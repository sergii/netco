#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${NEON_PROJECT_ID:-ancient-haze-86966909}"
BRANCH="${NEON_BRANCH:-production}"
DATABASE="${NEON_DATABASE:-neondb}"
ROLE="${NEON_ROLE:-neondb_owner}"

if [ "${CONFIRM_COVERAGE_RESET:-}" != "RECONCILE_COVERAGE_VS5" ]; then
  echo "Refusing to reconcile coverage schema without CONFIRM_COVERAGE_RESET=RECONCILE_COVERAGE_VS5" >&2
  exit 1
fi

command -v neon >/dev/null 2>&1 || {
  echo "Neon CLI is required" >&2
  exit 1
}

command -v psql >/dev/null 2>&1 || {
  echo "psql is required" >&2
  exit 1
}

DATABASE_URL="$(
  neon connection-string "$BRANCH"     --project-id "$PROJECT_ID"     --database-name "$DATABASE"     --role-name "$ROLE"
)"

export DATABASE_URL

echo "Current coverage row counts:"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "
  SELECT
    (SELECT count(*) FROM addresses)::text || ':' ||
    (SELECT count(*) FROM address_aliases)::text || ':' ||
    (SELECT count(*) FROM provider_address_availability)::text;
"

echo "Reconciling Coverage VS5 tables to canonical schema..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0005_reconcile_coverage_schema.sql

echo "Verifying canonical Coverage VS5 schema..."
bash scripts/verify-coverage-schema.sh

echo "Coverage VS5 canonical schema reconciliation complete."
