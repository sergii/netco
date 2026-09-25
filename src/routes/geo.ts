import { getDatabaseStatus } from "../db/status";
import { getAddressGeoPointProvenance } from "../geo/evidence";
import { getGeoEnrichmentBacklog } from "../geo/enrichment-backlog";
import {
  getCoveragePointFeatureCollection,
  type CoverageGeometryFilter,
} from "../geo/coverage-points";

export interface GeoRouteEnv {
  DATABASE?: Hyperdrive;
}

export interface GeoRouteResult {
  status: number;
  body: Record<string, unknown>;
}

export async function geoRoute(
  request: Request,
  env: GeoRouteEnv,
): Promise<GeoRouteResult | null> {
  if (request.method !== "GET") return null;

  const url = new URL(request.url);
  const coveragePoints =
    url.pathname === "/api/v1/geo/coverage-points";
  const enrichmentBacklog =
    url.pathname === "/api/v1/geo/enrichment-backlog";
  const provenanceMatch = url.pathname.match(
    /^\/api\/v1\/geo\/addresses\/([0-9a-f-]+)\/provenance$/,
  );

  if (!coveragePoints && !enrichmentBacklog && !provenanceMatch) {
    return null;
  }

  if (!env.DATABASE) {
    return {
      status: 503,
      body: { error: "database_binding_unavailable" },
    };
  }

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

  if (enrichmentBacklog) {
    return {
      status: 200,
      body: await getGeoEnrichmentBacklog(env.DATABASE),
    };
  }

  if (provenanceMatch) {
    const provenance = await getAddressGeoPointProvenance(
      env.DATABASE,
      provenanceMatch[1],
    );

    if (!provenance) {
      return {
        status: 404,
        body: {
          error: "geo_point_provenance_not_found",
          address_id: provenanceMatch[1],
        },
      };
    }

    return {
      status: 200,
      body: provenance,
    };
  }

  const requestedGeometry =
    url.searchParams.get("geometry") ?? "all";

  if (
    requestedGeometry !== "all" &&
    requestedGeometry !== "present" &&
    requestedGeometry !== "missing"
  ) {
    return {
      status: 400,
      body: {
        error: "geometry_filter_invalid",
        allowed: ["all", "present", "missing"],
      },
    };
  }

  return {
    status: 200,
    body: await getCoveragePointFeatureCollection(
      env.DATABASE,
      requestedGeometry as CoverageGeometryFilter,
    ),
  };
}
