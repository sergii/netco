# RFC 0009 - Address-Scoped Coverage and Orderability

Date: 2026-09-25
Status: Draft

## Context

Netco now has a production-proven path from official provider pages to:

```text
immutable evidence
  -> typed observations
  -> source-backed claims
  -> canonical provider
  -> Plan / PlanVersion
  -> rebuildable provider projections
```

The next product question is address-scoped:

```text
Can this provider actually be ordered at this address?
```

A provider-wide coverage map or technology page is not sufficient evidence for that question.

## Decision

Coverage / Orderability VS5 uses a separate address-scoped evidence path:

```text
structured address
  -> deterministic address normalization
  -> Address subject
  -> official address-checker interaction
  -> immutable browser result artifact
  -> typed coverage observation
  -> coverage.orderable claim
  -> provider_address_availability projection
```

The address checker is treated as a first-class source:

```text
source.kind = address_checker
```

## Address identity

An address is a first-class subject:

```text
subjects.kind = address
addresses.id = subjects.id
```

Initial structured fields are:

```text
country_code
region
city
district
street
house_number
corpus
building_letter
postal_code
latitude
longitude
normalized_key
```

VS5 deliberately does not accept arbitrary free-form addresses in the persistence boundary.

The first contract requires at least:

```text
country_code
city
street
house_number
```

This keeps the initial normalization deterministic and reviewable.

## Normalized key

The initial normalized key is deterministic and internal.

It normalizes:

- Unicode with NFKC;
- whitespace;
- case;
- common Ukrainian street-type prefixes for matching;
- house-number spacing/dashes.

It does not claim to be a universal Ukrainian address identifier.

A future official or external address identifier may be added without rewriting historical address observations.

## Browser Run boundary

Some provider checkers are interactive JavaScript applications.

VS5 uses Cloudflare Browser Run for those sources.

For Lanet, production interface evidence proved a two-step UI:

```text
street selector
  -> house selector
  -> checker result
```

Interaction code should prefer accessible roles and names over fragile CSS classes.

Observed controls include:

```text
combobox: Виберіть вулицю
button: Вулиця
button: Будинок
```

The house control is initially disabled and becomes available after street selection.

## Evidence before interpretation

Browser automation has two distinct outputs.

### Interaction evidence

This proves what the checker did and what rendered state followed.

Examples:

- selected street;
- selected house;
- resulting URL;
- resulting controls;
- result text markers;
- body excerpt;
- browser artifact stored in R2.

An interaction observation does **not** by itself create a coverage claim.

### Orderability observation

Only a deterministic result classifier may produce:

```text
coverage-orderability-observation.v1
```

The observation must distinguish:

```text
orderable
unavailable
needs_verification
```

`needs_verification` emits no automatic orderability claim.

## Claim model

The provider candidate remains the claim subject.

The address is the claim scope:

```text
subject_id       = observed provider candidate
predicate        = coverage.orderable
scope_subject_id = address
```

Positive example:

```json
{
  "value": true,
  "state": "orderable",
  "service_kind": "internet",
  "technologies": ["xpon"]
}
```

Negative example:

```json
{
  "value": false,
  "state": "unavailable",
  "service_kind": "internet",
  "technologies": []
}
```

Absence of a positive result is not automatically a negative claim.

## Provenance

Every automatic coverage claim must point to:

- address-checker source;
- immutable source snapshot;
- typed coverage observation;
- Address subject through `scope_subject_id`;
- browser result artifact in R2;
- deterministic evidence markers.

The raw provider response or rendered result is preserved before interpretation.

## Product projection

The product-facing read model is:

```text
provider_address_availability
```

Key dimensions:

```text
provider_id
address_id
service_kind
technology
```

Projection state may include:

```text
orderable
service_available
unavailable
needs_verification
unknown
```

Projection rows are rebuildable and may be deleted/recreated.

Historical claims remain the source of truth.

## Freshness

Address orderability is time-sensitive.

VS5 initially gives projected checker results a 24-hour freshness window:

```text
fresh_until = observed_at + 24 hours
```

This is an operational product rule, not an assertion that the provider guarantees availability for 24 hours.

Future source-specific freshness policy may replace it.

## Public acceptance fixture

The first Lanet production interaction uses a public, non-personal address published by Lanet for ЖК Грюнвальд:

```text
country: UA
city: Київ
street: Клавдіївська
house: 40А
```

The fixture exists only to prove the adapter end to end.

Netco must not infer or use a user's private address for acceptance tests.

## Safety boundaries

VS5 must not:

- expose a public mutation endpoint that can arbitrarily submit addresses;
- turn geolocation into an address claim without explicit normalization;
- infer orderability from a provider-wide map alone;
- infer unavailable from an automation error;
- emit a claim when UI state is ambiguous;
- store passwords, session secrets, or unnecessary cookies in evidence;
- use CSS-class selectors as the only interaction contract when semantic roles are available.

## Initial API

Read-only product access:

```text
GET /api/v1/coverage/:provider/address
```

The endpoint reads persisted projection state.

It does not execute a live checker request.

Live collection remains an internal scheduled adapter path.

## Initial production acceptance

VS5 is complete when one public fixture proves:

