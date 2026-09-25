import {
  checkProviderAvailability,
  findProvidersForAddress,
} from "../application/coverage";
import { listCoverageInventory } from "../application/coverage-inventory";
import type { CapabilityFailure } from "../application/result";
import type { AddressInput } from "../coverage/address";
import {
  getCoverageCheckerInterface,
  getCoverageCheckerInteraction,
} from "../coverage/store";
import { findSource } from "../sources/registry";

export interface CoverageRouteEnv {
  DATABASE?: Hyperdrive;
}

export interface CoverageRouteResult {
  status: number;
  body: Record<string, unknown>;
}

function structuredAddressInput(url: URL): AddressInput | null {
  const countryCode = url.searchParams.get("country_code");
  const city = url.searchParams.get("city");
  const street = url.searchParams.get("street");
  const houseNumber = url.searchParams.get("house_number");

  if (!countryCode || !city || !street || !houseNumber) {
    return null;
  }

  return {
    country_code: countryCode,
    region: url.searchParams.get("region"),
    city,
    district: url.searchParams.get("district"),
    street,
    house_number: houseNumber,
    corpus: url.searchParams.get("corpus"),
    building_letter: url.searchParams.get("building_letter"),
    postal_code: url.searchParams.get("postal_code"),
  };
}

function missingStructuredAddress(): CoverageRouteResult {
  return {
    status: 400,
    body: {
      error: "structured_address_required",
      required: [
        "country_code",
        "city",
        "street",
        "house_number",
      ],
    },
  };
}

function capabilityFailureResult(
  failure: CapabilityFailure,
): CoverageRouteResult {
  const status =
    failure.code === "coverage_schema_unavailable"
      ? 503
      : failure.code === "address_coverage_not_observed"
        ? 404
        : failure.code.startsWith("address_") ||
            failure.code === "freshness_invalid"
          ? 400
          : 500;

  return {
    status,
    body: {
      error: failure.code,
      ...(failure.details ?? {}),
    },
  };
}

export async function coverageRoute(
  request: Request,
  env: CoverageRouteEnv,
): Promise<CoverageRouteResult | null> {
  if (request.method !== "GET") return null;

  const url = new URL(request.url);
  const inventoryPath = url.pathname === "/api/v1/coverage/addresses";
  const aggregateAddress = url.pathname === "/api/v1/coverage/address";
  const checkerMatch = url.pathname.match(
    /^\/api\/v1\/coverage\/([a-z0-9-]+)\/checker-interface$/,
  );
  const interactionMatch = url.pathname.match(
    /^\/api\/v1\/coverage\/([a-z0-9-]+)\/checker-interaction$/,
  );
  const addressMatch = url.pathname.match(
    /^\/api\/v1\/coverage\/([a-z0-9-]+)\/address$/,
  );

  if (
    !inventoryPath &&
    !aggregateAddress &&
    !checkerMatch &&
    !interactionMatch &&
    !addressMatch
  ) {
    return null;
  }

  if (!env.DATABASE) {
    return {
      status: 503,
      body: { error: "database_binding_unavailable" },
    };
  }

  if (inventoryPath) {
    const result = await listCoverageInventory(
      env.DATABASE,
      url.searchParams.get("freshness"),
    );

    return result.ok
      ? { status: 200, body: result.value }
      : capabilityFailureResult(result);
  }

  if (aggregateAddress) {
    const input = structuredAddressInput(url);

    if (!input) {
      return missingStructuredAddress();
    }

    const result = await findProvidersForAddress(
      env.DATABASE,
      input,
    );

    return result.ok
      ? { status: 200, body: result.value }
      : capabilityFailureResult(result);
  }

  const providerSlug =
    (checkerMatch ?? interactionMatch ?? addressMatch)![1];

  if (addressMatch) {
    const input = structuredAddressInput(url);

    if (!input) {
      return missingStructuredAddress();
    }

    const result = await checkProviderAvailability(
      env.DATABASE,
      providerSlug,
      input,
    );

    return result.ok
      ? { status: 200, body: result.value }
      : capabilityFailureResult(result);
  }

  const source = findSource(`${providerSlug}-coverage`);
  if (!source || source.kind !== "address_checker") {
    return {
      status: 404,
      body: {
        error: "coverage_checker_not_registered",
        provider: providerSlug,
      },
    };
  }

  if (interactionMatch) {
    const interaction = await getCoverageCheckerInteraction(
      env.DATABASE,
      source.id,
    );

    if (!interaction) {
      return {
        status: 404,
        body: {
          error: "coverage_checker_interaction_not_found",
          provider: providerSlug,
        },
      };
    }

    return {
      status: 200,
      body: {
        provider: providerSlug,
        source: {
          id: source.id,
          slug: source.slug,
          kind: source.kind,
          canonical_url: source.canonical_url,
        },
        interaction,
      },
    };
  }

  const observation = await getCoverageCheckerInterface(
    env.DATABASE,
    source.id,
  );

  if (!observation) {
    return {
      status: 404,
      body: {
        error: "coverage_checker_probe_not_found",
        provider: providerSlug,
      },
    };
  }

  return {
    status: 200,
    body: {
      provider: checkerMatch![1],
      source: {
        id: source.id,
        slug: source.slug,
        kind: source.kind,
        canonical_url: source.canonical_url,
      },
      interface: observation,
    },
  };
}
