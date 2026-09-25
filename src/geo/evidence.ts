import { withPostgresClient } from "../db/postgres";

const ACQUISITION_METHODS = new Set([
  "official_dataset",
  "open_dataset",
  "approved_geocoder",
  "operator_verified",
  "imported",
]);

const GRANULARITIES = new Set([
  "address",
  "building",
  "parcel",
  "centroid",
  "unknown",
]);

export interface GeoPointObservationPayload {
  schema_version: "geo-point-observation.v1";
  address_id: string;
  latitude: number;
  longitude: number;
  acquisition_method:
    | "official_dataset"
    | "open_dataset"
    | "approved_geocoder"
    | "operator_verified"
    | "imported";
  granularity:
    | "address"
    | "building"
    | "parcel"
    | "centroid"
    | "unknown";
  precision_meters: number | null;
  source_reference: string | null;
  observed_at: string;
}

export interface GeoPointClaimValue {
  latitude: number;
  longitude: number;
  acquisition_method: GeoPointObservationPayload["acquisition_method"];
  granularity: GeoPointObservationPayload["granularity"];
  precision_meters: number | null;
  source_reference: string | null;
}

export interface GeoPointMaterializationResult {
  status:
    | "materialized"
    | "address_not_found"
    | "evidence_not_found"
    | "evidence_invalid";
  address_id: string;
  latitude: number | null;
  longitude: number | null;
  claim_id: string | null;
  observation_id: string | null;
  source_id: string | null;
  source_snapshot_id: string | null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

export function validateGeoPointObservationPayload(
  value: unknown,
): GeoPointObservationPayload | null {
  const payload = asObject(value);
  if (!payload) return null;

  if (payload.schema_version !== "geo-point-observation.v1") {
    return null;
  }

  if (
    typeof payload.address_id !== "string" ||
    payload.address_id.length === 0
  ) {
    return null;
  }

  const latitude = finiteNumber(payload.latitude);
  const longitude = finiteNumber(payload.longitude);

  if (
    latitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude === null ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  if (
    typeof payload.acquisition_method !== "string" ||
    !ACQUISITION_METHODS.has(payload.acquisition_method)
  ) {
    return null;
  }

  if (
    typeof payload.granularity !== "string" ||
    !GRANULARITIES.has(payload.granularity)
  ) {
    return null;
  }

  if (
    payload.precision_meters !== null &&
    (finiteNumber(payload.precision_meters) === null ||
      Number(payload.precision_meters) < 0)
  ) {
    return null;
  }

  if (
    payload.source_reference !== null &&
    typeof payload.source_reference !== "string"
  ) {
    return null;
  }

  if (
    typeof payload.observed_at !== "string" ||
    Number.isNaN(Date.parse(payload.observed_at))
  ) {
    return null;
  }

  return payload as unknown as GeoPointObservationPayload;
}

function validateClaimValue(
  value: unknown,
  payload: GeoPointObservationPayload,
): GeoPointClaimValue | null {
  const claim = asObject(value);
  if (!claim) return null;

  const latitude = finiteNumber(claim.latitude);
  const longitude = finiteNumber(claim.longitude);

  if (
    latitude === null ||
    longitude === null ||
    latitude !== payload.latitude ||
    longitude !== payload.longitude
  ) {
    return null;
  }

  if (
    claim.acquisition_method !== payload.acquisition_method ||
    claim.granularity !== payload.granularity ||
    claim.precision_meters !== payload.precision_meters ||
    claim.source_reference !== payload.source_reference
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    acquisition_method: payload.acquisition_method,
    granularity: payload.granularity,
    precision_meters: payload.precision_meters,
    source_reference: payload.source_reference,
  };
}

export async function materializeAddressGeoPoint(
  database: Hyperdrive,
  addressId: string,
): Promise<GeoPointMaterializationResult> {
  return withPostgresClient(database, async (client) => {
    await client.query("BEGIN");

    try {
      const address = await client.query<{ id: string }>(
        `
          SELECT id
          FROM addresses
          WHERE id = $1
          LIMIT 1
          FOR UPDATE
        `,
        [addressId],
      );

      if (!address.rows[0]) {
        await client.query("COMMIT");
        return {
          status: "address_not_found",
          address_id: addressId,
          latitude: null,
          longitude: null,
          claim_id: null,
          observation_id: null,
          source_id: null,
          source_snapshot_id: null,
        };
      }

      const evidence = await client.query<{
        claim_id: string;
        claim_value: unknown;
        source_id: string;
        source_snapshot_id: string;
        observation_id: string;
        observation_payload: unknown;
      }>(
        `
          SELECT
            c.id AS claim_id,
            c.value AS claim_value,
            c.source_id,
            c.source_snapshot_id,
            o.id AS observation_id,
            o.payload AS observation_payload
          FROM claims c
          JOIN observations o
            ON o.id = c.observation_id
          WHERE c.subject_id = $1
            AND c.predicate = 'geo.point'
            AND c.status = 'asserted'
            AND o.schema_name = 'geo-point-observation'
            AND o.schema_version = '1'
            AND o.validation_status = 'valid'
          ORDER BY
            c.observed_at DESC,
            c.created_at DESC,
            c.id DESC
          LIMIT 1
        `,
        [addressId],
      );

      const row = evidence.rows[0];

      if (!row) {
        await client.query("COMMIT");
        return {
          status: "evidence_not_found",
          address_id: addressId,
          latitude: null,
          longitude: null,
          claim_id: null,
          observation_id: null,
          source_id: null,
          source_snapshot_id: null,
        };
      }

      const payload = validateGeoPointObservationPayload(
        row.observation_payload,
      );

      if (!payload || payload.address_id !== addressId) {
        await client.query("ROLLBACK");
        return {
          status: "evidence_invalid",
          address_id: addressId,
          latitude: null,
          longitude: null,
          claim_id: row.claim_id,
          observation_id: row.observation_id,
          source_id: row.source_id,
          source_snapshot_id: row.source_snapshot_id,
        };
      }

      const claim = validateClaimValue(row.claim_value, payload);

      if (!claim) {
        await client.query("ROLLBACK");
        return {
          status: "evidence_invalid",
          address_id: addressId,
          latitude: null,
          longitude: null,
          claim_id: row.claim_id,
          observation_id: row.observation_id,
          source_id: row.source_id,
          source_snapshot_id: row.source_snapshot_id,
        };
      }

      await client.query(
        `
          UPDATE addresses
          SET
            latitude = $2,
            longitude = $3
          WHERE id = $1
        `,
        [addressId, claim.latitude, claim.longitude],
      );

      await client.query("COMMIT");

      return {
        status: "materialized",
        address_id: addressId,
        latitude: claim.latitude,
        longitude: claim.longitude,
        claim_id: row.claim_id,
        observation_id: row.observation_id,
        source_id: row.source_id,
        source_snapshot_id: row.source_snapshot_id,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}


export interface GeoPointBatchMaterializationResult {
  candidates: number;
  materialized: number;
  invalid: number;
}

export async function materializePendingAddressGeoPoints(
  database: Hyperdrive,
  limit = 100,
): Promise<GeoPointBatchMaterializationResult> {
  const addressIds = await withPostgresClient(
    database,
    async (client) => {
      const result = await client.query<{ address_id: string }>(
        `
          SELECT DISTINCT c.subject_id AS address_id
          FROM claims c
          JOIN observations o
            ON o.id = c.observation_id
          JOIN addresses a
            ON a.id = c.subject_id
          WHERE c.predicate = 'geo.point'
            AND c.status = 'asserted'
            AND o.schema_name = 'geo-point-observation'
            AND o.schema_version = '1'
            AND o.validation_status = 'valid'
          ORDER BY c.subject_id
          LIMIT $1
        `,
        [limit],
      );

      return result.rows.map((row) => row.address_id);
    },
  );

  let materialized = 0;
  let invalid = 0;

  for (const addressId of addressIds) {
    const result = await materializeAddressGeoPoint(
      database,
      addressId,
    );

    if (result.status === "materialized") {
      materialized += 1;
    } else if (result.status === "evidence_invalid") {
      invalid += 1;
    }
  }

  return {
    candidates: addressIds.length,
    materialized,
    invalid,
  };
}


export async function getAddressGeoPointProvenance(
  database: Hyperdrive,
  addressId: string,
): Promise<Record<string, unknown> | null> {
  return withPostgresClient(database, async (client) => {
    const result = await client.query<{
      claim_id: string;
      claim_value: unknown;
      claim_observed_at: Date | string;
      claim_metadata: unknown;
      observation_id: string;
      observation_schema_name: string;
      observation_schema_version: string;
      observation_extracted_at: Date | string;
      observation_payload: unknown;
      source_snapshot_id: string;
      snapshot_url: string;
      snapshot_fetched_at: Date | string;
      snapshot_content_hash: string;
      snapshot_body_ref: string;
      snapshot_fetch_metadata: unknown;
      source_id: string;
      source_kind: string;
      source_name: string;
      source_canonical_url: string | null;
      source_metadata: unknown;
    }>(
      `
        SELECT
          c.id AS claim_id,
          c.value AS claim_value,
          c.observed_at AS claim_observed_at,
          c.metadata AS claim_metadata,
          o.id AS observation_id,
          o.schema_name AS observation_schema_name,
          o.schema_version AS observation_schema_version,
          o.extracted_at AS observation_extracted_at,
          o.payload AS observation_payload,
          ss.id AS source_snapshot_id,
          ss.url AS snapshot_url,
          ss.fetched_at AS snapshot_fetched_at,
          ss.content_hash AS snapshot_content_hash,
          ss.body_ref AS snapshot_body_ref,
          ss.fetch_metadata AS snapshot_fetch_metadata,
          s.id AS source_id,
          s.kind AS source_kind,
          s.name AS source_name,
          s.canonical_url AS source_canonical_url,
          s.metadata AS source_metadata
        FROM claims c
        JOIN observations o
          ON o.id = c.observation_id
        JOIN source_snapshots ss
          ON ss.id = c.source_snapshot_id
        JOIN sources s
          ON s.id = c.source_id
        WHERE c.subject_id = $1
          AND c.predicate = 'geo.point'
          AND c.status = 'asserted'
          AND o.schema_name = 'geo-point-observation'
          AND o.validation_status = 'valid'
        ORDER BY
          c.observed_at DESC,
          c.created_at DESC,
          c.id DESC
        LIMIT 1
      `,
      [addressId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      address_id: addressId,
      claim: {
        id: row.claim_id,
        value: row.claim_value,
        observed_at: new Date(
          row.claim_observed_at,
        ).toISOString(),
        metadata: row.claim_metadata,
      },
      observation: {
        id: row.observation_id,
        schema_name: row.observation_schema_name,
        schema_version: row.observation_schema_version,
        extracted_at: new Date(
          row.observation_extracted_at,
        ).toISOString(),
        payload: row.observation_payload,
      },
      snapshot: {
        id: row.source_snapshot_id,
        url: row.snapshot_url,
        fetched_at: new Date(
          row.snapshot_fetched_at,
        ).toISOString(),
        content_hash: row.snapshot_content_hash,
        body_ref: row.snapshot_body_ref,
        fetch_metadata: row.snapshot_fetch_metadata,
      },
      source: {
        id: row.source_id,
        kind: row.source_kind,
        name: row.source_name,
        canonical_url: row.source_canonical_url,
        metadata: row.source_metadata,
      },
    };
  });
}
