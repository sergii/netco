import { getDatabaseStatus } from "../db/status";
import {
  getCoveragePointFeatureCollection,
  type CoverageGeometryFilter,
  type CoverageViewport,
} from "../geo/coverage-points";
import { getGeoEnrichmentBacklog } from "../geo/enrichment-backlog";
import { getH3CoverageCellFeatureCollection } from "../geo/h3-cells";
import { getAddressGeoProvenance } from "../geo/provenance";
import {
  capabilityFailure,
  capabilityOk,
  type CapabilityResult,
} from "./result";

const VIEWPORT_NAMES = ["west", "south", "east", "north"] as const;

export interface ViewportQuery {
  viewport?: {
    west?: number;
    south?: number;
    east?: number;
    north?: number;
  } | null;
}

export interface CoveragePointsQuery extends ViewportQuery {
  geometry?: string | null;
}

export interface H3CellsQuery extends ViewportQuery {
  resolution?: number | null;
}

async function requireCoverageSchema(
  database: Hyperdrive,
): Promise<CapabilityResult<true>> {
  const status = await getDatabaseStatus(database);

  if (!status.coverage_schema_ready) {
    return capabilityFailure("coverage_schema_unavailable", {
      coverage_tables: status.coverage_tables,
    });
  }

  return capabilityOk(true);
}

function validateViewport(
  query: ViewportQuery,
): CapabilityResult<CoverageViewport | null> {
  if (!query.viewport) {
    return capabilityOk(null);
  }

  const supplied = VIEWPORT_NAMES.filter(
    (name) => query.viewport?.[name] !== undefined,
  );

  if (supplied.length !== VIEWPORT_NAMES.length) {
    return capabilityFailure("viewport_incomplete", {
      required: [...VIEWPORT_NAMES],
    });
  }

  const {
    west,
    south,
    east,
    north,
  } = query.viewport as Required<NonNullable<ViewportQuery["viewport"]>>;

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
    return capabilityFailure("viewport_invalid");
  }

  return capabilityOk({ west, south, east, north });
}

export async function getAddressGeoEvidence(
  database: Hyperdrive,
  addressId: string,
): Promise<CapabilityResult<Record<string, unknown>>> {
  const provenance = await getAddressGeoProvenance(
    database,
    addressId,
  );

  if (!provenance) {
    return capabilityFailure("geo_provenance_not_found", {
      address_id: addressId,
    });
  }

  return capabilityOk(provenance);
}

export async function listGeoEnrichmentBacklog(
  database: Hyperdrive,
): Promise<CapabilityResult<Record<string, unknown>>> {
  const readiness = await requireCoverageSchema(database);
  if (!readiness.ok) return readiness;

  return capabilityOk(
    await getGeoEnrichmentBacklog(database),
  );
}

export async function listCoveragePoints(
  database: Hyperdrive,
  query: CoveragePointsQuery,
): Promise<CapabilityResult<Record<string, unknown>>> {
  const readiness = await requireCoverageSchema(database);
  if (!readiness.ok) return readiness;

  const geometry = query.geometry ?? "all";

  if (
    geometry !== "all" &&
    geometry !== "present" &&
    geometry !== "missing"
  ) {
    return capabilityFailure("geometry_filter_invalid", {
      allowed: ["all", "present", "missing"],
    });
  }

  const viewportResult = validateViewport(query);
  if (!viewportResult.ok) return viewportResult;
  const viewport = viewportResult.value;

  if (viewport && geometry === "missing") {
    return capabilityFailure("viewport_requires_geometry", {
      allowed_geometry: ["all", "present"],
    });
  }

  return capabilityOk(
    await getCoveragePointFeatureCollection(
      database,
      geometry as CoverageGeometryFilter,
      viewport,
    ),
  );
}

export async function listH3CoverageCells(
  database: Hyperdrive,
  query: H3CellsQuery,
): Promise<CapabilityResult<Record<string, unknown>>> {
  const readiness = await requireCoverageSchema(database);
  if (!readiness.ok) return readiness;

  if (query.resolution === null || query.resolution === undefined) {
    return capabilityFailure("h3_resolution_required", {
      minimum: 0,
      maximum: 15,
    });
  }

  if (
    !Number.isInteger(query.resolution) ||
    query.resolution < 0 ||
    query.resolution > 15
  ) {
    return capabilityFailure("h3_resolution_invalid", {
      minimum: 0,
      maximum: 15,
    });
  }

  const viewportResult = validateViewport(query);
  if (!viewportResult.ok) return viewportResult;

  return capabilityOk(
    await getH3CoverageCellFeatureCollection(
      database,
      query.resolution,
      viewportResult.value,
    ),
  );
}
