# RFC-0014: OpenAPI and Scalar service surface pilot

Status: Proposed
Date: 2026-09-25

## Context

Netco already exposes a useful HTTP API from a Cloudflare Worker, but its externally visible contract is implicit in route code and a hand-maintained endpoint list.

This pilot applies the portfolio-wide API-first Cloudflare pattern without changing Netco business behavior.

## Decision

Add:

```text
openapi/openapi.json
GET /openapi.json
GET /docs
```

`/docs` renders the committed OpenAPI document with Scalar.

The existing `/api/v1/*` implementation remains unchanged.

## OpenAPI version

The pilot declares OpenAPI 3.2.1.

The document intentionally uses conservative schema constructs so that it remains easy to consume while OpenAPI 3.2 tooling support matures.

## Scope

The first slice documents the current HTTP route surface and query/path parameters.

Response bodies that already have durable domain schemas should become strongly typed in later slices. Where the implementation currently returns evolving evidence or projection shapes, the first contract may describe a generic JSON object rather than inventing a premature stable schema.

## Why Netco first

Netco is a strong pilot because it already exercises:

- Cloudflare Workers
- Wrangler local development
- real versioned HTTP endpoints
- Hyperdrive/Postgres behavior
- browser UI
- CI typechecking
- Wrangler deploy dry-run

At the same time, this addition is orthogonal to the current data collection and geospatial work.

## Acceptance

The pilot is successful when:

1. `npm run typecheck` passes
2. Wrangler dry-run passes
3. `GET /openapi.json` returns the committed contract
4. `GET /docs` renders Scalar from that contract
5. Scalar can issue a same-origin request to at least one Netco GET endpoint
6. no existing API behavior changes

## Follow-up

After the pilot:

- add OpenAPI validation to CI
- add contract/route drift checks
- tighten schemas for stable response models
- decide which operations, if any, should be projected into CLI or MCP adapters
