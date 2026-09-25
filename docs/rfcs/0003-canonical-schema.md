# RFC 0003 - Canonical Schema and Structured Contracts

Status: Draft  
Date: 2026-09-25

## Purpose

Turn RFC 0001 and RFC 0002 into an implementable PostgreSQL/Rails data model without collapsing the evidence-first architecture into mutable provider rows.

This RFC defines:

- the minimal persistent tables;
- the append-only evidence layer;
- canonical identity primitives;
- entity-resolution records;
- temporal conventions;
- read-model projections;
- JSON Schema boundaries for structured extraction;
- invariants and indexes needed for a practical V1.

The goal is not to model every future broadband concept now. The goal is to establish a stable spine that can accept richer data later without destructive migrations.

## Architectural split

Netco has two different data responsibilities.

### Knowledge system of record

Append-only or history-preserving records:

```text
sources
source_snapshots
observations
claims
subjects
entities
entity_names
relationships
resolution_cases
resolution_evidence
resolution_decisions
```

These preserve what was observed, when, where it came from, and how identity decisions were made.

### Product read model

Rebuildable projections optimized for API and UI queries:

```text
provider_profiles
provider_quality
provider_current_plans
provider_address_availability
provider_current_technologies
```

Projection tables are not the primary truth. They may be regenerated from the knowledge layer.

## Identifier strategy

Use UUID primary keys for knowledge objects.

Reasons:

- observations may eventually be produced by multiple workers;
- records may be imported from external pipelines;
- IDs should not expose row counts;
- append-only ingestion benefits from globally unique identifiers.

PostgreSQL UUID generation should use a database-supported generator.

Human-facing slugs are separate from primary keys.

## Subjects

Claims need a stable generic target without relying on weak polymorphic foreign keys.

Introduce a root subject registry:

```text
subjects
  id uuid primary key
  kind text not null
  created_at timestamptz not null
```

Initial subject kinds:

```text
legal_entity
brand
network_operator
service_provider
address
building
plan
plan_version
network
```

Domain tables use the same ID as their corresponding subject.

Example:

```text
subjects.id = entities.id
subjects.kind = brand
entities.id = same UUID
```

This gives `claims.subject_id` a real foreign key while keeping claims generic.

## Entities

```text
entities
  id uuid primary key references subjects(id)
  entity_type text not null
  lifecycle_status text not null default 'unknown'
  created_at timestamptz not null
```

Initial entity types:

```text
legal_entity
brand
network_operator
service_provider
```

Lifecycle states:

```text
active
inactive
legacy
unknown
```

Lifecycle status is a convenience projection and should not erase the claims supporting it.

## Sources

```text
sources
  id uuid primary key
  kind text not null
  name text not null
  canonical_url text
  metadata jsonb not null default '{}'
  created_at timestamptz not null
```

Suggested source kinds:

```text
official_registry
official_website
address_checker
official_api
partner_feed
aggregator
user_report
forum
social
manual
```

Do not place one universal authority score on a source.

Authority depends on predicate.

Example:

- regulator: high authority for legal identity;
- provider website: high authority for retail price;
- address checker: high authority for current orderability;
- user report: potentially useful for measured outage behavior.

Predicate-specific authority belongs in resolver policy.

## Source snapshots

```text
source_snapshots
  id uuid primary key
  source_id uuid not null references sources(id)
  url text not null
  fetched_at timestamptz not null
  http_status integer
  response_headers jsonb not null default '{}'
  content_hash text not null
  content_type text
  body_ref text
  fetch_metadata jsonb not null default '{}'
  created_at timestamptz not null
```

`body_ref` may point to database text initially and object storage later.

Recommended uniqueness:

```text
(source_id, url, content_hash)
```

Do not create a new extraction job if the source content is unchanged unless the extractor version changed and reprocessing is explicitly requested.

## Observations

```text
observations
  id uuid primary key
  source_snapshot_id uuid not null references source_snapshots(id)
  schema_name text not null
  schema_version text not null
  extractor text not null
  extractor_version text not null
  normalizer_version text
  extracted_at timestamptz not null
  payload jsonb not null
  validation_status text not null
  validation_errors jsonb not null default '[]'
  created_at timestamptz not null
```

Validation states:

```text
valid
invalid
partial
```

Invalid observations are retained for debugging but cannot create accepted claims automatically.

## Claims

