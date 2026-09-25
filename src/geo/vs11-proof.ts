import { findAddress } from "../coverage/address";
import { withPostgresClient } from "../db/postgres";
import { captureArtifactSnapshot } from "../evidence/snapshot";
import { materializeAddressGeoPoint } from "./evidence";

const SOURCE_ID = "7d9e1c5d-bb74-4e80-a499-3df34d59e9f4";
const SOURCE_URL = "https://nominatim.openstreetmap.org/search";
const SOURCE_REFERENCE = "https://www.openstreetmap.org/way/344896684";
const OBSERVED_AT = "2026-09-25T17:56:38.155Z";

const FIXTURE_BODY = JSON.stringify([
  {
    place_id: 192054527,
    osm_type: "way",
    osm_id: 344896684,
    lat: "50.4784296",
    lon: "30.3402236",
    category: "building",
    type: "apartments",
    display_name:
      "40-А, Клавдіївська вулиця, Сахалін, Святошинський район, Київ, 03164, Україна",
    address: {
      house_number: "40-А",
      road: "Клавдіївська вулиця",
      quarter: "Сахалін",
      borough: "Святошинський район",
      city: "Київ",
      "ISO3166-2-lvl4": "UA-30",
      postcode: "03164",
      country: "Україна",
      country_code: "ua",
    },
  },
]);

export interface Vs11GeoProofResult {
  status: "created" | "existing";
  address_id: string;
  source_id: string;
  source_snapshot_id: string | null;
  observation_id: string | null;
  claim_id: string | null;
  latitude: number;
  longitude: number;
  materialization_status: string;
}

