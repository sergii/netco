BEGIN;

CREATE TABLE entities (
  id uuid PRIMARY KEY REFERENCES subjects(id),
  entity_type text NOT NULL
    CHECK (entity_type IN (
      'legal_entity',
      'brand',
      'network_operator',
      'service_provider'
    )),
  lifecycle_status text NOT NULL DEFAULT 'unknown'
    CHECK (lifecycle_status IN ('active', 'inactive', 'legacy', 'unknown')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resolution_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observed_subject_id uuid NOT NULL REFERENCES subjects(id),
  status text NOT NULL
    CHECK (status IN (
      'open',
      'matched',
      'no_match',
      'needs_review',
      'superseded'
    )),
  resolver_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (observed_subject_id, resolver_version)
);

CREATE TABLE resolution_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_case_id uuid NOT NULL REFERENCES resolution_cases(id),
  candidate_subject_id uuid NOT NULL REFERENCES subjects(id),
  score numeric(5,4),
  rank integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resolution_case_id, candidate_subject_id)
);

CREATE TABLE resolution_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_candidate_id uuid NOT NULL REFERENCES resolution_candidates(id),
  signal text NOT NULL,
  direction text NOT NULL
    CHECK (direction IN ('positive', 'negative', 'neutral')),
  strength numeric(5,4),
  value jsonb NOT NULL,
  source_id uuid REFERENCES sources(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX resolution_evidence_candidate_signal_unique
  ON resolution_evidence (resolution_candidate_id, signal);

CREATE TABLE resolution_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_case_id uuid NOT NULL REFERENCES resolution_cases(id),
  decision text NOT NULL
    CHECK (decision IN ('MATCH', 'POSSIBLE_MATCH', 'NO_MATCH', 'REVIEW')),
  canonical_subject_id uuid REFERENCES subjects(id),
  confidence numeric(5,4),
  decided_by text NOT NULL,
  resolver_version text,
  rationale jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    confidence IS NULL
    OR (confidence >= 0 AND confidence <= 1)
  )
);

CREATE INDEX resolution_decisions_case_time_idx
  ON resolution_decisions (resolution_case_id, created_at DESC);

CREATE TABLE plans (
  id uuid PRIMARY KEY REFERENCES subjects(id),
  provider_entity_id uuid NOT NULL REFERENCES entities(id),
  canonical_name text NOT NULL,
  normalized_name text NOT NULL,
  lifecycle_status text NOT NULL DEFAULT 'unknown'
    CHECK (lifecycle_status IN ('active', 'inactive', 'legacy', 'unknown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_entity_id, normalized_name)
);

CREATE INDEX plans_provider_idx
  ON plans (provider_entity_id, canonical_name);

CREATE TABLE plan_versions (
  id uuid PRIMARY KEY REFERENCES subjects(id),
  plan_id uuid NOT NULL REFERENCES plans(id),
  valid_from timestamptz,
  valid_to timestamptz,
  observed_at timestamptz NOT NULL,
  terms jsonb NOT NULL,
  source_id uuid NOT NULL REFERENCES sources(id),
  observation_id uuid REFERENCES observations(id),
  supporting_claim_id uuid NOT NULL UNIQUE REFERENCES claims(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from)
);

CREATE INDEX plan_versions_plan_time_idx
  ON plan_versions (plan_id, observed_at DESC);

CREATE TABLE provider_profiles (
  provider_id uuid PRIMARY KEY REFERENCES entities(id),
  slug text NOT NULL UNIQUE,
  display_name text,
  canonical_brand_name text,
  legal_name text,
  edrpou text,
  website text,
  lifecycle_status text NOT NULL DEFAULT 'unknown',
  residential boolean,
  business boolean,
  current_technologies jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_observed_at timestamptz,
  projection_version text NOT NULL,
  rebuilt_at timestamptz NOT NULL
);

CREATE TABLE provider_current_plans (
  provider_id uuid NOT NULL REFERENCES entities(id),
  plan_id uuid NOT NULL REFERENCES plans(id),
  plan_version_id uuid NOT NULL REFERENCES plan_versions(id),
  canonical_name text NOT NULL,
  terms jsonb NOT NULL,
  observed_at timestamptz NOT NULL,
  supporting_claim_id uuid NOT NULL REFERENCES claims(id),
  projection_version text NOT NULL,
  rebuilt_at timestamptz NOT NULL,
  PRIMARY KEY (provider_id, plan_id)
);

CREATE INDEX provider_current_plans_provider_name_idx
  ON provider_current_plans (provider_id, canonical_name);

CREATE TABLE provider_current_technologies (
  provider_id uuid NOT NULL REFERENCES entities(id),
  technology text NOT NULL,
  observed_label text,
  observed_at timestamptz NOT NULL,
  supporting_claim_id uuid NOT NULL REFERENCES claims(id),
  projection_version text NOT NULL,
  rebuilt_at timestamptz NOT NULL,
  PRIMARY KEY (provider_id, technology)
);

COMMIT;
