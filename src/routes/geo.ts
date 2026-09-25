import { getDatabaseStatus } from "../db/status";
import { getGeoEnrichmentBacklog } from "../geo/enrichment-backlog";
import {
  getAddressGeoProvenance,
  materializeVs11TrustedGeoFixture,
} from "../geo/vs11-proof";
import {
  getCoveragePointFeatureCollection,
  type CoverageGeometryFilter,
} from "../geo/coverage-points";

export interface GeoRouteEnv {
  DATABASE?: Hyperdrive;
  SNAPSHOTS?: R2Bucket;
}

export interface GeoRouteResult {
  status: number;
  body: Record<string, unknown>;
}

export async function geoRoute(
  request: Request,
  env: GeoRouteEnv,
): Promise<GeoRouteResult | null> {
  const url = new URL(request.url);
  const vs11Ingest =
    request.method === "POST" &&
    url.pathname ===
      "/__internal/vs11/4c0de5da-9c91-4a30-93b8-04a893f7713f";
  const provenanceMatch =
    request.method === "GET"
      ? url.pathname.match(
          /^\/api\/v1\/geo\/addresses\/([0-9a-f-]+)\/provenance$/,
        )
      : null;

  if (
    request.method !== "GET" &&
    !vs11Ingest
  ) {
    return null;
  }
  const coveragePoints =
    url.pathname === "/api/v1/geo/coverage-points";
  const enrichmentBacklog =
    url.pathname === "/api/v1/geo/enrichment-backlog";

  if (
    !coveragePoints &&
    !enrichmentBacklog &&
    !provenanceMatch &&
    !vs11Ingest
  ) {
    return null;
  }

  if (!env.DATABASE) {
    return {
      status: 503,
      body: { error: "database_binding_unavailable" },
    };
  }

  if (vs11Ingest) {
    if (!env.SNAPSHOTS) {
      return {
        status: 503,
        body: { error: "snapshot_binding_unavailable" },
      };
    }

    const proof = await materializeVs11TrustedGeoFixture(
      env.SNAPSHOTS,
      env.DATABASE,
    );

    return {
      status: 200,
      body: { ...proof },
    };
  }

  if (provenanceMatch) {
    const provenance = await getAddressGeoProvenance(
      env.DATABASE,
      provenanceMatch[1],
    );

    return provenance
      ? { status: 200, body: provenance }
      : {
          status: 404,
          body: {
            error: "geo_provenance_not_found",
            address_id: provenanceMatch[1],
          },
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