export async function materializeVs11TrustedGeoFixture(
  bucket: R2Bucket,
  database: Hyperdrive,
): Promise<Vs11GeoProofResult> {
  const address = await findAddress(database, {
    country_code: "UA",
    city: "Київ",
    street: "Клавдіївська",
    house_number: "40А",
  });

  if (!address) {
    throw new Error("vs11_fixture_address_not_found");
  }

  const created = await withPostgresClient(database, async (client) => {
    await client.query("BEGIN");

    try {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`vs11:${address.id}:${SOURCE_ID}`],
      );

      const existing = await client.query<{
        claim_id: string;
        observation_id: string;
        source_snapshot_id: string;
      }>(
        `
          SELECT
            c.id AS claim_id,
            c.observation_id,
            c.source_snapshot_id
          FROM claims c
          WHERE c.subject_id = $1
            AND c.source_id = $2
            AND c.predicate = 'geo.point'
            AND c.status = 'asserted'
          ORDER BY c.created_at DESC
          LIMIT 1
        `,
        [address.id, SOURCE_ID],
      );

      const existingRow = existing.rows[0];
      if (existingRow) {
        await client.query("COMMIT");
        return {
          status: "existing" as const,
          claim_id: existingRow.claim_id,
          observation_id: existingRow.observation_id,
          source_snapshot_id: existingRow.source_snapshot_id,
        };
      }

      await client.query(
        `
          INSERT INTO sources (
            id,
            kind,
            name,
            canonical_url,
            metadata
          )
          VALUES ($1, 'approved_geocoder', $2, $3, $4::jsonb)
          ON CONFLICT (id) DO UPDATE
          SET
            kind = EXCLUDED.kind,
            name = EXCLUDED.name,
            canonical_url = EXCLUDED.canonical_url,
            metadata = EXCLUDED.metadata
        `,
        [
          SOURCE_ID,
          "OpenStreetMap Nominatim bounded VS11 fixture",
          SOURCE_URL,
          JSON.stringify({
            dataset: "OpenStreetMap",
            service: "Nominatim",
            license: "ODbL",
            attribution: "© OpenStreetMap contributors",
            usage_policy:
              "https://operations.osmfoundation.org/policies/nominatim/",
            collection_mode: "bounded_single_fixture",
            collection_complete: true,
          }),
        ],
      );

      const snapshot = await captureArtifactSnapshot(bucket, {
        sourceId: SOURCE_ID,
        requestedUrl: SOURCE_URL,
        finalUrl: SOURCE_URL,
        body: FIXTURE_BODY,
        contentType: "application/json; charset=utf-8",
        httpStatus: 200,
        responseHeaders: {
          "content-type": "application/json; charset=utf-8",
        },
      });

      await client.query(
        `
          INSERT INTO source_snapshots (
            id,
            source_id,
            url,
            fetched_at,
            http_status,
            response_headers,
            content_hash,
            content_type,
            content_length,
            body_ref,
            fetch_metadata
          )
          VALUES (
            $1,
            $2,
            $3,
            $4::timestamptz,
            $5,
            $6::jsonb,
            $7,
            $8,
            $9,
            $10,
            $11::jsonb
          )
        `,
        [
          snapshot.id,
          SOURCE_ID,
          SOURCE_URL,
          OBSERVED_AT,
          snapshot.http_status,
          JSON.stringify(snapshot.response_headers),
          snapshot.sha256,
          snapshot.content_type,
          snapshot.content_length,
          snapshot.body_ref,
          JSON.stringify({
            requested_url: SOURCE_URL,
            capture_kind: "bounded_geo_probe",
            acquisition_runner: "github-actions",
            external_requests: 1,
            osm_type: "way",
            osm_id: 344896684,
          }),
        ],
      );

      const observationId = crypto.randomUUID();
      const payload = {
        schema_version: "geo-point-observation.v1",
        address_id: address.id,
        latitude: 50.4784296,
        longitude: 30.3402236,
        acquisition_method: "approved_geocoder",
        granularity: "building",
        precision_meters: null,
        source_reference: SOURCE_REFERENCE,
        observed_at: OBSERVED_AT,
      };

      await client.query(
        `
          INSERT INTO observations (
            id,
            source_snapshot_id,
            schema_name,
            schema_version,
            extractor,
            extractor_version,
            normalizer_version,
            extracted_at,
            payload,
            validation_status,
            validation_errors
          )
          VALUES (
            $1,
            $2,
            'geo-point-observation',
            '1',
            'nominatim-bounded-probe',
            '1',
            '1',
            $3::timestamptz,
            $4::jsonb,
            'valid',
            '[]'::jsonb
          )
        `,
        [
          observationId,
          snapshot.id,
          OBSERVED_AT,
          JSON.stringify(payload),
        ],
      );

      const claimId = crypto.randomUUID();
      await client.query(
        `
          INSERT INTO claims (
            id,
            subject_id,
            predicate,
            value,
            source_id,
            source_snapshot_id,
            observation_id,
            observed_at,
            extraction_confidence,
            status,
            metadata
          )
          VALUES (
            $1,
            $2,
            'geo.point',
            $3::jsonb,
            $4,
            $5,
            $6,
            $7::timestamptz,
            0.99,
            'asserted',
            $8::jsonb
          )
        `,
        [
          claimId,
          address.id,
          JSON.stringify({
            latitude: payload.latitude,
            longitude: payload.longitude,
            acquisition_method: payload.acquisition_method,
            granularity: payload.granularity,
            precision_meters: payload.precision_meters,
            source_reference: payload.source_reference,
          }),
          SOURCE_ID,
          snapshot.id,
          observationId,
          OBSERVED_AT,
          JSON.stringify({
            source_service: "Nominatim",
            source_dataset: "OpenStreetMap",
            osm_type: "way",
            osm_id: 344896684,
            bounded_probe: true,
            evidence_locator: {
              kind: "json_object",
              body_ref: snapshot.body_ref,
              selector: "[0]",
            },
          }),
        ],
      );

      await client.query("COMMIT");

      return {
        status: "created" as const,
        claim_id: claimId,
        observation_id: observationId,
        source_snapshot_id: snapshot.id,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });

  const materialization = await materializeAddressGeoPoint(
    database,
    address.id,
  );

  return {
    status: created.status,
    address_id: address.id,
    source_id: SOURCE_ID,
    source_snapshot_id: created.source_snapshot_id,
    observation_id: created.observation_id,
    claim_id: created.claim_id,
    latitude: 50.4784296,
    longitude: 30.3402236,
    materialization_status: materialization.status,
  };
}

export async function getAddressGeoProvenance(
  database: Hyperdrive,
  addressId: string,
): Promise<Record<string, unknown> | null> {
  return withPostgresClient(database, async (client) => {
    const result = await client.query<{
      claim_id: string;
      claim_value: unknown;
      observed_at: Date | string;
      observation_id: string;
      observation_payload: unknown;
      validation_status: string;
      source_snapshot_id: string;
      body_ref: string;
      content_hash: string;
      source_id: string;
      source_name: string;
      source_url: string | null;
      source_metadata: unknown;
    }>(
      `
        SELECT
          c.id AS claim_id,
          c.value AS claim_value,
          c.observed_at,
          o.id AS observation_id,
          o.payload AS observation_payload,
          o.validation_status,
          ss.id AS source_snapshot_id,
          ss.body_ref,
          ss.content_hash,
          s.id AS source_id,
          s.name AS source_name,
          s.canonical_url AS source_url,
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
        ORDER BY c.observed_at DESC, c.created_at DESC
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
        observed_at: new Date(row.observed_at).toISOString(),
      },
      observation: {
        id: row.observation_id,
        validation_status: row.validation_status,
        payload: row.observation_payload,
      },
      snapshot: {
        id: row.source_snapshot_id,
        body_ref: row.body_ref,
        content_hash: row.content_hash,
      },
      source: {
        id: row.source_id,
        name: row.source_name,
        canonical_url: row.source_url,
        metadata: row.source_metadata,
      },
    };
  });
}
