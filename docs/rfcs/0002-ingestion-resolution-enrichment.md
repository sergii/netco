# RFC 0002 - Ingestion, Resolution, and Enrichment Pipeline

Status: Draft  
Date: 2026-09-25

## Goal

Define how Netco converts messy external data into structured, reviewable, and continuously improving provider knowledge.

## Pipeline

```text
Source
  ->
Fetch
  ->
Snapshot
  ->
Structured Extraction
  ->
Schema Validation
  ->
Observation
  ->
Claims
  ->
Entity Resolution
  ->
Conflict Resolution
  ->
Canonical Projection
  ->
Completeness Analysis
  ->
Enrichment Queue
```

## Structured input

Extractors and agents should receive an explicit contract rather than an unbounded instruction.

Example:

```json
{
  "source": {
    "url": "https://example.net",
    "type": "official_site",
    "fetched_at": "2026-09-25T06:00:00+03:00"
  },
  "candidate": {
    "name": null,
    "legal_name": null,
    "brand_name": null,
    "website": null,
    "phones": [],
    "technologies": [],
    "coverage": [],
    "plans": []
  }
}
```

The contract communicates which fields are expected and enables deterministic validation.

## Structured output

Agent output must conform to a versioned schema.

Example:

```json
{
  "brand_name": "Teremki LAN",
  "legal_name": null,
  "canonical_name_candidate": "Teremki LAN",
  "aliases": [
    {
      "value": "Теремки LAN",
      "type": "localized"
    },
    {
      "value": "Теремки ЛАН",
      "type": "colloquial"
    },
    {
      "value": "teremki@lan",
      "type": "legacy"
    }
  ],
  "technologies": ["ethernet", "pon"],
  "missing_fields": ["legal_name", "edrpou"],
  "extraction_confidence": 0.91
}
```

This is an observation payload, not a direct canonical update.

## Validation boundary

The allowed write path is:

```text
LLM / parser
  -> StructuredObservation
  -> SchemaValidation
  -> ClaimCreation
  -> Resolution
  -> Projection
```

Never:

```text
LLM
  -> UPDATE providers
```

## Versioning

Every extraction must carry:

```text
schema_version
extractor
extractor_version
normalizer_version
resolver_version
```

This allows old snapshots to be reprocessed after extractor improvements without re-fetching the source.

## Fetching strategy

Each fetch should preserve:

```text
URL
HTTP status
headers
content hash
raw body or blob reference
fetched_at
```

If:

```text
content_hash unchanged
```

then:

```text
skip expensive extraction
```

If:

```text
content_hash changed
```

then:

```text
create snapshot
  -> diff
  -> extract
  -> produce claims
```

## Integration classes

Provider data sources can be categorized by integration quality:

```text
A - official documented API or feed
B - structured endpoint used by provider website
C - structured HTML or JSON-LD
D - unstructured HTML scraping
E - manual or partner-supplied data
```

Undocumented internal endpoints should not become the sole long-term dependency. They are useful adapters but can change without notice.

## Source-specific enrichment

Missing data should map to explicit enrichment strategies.

Examples:

```text
missing legal_name
  -> query official registry

missing current plans
  -> crawl official pricing page

missing coverage
  -> provider address checker adapter

missing aliases
  -> brand pages + registry + historical sources

conflicting website identity
  -> entity-resolution review
```

The general flow is:

```text
Gap
  -> EnrichmentStrategy
  -> Job
  -> Snapshot
  -> Observation
  -> Claim
```

## Completeness analysis

Internal UI should expose field-level state and quality dimensions.

Example:

```text
Provider
------------------------------------------------
Canonical name     Teremki LAN       known
Brand name         Teremki LAN       known
Legal name         -                 not_found
EDRPOU             -                 not_collected
Website            teremki...        known
Technology         PON, Ethernet     known
Coverage           partial           stale
Tariffs            7                 known
```

Suggested quality panel:

```text
Completeness       73%
Freshness          62%
Authority          88%
Resolution conf.   91%
Conflicts          2
Coverage depth     building
```

These scores support operations and prioritization. They do not replace the raw dimensions.

## Enrichment prioritization

Jobs can be prioritized by a weighted combination of:

- customer-facing impact;
- missing critical fields;
- staleness;
- unresolved conflicts;
- provider popularity;
- geography demand;
- crawl cost;
- source reliability;
- expected information gain.

Potential states:

```text
queued
running
succeeded
no_change
not_found
blocked
needs_review
failed
```

## Entity-resolution evidence

Entity resolution should preserve why a match was proposed.

Example:

```text
same EDRPOU         strong positive
same domain         strong positive
same phone          positive
same address        positive
similar name        weak positive
different EDRPOU    strong negative
```

The actual numeric model can evolve, but evidence should remain inspectable.

## Human review

Human review is required when:

- two strong identity signals disagree;
- a merge would join existing canonical entities;
- a legal entity maps to multiple ambiguous brands;
- sources disagree on current ownership;
- a canonical identity change would affect significant historical data.

Review decisions themselves should be recorded as provenance-bearing events.

## Internal UI

The first internal data-quality UI should emphasize:

1. unresolved entities;
2. missing critical fields;
3. stale provider records;
4. conflicting claims;
5. sources failing to fetch;
6. coverage gaps;
7. tariff changes;
8. enrichment queue state.

It should make it obvious what Netco knows, what it does not know, and why.

## Operational principle

The system must be allowed to be wrong temporarily without corrupting history.

A crawler can misread a page.
An LLM can extract the wrong entity.
An aggregator can contain old information.
A provider can publish inconsistent information.

Evidence remains immutable, resolution can be replayed, and canonical projections can be rebuilt.
