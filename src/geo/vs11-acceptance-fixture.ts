import { withPostgresClient } from "../db/postgres";
import {
  materializeAddressGeoPoint,
  type GeoPointMaterializationResult,
  type GeoPointObservationPayload,
} from "./evidence";

const ADDRESS_NORMALIZED_KEY =
  "ua||київ|клавдіївська|40а||";

const SOURCE_ID = "a5e039d4-61a3-46c6-ab22-64227454e2da";
const SNAPSHOT_ID = "f83778fc-250f-44d0-aef2-5cb83c716fad";
const OBSERVATION_ID = "6db0132b-c600-4d29-9cb5-590d905eee4d";
const CLAIM_ID = "63e69665-c782-4ce3-9a47-1b094cdb5187";

const CAPTURED_AT = "2026-09-25T17:56:38.155Z";
const SOURCE_URL =
  "https://nominatim.openstreetmap.org/search";
const BODY_REF =
  "geo/vs11/nominatim-klavdiivska-40a.json";

const LATITUDE = 50.4784296;
const LONGITUDE = 30.3402236;
const SOURCE_REFERENCE = "osm:way:344896684";

const artifact = {
  schema_version: "geo-acceptance-artifact.v1",
  capture_kind: "bounded_nominatim_probe",
  captured_at: CAPTURED_AT,
  source: {
    name: "OpenStreetMap Nominatim",
    canonical_url: SOURCE_URL,
    attribution: "© OpenStreetMap contributors",
    license: "ODbL-1.0",
    usage_scope: "bounded_acceptance_only",
  },
  request: {
    method: "GET",
    endpoint: SOURCE_URL,
    query: "40-А, Клавдіївська вулиця, Київ, Україна",
    format: "jsonv2",
    addressdetails: 1,
    limit: 3,
    user_agent:
      "Netco/0.1 (https://github.com/sergii/netco)",
  },
  response: [
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
  ],
  probe: {
    github_run_id: 36170268976,
    commit: "0c60226b76ab79757676aad0df17dfeff81f4de2",
  },
};

export interface Vs11GeoBootstrapResult {
  status:
    | "materialized"
    | "already_present"
    | "address_not_found";
  address_id: string | null;
  source_id: string | null;
  snapshot_id: string | null;
  observation_id: string | null;
  claim_id: string | null;
  materialization: GeoPointMaterializationResult | null;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string): Promise<string> {
  return bytesToHex(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    ),
  );
}

