import type { SnapshotRecord } from "./snapshot";
import type { IdentityObservation } from "./identity";
import type { UrlDiscoveryObservation } from "../crawl/discovery";
import type { PagePurposeObservation } from "../crawl/page-purpose";
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
  canonicalUrl: string,
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
          AND (
            url = $2
            OR fetch_metadata->>'requested_url' = $2
          )
        ORDER BY fetched_at DESC
        LIMIT 1
      `,
      [sourceId, canonicalUrl],
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

export interface SnapshotPersistenceMetadata {
  capture_kind?: "source_root" | "crawl_candidate";
  parent_snapshot_id?: string;
  discovery_observation_id?: string;
  expected_classification?: string;
  relevance_score?: number;
}

export async function persistSourceSnapshot(
  database: Hyperdrive,
  source: SourceDefinition,
  snapshot: SnapshotRecord,
  metadata: SnapshotPersistenceMetadata = {},
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
            ...metadata,
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
          AND (
            url = $2
            OR fetch_metadata->>'requested_url' = $2
          )
        ORDER BY fetched_at DESC
        LIMIT 1
      `,
      [source.id, source.canonical_url],
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
          AND schema_name = 'provider-identity-observation'
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


export async function getLatestSourceSnapshotRecord(
  database: Hyperdrive,
  sourceId: string,
  canonicalUrl: string,
): Promise<SnapshotRecord | null> {
  return withPostgresClient(database, async (client) => {
    const result = await client.query<{
      id: string;
      source_id: string;
      url: string;
      fetched_at: Date | string;
      http_status: number;
      response_headers: Record<string, string>;
      content_hash: string;
      content_type: string | null;
      content_length: string | number | null;
      body_ref: string;
      fetch_metadata: {
        requested_url?: string;
        schema_version?: string;
      } | null;
    }>(
      `
        SELECT
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
        FROM source_snapshots
        WHERE source_id = $1
          AND (
            url = $2
            OR fetch_metadata->>'requested_url' = $2
          )
        ORDER BY fetched_at DESC
        LIMIT 1
      `,
      [sourceId, canonicalUrl],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      schema_version: "source-snapshot.v1",
      id: row.id,
      source_id: row.source_id,
      requested_url: row.fetch_metadata?.requested_url ?? row.url,
      final_url: row.url,
      fetched_at: iso(row.fetched_at),
      http_status: row.http_status,
      response_headers: row.response_headers ?? {},
      content_type: row.content_type,
      content_length:
        row.content_length === null ? 0 : Number(row.content_length),
      sha256: row.content_hash,
      body_ref: row.body_ref,
    };
  });
}

export interface PersistObservationResult {
  id: string;
  inserted: boolean;
}

export async function persistUrlDiscoveryObservation(
  database: Hyperdrive,
  snapshot: SnapshotRecord,
  observation: UrlDiscoveryObservation,
): Promise<PersistObservationResult> {
  return withPostgresClient(database, async (client) => {
    const result = await client.query<{ id: string }>(
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
        SELECT
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
        WHERE NOT EXISTS (
          SELECT 1
          FROM observations
          WHERE source_snapshot_id = $2
            AND schema_name = $3
            AND schema_version = $4
            AND extractor = $5
            AND extractor_version = $6
        )
        RETURNING id
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

    const inserted = result.rows[0];

    if (inserted) {
      return {
        id: inserted.id,
        inserted: true,
      };
    }

    const existing = await client.query<{ id: string }>(
      `
        SELECT id
        FROM observations
        WHERE source_snapshot_id = $1
          AND schema_name = $2
          AND schema_version = $3
          AND extractor = $4
          AND extractor_version = $5
        ORDER BY extracted_at DESC
        LIMIT 1
      `,
      [
        snapshot.id,
        observation.schema_name,
        observation.schema_version,
        observation.extractor,
        observation.extractor_version,
      ],
    );

    const row = existing.rows[0];
    if (!row) {
      throw new Error("discovery_observation_persistence_failed");
    }

    return {
      id: row.id,
      inserted: false,
    };
  });
}

export async function getLatestUrlDiscoveryObservation(
  database: Hyperdrive,
  sourceId: string,
): Promise<Record<string, unknown> | null> {
  return withPostgresClient(database, async (client) => {
    const result = await client.query<{
      id: string;
      source_snapshot_id: string;
      extracted_at: Date | string;
      validation_status: string;
      validation_errors: unknown;
      payload: unknown;
    }>(
      `
        SELECT
          o.id,
          o.source_snapshot_id,
          o.extracted_at,
          o.validation_status,
          o.validation_errors,
          o.payload
        FROM observations o
        JOIN source_snapshots s
          ON s.id = o.source_snapshot_id
        WHERE s.source_id = $1
          AND o.schema_name = 'url-discovery-observation'
        ORDER BY o.extracted_at DESC
        LIMIT 1
      `,
      [sourceId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      source_snapshot_id: row.source_snapshot_id,
      extracted_at: iso(row.extracted_at),
      validation_status: row.validation_status,
      validation_errors: row.validation_errors,
      payload: row.payload,
    };
  });
}


export async function getLatestSnapshotForUrl(
  database: Hyperdrive,
  sourceId: string,
  url: string,
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
          AND (
            url = $2
            OR fetch_metadata->>'requested_url' = $2
          )
        ORDER BY fetched_at DESC
        LIMIT 1
      `,
      [sourceId, url],
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

export async function persistPagePurposeObservation(
  database: Hyperdrive,
  snapshot: SnapshotRecord,
  observation: PagePurposeObservation,
): Promise<void> {
  await withPostgresClient(database, async (client) => {
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
  });
}

export async function getRecentPagePurposeObservations(
  database: Hyperdrive,
  sourceId: string,
  limit = 20,
): Promise<Array<Record<string, unknown>>> {
  return withPostgresClient(database, async (client) => {
    const result = await client.query<{
      id: string;
      source_snapshot_id: string;
      extracted_at: Date | string;
      validation_status: string;
      validation_errors: unknown;
      payload: unknown;
    }>(
      `
        SELECT
          o.id,
          o.source_snapshot_id,
          o.extracted_at,
          o.validation_status,
          o.validation_errors,
          o.payload
        FROM observations o
        JOIN source_snapshots s
          ON s.id = o.source_snapshot_id
        WHERE s.source_id = $1
          AND o.schema_name = 'page-purpose-observation'
        ORDER BY o.extracted_at DESC
        LIMIT $2
      `,
      [sourceId, limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      source_snapshot_id: row.source_snapshot_id,
      extracted_at: iso(row.extracted_at),
      validation_status: row.validation_status,
      validation_errors: row.validation_errors,
      payload: row.payload,
    }));
  });
}
