import { findSource } from "../sources/registry";
import {
  getCoverageCheckerInterface,
  getCoverageCheckerInteraction,
} from "../coverage/store";
import { normalizeAddress } from "../coverage/address";
import {
  getAddressAvailability,
  getAllAddressAvailability,
} from "../coverage/orderability";
import { getDatabaseStatus } from "../db/status";

export interface CoverageRouteEnv {
  DATABASE?: Hyperdrive;
}

export interface CoverageRouteResult {
  status: number;
  body: Record<string, unknown>;
}

export async function coverageRoute(
  request: Request,
  env: CoverageRouteEnv,
): Promise<CoverageRouteResult | null> {
  if (request.method !== "GET") return null;

  const url = new URL(request.url);
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

  if (!aggregateAddress && !checkerMatch && !interactionMatch && !addressMatch) return null;

  if (!env.DATABASE) {
    return {
      status: 503,
      body: { error: "database_binding_unavailable" },
    };
  }

  if (aggregateAddress) {
    const status = await getDatabaseStatus(env.DATABASE);
    if (!status.coverage_schema_ready) {
      return {
        status: 503,
        body: {
          error: "coverage_schema_unavailable",
          coverage_tables: status.coverage_tables,
        },
      };
    }

    const countryCode = url.searchParams.get("country_code");
    const city = url.searchParams.get("city");
    const street = url.searchParams.get("street");
    const houseNumber = url.searchParams.get("house_number");

    if (!countryCode || !city || !street || !houseNumber) {
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

    let normalized;
    try {
      normalized = normalizeAddress({
        country_code: countryCode,
        region: url.searchParams.get("region"),
        city,
        district: url.searchParams.get("district"),
        street,
        house_number: houseNumber,
        corpus: url.searchParams.get("corpus"),
        building_letter: url.searchParams.get("building_letter"),
        postal_code: url.searchParams.get("postal_code"),
      });
    } catch (error) {
      return {
        status: 400,
        body: {
          error:
            error instanceof Error
              ? error.message
              : "address_invalid",
        },
      };
    }

    const availability = await getAllAddressAvailability(
      env.DATABASE,
      normalized.normalized_key,
    );

    return {
      status: 200,
      body: {
        query: {
          normalized_key: normalized.normalized_key,
          display: normalized.display,
        },
        ...availability,
      },
    };
  }

  const providerSlug =
    (checkerMatch ?? interactionMatch ?? addressMatch)![1];

  if (addressMatch) {
    const status = await getDatabaseStatus(env.DATABASE);
    if (!status.coverage_schema_ready) {
      return {
        status: 503,
        body: {
          error: "coverage_schema_unavailable",
          coverage_tables: status.coverage_tables,
        },
      };
    }

    const countryCode = url.searchParams.get("country_code");
    const city = url.searchParams.get("city");
    const street = url.searchParams.get("street");
    const houseNumber = url.searchParams.get("house_number");

    if (!countryCode || !city || !street || !houseNumber) {
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

    let normalized;
    try {
      normalized = normalizeAddress({
        country_code: countryCode,
        region: url.searchParams.get("region"),
        city,
        district: url.searchParams.get("district"),
        street,
        house_number: houseNumber,
        corpus: url.searchParams.get("corpus"),
        building_letter: url.searchParams.get("building_letter"),
        postal_code: url.searchParams.get("postal_code"),
      });
    } catch (error) {
      return {
        status: 400,
        body: {
          error:
            error instanceof Error
              ? error.message
              : "address_invalid",
        },
      };
    }

    const availability = await getAddressAvailability(
      env.DATABASE,
      providerSlug,
      normalized.normalized_key,
    );

    if (!availability) {
      return {
        status: 404,
        body: {
          error: "address_coverage_not_observed",
          provider: providerSlug,
          address: {
            normalized_key: normalized.normalized_key,
            display: normalized.display,
          },
        },
      };
    }

    return {
      status: 200,
      body: availability,
    };
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
      provider: (checkerMatch ?? addressMatch)![1],
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
