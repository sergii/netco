# Implementation 0002 - Evidence Spine VS1

Date: 2026-09-25
Status: In progress

## Goal

Prove one end-to-end evidence path before introducing a crawler.

```text
HTTP source
  -> raw body
  -> immutable content-addressed blob
  -> append-only snapshot record
  -> PostgreSQL source_snapshot
  -> observation
  -> claims
  -> provenance query
```

## Snapshot storage

The Worker implementation uses two logical R2 object families.

### Content-addressed blobs

```text
blobs/sha256/<first-two-hex>/<sha256>
```

The same bytes may be physically stored once.

### Fetch records

```text
snapshots/<snapshot-uuid>.json
```

Every fetch gets a new snapshot record even when the body hash is unchanged.

This preserves the difference between:

```text
physical blob deduplication
and
append-only observation history
```

## Safety

The snapshot capture module is intentionally not exposed as a public arbitrary-URL endpoint.

A public unauthenticated fetch endpoint would create an SSRF surface.

The first caller should be an internal collector/workflow with an explicit source allowlist.

## Relational schema

`migrations/0001_evidence_spine.sql` introduces:

- subjects
- sources
- source_snapshots
- observations
- claims

The migration also enables:

- pgcrypto
- pg_trgm
- PostGIS

The migration has not yet been applied to production.

## Infrastructure bindings

Planned Worker bindings:

```text
SNAPSHOTS  -> R2 bucket netco-snapshots
DATABASE   -> Hyperdrive configuration netco-db
```

The repository does not declare these bindings until the resources exist, so Cloudflare production remains deployable during provisioning.

## Acceptance

VS1 is complete when one real provider page can be collected and we can answer:

1. What exact bytes did Netco fetch?
2. When were they fetched?
3. Which observation was extracted from them?
4. Which claims came from that observation?
5. Which source and snapshot support each claim?

Crawler work starts only after this path is proven.