```text
claims
  id uuid primary key
  subject_id uuid not null references subjects(id)
  predicate text not null
  value jsonb not null
  scope_subject_id uuid references subjects(id)
  source_id uuid not null references sources(id)
  source_snapshot_id uuid references source_snapshots(id)
  observation_id uuid references observations(id)
  observed_at timestamptz not null
  valid_from timestamptz
  valid_to timestamptz
  extraction_confidence numeric(4,3)
  status text not null default 'asserted'
  supersedes_claim_id uuid references claims(id)
  metadata jsonb not null default '{}'
  created_at timestamptz not null
```

Claim states:

```text
asserted
retracted
superseded
rejected
```

A correction does not delete an earlier claim.

It creates a new claim and may link through `supersedes_claim_id`.

### Claim examples

Brand name:

```json
{
  "predicate": "brand.name",
  "value": {"text": "Київстар", "language": "uk", "script": "Cyrl"}
}
```

Technology at a building:

```json
{
  "predicate": "service.technology",
  "value": {"technology": "gpon"},
  "scope_subject_id": "building-subject-id"
}
```

Price:

```json
{
  "predicate": "plan.monthly_price",
  "value": {"amount": "399.00", "currency": "UAH"}
}
```

## Predicate registry

Do not allow arbitrary free-form predicates forever.

V1 may begin with application constants, but the namespace should already be controlled.

Suggested namespaces:

```text
identity.*
legal.*
brand.*
service.*
network.*
coverage.*
plan.*
pricing.*
resilience.*
contact.*
relationship.*
```

A future `predicate_definitions` table may define:

- expected value schema;
- allowed subject kinds;
- whether scope is required;
- resolver policy;
- freshness policy.

Until then, these rules live in versioned application code.

## Entity names

```text
entity_names
  id uuid primary key
  entity_id uuid not null references entities(id)
  value text not null
  normalized_value text not null
  language text
  script text
  name_type text not null
  source_id uuid references sources(id)
  valid_from timestamptz
  valid_to timestamptz
  observed_at timestamptz
  created_at timestamptz not null
```

Name types:

```text
official
legal
localized
transliterated
legacy
former_brand
colloquial
domain
abbreviation
misspelling
```

Observed names and generated search terms remain separate.

Generated search terms may live in a projection or search index.

## Relationships

```text
relationships
  id uuid primary key
  subject_id uuid not null references subjects(id)
  predicate text not null
  object_subject_id uuid not null references subjects(id)
  source_id uuid references sources(id)
  observation_id uuid references observations(id)
  observed_at timestamptz
  valid_from timestamptz
  valid_to timestamptz
  status text not null default 'asserted'
  metadata jsonb not null default '{}'
  created_at timestamptz not null
```

Initial relationship predicates:

```text
owns
operates
markets_as
resells
acquired
successor_of
formerly_known_as
uses_network_of
```

Relationships are temporal and provenance-bearing.

## Addresses and buildings

Address normalization is its own bounded context.

### Addresses

```text
addresses
  id uuid primary key references subjects(id)
  country_code text not null
  region text
  city text
  district text
  street text
  house_number text
  corpus text
  building_letter text
  postal_code text
  latitude numeric
  longitude numeric
  normalized_key text
  created_at timestamptz not null
```

### Address aliases

```text
address_aliases
  id uuid primary key
  address_id uuid not null references addresses(id)
  value text not null
  alias_type text not null
  source_id uuid references sources(id)
  valid_from timestamptz
  valid_to timestamptz
  created_at timestamptz not null
```

Potential alias types:

```text
official
historical
abbreviated
localized
source_specific
```

Do not assume street plus house number is globally unique.

Use country/city context and, when available, external address identifiers.

## Plans

Plans have identity; commercial terms have versions.

### Plans

```text
plans
  id uuid primary key references subjects(id)
  provider_entity_id uuid not null references entities(id)
  canonical_name text
  lifecycle_status text not null default 'unknown'
  created_at timestamptz not null
```

### Plan versions

```text
plan_versions
  id uuid primary key references subjects(id)
  plan_id uuid not null references plans(id)
  valid_from timestamptz
  valid_to timestamptz
  observed_at timestamptz not null
  terms jsonb not null
  source_id uuid not null references sources(id)
  observation_id uuid references observations(id)
  created_at timestamptz not null
```

Typical `terms` dimensions:

```text
download_speed
upload_speed
technology
monthly_recurring
promo_price
promo_duration
price_after_promo
installation_fee
activation_fee
equipment_purchase
equipment_rental
deposit
contract_period
new_customers_only
bundle_requirement
autopay_requirement
currency
tax_inclusion
```

