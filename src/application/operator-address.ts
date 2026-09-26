import { getDatabaseStatus } from "../db/status";
import { withPostgresClient } from "../db/postgres";
import { getAllAddressAvailability } from "../coverage/orderability";
import { getAddressGeoProvenance } from "../geo/provenance";
import {
  capabilityFailure,
  capabilityOk,
  type CapabilityResult,
} from "./result";

interface AddressRow {
  id: string;
  country_code: string;
  region: string | null;
  city: string;
  district: string | null;
  street: string;
  house_number: string;
  corpus: string | null;
  building_letter: string | null;
  postal_code: string | null;
  normalized_key: string;
  latitude: string | number | null;
  longitude: string | number | null;
}

interface CoverageEvidenceRow {
  claim_id: string;
  predicate: string;
  observed_at: Date | string;
  observation_id: string;
  schema_name: string;
  validation_status: string;
  snapshot_id: string;
  body_ref: string;
  content_hash: string;
  source_id: string;
  source_name: string;
  source_url: string | null;
}

interface AvailabilityEntry {
  technology?: unknown;
  observed_at?: unknown;
  fresh_until?: unknown;
  supporting_claim_id?: unknown;
}

interface ProviderEntry {
  provider_id?: unknown;
  slug?: unknown;
  display_name?: unknown;
  availability?: unknown;
}

function providerEntries(value: unknown): ProviderEntry[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is ProviderEntry =>
          typeof entry === "object" && entry !== null,
      )
    : [];
}

function availabilityEntries(provider: ProviderEntry): AvailabilityEntry[] {
  return Array.isArray(provider.availability)
    ? provider.availability.filter(
        (entry): entry is AvailabilityEntry =>
          typeof entry === "object" && entry !== null,
      )
    : [];
}

function textValues(values: unknown[]): string[] {
  return [
    ...new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      ),
    ),
  ].sort();
}

async function findAddress(
  database: Hyperdrive,
  addressId: string,
): Promise<AddressRow | null> {
  return withPostgresClient(database, async (client) => {
    const result = await client.query<AddressRow>(
      `
        SELECT
          id,
          country_code,
          region,
          city,
          district,
          street,
          house_number,
          corpus,
          building_letter,
          postal_code,
          normalized_key,
          latitude,
          longitude
        FROM addresses
        WHERE id = $1
        LIMIT 1
      `,
      [addressId],
    );

    return result.rows[0] ?? null;
  });
}

async function getCoverageEvidenceTrail(
  database: Hyperdrive,
  claimIds: string[],
): Promise<Array<Record<string, unknown>>> {
  if (claimIds.length === 0) return [];

  return withPostgresClient(database, async (client) => {
    const result = await client.query<CoverageEvidenceRow>(
      `
        SELECT
          c.id AS claim_id,
          c.predicate,
          c.observed_at,
          o.id AS observation_id,
          o.schema_name,
          o.validation_status,
          ss.id AS snapshot_id,
          ss.body_ref,
          ss.content_hash,
          s.id AS source_id,
          s.name AS source_name,
          s.canonical_url AS source_url
        FROM claims c
        JOIN observations o
          ON o.id = c.observation_id
        JOIN source_snapshots ss
          ON ss.id = c.source_snapshot_id
        JOIN sources s
          ON s.id = c.source_id
        WHERE c.id = ANY($1::uuid[])
        ORDER BY c.observed_at DESC, c.id
      `,
      [claimIds],
    );

    return result.rows.map((row) => ({
      claim: {
        id: row.claim_id,
        predicate: row.predicate,
        observed_at: new Date(row.observed_at).toISOString(),
      },
      observation: {
        id: row.observation_id,
        schema_name: row.schema_name,
        validation_status: row.validation_status,
      },
      snapshot: {
        id: row.snapshot_id,
        body_ref: row.body_ref,
        content_hash: row.content_hash,
      },
      source: {
        id: row.source_id,
        name: row.source_name,
        canonical_url: row.source_url,
      },
    }));
  });
}

export async function getOperatorAddressWorkspace(
  database: Hyperdrive,
  addressId: string,
): Promise<CapabilityResult<Record<string, unknown>>> {
  const status = await getDatabaseStatus(database);

  if (!status.coverage_schema_ready) {
    return capabilityFailure("coverage_schema_unavailable", {
      coverage_tables: status.coverage_tables,
    });
  }

  const address = await findAddress(database, addressId);
  if (!address) {
    return capabilityFailure("operator_address_not_found", {
      address_id: addressId,
    });
  }

  const [coverage, geoProvenance] = await Promise.all([
    getAllAddressAvailability(database, address.normalized_key),
    getAddressGeoProvenance(database, address.id),
  ]);

  const providers = providerEntries(coverage.providers);
  const availability = providers.flatMap(availabilityEntries);
  const now = Date.now();

  const technologies = textValues(
    availability.map((entry) => entry.technology),
  );
  const claimIds = textValues(
    availability.map((entry) => entry.supporting_claim_id),
  );

  const observedTimes = availability
    .map((entry) =>
      typeof entry.observed_at === "string"
        ? new Date(entry.observed_at).getTime()
        : Number.NaN,
    )
    .filter(Number.isFinite);

  const freshRows = availability.filter((entry) => {
    if (typeof entry.fresh_until !== "string") return false;
    const timestamp = new Date(entry.fresh_until).getTime();
    return Number.isFinite(timestamp) && timestamp > now;
  });

  const freshnessState =
    availability.length === 0
      ? "unknown"
      : freshRows.length > 0
        ? "fresh"
        : "stale";

  const coverageEvidence = await getCoverageEvidenceTrail(
    database,
    claimIds,
  );

  const latitude =
    address.latitude === null ? null : Number(address.latitude);
  const longitude =
    address.longitude === null ? null : Number(address.longitude);
  const hasGeometry =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  const qualityFlags: string[] = [];
  if (!hasGeometry) qualityFlags.push("geometry_missing");
  if (providers.length === 0) qualityFlags.push("coverage_missing");
  if (freshnessState === "stale") qualityFlags.push("coverage_stale");
  if (!geoProvenance) qualityFlags.push("geo_provenance_missing");

  return capabilityOk({
    address: {
      id: address.id,
      country_code: address.country_code,
      region: address.region,
      city: address.city,
      district: address.district,
      street: address.street,
      house_number: address.house_number,
      corpus: address.corpus,
      building_letter: address.building_letter,
      postal_code: address.postal_code,
      normalized_key: address.normalized_key,
    },
    map: {
      geometry_state: hasGeometry ? "present" : "missing",
      latitude: hasGeometry ? latitude : null,
      longitude: hasGeometry ? longitude : null,
    },
    coverage: {
      provider_count: providers.length,
      availability_count: availability.length,
      technologies,
      freshness_state: freshnessState,
      latest_observed_at:
        observedTimes.length > 0
          ? new Date(Math.max(...observedTimes)).toISOString()
          : null,
      providers,
    },
    supporting_claim_ids: claimIds,
    evidence: {
      coverage: coverageEvidence,
      geo: geoProvenance,
    },
    data_quality: {
      status: qualityFlags.length === 0 ? "ok" : "needs_attention",
      flags: qualityFlags,
    },
    operator: {
      notes: null,
      notes_state: "placeholder",
    },
  });
}
