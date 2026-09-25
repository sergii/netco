# RFC 0001 - Provider Knowledge Model

Status: Draft  
Date: 2026-09-25

## Context

Internet-provider data is not a clean catalog problem. A single provider can have:

- an official brand name;
- one or more legal entities;
- historical or colloquial names;
- Cyrillic and Latin spellings;
- transliterations;
- multiple domains;
- acquired or former brands;
- infrastructure operated by another entity;
- different technologies at different addresses;
- conflicting claims across sources;
- tariffs that change over time;
- marketing claims that are not independently verified.

The model must preserve evidence and uncertainty instead of flattening everything into one mutable provider row.

## Decision

Netco will model source evidence first and derive canonical views from it.

```text
Source
  -> Snapshot
  -> Observation
  -> Claim
  -> Entity Resolution / Conflict Resolution
  -> Canonical Projection
```

Canonical data is a projection over claims, not the primary storage of truth.

## Core entities

### Source

Represents where information came from.

Examples:

- official provider website;
- official registry;
- address checker;
- aggregator;
- partner feed;
- user report;
- forum or social source.

Suggested fields:

```text
Source
  id
  kind
  name
  url
  authority_profile
```

Authority is contextual. An official regulator can be authoritative for a legal name while a provider website can be more authoritative for a current retail tariff.

### Snapshot

Immutable capture of source material.

```text
Snapshot
  id
  source_id
  url
  fetched_at
  http_status
  headers
  content_hash
  body/blob_reference
```

Snapshots are append-only.

If a new fetch has the same content hash, extraction may be skipped.

### Observation

Structured representation of what was extracted from a snapshot.

An observation is not truth. It means only:

> this source appeared to state this information at this time.

```text
Observation
  id
  snapshot_id
  schema_version
  extractor
  extractor_version
  extracted_at
  payload
```

### Claim

A first-class assertion derived from an observation.

Example:

```json
{
  "subject": "provider:123",
  "predicate": "offers_technology",
  "value": "gpon",
  "scope": {
    "address_id": "address:987"
  },
  "observed_at": "2026-09-25T06:00:00+03:00",
  "valid_from": null,
  "valid_to": null,
  "source_id": "source:official-site",
  "extraction_confidence": 0.98
}
```

Claims are append-only.

Conflicting claims coexist. They are resolved later.

## Provider is not one entity

The word "provider" hides several distinct concepts.

Netco should distinguish at least:

```text
LegalEntity
Brand
NetworkOperator
ServiceProvider
```

These may be connected by relationships such as:

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

This prevents future schema breakage when a brand is acquired, renamed, resold, or delivered over infrastructure operated by another company.

## Names and aliases

Names must not be compressed into a single `name` field.

Suggested model:

```text
EntityName
  entity_id
  value
  normalized_value
  language
  script
  type
  valid_from
  valid_to
  source_id
```

Name types may include:

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

Example for one entity:

```text
Teremki LAN
Теремки LAN
Теремки ЛАН
teremki@lan
Теремки
```

Observed aliases and generated search forms are different concepts.

A transliteration generated for search must not automatically become an alias claim. It may never have been used by the provider itself.

```text
aliases      = observed facts
search_terms = derived values
```

## Canonical names

A canonical name should normally reflect the provider's currently used brand, not an automatic transliteration or translation.

Example:

```text
canonical_name = Київстар

aliases:
  Kyivstar
  Kyiv Star
  Киевстар
```

Canonical choice is a resolution decision and must be reproducible from evidence.

## Entity resolution

Extraction must never directly merge entities.

Pipeline:

```text
ObservedEntity
  -> CandidateGeneration
  -> MatchEvidence
  -> ResolutionDecision
  -> CanonicalEntity
```

Potential matching evidence:

```text
same EDRPOU
same official domain
same phone
same address
same legal name
similar brand name
historical relationship
```

Possible outcomes:

```text
MATCH
POSSIBLE_MATCH
NO_MATCH
REVIEW
```

