# Implementation 0009 - Projection / Resolution VS4 Production Acceptance

Date: 2026-09-25
Status: Proven in production

## Goal

Prove the first product-facing read model built entirely from append-only evidence and claims:

```text
provider_candidate claims
  -> resolution case
  -> resolution evidence
  -> MATCH decision
  -> canonical service_provider
  -> Plan
  -> PlanVersion
  -> provider_current_plans
  -> provider_current_technologies
  -> provider profile API
```

No source snapshot, observation, or historical claim is rewritten by projection rebuild.

## Production schema

Migration:

```text
migrations/0003_resolution_projection.sql
```

Production migration completed successfully.

The Worker reports:

```text
projection_schema_ready: true
projection_tables: 10
```

The 10 VS4 tables are:

```text
entities
resolution_cases
resolution_candidates
resolution_evidence
resolution_decisions
plans
plan_versions
provider_profiles
provider_current_plans
provider_current_technologies
```

## Production deployment

Feature commit:

```text
9224a38e9cf2fa3ebb77274f2c880b5f500d925f
```

Temporary acceptance schedule commit:

```text
b11ac69d98923e7eae602a6046f2d434f352d678
```

Cloudflare build completed successfully.

## Cron propagation finding

For production acceptance, cron was temporarily changed to:

```text
* * * * *
```

Cloudflare documents that Cron Trigger changes can take several minutes, up to 15 minutes, to propagate globally.

The first scheduled invocation for the new trigger became visible before the provider projection appeared.

This acceptance therefore verifies the real production scheduled path rather than a test-only mutation endpoint.

## Canonical provider identity

Observed Lanet provider candidate:

```text
820ee63f-3b2e-4b34-b1d5-3cc7bceab64d
```

Canonical Lanet service provider:

```text
4bf8f950-5943-4f43-a820-457de9d4beef
```

Product slug:

```text
lanet
```

The IDs are deliberately different.

The observed subject remains evidence-bearing `provider_candidate`.

The canonical subject is a separate `service_provider`.

## Resolution result

Resolution case:

```text
bf3ff66c-509a-485b-bc87-6241738d91de
```

Decision:

```text
MATCH
```

Confidence:

```text
1.0
```

Resolver:

```text
official-source-self/v1
```

The initial resolver is a bootstrap policy over curated official-source identity.

The decision is persisted historically and may be superseded by a future resolver version.

## Provider projection

Production endpoint:

```text
GET /api/v1/providers/lanet
```

returned HTTP 200.

Representative provider profile:

```text
id: 4bf8f950-5943-4f43-a820-457de9d4beef
slug: lanet
display_name: Мережа Ланет
canonical_brand_name: Мережа Ланет
website: https://www.lanet.ua/
current_technologies: [xpon]
projection_version: provider-projection/v1
```

## Current plan

Plan:

```text
plan_id:
e13ba009-94e0-4304-9ac3-99eee53f4b41

canonical_name:
PON.T
```

Current PlanVersion:

```text
plan_version_id:
6a1fd8ae-0184-4950-aa42-c62d9d9b9ca3

download_mbps:
5000

technology:
xpon

promo_price:
67.00 UAH

promo_duration_months:
6

monthly_price:
null

price_after_promo:
null
```

Supporting claim:

```text
bb0477f2-892b-4c2d-bea4-46222623c0a9
```

This preserves the v4 extraction semantics: 67 UAH remains promotional and is not promoted to recurring monthly price.

## Current technology

Projected technology:

```text
technology:
xpon

observed_label:
PON
```

Supporting claim:

```text
00cf640b-242e-46ac-954e-554fb08fac47
```

## API acceptance

The formal read-only acceptance workflow succeeded on retry after Cron Trigger propagation.

Acceptance asserted:

- projection schema is 10/10;
- canonical provider ID is correct;
- provider slug is `lanet`;
- current plans are non-empty;
- current plan includes `PON.T` at 5000 Mbps;
- current technologies include `xpon`;
- resolution decision is `MATCH`;
- resolution confidence is 1.

## Rebuild semantics

Current projections are rebuildable.

VS4 may:

- create missing canonical provider subjects;
- record resolution cases/evidence/decisions;
- create stable Plan identities;
- append PlanVersions for previously unseen supporting claims;
- delete and rebuild current projection rows;
- refresh provider profile rows.

VS4 does not:

- delete source snapshots;
- delete observations;
- delete claims;
- rewrite old extractor results;
- collapse the observed provider candidate into the canonical provider subject.

## Production schedule

After acceptance, normal cadence was restored to:

```text
17 3 * * *
```

## Result

Projection / Resolution VS4 is production-proven.

Netco now has a real product-facing path:

```text
official website
  -> immutable evidence
  -> typed observation
  -> source-backed claim
  -> resolution
  -> canonical provider
  -> Plan / PlanVersion
  -> rebuildable read model
  -> public provider API
```

## Next slice

The next useful boundary is address-scoped coverage and orderability.

Initial targets:

```text
Address / Building subjects
address normalization
coverage checker execution
coverage.orderable claims
provider_address_availability projection
map/read API
```

The same invariant continues to apply:

```text
source evidence first
claims second
projection last
```
