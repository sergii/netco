BEGIN;

ALTER TABLE source_snapshots
  ADD COLUMN IF NOT EXISTS content_length bigint;

COMMIT;
