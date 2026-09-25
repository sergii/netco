import { getDatabaseStatus } from "../db/status";
import { getGeoEnrichmentBacklog } from "../geo/enrichment-backlog";
import { getAddressGeoProvenance } from "../geo/provenance";
import {
  getCoveragePointFeatureCollection,
  type CoverageGeometryFilter,
  type CoverageViewport,
} from "../geo/coverage-points";
import { getCoverageH3CellFeatureCollection } from "../geo/h3-cells";

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

  const viewportNames = ["west", "south", "east", "north"] as const;
  const viewportValues = viewportNames.map((name) =>
    url.searchParams.get(name),
  );
  const suppliedViewportValues = viewportValues.filter(
    (value) => value !== null,
  );

  let viewport: CoverageViewport | null = null;

  if (suppliedViewportValues.length > 0) {
    if (suppliedViewportValues.length !== viewportNames.length) {
      return {
        status: 400,
        body: {
          error: "viewport_incomplete",
          required: [...viewportNames],
        },
      };
    }

    const [west, south, east, north] = viewportValues.map(
      (value) => Number(value),
    );

    if (
      !Number.isFinite(west) ||
      !Number.isFinite(south) ||
      !Number.isFinite(east) ||
      !Number.isFinite(north) ||
      west < -180 ||
      west > 180 ||
      east < -180 ||
      east > 180 ||
      south < -90 ||
      south > 90 ||
      north < -90 ||
      north > 90 ||
      west >= east ||
      south >= north
    ) {
      return {
        status: 400,
        body: {
          error: "viewport_invalid",
        },
      };
    }

    viewport = { west, south, east, north };
  }

  if (h3Cells) {
    const rawResolution = url.searchParams.get("resolution");
    const resolution = Number(rawResolution);

    if (
      rawResolution === null ||
      !Number.isInteger(resolution) ||
      resolution < 0 ||
      resolution > 15
    ) {
      return {
        status: 400,
        body: {
          error: "h3_resolution_invalid",
          allowed: {
            minimum: 0,
            maximum: 15,
          },
        },
      };
    }

    return {
      status: 200,
      body: await getCoverageH3CellFeatureCollection(
        env.DATABASE,
        resolution,
        viewport,
      ),
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

  if (viewport && requestedGeometry === "missing") {
    return {
      status: 400,
      body: {
        error: "viewport_requires_geometry",
        allowed_geometry: ["all", "present"],
      },
    };
  }

  return {
    status: 200,
    body: await getCoveragePointFeatureCollection(
      env.DATABASE,
      requestedGeometry as CoverageGeometryFilter,
      viewport,
    ),
  };
}
