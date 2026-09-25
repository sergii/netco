import { findSource } from "../sources/registry";
import { getCoverageCheckerInterface } from "../coverage/store";

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
  const match = url.pathname.match(
    /^\/api\/v1\/coverage\/([a-z0-9-]+)\/checker-interface$/,
  );

  if (!match) return null;

  if (!env.DATABASE) {
    return {
      status: 503,
      body: { error: "database_binding_unavailable" },
    };
  }

  const source = findSource(`${match[1]}-coverage`);
  if (!source || source.kind !== "address_checker") {
    return {
      status: 404,
      body: {
        error: "coverage_checker_not_registered",
        provider: match[1],
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
        provider: match[1],
      },
    };
  }

  return {
    status: 200,
    body: {
      provider: match[1],
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
