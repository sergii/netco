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
