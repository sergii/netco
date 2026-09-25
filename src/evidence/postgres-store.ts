import type { SnapshotRecord } from "./snapshot";
import type { IdentityObservation } from "./identity";
import type { SourceDefinition } from "../sources/registry";
import { withPostgresClient } from "../db/postgres";

export interface LatestSourceSnapshot {
  id: string;
  fetched_at: string;
}

export interface SourceProvenance {
  source: {
    id: string;
    slug: string;
    name: string;
    canonical_url: string;
  };
  snapshot: null | {
    id: string;
    url: string;
    fetched_at: string;
    http_status: number;
    content_hash: string;
    content_type: string | null;
    content_length: number | null;
    body_ref: string;
  };
  observation: null | {
    id: string;
    schema_name: string;
    schema_version: string;
    extractor: string;
    extractor_version: string;
    extracted_at: string;
    validation_status: string;
    validation_errors: unknown;
    payload: unknown;
  };
  claims: Array<{
    id: string;
    subject_id: string;
    predicate: string;
    value: unknown;
    observed_at: string;
    extraction_confidence: number | null;
    status: string;
    metadata: unknown;
  }>;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function getLatestSourceSnapshot(
  database: Hyperdrive,
  sourceId: string,
): Promise<LatestSourceSnapshot | null> {
  return withPostgresClient(database, async (client) => {
    const result = await client.query<{
      id: string;
      fetched_at: Date | string;
    }>(
      `
        SELECT id, fetched_at
        FROM source_snapshots
        WHERE source_id = $1
        ORDER BY fetched_at DESC
        LIMIT 1
      `,
      [sourceId],
    );

    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          fetched_at: iso(row.fetched_at),
        }
      : null;
  });
}

