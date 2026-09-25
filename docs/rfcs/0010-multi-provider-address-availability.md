# RFC 0010 - Multi-Provider Address Availability

Date: 2026-09-25
Status: Draft

## Context

Coverage / Orderability VS5 proved one complete provider-scoped path in production:

```text
structured address
  -> normalized Address subject
  -> official Lanet checker interaction
  -> immutable browser evidence
  -> typed orderability observation
  -> coverage.orderable claim
  -> provider_address_availability
  -> provider-scoped read API
```

The next product question is not provider-scoped:

```text
Which providers can I order at this address?
```

Answering that requires at least two independent provider adapters and one address-centric read model.

## Decision

VS6 introduces a minimal multi-provider address query using exactly two providers:

```text
Lanet
Kyivstar
```

The first acceptance fixture remains a public, non-personal Kyiv address.

The same canonical Address subject must scope evidence from both providers.

## Collection model

Provider adapters remain independent.

```text
Address
  -> Lanet checker
  -> Kyivstar checker
```

Each adapter independently produces:

```text
Source
  -> immutable Snapshot
  -> interaction Observation
  -> deterministic orderability Observation
  -> coverage.orderable Claim
  -> provider_address_availability rows
```

One provider failure must not mutate, delete, fabricate, or downgrade another provider's result.

## Product read API

Add an address-centric read endpoint:

```text
GET /api/v1/coverage/address
```

Query parameters reuse the structured address contract from VS5:

```text
country_code
city
street
house_number
region?
district?
corpus?
building_letter?
postal_code?
```

The endpoint reads persisted projections only.

It must not launch Browser Run or execute provider checkers on request.

## Response contract

Conceptually:

```json
{
  "address": {
    "country_code": "UA",
    "city": "Київ",
    "street": "Клавдіївська",
    "house_number": "40А"
  },
  "providers": [
    {
      "provider": "lanet",
      "availability": [
        {
          "service_kind": "internet",
          "technology": "xgpon",
          "state": "orderable",
          "observed_at": "...",
          "fresh_until": "...",
          "supporting_claim_id": "..."
        }
      ]
    },
    {
      "provider": "kyivstar",
      "availability": []
    }
  ]
}
```

An empty provider availability array means no persisted claimable result is currently available.

It does not mean unavailable.

## Kyivstar adapter boundary

Kyivstar is the second adapter because its official Home Internet surface exposes address-scoped coverage verification.

The adapter must be production-probed before classifier implementation.

The same rules from VS5 apply:

- prefer semantic roles and accessible names over CSS classes;
- persist raw rendered evidence before interpretation;
- never infer unavailable from automation failure;
- ambiguous result -> `needs_verification`;
- `needs_verification` -> no automatic orderability claim.

## Acceptance

VS6 is complete when one public Kyiv address proves:

```text
same normalized Address
  -> Lanet evidence
  -> Kyivstar evidence
  -> independent provider-scoped claims/projections
  -> one aggregated address API response
```

The production proof must establish:

1. Lanet remains readable through the address-centric API.
2. Kyivstar produces immutable interaction evidence.
3. A deterministic Kyivstar positive result may emit `coverage.orderable`.
4. An ambiguous Kyivstar result emits no automatic claim.
5. Failure of either adapter does not erase the other provider's projection.
6. The aggregated endpoint does no live browser work.

## Explicitly deferred

- more than two providers;
- arbitrary user-triggered live checks;
- batch address campaigns;
- city-wide fan-out;
- provider ranking;
- plan or price comparison;
- resilience comparison;
- PostGIS building geometry;
- H3 aggregation;
- map UI;
- MCP multi-provider query tools.

## Why this slice comes before maps

A map built from one provider proves rendering, not the provider-agnostic domain model.

VS6 first proves that address-scoped availability can be collected and queried consistently across independent provider implementations.

Only then should Netco aggregate that data spatially.