A merge must be reversible.

Do not destroy the original observed entities when canonical identities change.

## Structured field state

`null` is insufficient.

A field can be:

```text
known
not_collected
not_found
not_disclosed
unknown
unverified
not_applicable
conflicting
stale
```

Examples:

```text
EDRPOU not_collected
```

means Netco has not tried to retrieve it.

```text
EDRPOU not_found
```

means the expected strategy ran and did not find a value.

These states drive enrichment differently.

## Provenance dimensions

The following must not be collapsed into one confidence score:

```text
extraction_confidence
source_authority
resolution_confidence
```

A parser may have 0.99 confidence that a low-authority forum said something. That does not make the claim authoritative.

## Temporal model

Two different timestamps are required:

```text
observed_at
effective_at / valid_from / valid_to
```

Example:

A provider publishes on September 25 that a new tariff starts October 1.

```text
observed_at = 2026-09-25
valid_from  = 2026-10-01
```

This creates a bitemporal-like model:

- when was the claim true;
- when did Netco learn about it.

## Plans and pricing

Plans are versioned. Prices are not updated in place.

```text
Plan
  -> PlanVersion
```

Example:

```text
PlanVersion #1
  monthly_price = 399
  valid_to = 2026-09-30

PlanVersion #2
  monthly_price = 449
  valid_from = 2026-10-01
```

Pricing needs more dimensions than `promo_price` and `regular_price`:

```text
monthly_recurring
one_time_installation
equipment_purchase
equipment_rental
deposit
activation
contract_period
promo_duration
price_after_promo
new_customers_only
bundle_requirement
autopay_requirement
currency
tax_inclusion
```

This enables meaningful total-cost comparisons.

## Coverage

Coverage is not boolean.

Useful states include:

```text
network_present
service_available
orderable
installation_required
installation_confirmed
active_subscriber_observed
```

Coverage is scoped.

Potential location scopes:

```text
city
district
street
building
entrance
floor
apartment
```

A provider may have fiber in a building while having no free port for a specific entrance or apartment.

## Address model

Addresses should be a separate bounded context.

Avoid long-term dependence on:

```text
street = "Антоновича"
house = "100"
```

Potential model:

```text
CanonicalAddress
AddressAlias
Building
Entrance
GeoPoint
AdministrativeArea
ExternalAddressIdentifier
```

The same place may have historical street names, spelling variants, abbreviations, building suffixes, corps numbers, or letters.

## Power-outage resilience

Resilience must not be a provider-level scalar.

It can vary by:

- network;
- technology;
- building;
- node;
- region;
- backup configuration.

Suggested model:

```text
ResilienceClaim
  provider
  network
  technology
  geographic_scope
  claimed_duration
  conditions
  evidence_type
  source
  observed_at
```

Evidence types may include:

```text
claimed
measured
user_reported
verified
```

This dataset may become especially valuable in Ukraine.

## Data quality

Do not rely on one generic completeness score.

Track dimensions separately:

```text
completeness
freshness
confidence
authority
conflict_count
coverage_depth
```

A record can be 95% complete while badly stale.

Aggregated health indicators are acceptable for internal UI, but the underlying dimensions must remain visible.

## Canonical projection

Canonical views are derived from claims using explicit resolution rules.

```text
claims
  -> resolution rules
  -> ProviderProjection
```

Example UI:

```text
Technology

GPON                         canonical
Official provider site      observed 25 Sep

EPON                         conflicting
Aggregator source            observed 12 Sep
```

Changing resolution rules must not require rewriting historical evidence.

## Invariants

1. Raw evidence is immutable.
2. Claims are append-only.
3. LLM extraction cannot directly mutate canonical provider state.
4. Entity resolution is reversible.
5. Canonical projections are reproducible.
6. Temporal history is preserved.
7. Every material value retains provenance.
8. Missing and conflicting data are explicit states.
9. Search normalization is not treated as observed identity.
10. Address-scoped facts remain scoped and are not promoted to provider-wide facts without evidence.
