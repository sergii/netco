# RFC 0027 - Operator Address Workspace

Date: 2026-09-26

Status: implementation slice

Issue: #102

## Decision

VS16 introduces a stable read-only operator workspace centered on one persisted address.

The workspace is an application capability first:

```text
GET /api/v1/operator/addresses/:address_id
```

The internal Explorer is a thin consumer of that capability.

## Composition

The capability reads only persisted Netco state:

```text
canonical address
  + provider address availability
  + coverage supporting claims
  + immutable evidence trail
  + geo provenance
  + persisted latitude/longitude
  -> operator address workspace
```

It must not trigger:

- provider probing;
- geocoding;
- crawling;
- snapshot collection;
- background refresh.

## Response boundary

The workspace returns:

- canonical structured address;
- map coordinates and geometry state;
- providers and availability rows;
- technologies;
- freshness state and latest observation time;
- supporting claim IDs;
- coverage claim -> observation -> snapshot -> source evidence trail;
- geo provenance;
- data-quality flags;
- an explicit operator-notes placeholder.

## UI workflow

The internal sidebar gains an `Адреси` section.

Operators can:

1. filter the existing coverage inventory;
2. select a persisted address;
3. inspect its complete read-only workspace;
4. enter the same workspace from an H3 cell inspection;
5. jump to the address coordinates on the existing MapLibre map when geometry is present.

## Deferred

VS16 does not add mutable CRM entities.

Deferred:

- notes persistence;
- tasks;
- leads;
- calls;
- connection requests;
- installation state;
- automatic refresh;
- provider collection.

Those can be added as later slices without changing the read model introduced here.
