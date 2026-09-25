import { withPostgresClient } from "./postgres";

const REQUIRED_TABLES = [
  "claims",
  "observations",
  "source_snapshots",
  "sources",
  "subjects",
] as const;

export interface DatabaseStatus {
  reachable: boolean;
  schema_ready: boolean;
  required_tables: number;
  content_length_column: boolean;
}

export async function getDatabaseStatus(
  database: Hyperdrive,
): Promise<DatabaseStatus> {
  try {
    return await withPostgresClient(database, async (client) => {
      const result = await client.query<{
        required_tables: string;
        content_length_column: boolean;
      }>(
        `
          SELECT
            (
              SELECT count(*)::text
              FROM pg_catalog.pg_tables
              WHERE schemaname = 'public'
                AND tablename = ANY($1::text[])
            ) AS required_tables,
            EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = 'source_snapshots'
                AND column_name = 'content_length'
            ) AS content_length_column
        `,
        [REQUIRED_TABLES],
      );

      const row = result.rows[0];
      const requiredTables = Number(row?.required_tables ?? 0);
      const contentLengthColumn = Boolean(row?.content_length_column);

      return {
        reachable: true,
        schema_ready:
          requiredTables === REQUIRED_TABLES.length && contentLengthColumn,
        required_tables: requiredTables,
        content_length_column: contentLengthColumn,
      };
    });
  } catch {
    return {
      reachable: false,
      schema_ready: false,
      required_tables: 0,
      content_length_column: false,
    };
  }
}
