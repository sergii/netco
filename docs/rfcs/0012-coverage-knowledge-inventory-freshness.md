# RFC 0012 - Coverage Knowledge Inventory and Freshness

Date: 2026-09-25
Status: Production proven

## Context

VS5 proved provider-scoped address orderability.

VS6 proved an address-centric read contract over persisted provider availability without triggering provider collection.

The next internal and product question is:

```text
What address-scoped coverage knowledge does Netco currently have,
and how fresh is it?
```

This is required before a useful operator view or map can exist.

## Decision

Introduce a projection-only coverage inventory endpoint:

```text
GET /api/v1/coverage/addresses
```

Optional filter:

```text
freshness=all|fresh|stale
```

The inventory is derived only from:

```text
addresses
provider_address_availability
provider_profiles
```

It performs no Browser Run, crawler, provider HTTP request, or live checker interaction.

## Freshness semantics

Each availability row already carries:

```text
observed_at
fresh_until
```

For the inventory:

```text
row is fresh
  iff fresh_until is non-null and in the future

address is fresh
  iff at least one persisted availability row is fresh

address is stale
  iff persisted availability exists and every row is stale
```

An address with no persisted availability is not materialized in this inventory.

Unknown is therefore different from stale.

## Response shape

Each inventory entry contains:

```text
Address
freshness_state
provider_count
availability_count
technologies
latest_observed_at
providers[]
  availability[]
    service_kind
    technology
    availability_state
    observed_at
    fresh_until
    freshness_state
    supporting_claim_id
    projection_version
    rebuilt_at
```

Provider separation and provenance are preserved.

## Production acceptance - 2026-09-25

Production endpoint:

```text
GET /api/v1/coverage/addresses?freshness=all
GET /api/v1/coverage/addresses?freshness=fresh
GET /api/v1/coverage/addresses?freshness=stale
```

Acceptance fixture:

```text
UA
Київ
Клавдіївська
40А
```

Production proof established:

```text
all_count   = 1
fresh_count = 1
stale_count = 0
```

Fixture inventory:

```text
freshness_state   = fresh
provider_count    = 1
availability_count = 2
technologies      = [gig, xgpon]
provider          = lanet
```

Both availability rows preserve supporting claim:

```text
09f69117-afb0-4a0c-b52c-54e0557fe2ab
```

An invalid freshness filter returns HTTP 400.

## Relationship to provider collection policy

RFC 0011 remains authoritative.

Coverage inventory exposes only already persisted knowledge.

It must not become an implicit refresh trigger.

Stale inventory rows may later become inputs to a separately approved acquisition queue, but the inventory endpoint itself remains read-only.

## Why this matters for maps and CRM

The inventory is the first complete list of address-scoped coverage knowledge available to Netco.

It can feed:

```text
operator/CRM inventory
freshness dashboards
data-quality queues
geospatial enrichment
future map layers
```

without coupling those surfaces to provider collection.

## Deferred

- geocoding;
- geometry;
- PostGIS spatial queries;
- H3 aggregation;
- map rendering;
- automatic stale-data refresh;
- provider collection policy automation.
