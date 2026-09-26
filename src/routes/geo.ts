import {
  getAddressGeoEvidence,
  listCoveragePoints,
  listGeoEnrichmentBacklog,
  listH3CoverageCells,
  type CoveragePointsQuery,
  type H3CellsQuery,
  type ViewportQuery,
} from "../application/geo";
import type { CapabilityFailure } from "../application/result";

export interface GeoRouteEnv {
  DATABASE?: Hyperdrive;
}

export interface GeoRouteResult {
  status: number;
  body: Record<string, unknown>;
}

function failureResult(
  failure: CapabilityFailure,
): GeoRouteResult {
  const status =
    failure.code === "geo_provenance_not_found"
      ? 404
      : failure.code === "coverage_schema_unavailable"
        ? 503
        : failure.code.startsWith("viewport_") ||
            failure.code.startsWith("h3_") ||
            failure.code === "geometry_filter_invalid"
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

function viewportQuery(url: URL): ViewportQuery["viewport"] {
  const viewportNames = ["west", "south", "east", "north"] as const;
  const viewport: NonNullable<ViewportQuery["viewport"]> = {};
  let hasViewport = false;

  for (const name of viewportNames) {
    const value = url.searchParams.get(name);
    if (value !== null) {
      viewport[name] = Number(value);
      hasViewport = true;
    }
  }

  return hasViewport ? viewport : null;
}

function coveragePointsQuery(url: URL): CoveragePointsQuery {
  return {
    geometry: url.searchParams.get("geometry"),
    viewport: viewportQuery(url),
  };
}

function h3CellsQuery(url: URL): H3CellsQuery {
  const resolution = url.searchParams.get("resolution");

  return {
    resolution: resolution === null ? null : Number(resolution),
    viewport: viewportQuery(url),
  };
}

export async function geoRoute(
  request: Request,
  env: GeoRouteEnv,
): Promise<GeoRouteResult | null> {
  const url = new URL(request.url);
  const provenanceMatch =
    request.method === "GET"
      ? url.pathname.match(
          /^\/api\/v1\/geo\/addresses\/([0-9a-f-]+)\/provenance$/,
        )
      : null;

  if (request.method !== "GET") return null;

  const coveragePoints =
    url.pathname === "/api/v1/geo/coverage-points";
  const h3Cells =
    url.pathname === "/api/v1/geo/h3-cells";
  const enrichmentBacklog =
    url.pathname === "/api/v1/geo/enrichment-backlog";

  if (
    !coveragePoints &&
    !h3Cells &&
    !enrichmentBacklog &&
    !provenanceMatch
  ) {
    return null;
  }

  if (!env.DATABASE) {
    return {
      status: 503,
      body: { error: "database_binding_unavailable" },
    };
  }

  if (provenanceMatch) {
    const result = await getAddressGeoEvidence(
      env.DATABASE,
      provenanceMatch[1],
    );

    return result.ok
      ? { status: 200, body: result.value }
      : failureResult(result);
  }

  if (enrichmentBacklog) {
    const result = await listGeoEnrichmentBacklog(env.DATABASE);

    return result.ok
      ? { status: 200, body: result.value }
      : failureResult(result);
  }

  if (h3Cells) {
    const result = await listH3CoverageCells(
      env.DATABASE,
      h3CellsQuery(url),
    );

    return result.ok
      ? { status: 200, body: result.value }
      : failureResult(result);
  }

  const result = await listCoveragePoints(
    env.DATABASE,
    coveragePointsQuery(url),
  );

  return result.ok
    ? { status: 200, body: result.value }
    : failureResult(result);
}
