# RFC 0008 - Provider Resolution, Plan Identity, and Rebuildable Projections

Date: 2026-09-25
Status: Draft

## Context

Evidence Spine, bounded crawling, and typed extraction now produce append-only claims such as:

```text
identity.display_name
web.official_site
plan.catalog_entry
service.technology
coverage.checker_entrypoint
```

These claims are evidence, not product read models.

The next boundary is turning claims into stable domain identities and current projections without overwriting or weakening provenance.

## Decision

Projection / Resolution VS4 introduces four distinct layers:

```text
observed provider_candidate
  -> resolution case / evidence / decision
  -> canonical service_provider entity
  -> Plan / PlanVersion identities
  -> rebuildable provider projections
```

Historical claims remain the source of truth.

Projection rows may be deleted and rebuilt.

## Canonical provider identity

Observed provider candidates and canonical providers use different subject IDs.

A source registry entry therefore carries:

```text
subject_id   = observed provider candidate
provider_id  = canonical service provider
provider_slug = product-facing stable slug
```

The initial resolver policy is:

```text
official-source-self/v1
```

Despite the historical name, the rule now maps an observed provider candidate to a separate canonical provider subject.

The rule requires an asserted official-source identity claim.

It records:

- resolution case;
- canonical candidate;
- positive identity evidence;
- positive website evidence when available;
- MATCH decision;
- resolver version;
- rationale.

The decision is historical and may be superseded by a future resolver version.

## Why the registry contains provider_id

VS4 needs a stable bootstrap canonical identifier before generic multi-candidate entity resolution exists.

The registry supplies that stable identity for the first manually curated providers.

This is a bootstrap mechanism, not the final candidate-generation system.

Future resolver versions may create or select canonical providers dynamically.

## Entity model

Canonical provider subjects use:

```text
subjects.kind = service_provider
entities.entity_type = service_provider
```

Observed candidates retain:

```text
subjects.kind = provider_candidate
```

This avoids mutating the semantic type of historical observed subjects.

## Plans

Plan identity is stable across observations.

```text
plans
  provider_entity_id
  canonical_name
  normalized_name
```

Initial plan matching is deterministic:

```text
canonical provider + normalized plan name
```

This is intentionally conservative.

It does not attempt fuzzy matching or cross-provider plan merging.

## Plan versions

Every accepted `plan.catalog_entry` claim may produce one PlanVersion.

```text
plan_versions
  plan_id
  terms
  observed_at
  source_id
  observation_id
  supporting_claim_id
```

`supporting_claim_id` is unique.

This preserves one-to-one provenance between a PlanVersion and the claim that created it.

Repeated identical commercial terms may therefore exist as multiple historical PlanVersions when observed at different times.

That is preferable to losing observation history.

A future compaction/change-period layer may derive effective commercial periods.

## Extractor-version policy

Current projections must not mix obsolete parser generations.

For each:

```text
source_snapshot + schema_name
```

VS4 selects the highest numeric extractor version with a valid observation.

Claims from older extractor versions remain append-only history but do not affect current projections.

## Current projections

### provider_profiles

Contains:

- canonical provider ID;
- product slug;
- display name;
- canonical brand name;
- website;
- lifecycle state;
- current technologies;
- latest observation timestamp;
- projection version;
- rebuild timestamp.

### provider_current_plans

Contains one current PlanVersion per Plan.

The current version is selected by latest:

```text
observed_at
created_at
plan_version id
```

### provider_current_technologies

Contains one current row per normalized technology.

The latest accepted claim wins for that technology.

## Rebuild semantics

Projection rebuild is deterministic and idempotent.

It may:

- create missing canonical domain identities;
- add new PlanVersions for previously unseen claims;
- delete and rebuild current projection rows;
- update provider profile rows.

It must not:

- delete observations;
- delete claims;
- rewrite source snapshots;
- mutate historical resolution decisions;
- silently merge distinct observed provider candidates.

## API boundary

Product-facing reads use projections:

```text
GET /api/v1/providers
GET /api/v1/providers/:slug
```

Evidence endpoints remain available separately.

The provider response contains:

- canonical provider profile;
- current plans;
- current technologies;
- latest matching resolution decision.

## Initial production acceptance

The first target is Lanet.

Expected canonical flow:

```text
observed subject:
820ee63f-3b2e-4b34-b1d5-3cc7bceab64d

canonical provider:
4bf8f950-5943-4f43-a820-457de9d4beef

provider slug:
lanet
```

Acceptance requires:

- MATCH resolution decision;
- canonical service_provider entity;
- at least one Plan;
- at least one PlanVersion;
- current plan projection;
- current technology projection;
- provider profile built entirely from claims and resolution configuration.

## Deferred

- fuzzy provider candidate generation;
- cross-source duplicate provider resolution;
- human review UI;
- reversible superseding resolution decisions;
- Plan aliases and fuzzy plan matching;
- effective price-period compaction;
- provider_quality;
- address-scoped availability projection.