export async function bootstrapVs11GeoAcceptanceFixture(
  bucket: R2Bucket,
  database: Hyperdrive,
): Promise<Vs11GeoBootstrapResult> {
  const address = await withPostgresClient(
    database,
    async (client) => {
      const result = await client.query<{ id: string }>(
        `
          SELECT id
          FROM addresses
          WHERE normalized_key = $1
          LIMIT 1
        `,
        [ADDRESS_NORMALIZED_KEY],
      );

      return result.rows[0] ?? null;
    },
  );

  if (!address) {
    return {
      status: "address_not_found",
      address_id: null,
      source_id: null,
      snapshot_id: null,
      observation_id: null,
      claim_id: null,
      materialization: null,
    };
  }

  const existing = await withPostgresClient(
    database,
    async (client) => {
      const result = await client.query<{ id: string }>(
        `
          SELECT id
          FROM claims
          WHERE subject_id = $1
            AND predicate = 'geo.point'
            AND status = 'asserted'
            AND value->>'source_reference' = $2
          LIMIT 1
        `,
        [address.id, SOURCE_REFERENCE],
      );

      return result.rows[0] ?? null;
    },
  );

  if (existing) {
    const materialization = await materializeAddressGeoPoint(
      database,
      address.id,
    );

    return {
      status: "already_present",
      address_id: address.id,
      source_id: materialization.source_id,
      snapshot_id: materialization.source_snapshot_id,
      observation_id: materialization.observation_id,
      claim_id: materialization.claim_id,
      materialization,
    };
  }

  const artifactJson = JSON.stringify(artifact);
  const contentHash = await sha256Hex(artifactJson);

  await bucket.put(BODY_REF, artifactJson, {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
    },
    customMetadata: {
      schema_version: "geo-acceptance-artifact.v1",
      usage_scope: "bounded_acceptance_only",
    },
  });

  const persisted = await withPostgresClient(
    database,
    async (client) => {
      await client.query("BEGIN");

      try {
        const existingSource = await client.query<{ id: string }>(
          `
            SELECT id
            FROM sources
            WHERE canonical_url = $1
            LIMIT 1
          `,
          [SOURCE_URL],
        );

        const sourceId = existingSource.rows[0]?.id ?? SOURCE_ID;

        if (!existingSource.rows[0]) {
          await client.query(
            `
              INSERT INTO sources (
                id,
                kind,
                name,
                canonical_url,
                metadata
              )
              VALUES (
                $1,
                'open_geocoder',
                'OpenStreetMap Nominatim bounded acceptance',
                $2,
                $3::jsonb
              )
            `,
            [
              sourceId,
              SOURCE_URL,
              JSON.stringify({
                attribution: "© OpenStreetMap contributors",
                license: "ODbL-1.0",
                usage_scope: "bounded_acceptance_only",
                provider_collection: false,
              }),
            ],
          );
        }

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
              200,
              $5::jsonb,
              $6,
              'application/json',
              $7,
              $8,
              $9::jsonb
            )
            ON CONFLICT (id) DO NOTHING
          `,
          [
            SNAPSHOT_ID,
            sourceId,
            SOURCE_URL,
            CAPTURED_AT,
            JSON.stringify({
              "content-type": "application/json",
            }),
            contentHash,
            new TextEncoder().encode(artifactJson).byteLength,
            BODY_REF,
            JSON.stringify({
              capture_kind: "geo_acceptance_fixture",
              query:
                "40-А, Клавдіївська вулиця, Київ, Україна",
              usage_scope: "bounded_acceptance_only",
              attribution: "© OpenStreetMap contributors",
              license: "ODbL-1.0",
              github_probe_run_id: 36170268976,
            }),
          ],
        );

        const payload: GeoPointObservationPayload = {
          schema_version: "geo-point-observation.v1",
          address_id: address.id,
          latitude: LATITUDE,
          longitude: LONGITUDE,
          acquisition_method: "approved_geocoder",
          granularity: "building",
          precision_meters: null,
          source_reference: SOURCE_REFERENCE,
          observed_at: CAPTURED_AT,
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
              'bounded-nominatim-fixture',
              '1',
              '1',
              $3::timestamptz,
              $4::jsonb,
              'valid',
              '[]'::jsonb
            )
            ON CONFLICT (id) DO NOTHING
          `,
          [
            OBSERVATION_ID,
            SNAPSHOT_ID,
            CAPTURED_AT,
            JSON.stringify(payload),
          ],
        );

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
              1.0000,
              'asserted',
              $8::jsonb
            )
            ON CONFLICT (id) DO NOTHING
          `,
          [
            CLAIM_ID,
            address.id,
            JSON.stringify({
              latitude: LATITUDE,
              longitude: LONGITUDE,
              acquisition_method: "approved_geocoder",
              granularity: "building",
              precision_meters: null,
              source_reference: SOURCE_REFERENCE,
            }),
            sourceId,
            SNAPSHOT_ID,
            OBSERVATION_ID,
            CAPTURED_AT,
            JSON.stringify({
              attribution: "© OpenStreetMap contributors",
              license: "ODbL-1.0",
              usage_scope: "bounded_acceptance_only",
              osm_type: "way",
              osm_id: 344896684,
              evidence_locator: {
                kind: "r2_json",
                body_ref: BODY_REF,
              },
              github_probe_run_id: 36170268976,
            }),
          ],
        );

        await client.query("COMMIT");

        return {
          source_id: sourceId,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    },
  );

  const materialization = await materializeAddressGeoPoint(
    database,
    address.id,
  );

  return {
    status: "materialized",
    address_id: address.id,
    source_id: persisted.source_id,
    snapshot_id: SNAPSHOT_ID,
    observation_id: OBSERVATION_ID,
    claim_id: CLAIM_ID,
    materialization,
  };
}
