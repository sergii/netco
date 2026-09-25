import type { SnapshotRecord } from "./snapshot";
import type { SourceDefinition } from "../sources/registry";
import { withPostgresClient } from "../db/postgres";

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
          ON CONFLICT (id) DO NOTHING
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
