# RFC 0006 - Crawler Adapter and URL Discovery Pipeline

Date: 2026-09-25
Status: Draft

## Context

Evidence Spine VS1 proved the production path from registered source to immutable snapshot, observation, claims, and provenance.

Provider facts are usually spread across multiple pages, so Netco needs bounded URL discovery before broader crawling.

## Decision

Crawlers are adapters behind the Evidence Spine.

```text
Source
  -> discovery adapter
  -> classified candidate URLs
  -> snapshot adapter
  -> Snapshot
  -> Observation
  -> Claims
  -> Projection
```

Crawler output never writes canonical provider state directly.

## VS1 - deterministic HTML discovery

For an existing successful HTML snapshot:

1. load the immutable body from R2;
2. extract anchor links;
3. resolve relative URLs;
4. allow only explicitly configured provider hosts;
5. remove URL fragments and common analytics parameters;
6. deduplicate normalized URLs;
7. classify URLs deterministically;
8. store the result as a `url-discovery-observation`.

No new external fetch is required for this discovery step.

## Initial classes

- plans
- coverage
- technology
- connection
- contacts
- about_legal
- faq_support
- account
- unknown

Each link records URL, anchor text, class, relevance score, matched terms, and whether it is a crawl candidate.

The relevance score prioritizes crawl work. It is not a provider quality score.

## Safety boundary

Each source owns an explicit `crawl_hosts` allowlist.

Discovery does not follow arbitrary external hosts.

Public arbitrary crawl URLs are not supported.

## Evidence semantics

Discovery is evidence derived from a specific immutable snapshot:

```text
source_snapshot
  -> url-discovery-observation
```

This preserves the answer to:

> Which exact snapshot caused this URL to enter the crawl frontier?

## Cloudflare Browser Run

Cloudflare Browser Run exposes an asynchronous `/crawl` REST API with site discovery, depth/page limits, include/exclude patterns, static and rendered modes, incremental crawling, and robots-aware behavior.

It is a strong future discovery adapter.

The REST API requires a Cloudflare API Bearer token. Netco will not put an account-wide Cloudflare credential into the runtime Worker just to enable crawling.

A future Browser Run adapter must use a deliberately scoped credential boundary and still emit into the same Snapshot -> Observation -> Claims pipeline.

## Next slices

VS2 fetches only high-relevance candidates with strict page/byte/cooldown limits.

VS3 adds Browser Run for JS-heavy or sitemap-heavy provider sites.

## Non-goals

- unbounded recursive crawling
- arbitrary public target URLs
- bypassing website access controls
- direct crawler writes into canonical projections
