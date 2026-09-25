# Implementation 0003 - R2 Auto-Provisioning and Source Registry

Date: 2026-09-25  
Status: Proposed in PR

## Purpose

Make the existing Evidence Spine snapshot layer deployable without manually creating an R2 bucket, and introduce an explicit allowlisted source registry before any crawler is exposed.

## R2 provisioning

Wrangler supports automatic resource provisioning for R2 bindings that omit a bucket name.

Netco declares:

```json
{
  "r2_buckets": [
    {
      "binding": "SNAPSHOTS"
    }
  ]
}
```

On the first production deployment after merge, Cloudflare Builds / Wrangler should create the R2 resource and bind it to the Worker.

The exact Cloudflare-generated bucket name must be inspected after deployment before being treated as canonical infrastructure naming.

## Source registry

The first allowlisted source is:

```text
slug: teremki
kind: official_website
url: https://www.teremki.net.ua/
```

The registry is intentionally explicit.

Crawler and collector code must resolve a registered source rather than accept arbitrary external URLs from an unauthenticated public API.

## Collector

`collectKnownSource(bucket, slug)` composes:

```text
source registry
  -> captureHttpSnapshot
  -> SHA-256 content-addressed blob
  -> append-only snapshot manifest
```

It is not currently exposed as a public HTTP mutation.

## Read API

The Worker exposes:

```text
GET /api/v1/sources
GET /api/v1/sources/:slug
```

These routes are read-only and do not cause external fetches.

## Next step

After the first production deploy with the R2 binding:

1. verify `SNAPSHOTS` is true at `/api/v1/evidence/status`;
2. inspect the auto-provisioned R2 bucket;
3. connect Neon;
4. create Hyperdrive `netco-db`;
5. bind it as `DATABASE`;
6. apply `migrations/0001_evidence_spine.sql`;
7. add one controlled internal collection trigger;
8. persist the R2 snapshot record into PostgreSQL.
