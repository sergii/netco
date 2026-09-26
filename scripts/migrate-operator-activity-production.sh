#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${NEON_PROJECT_ID:-ancient-haze-86966909}"
BRANCH="${NEON_BRANCH:-production}"
DATABASE="${NEON_DATABASE:-neondb}"
ROLE="${NEON_ROLE:-neondb_owner}"

if [ "${CONFIRM_OPERATOR_ACTIVITY_MIGRATION:-}" != "APPLY_VS18_OPERATOR_ACTIVITY" ]; then
  echo "Refusing to apply VS18 migration without CONFIRM_OPERATOR_ACTIVITY_MIGRATION=APPLY_VS18_OPERATOR_ACTIVITY" >&2
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

echo "Applying VS18 operator activity schema..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1   -f migrations/0006_operator_address_activity.sql

echo "Verifying VS18 operator activity schema..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "
  SELECT json_build_object(
    'table', to_regclass('public.operator_address_activity')::text,
    'runtime_select', has_table_privilege('hyperdrive-user', 'public.operator_address_activity', 'SELECT'),
    'runtime_insert', has_table_privilege('hyperdrive-user', 'public.operator_address_activity', 'INSERT'),
    'runtime_update', has_table_privilege('hyperdrive-user', 'public.operator_address_activity', 'UPDATE'),
    'runtime_delete', has_table_privilege('hyperdrive-user', 'public.operator_address_activity', 'DELETE')
  );
"
