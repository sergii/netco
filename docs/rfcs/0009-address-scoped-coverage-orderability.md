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