Use a structured JSON schema for `terms`; do not allow arbitrary blobs without validation.

## Coverage and availability

Do not introduce a single `coverage = true` field.

V1 can represent coverage as claims scoped to an address or building subject.

Recommended predicates:

```text
coverage.network_present
coverage.service_available
coverage.orderable
coverage.installation_required
coverage.installation_confirmed
coverage.active_subscriber_observed
```

Example:

```text
subject_id       = service provider
predicate        = coverage.orderable
value            = {"value": true}
scope_subject_id = building
```

If entrance or apartment granularity becomes necessary, add subject kinds for those location objects rather than overloading building IDs.

## Resilience

V1 should also represent resilience as scoped claims instead of a provider column.

Recommended predicates:

```text
resilience.claimed_duration
resilience.measured_duration
resilience.backup_type
resilience.requires_customer_power
```

Scope may be:

- network;
- building;
- geographic area;
- technology.

The evidence type belongs in claim metadata or a structured claim value.

## Missing-data model

Absence of a claim is not sufficient to explain why data is absent.

Introduce explicit gap tracking:

```text
data_gaps
  id uuid primary key
  subject_id uuid not null references subjects(id)
  field_key text not null
  state text not null
  checked_at timestamptz
  strategy text
  source_id uuid references sources(id)
  details jsonb not null default '{}'
  created_at timestamptz not null
  updated_at timestamptz not null
```

States:

```text
not_collected
not_found
not_disclosed
unknown
unverified
not_applicable
conflicting
stale
resolved
```

Unlike claims, gap rows are operational state and may be updated.

The observations and claims that led to a gap remain immutable.

## Entity-resolution model

Entity resolution must preserve candidates, evidence, and decisions.

### Resolution cases

```text
resolution_cases
  id uuid primary key
  observed_subject_id uuid not null references subjects(id)
  status text not null
  resolver_version text not null
  created_at timestamptz not null
  resolved_at timestamptz
```

States:

```text
open
matched
no_match
needs_review
superseded
```

### Resolution candidates

```text
resolution_candidates
  id uuid primary key
  resolution_case_id uuid not null references resolution_cases(id)
  candidate_subject_id uuid not null references subjects(id)
  score numeric
  rank integer
  created_at timestamptz not null
```

### Resolution evidence

```text
resolution_evidence
  id uuid primary key
  resolution_candidate_id uuid not null references resolution_candidates(id)
  signal text not null
  direction text not null
  strength numeric
  value jsonb not null
  source_id uuid references sources(id)
  created_at timestamptz not null
```

Directions:

```text
positive
negative
neutral
```

Signals may include:

```text
same_edrpou
different_edrpou
same_domain
same_phone
same_address
same_legal_name
similar_brand_name
historical_relationship
```

### Resolution decisions

```text
resolution_decisions
  id uuid primary key
  resolution_case_id uuid not null references resolution_cases(id)
  decision text not null
  canonical_subject_id uuid references subjects(id)
  confidence numeric(4,3)
  decided_by text not null
  resolver_version text
  rationale jsonb not null default '{}'
  created_at timestamptz not null
```

Decisions:

```text
MATCH
POSSIBLE_MATCH
NO_MATCH
REVIEW
```

`decided_by` may identify:

```text
rule
model
human
import
```

A later decision can supersede an earlier resolution without deleting history.

## Projection tables

The first consumer-facing read model should be deliberately boring.

### provider_profiles

Suggested fields:

```text
provider_id
display_name
canonical_brand_name
legal_name
edrpou
website
lifecycle_status
residential
business
current_technologies
last_observed_at
projection_version
rebuilt_at
```

### provider_quality

```text
provider_id
completeness_score
freshness_score
authority_score
resolution_confidence
conflict_count
coverage_depth
computed_at
projection_version
```

### provider_current_plans

Flatten the currently effective plan versions for fast comparison queries.

### provider_address_availability

Suggested key:

```text
provider_id
address_or_building_id
service_kind
technology
availability_state
observed_at
fresh_until
supporting_claim_id
```

Read models may be regular tables refreshed by jobs initially. Materialized views are optional.

## Temporal conventions

Use `timestamptz` consistently.

Semantics:

```text
observed_at = when Netco/source observation was made
valid_from  = when the fact becomes effective in the real world
valid_to    = when the fact stops being effective in the real world
created_at  = when the database record was created
```

Do not overload `updated_at` to represent business history.

For ranges, use half-open semantics:

```text
[valid_from, valid_to)
```

## Structured contracts

