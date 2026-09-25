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
- Product/API queries should read rebuildable projections rather than recomputing canonical truth from raw evidence on every request.

## Documents

- [RFC 0001 - Provider Knowledge Model](docs/rfcs/0001-provider-knowledge-model.md)
- [RFC 0002 - Ingestion, Resolution, and Enrichment Pipeline](docs/rfcs/0002-ingestion-resolution-enrichment.md)
- [RFC 0003 - Canonical Schema and Structured Contracts](docs/rfcs/0003-canonical-schema.md)
- [RFC 0004 - Cloudflare, Neon, Geospatial Intelligence, Maps, and MCP](docs/rfcs/0004-cloudflare-neon-geospatial-intelligence.md)
- [RFC 0005 - DIMAP-Inspired Map UX, Layer Model, Radar, and Realtime Ingestion Status](docs/rfcs/0005-dimap-map-ux-reference.md)
- [RFC 0006 - Crawler Adapter and URL Discovery Pipeline](docs/rfcs/0006-crawler-adapter-url-discovery.md)
- [RFC 0007 - Typed Domain Extraction and Claim Boundary](docs/rfcs/0007-typed-domain-extraction-claim-boundary.md)
- [RFC 0008 - Provider Resolution, Plan Identity, and Rebuildable Projections](docs/rfcs/0008-provider-resolution-plan-projections.md)
- [RFC 0009 - Address-Scoped Coverage and Orderability](docs/rfcs/0009-address-scoped-coverage-orderability.md)
- [RFC 0010 - Multi-Provider Address Availability](docs/rfcs/0010-multi-provider-address-availability.md)
- [Kyiv Bootstrap Research](docs/research/kyiv-bootstrap.md)

## Structured contracts

- [Provider Observation V1](schemas/provider-observation.v1.schema.json)
- [Claim V1](schemas/claim.v1.schema.json)
- [Entity Resolution Decision V1](schemas/entity-resolution-decision.v1.schema.json)
- [Geo Query V1](schemas/geo-query.v1.schema.json)
- [Plan Observation V1](schemas/plan-observation.v1.schema.json)
- [Technology Observation V1](schemas/technology-observation.v1.schema.json)
- [Coverage Entrypoint Observation V1](schemas/coverage-entrypoint-observation.v1.schema.json)

## Current status

Early architecture and research. No implementation decisions should be treated as irreversible yet.

Evidence Spine VS1, Crawler Discovery VS1, bounded Crawler VS2, typed Extraction VS3, Projection / Resolution VS4, and Coverage / Orderability VS5 are proven in production. The next milestone is VS6 - multi-provider address availability: one normalized address, independent Lanet and Kyivstar checker evidence, provider-scoped claims/projections, and one aggregated address-centric read API.

The current infrastructure hypothesis is Cloudflare Workers + Hyperdrive + Neon PostgreSQL/PostGIS, with H3 for spatial aggregation, R2 for immutable evidence, MapLibre for maps, and a shared Geo Query Engine for UI/API/MCP. This direction is documented in RFC 0004 and remains subject to validation through vertical slices.
