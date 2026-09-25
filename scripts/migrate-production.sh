#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="ancient-haze-86966909"
BRANCH="production"
DATABASE="neondb"
ROLE="neondb_owner"

if ! command -v neon >/dev/null 2>&1; then
  echo "Neon CLI is not installed. Run: npm i -g neon@latest" >&2
  exit 1
fi

if [ ! -f ".neon" ]; then
  echo "This repo is not linked to Neon. Run:" >&2
  echo "  neon link --project-id ${PROJECT_ID} --branch ${BRANCH} -y" >&2
  exit 1
fi

psql() {
  neon connection-string "${BRANCH}" \
    --project-id "${PROJECT_ID}" \
    --database-name "${DATABASE}" \
    --role-name "${ROLE}" \
    --psql -- "$@"
}

echo "Checking required PostgreSQL extensions are available..."
available_extensions="$(
  psql -Atq -v ON_ERROR_STOP=1 -c "
    SELECT count(*)
    FROM pg_available_extensions
    WHERE name IN ('pgcrypto', 'pg_trgm', 'postgis');
  "
)"

if [ "${available_extensions}" != "3" ]; then
  echo "Expected pgcrypto, pg_trgm and postgis to be available; found ${available_extensions}/3." >&2
  exit 1
fi

echo "Checking Evidence Spine schema state..."
existing_tables="$(
  psql -Atq -v ON_ERROR_STOP=1 -c "
    SELECT count(*)
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'subjects',
        'sources',
        'source_snapshots',
        'observations',
        'claims'
      );
  "
)"

content_length_exists="$(
  psql -Atq -v ON_ERROR_STOP=1 -c "
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'source_snapshots'
      AND column_name = 'content_length';
  "
)"

case "${existing_tables}" in
  0)
    echo "Applying migrations/0001_evidence_spine.sql..."
    psql -v ON_ERROR_STOP=1 -f migrations/0001_evidence_spine.sql

    echo "Applying migrations/0002_snapshot_content_length.sql..."
    psql -v ON_ERROR_STOP=1 -f migrations/0002_snapshot_content_length.sql
    ;;
  5)
    if [ "${content_length_exists}" = "0" ]; then
      echo "Evidence Spine base schema exists; applying 0002..."
      psql -v ON_ERROR_STOP=1 -f migrations/0002_snapshot_content_length.sql
    else
      echo "Evidence Spine migrations are already applied."
    fi
    ;;
  *)
    echo "Refusing to migrate a partial Evidence Spine schema: ${existing_tables}/5 core tables exist." >&2
    exit 1
    ;;
esac

echo "Verifying production schema..."
verification="$(
  psql -Atq -v ON_ERROR_STOP=1 -c "
    SELECT
      (
        SELECT count(*)
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
          AND tablename IN (
            'subjects',
            'sources',
            'source_snapshots',
            'observations',
            'claims'
          )
      )::text
      || ':'
      ||
      (
        SELECT count(*)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'source_snapshots'
          AND column_name = 'content_length'
      )::text;
  "
)"

if [ "${verification}" != "5:1" ]; then
  echo "Schema verification failed: expected 5:1, got ${verification}" >&2
  exit 1
fi

echo "Evidence Spine production migration complete."
