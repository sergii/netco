import { withPostgresClient } from "../db/postgres";
import type { CoverageCheckerInterfaceObservation } from "./probe";
import type { CoverageCheckerInteractionObservation } from "./interaction-probe";

function iso(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

export interface LatestCoverageCheckerProbe {
  snapshot_id: string;
  observation_id: string;
  fetched_at: string;
  control_count: number;
  browser_ms_used: number | null;
}

export async function persistCoverageCheckerInterfaceObservation(
  database: Hyperdrive,
  snapshotId: string,
  observation: CoverageCheckerInterfaceObservation,
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
        snapshotId,
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

export async function getLatestCoverageCheckerProbe(
  database: Hyperdrive,
  sourceId: string,
): Promise<LatestCoverageCheckerProbe | null> {
  return withPostgresClient(database, async (client) => {
    const result = await client.query<{
      snapshot_id: string;
      observation_id: string;
      fetched_at: Date | string;
      control_count: string | number | null;
      browser_ms_used: string | number | null;
    }>(
      `
        SELECT
          s.id AS snapshot_id,
          o.id AS observation_id,
          s.fetched_at,
          o.payload->>'interactive_control_count' AS control_count,
          o.payload->>'browser_ms_used' AS browser_ms_used
        FROM source_snapshots s
        JOIN observations o
          ON o.source_snapshot_id = s.id
        WHERE s.source_id = $1
          AND s.fetch_metadata->>'capture_kind' =
            'coverage_checker_probe'
          AND o.schema_name =
            'coverage-checker-interface-observation'
        ORDER BY o.extracted_at DESC
        LIMIT 1
      `,
      [sourceId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      snapshot_id: row.snapshot_id,
      observation_id: row.observation_id,
      fetched_at: iso(row.fetched_at),
      control_count: Number(row.control_count ?? 0),
      browser_ms_used:
        row.browser_ms_used === null
          ? null
          : Number(row.browser_ms_used),
    };
  });
}

export async function getCoverageCheckerInterface(
  database: Hyperdrive,
  sourceId: string,
): Promise<Record<string, unknown> | null> {
  return withPostgresClient(database, async (client) => {
    const result = await client.query<{
      snapshot_id: string;
      observation_id: string;
      fetched_at: Date | string;
      extracted_at: Date | string;
      validation_status: string;
      validation_errors: unknown;
      payload: unknown;
    }>(
      `
        SELECT
          s.id AS snapshot_id,
          o.id AS observation_id,
          s.fetched_at,
          o.extracted_at,
          o.validation_status,
          o.validation_errors,
          o.payload
        FROM source_snapshots s
        JOIN observations o
          ON o.source_snapshot_id = s.id
        WHERE s.source_id = $1
          AND s.fetch_metadata->>'capture_kind' =
            'coverage_checker_probe'
          AND o.schema_name =
            'coverage-checker-interface-observation'
        ORDER BY o.extracted_at DESC
        LIMIT 1
      `,
      [sourceId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      snapshot_id: row.snapshot_id,
      observation_id: row.observation_id,
      fetched_at: iso(row.fetched_at),
      extracted_at: iso(row.extracted_at),
      validation_status: row.validation_status,
      validation_errors: row.validation_errors,
      payload: row.payload,
    };
  });
}


export interface LatestCoverageCheckerInteractionProbe {
  snapshot_id: string;
  observation_id: string;
  fetched_at: string;
  validation_status: "valid" | "partial" | "invalid";
}

export async function persistCoverageCheckerInteractionObservation(
  database: Hyperdrive,
  snapshotId: string,
  observation: CoverageCheckerInteractionObservation,
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
        snapshotId,
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

export async function getLatestCoverageCheckerInteractionProbe(
  database: Hyperdrive,
  sourceId: string,
): Promise<LatestCoverageCheckerInteractionProbe | null> {
  return withPostgresClient(database, async (client) => {
    const result = await client.query<{
      snapshot_id: string;
      observation_id: string;
      fetched_at: Date | string;
      validation_status: "valid" | "partial" | "invalid";
    }>(
      `
        SELECT
          s.id AS snapshot_id,
          o.id AS observation_id,
          s.fetched_at,
          o.validation_status
        FROM source_snapshots s
        JOIN observations o
          ON o.source_snapshot_id = s.id
        WHERE s.source_id = $1
          AND s.fetch_metadata->>'capture_kind' =
            'coverage_checker_result'
          AND o.schema_name =
            'coverage-checker-interaction-observation'
        ORDER BY o.extracted_at DESC
        LIMIT 1
      `,
      [sourceId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      snapshot_id: row.snapshot_id,
      observation_id: row.observation_id,
      fetched_at: iso(row.fetched_at),
      validation_status: row.validation_status,
    };
  });
}

export async function getCoverageCheckerInteraction(
  database: Hyperdrive,
  sourceId: string,
): Promise<Record<string, unknown> | null> {
  return withPostgresClient(database, async (client) => {
    const result = await client.query<{
      snapshot_id: string;
      observation_id: string;
      fetched_at: Date | string;
      extracted_at: Date | string;
      validation_status: string;
      validation_errors: unknown;
      payload: unknown;
    }>(
      `
        SELECT
          s.id AS snapshot_id,
          o.id AS observation_id,
          s.fetched_at,
          o.extracted_at,
          o.validation_status,
          o.validation_errors,
          o.payload
        FROM source_snapshots s
        JOIN observations o
          ON o.source_snapshot_id = s.id
        WHERE s.source_id = $1
          AND s.fetch_metadata->>'capture_kind' =
            'coverage_checker_result'
          AND o.schema_name =
            'coverage-checker-interaction-observation'
        ORDER BY o.extracted_at DESC
        LIMIT 1
      `,
      [sourceId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      snapshot_id: row.snapshot_id,
      observation_id: row.observation_id,
      fetched_at: iso(row.fetched_at),
      extracted_at: iso(row.extracted_at),
      validation_status: row.validation_status,
      validation_errors: row.validation_errors,
      payload: row.payload,
    };
  });
}
