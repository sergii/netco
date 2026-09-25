import { withPostgresClient } from "../db/postgres";

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
