# RFC 0007 - Typed Domain Extraction and Claim Boundary

Date: 2026-09-25
Status: Draft

## Context

Crawler VS2 proves that Netco can discover high-value provider pages and persist them as immutable evidence.

The next boundary is converting fetched HTML into domain facts without allowing parsers or future LLMs to mutate canonical product state directly.

## Decision

Domain extraction follows:

```text
crawl candidate snapshot
  -> page-purpose observation
  -> deterministic domain extractor
  -> typed domain observation
  -> validation
  -> source-backed claims
  -> later resolution/projection
```

Canonical provider projections remain outside the extractor write path.

## Initial observation contracts

VS3 introduces:

```text
plan-observation.v1
technology-observation.v1
coverage-entrypoint-observation.v1
```

Each persisted payload is self-describing with its own schema version.

JSON Schema files live under `schemas/`.

## Initial claim predicates

Validated observations may emit:

```text
plan.catalog_entry
service.technology
coverage.checker_entrypoint
```

These are evidence claims, not canonical projection rows.

### plan.catalog_entry

The provider-candidate subject is used initially because plan identity and PlanVersion tables are not yet implemented.

The value can contain:

- observed plan name;
- download speed;
- technology hint;
- monthly price;
- promotional price;
- promotion duration;
- post-promotion price when known.

Later plan resolution may convert these claims into first-class Plan and PlanVersion subjects without rewriting historical evidence.

### service.technology

Represents technology the official provider page explicitly appears to offer.

Generic PON is normalized to the `xpon` family while preserving the exact observed label in the claim value and observation.

No building-level scope is inferred from a provider-wide technology page.

### coverage.checker_entrypoint

Represents the existence of an official address-level coverage checker.

It does **not** assert that service is available at any particular address.

Actual orderability remains a future address-scoped claim such as `coverage.orderable`.

## Validation boundary

Claims are emitted only when:

```text
observation.validation_status == valid
```

Partial and invalid observations remain evidence but emit no claims.

## Deterministic first

VS3 starts with deterministic HTML extraction.

LLM extraction may be added later behind the same typed observation and validation boundary.

The allowed future path remains:

```text
LLM
  -> typed observation
  -> schema validation
  -> claims
```

Never:

```text
LLM
  -> canonical projection write
```

## Reprocessing

Extraction is identified by:

- source snapshot;
- schema name/version;
- extractor;
- extractor version;
- normalizer version.

A snapshot is not reprocessed by the same extractor version once its domain observation exists.

A future extractor version can intentionally reprocess the same immutable snapshot.

## Evidence locator

Every emitted claim stores metadata linking it to:

- source slug;
- source snapshot;
- domain observation;
- page-purpose observation;
- R2 body reference;
- deterministic body-text evidence marker.

## VS3 production acceptance

The first acceptance target is the existing Lanet crawl evidence:

```text
/map/              -> coverage-entrypoint-observation
/tariffs/          -> plan-observation
/tariffs/iptv/     -> plan-observation
/internet/pon-2/   -> technology-observation
/pon/              -> technology-observation
```

No new external fetch is required to prove the extraction slice.

## Deferred

- Plan/PlanVersion relational identities;
- provider_current_plans projection;
- address/building subjects;
- address-scoped coverage claims;
- LLM extraction;
- browser-rendered extraction;
- conflict resolution and canonical projection refresh.