export async function persistSourceSnapshot(
  database: Hyperdrive,
  source: SourceDefinition,
  snapshot: SnapshotRecord,
): Promise<void> {
  if (!snapshot.source_id) {
    throw new Error("snapshot_source_id_required");
  }

  if (snapshot.source_id !== source.id) {
    throw new Error("snapshot_source_mismatch");
  }

  await withPostgresClient(database, async (client) => {
    await client.query("BEGIN");

    try {
      await client.query(
        `
          INSERT INTO sources (
            id,
            kind,
            name,
            canonical_url,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5::jsonb)
          ON CONFLICT (id) DO UPDATE
          SET
            kind = EXCLUDED.kind,
            name = EXCLUDED.name,
            canonical_url = EXCLUDED.canonical_url,
            metadata = EXCLUDED.metadata
        `,
        [
          source.id,
          source.kind,
          source.name,
          source.canonical_url,
          JSON.stringify({
            provider_candidate_name: source.provider_candidate_name,
          }),
        ],
      );

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
          source.id,
          snapshot.final_url,
          snapshot.fetched_at,
          snapshot.http_status,
          JSON.stringify(snapshot.response_headers),
          snapshot.sha256,
          snapshot.content_type,
          snapshot.content_length,
          snapshot.body_ref,
          JSON.stringify({
            requested_url: snapshot.requested_url,
            schema_version: snapshot.schema_version,
          }),
        ],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function persistIdentityObservation(
  database: Hyperdrive,
  source: SourceDefinition,
  snapshot: SnapshotRecord,
  observation: IdentityObservation,
): Promise<number> {
  return withPostgresClient(database, async (client) => {
    await client.query("BEGIN");

    try {
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
            $3,
            $4,
            $5,
            $6,
            $7,
            $8::timestamptz,
            $9::jsonb,
            $10,
            $11::jsonb
          )
        `,
        [
          observation.id,
          snapshot.id,
          observation.schema_name,
          observation.schema_version,
          observation.extractor,
          observation.extractor_version,
          observation.normalizer_version,
          observation.extracted_at,
          JSON.stringify(observation.payload),
          observation.validation_status,
          JSON.stringify(observation.validation_errors),
        ],
      );

      let claimCount = 0;

      if (
        observation.validation_status === "valid" &&
        source.provider_candidate_name
      ) {
        await client.query(
          `
            INSERT INTO subjects (id, kind)
            VALUES ($1, 'provider_candidate')
            ON CONFLICT (id) DO NOTHING
          `,
          [source.subject_id],
        );

        const evidenceMetadata = {
          source_slug: source.slug,
          evidence_locator: {
            kind: "body_text_marker",
            body_ref: snapshot.body_ref,
            marker: observation.payload.matched_identity_markers[0],
          },
        };

        const claims = [
          {
            predicate: "identity.display_name",
            value: { value: source.provider_candidate_name },
          },
          {
            predicate: "web.official_site",
            value: { url: source.canonical_url },
          },
        ];

        for (const claim of claims) {
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
                $3,
                $4::jsonb,
                $5,
                $6,
                $7,
                $8::timestamptz,
                $9,
                'asserted',
                $10::jsonb
              )
            `,
            [
              crypto.randomUUID(),
              source.subject_id,
              claim.predicate,
              JSON.stringify(claim.value),
              source.id,
              snapshot.id,
              observation.id,
              snapshot.fetched_at,
              0.95,
              JSON.stringify(evidenceMetadata),
            ],
          );

          claimCount += 1;
        }
      }

      await client.query("COMMIT");
      return claimCount;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function getSourceProvenance(
  database: Hyperdrive,
  source: SourceDefinition,
): Promise<SourceProvenance> {
  return withPostgresClient(database, async (client) => {
    const snapshotResult = await client.query<{
      id: string;
      url: string;
      fetched_at: Date | string;
      http_status: number;
      content_hash: string;
      content_type: string | null;
      content_length: string | number | null;
      body_ref: string;
    }>(
      `
        SELECT
          id,
          url,
          fetched_at,
          http_status,
          content_hash,
          content_type,
          content_length,
          body_ref
        FROM source_snapshots
        WHERE source_id = $1
        ORDER BY fetched_at DESC
        LIMIT 1
      `,
      [source.id],
    );

    const snapshotRow = snapshotResult.rows[0];

    if (!snapshotRow) {
      return {
        source: {
          id: source.id,
          slug: source.slug,
          name: source.name,
          canonical_url: source.canonical_url,
        },
        snapshot: null,
        observation: null,
        claims: [],
      };
    }

    const observationResult = await client.query<{
      id: string;
      schema_name: string;
      schema_version: string;
      extractor: string;
      extractor_version: string;
      extracted_at: Date | string;
      validation_status: string;
      validation_errors: unknown;
      payload: unknown;
    }>(
      `
        SELECT
          id,
          schema_name,
          schema_version,
          extractor,
          extractor_version,
          extracted_at,
          validation_status,
          validation_errors,
          payload
        FROM observations
        WHERE source_snapshot_id = $1
        ORDER BY extracted_at DESC
        LIMIT 1
      `,
      [snapshotRow.id],
    );

    const observationRow = observationResult.rows[0];

    const claimsResult = observationRow
      ? await client.query<{
          id: string;
          subject_id: string;
          predicate: string;
          value: unknown;
          observed_at: Date | string;
          extraction_confidence: string | number | null;
          status: string;
          metadata: unknown;
        }>(
          `
            SELECT
              id,
              subject_id,
              predicate,
              value,
              observed_at,
              extraction_confidence,
              status,
              metadata
            FROM claims
            WHERE observation_id = $1
            ORDER BY predicate, id
          `,
          [observationRow.id],
        )
      : { rows: [] };

    return {
      source: {
        id: source.id,
        slug: source.slug,
        name: source.name,
        canonical_url: source.canonical_url,
      },
      snapshot: {
        ...snapshotRow,
        fetched_at: iso(snapshotRow.fetched_at),
        content_length:
          snapshotRow.content_length === null
            ? null
            : Number(snapshotRow.content_length),
      },
      observation: observationRow
        ? {
            ...observationRow,
            extracted_at: iso(observationRow.extracted_at),
          }
        : null,
      claims: claimsResult.rows.map((claim) => ({
        ...claim,
        observed_at: iso(claim.observed_at),
        extraction_confidence:
          claim.extraction_confidence === null
            ? null
            : Number(claim.extraction_confidence),
      })),
    };
  });
}
