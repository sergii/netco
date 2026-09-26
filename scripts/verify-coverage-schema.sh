#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  missing text[] := ARRAY[]::text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.addresses'::regclass
      AND contype = 'p'
      AND conname = 'addresses_pkey'
  ) THEN
    missing := array_append(missing, 'addresses_pkey');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.addresses'::regclass
      AND contype = 'u'
      AND conname = 'addresses_normalized_key_key'
  ) THEN
    missing := array_append(missing, 'addresses_normalized_key_key');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.addresses'::regclass
      AND contype = 'f'
      AND conname = 'addresses_id_fkey'
  ) THEN
    missing := array_append(missing, 'addresses_id_fkey');
  END IF;

  IF (
    SELECT count(*)
    FROM pg_constraint
    WHERE conrelid = 'public.addresses'::regclass
      AND contype = 'c'
  ) <> 2 THEN
    missing := array_append(missing, 'addresses_checks');
  END IF;

  IF to_regclass('public.addresses_city_street_house_idx') IS NULL THEN
    missing := array_append(missing, 'addresses_city_street_house_idx');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.address_aliases'::regclass
      AND contype = 'p'
      AND conname = 'address_aliases_pkey'
  ) THEN
    missing := array_append(missing, 'address_aliases_pkey');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.address_aliases'::regclass
      AND contype = 'f'
      AND conname = 'address_aliases_address_id_fkey'
  ) THEN
    missing := array_append(missing, 'address_aliases_address_id_fkey');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.address_aliases'::regclass
      AND contype = 'f'
      AND conname = 'address_aliases_source_id_fkey'
  ) THEN
    missing := array_append(missing, 'address_aliases_source_id_fkey');
  END IF;

  IF (
    SELECT count(*)
    FROM pg_constraint
    WHERE conrelid = 'public.address_aliases'::regclass
      AND contype = 'c'
  ) <> 1 THEN
    missing := array_append(missing, 'address_aliases_check');
  END IF;

  IF to_regclass('public.address_aliases_address_idx') IS NULL THEN
    missing := array_append(missing, 'address_aliases_address_idx');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.provider_address_availability'::regclass
      AND contype = 'p'
      AND conname = 'provider_address_availability_pkey'
  ) THEN
    missing := array_append(missing, 'provider_address_availability_pkey');
  END IF;

  IF (
    SELECT count(*)
    FROM pg_constraint
    WHERE conrelid = 'public.provider_address_availability'::regclass
      AND contype = 'f'
  ) <> 3 THEN
    missing := array_append(missing, 'provider_address_availability_fks');
  END IF;

  IF (
    SELECT count(*)
    FROM pg_constraint
    WHERE conrelid = 'public.provider_address_availability'::regclass
      AND contype = 'c'
  ) <> 1 THEN
    missing := array_append(missing, 'provider_address_availability_check');
  END IF;

  IF to_regclass('public.provider_address_availability_address_idx') IS NULL THEN
    missing := array_append(missing, 'provider_address_availability_address_idx');
  END IF;

  IF to_regclass('public.provider_address_availability_provider_idx') IS NULL THEN
    missing := array_append(missing, 'provider_address_availability_provider_idx');
  END IF;

  IF cardinality(missing) > 0 THEN
    RAISE EXCEPTION 'coverage schema is not canonical: %', array_to_string(missing, ', ');
  END IF;
END
$$;

SELECT json_build_object(
  'addresses', (SELECT count(*) FROM addresses),
  'address_aliases', (SELECT count(*) FROM address_aliases),
  'provider_address_availability', (SELECT count(*) FROM provider_address_availability),
  'canonical', true
);
SQL
