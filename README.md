# Netco

Netco is an evolving knowledge base and product concept for discovering, normalizing, comparing, and continuously verifying fixed internet providers.

The initial focus is Kyiv, Ukraine. The architecture is intentionally designed for messy real-world provider data: multiple brands and legal entities, aliases in different languages and scripts, conflicting sources, changing tariffs, address-scoped coverage, and historical observations.

## Core principles

- Raw source data is append-only.
- Observations describe what a source said, not absolute truth.
- Claims are first-class records with provenance and temporal scope.
- Canonical provider data is a derived projection, not mutable source-of-truth fields.
- Entity resolution is evidence-based and reversible.
- Every meaningful value should retain source, observation time, and confidence.
- Missing, stale, conflicting, and not-yet-collected data are distinct states.
- Historical tariff, coverage, technology, and resilience changes are preserved.
- Structured extraction must be schema-versioned and validated before it can affect canonical views.

## Documents

- [RFC 0001 - Provider Knowledge Model](docs/rfcs/0001-provider-knowledge-model.md)
- [RFC 0002 - Ingestion, Resolution, and Enrichment Pipeline](docs/rfcs/0002-ingestion-resolution-enrichment.md)
- [Kyiv Bootstrap Research](docs/research/kyiv-bootstrap.md)

## Current status

Early architecture and research. No implementation decisions should be treated as irreversible yet.
