BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  name text NOT NULL,
  canonical_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sources_canonical_url_unique
  ON sources (canonical_url)
  WHERE canonical_url IS NOT NULL;

CREATE TABLE source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id),
  url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  http_status integer NOT NULL,
  response_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  content_type text,
  body_ref text NOT NULL,
  fetch_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX source_snapshots_source_time_idx
  ON source_snapshots (source_id, fetched_at DESC);

CREATE INDEX source_snapshots_content_hash_idx
  ON source_snapshots (content_hash);

CREATE TABLE observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_snapshot_id uuid NOT NULL REFERENCES source_snapshots(id),
  schema_name text NOT NULL,
  schema_version text NOT NULL,
  extractor text NOT NULL,
  extractor_version text NOT NULL,
  normalizer_version text,
  extracted_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  validation_status text NOT NULL
    CHECK (validation_status IN ('valid', 'invalid', 'partial')),
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX observations_snapshot_idx
  ON observations (source_snapshot_id);

CREATE TABLE claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id),
  predicate text NOT NULL,
  value jsonb NOT NULL,
  scope_subject_id uuid REFERENCES subjects(id),
  source_id uuid NOT NULL REFERENCES sources(id),
  source_snapshot_id uuid NOT NULL REFERENCES source_snapshots(id),
  observation_id uuid REFERENCES observations(id),
  observed_at timestamptz NOT NULL,
  valid_from timestamptz,
  valid_to timestamptz,
  extraction_confidence numeric(5,4),
  status text NOT NULL DEFAULT 'asserted'
    CHECK (status IN ('asserted', 'retracted', 'superseded', 'rejected')),
  supersedes_claim_id uuid REFERENCES claims(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    extraction_confidence IS NULL
    OR (extraction_confidence >= 0 AND extraction_confidence <= 1)
  ),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from)
);

CREATE INDEX claims_subject_predicate_idx
  ON claims (subject_id, predicate, observed_at DESC);

CREATE INDEX claims_source_snapshot_idx
  ON claims (source_snapshot_id);

CREATE INDEX claims_observation_idx
  ON claims (observation_id)
  WHERE observation_id IS NOT NULL;

COMMIT;
