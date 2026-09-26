# RFC 0025 - H3 Cell Evidence Inspection Workflow

Date: 2026-09-26
Status: Production proven

## Context

VS13 proved deterministic H3 aggregation over persisted coverage points.

VS14 rendered those H3 cells in MapLibre and allowed cell selection, but selection exposed only aggregate counts.

The next useful product question is not another spatial primitive. It is:

> Why does Netco believe this cell contains this coverage?

## Decision

A selected H3 cell is resolved through a read-only application capability:

```text
H3 index
  -> persisted coverage point records
  -> address summaries
```

HTTP exposes:

```text
GET /api/v1/geo/h3-cells/:h3_index
```

The cell-detail response contains persisted address summaries needed to continue the workflow, including:

```text
address_id
structured address
point
freshness_state
provider_count
availability_count
technologies
latest_observed_at
```

It does not duplicate provider coverage or provenance data.

## Composition boundary

The Explorer composes three existing semantic reads:

```text
cell detail
  -> /api/v1/geo/h3-cells/:h3_index

address coverage
  -> /api/v1/coverage/address

geo provenance
  -> /api/v1/geo/addresses/:address_id/provenance
```

The browser does not recreate normalization, coverage, or provenance rules.

## Failure semantics

```text
invalid H3 index
  -> HTTP 400 h3_cell_invalid

valid H3 index with no persisted Netco points
  -> HTTP 404 h3_cell_not_found
```

This preserves the distinction between malformed input and a valid geography that Netco has not collected.

## Collection boundary

H3 cell inspection is projection-only.

It must not trigger:

- provider crawling;
- provider checker interaction;
- browser automation;
- geocoding;
- external network collection;
- raw database access from the client.

A permanent CI guard enforces this boundary.

## Product consequence

The map is now an evidence navigation surface rather than only a visualization.

```text
map
  -> cell
  -> address
  -> coverage
  -> provenance
```

This gives the user a direct answer to:

> What do we know here, and what evidence supports it?

## Production proof

Canonical proof:

```text
docs/proofs/2026-09-26-vs15-map-cell-inspection-production-proof.md
```

## Next boundary

The next map slice should add an explicit analytical layer rather than more navigation plumbing.

Candidate VS16:

```text
metric selector
  -> provider_count first
  -> deterministic legend
  -> visible freshness/confidence encoding
  -> cell inspection remains available
```

Metric magnitude and evidence quality must remain separate visual dimensions.
