import { getDatabaseStatus } from "../db/status";
import {
  getCoveragePointFeatureCollection,
  type CoverageGeometryFilter,
  type CoverageViewport,
} from "../geo/coverage-points";
import { getGeoEnrichmentBacklog } from "../geo/enrichment-backlog";
import { getAddressGeoProvenance } from "../geo/provenance";
import {
  capabilityFailure,
  capabilityOk,
  type CapabilityResult,
} from "./result";

const VIEWPORT_NAMES = ["west", "south", "east", "north"] as const;

export interface CoveragePointsQuery {
  geometry?: string | null;
  viewport?: {
    west?: number;
    south?: number;
    east?: number;
    north?: number;
  } | null;
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

  let viewport: CoverageViewport | null = null;

  if (query.viewport) {
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
    } = query.viewport as Required<NonNullable<CoveragePointsQuery["viewport"]>>;

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

    viewport = { west, south, east, north };
  }

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