```text
structured address
  -> Address subject
  -> Browser Run checker interaction
  -> immutable result snapshot
  -> valid orderability observation
  -> coverage.orderable claim
  -> provider_address_availability
  -> read-only coverage API
```

Acceptance must also prove that an ambiguous checker result emits no automatic claim.

## Deferred

- arbitrary user-submitted live checks;
- batch city crawling;
- apartment/entrance subjects;
- official Ukrainian address registry integration;
- fuzzy address parsing;
- address aliases from multiple sources;
- H3 aggregation;
- map tiles / heatmaps;
- multi-provider address fan-out;
- human review UI;
- source-specific freshness policies.

## Retry semantics after partial interaction evidence

Production acceptance on 2026-09-25 exposed an important operational boundary.

A failed or partial browser interaction must not inherit the normal 24-hour success cooldown.

The interaction adapter therefore applies the 24-hour cooldown only when the latest interaction observation is:

```text
validation_status = valid
```

For:

```text
partial
invalid
```

the scheduler may retry on the next collection opportunity.

This matters because an adapter fix, provider UI recovery, or transient Browser Run failure must be able to produce new evidence without waiting for stale partial evidence to expire.

The invariant is:

```text
valid evidence   -> freshness/cooldown may suppress redundant work
partial evidence -> retry allowed
invalid evidence -> retry allowed
```

During production acceptance, the cron may temporarily be accelerated to exercise this retry path. After acceptance, Netco returns to the normal daily schedule.



## Lanet result classification contract

A live browser probe of the public acceptance fixture on 2026-09-25 established the address-result state that appears only after both semantic controls have been completed.

For `Київ, Клавдіївська, 40А`, the address-specific result contains the ordered evidence region between the selected house and the map attribution, including:

```text
б. 40А
Послуга Інтернет
Доступна у всьому будинку
GIG (мідна вита пара)
XGPON (оптичне волокно)
Замовити підключення
```

The provider-wide map legend also contains both positive and negative phrases regardless of the selected address. Therefore the classifier must not treat page-wide occurrences such as `Доступне підключення` or `Підключення недоступне` as address orderability evidence.

The initial deterministic classifier is intentionally conservative:

```text
selected house
  + address-local "Послуга Інтернет"
  + address-local "Доступна у всьому будинку"
  + address-local "Замовити підключення"
    -> orderable

anything else
    -> needs_verification
```

Explicit technologies are preserved from the same address-local result region. The first proven fixture exposes `GIG` and `XGPON`.

No automatic `unavailable` claim is emitted until a separate production fixture proves a deterministic address-local unavailable state. This preserves the invariant that absence of positive evidence is not negative evidence.

Orderability interpretation runs as a separate materialization step after the immutable interaction snapshot is persisted. The materializer reads that exact R2 snapshot, creates or reuses the canonical Address subject, persists `coverage-orderability-observation.v1`, emits `coverage.orderable` only for a claimable deterministic result, and rebuilds `provider_address_availability`.

This separation keeps raw browser evidence append-only and retryable independently from interpretation.


## Production acceptance - 2026-09-25

Coverage / Orderability VS5 completed its positive production path against the public Lanet acceptance fixture:

```text
UA
Київ
Клавдіївська
40А
```

The production Browser Run interaction completed successfully and persisted immutable evidence.

The materialization event proved:

```text
result = orderable
technologies = [gig, xgpon]
projection_rows = 2
```

Production evidence identifiers:

```text
snapshot_id    = 2af08ba1-bda1-49a7-baaf-3d01bf42376f
observation_id = 5242508a-d4d2-4996-93e4-bba5cf5b177f
claim_id       = 09f69117-afb0-4a0c-b52c-54e0557fe2ab
```

The read-only production API returned the same Address subject and two orderable projection rows:

```text
GET /api/v1/coverage/lanet/address

address:
  Київ, Клавдіївська, 40А

availability:
  internet / gig   / orderable
  internet / xgpon / orderable
```

Both projection rows reference the same supporting claim:

```text
09f69117-afb0-4a0c-b52c-54e0557fe2ab
```

The acceptance path is therefore production-proven as:

```text
structured address
  -> Address subject
  -> Browser Run interaction
  -> immutable snapshot
  -> valid orderability observation
  -> coverage.orderable claim
  -> provider_address_availability
  -> read-only coverage API
```

The accelerated acceptance cron is no longer required. The production schedule returns to:

```text
17 3 * * *
```

### Conservative ambiguity handling

The classifier remains intentionally one-sided for VS5:

```text
proven positive contract -> orderable
anything else            -> needs_verification
```

`needs_verification` produces no automatic `coverage.orderable` claim.

A deterministic automatic `unavailable` classifier remains disabled until a separate production fixture proves the provider's address-local unavailable state.

### Schema hardening follow-up

The production application role remains intentionally DDL-restricted.

During acceptance, the missing coverage tables were bootstrapped through an owner-level Neon path. Runtime DDL was subsequently removed in PR #45, and address creation was serialized independently from the canonical unique-index path.

The positive VS5 runtime path is production-proven, but the owner-created bootstrap tables still require a separate schema-hardening reconciliation with the full constraints and indexes declared by `migrations/0004_coverage_addresses.sql`.

That reconciliation is operational hardening and must not broaden the privileges of `hyperdrive-user`.