The repository should contain machine-readable contracts under `schemas/`.

Initial schemas:

```text
schemas/provider-observation.v1.schema.json
schemas/claim.v1.schema.json
schemas/entity-resolution-decision.v1.schema.json
```

These contracts define the boundary between extraction/resolution workers and persisted data.

A payload must be validated before it can create accepted claims or resolution decisions.

## Recommended indexes

### source_snapshots

```text
index on (source_id, fetched_at desc)
unique/index on (source_id, url, content_hash)
index on content_hash
```

### observations

```text
index on source_snapshot_id
index on (schema_name, schema_version)
index on extracted_at
```

### claims

```text
index on (subject_id, predicate)
index on (subject_id, predicate, observed_at desc)
index on scope_subject_id
index on source_id
index on observation_id
GIN index on value only after actual query patterns justify it
```

### entity_names

```text
index on entity_id
index on normalized_value
trigram index on normalized_value for candidate generation
```

### relationships

```text
index on subject_id
index on object_subject_id
index on (subject_id, predicate)
```

### data_gaps

```text
unique/index on (subject_id, field_key)
index on (state, checked_at)
```

### resolution

```text
index on resolution_cases(status)
index on resolution_candidates(resolution_case_id, rank)
index on resolution_decisions(resolution_case_id, created_at desc)
```

## PostgreSQL extensions

Potentially useful:

```text
pgcrypto
pg_trgm
unaccent
```

Do not add PostGIS until geographic query requirements justify it.

Latitude/longitude columns are enough for the earliest Kyiv bootstrap if spatial operations remain simple.

## Rails boundaries

Suggested application modules:

```text
Sources
Ingestion
Knowledge
Identity
Catalog
Coverage
Pricing
Addresses
Resolution
Enrichment
Projections
```

Avoid one giant `Provider` model with dozens of callbacks.

Domain services should perform:

- ingestion;
- claim creation;
- resolution;
- projection rebuilds.

Active Record models should primarily enforce persistence invariants.

## V1 implementation order

Implement only what is needed to ingest and resolve the first Kyiv provider registry.

### Slice 1 - Evidence spine

```text
subjects
sources
source_snapshots
observations
claims
entities
entity_names
```

Acceptance:

- ingest one source snapshot;
- validate one provider observation;
- create claims;
- show provenance end to end.

### Slice 2 - Entity resolution

```text
resolution_cases
resolution_candidates
resolution_evidence
resolution_decisions
```

Acceptance:

- ingest two spellings of one provider;
- produce candidate evidence;
- match them without deleting either observed identity;
- reverse the decision.

### Slice 3 - Provider projection

```text
provider_profiles
provider_quality
data_gaps
```

Acceptance:

- rebuild canonical provider profile entirely from evidence;
- show missing/conflicting fields;
- change resolver rules and rebuild without editing source evidence.

### Slice 4 - Plans and addresses

```text
addresses
address_aliases
plans
plan_versions
provider_address_availability
```

Acceptance:

- represent current and historical plan price;
- represent address-scoped orderability;
- preserve source and observation timestamps.

## Explicit non-goals for V1

Do not build yet:

- a generic RDF store;
- a graph database;
- a universal ontology engine;
- PostGIS-heavy spatial modeling;
- automatic irreversible merges;
- one global confidence score;
- event sourcing for every operational table.

PostgreSQL plus explicit evidence tables is sufficient.

## Invariants

1. A claim cannot exist without a valid subject and source.
2. Accepted machine-generated claims must point to a valid observation.
3. Observations must record schema and extractor versions.
4. Source snapshots are immutable.
5. Claims are never silently overwritten.
6. Entity-resolution decisions are historical and reversible.
7. Projection rows may be deleted and rebuilt.
8. Search-normalization output is not evidence.
9. Provider-wide facts must not be inferred from address-scoped claims without an explicit aggregation rule.
10. Business-effective time and observation time remain distinct.
11. Missing-data state is explicit when Netco has attempted collection.
12. Product API queries should normally read projections, not reconstruct canonical truth from raw claims on every request.

## Open questions

- Should source bodies initially live in PostgreSQL or object storage?
- Which Ukrainian address dataset should provide stable external identifiers?
- Which claims deserve typed relational tables after query patterns emerge?
- Should plan versions remain first-class rows plus claims, or should all commercial terms eventually be claims?
- What projection refresh model is sufficient for V1: synchronous, job-based, or incremental?
- Should authoritative registry imports create entities directly or still pass through observed subjects and resolution?
