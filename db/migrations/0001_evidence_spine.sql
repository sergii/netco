BEGIN;

CREATE TABLE sources (
  id uuid PRIMARY KEY,
  kind text NOT NULL,
  name text NOT NULL,
  canonical_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subjects (
  id uuid PRIMARY KEY,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE entities (
  id uuid PRIMARY KEY REFERENCES subjects(id),
  entity_type text NOT NULL
    CHECK (entity_type IN ('legal_entity', 'brand', 'network_operator', 'service_provider')),
  lifecycle_status text NOT NULL DEFAULT 'unknown'
    CHECK (lifecycle_status IN ('active', 'inactive', 'legacy', 'unknown')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE entity_names (
  id uuid PRIMARY KEY,
  entity_id uuid NOT NULL REFERENCES entities(id),
  value text NOT NULL,
  normalized_value text NOT NULL,
  language text,
  script text,
  name_type text NOT NULL,
  source_id uuid REFERENCES sources(id),
  valid_from timestamptz,
  valid_to timestamptz,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE source_snapshots (
  id uuid PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES sources(id),
  url text NOT NULL,
  fetched_at timestamptz NOT NULL,
  http_status integer NOT NULL CHECK (http_status BETWEEN 100 AND 599),
  response_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  content_type text,
  content_length bigint,
  body_ref text NOT NULL,
  fetch_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE observations (
  id uuid PRIMARY KEY,
  source_snapshot_id uuid NOT NULL REFERENCES source_snapshots(id),
  schema_name text NOT NULL,
  schema_version text NOT NULL,
  extractor text NOT NULL,
  extractor_version text NOT NULL,
  normalizer_version text,
  extracted_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  validation_status text NOT NULL
    CHECK (validation_status IN ('valid', 'partial', 'invalid')),
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE claims (
  id uuid PRIMARY KEY,
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
  extraction_confidence numeric(5,4)
    CHECK (extraction_confidence IS NULL OR extraction_confidence BETWEEN 0 AND 1),
  status text NOT NULL DEFAULT 'asserted'
    CHECK (status IN ('asserted', 'retracted', 'superseded', 'rejected')),
  supersedes_claim_id uuid REFERENCES claims(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX entity_names_normalized_value_idx
  ON entity_names (normalized_value);

CREATE INDEX source_snapshots_source_fetched_idx
  ON source_snapshots (source_id, fetched_at DESC);

CREATE INDEX source_snapshots_content_hash_idx
  ON source_snapshots (content_hash);

CREATE INDEX observations_snapshot_idx
  ON observations (source_snapshot_id);

CREATE INDEX claims_subject_predicate_observed_idx
  ON claims (subject_id, predicate, observed_at DESC);

CREATE INDEX claims_snapshot_idx
  ON claims (source_snapshot_id);

CREATE INDEX claims_observation_idx
  ON claims (observation_id);

COMMIT;
