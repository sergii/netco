# VS15 production proof - H3 cell evidence inspection

Date: 2026-09-26

Status: production-proven

Issue: #95

Implementation PR: #96

Production implementation SHA:

```text
d78fa7027f615360699a46f0e5b3032c51d3a8b1
```

Cloudflare Git build and deployment for that exact SHA completed successfully.

Production proof workflow:

```text
VS15 Map Inspection Production Proof #1
run id: 36256669885
proof head SHA: 8506fbed6190f0f22d20650d127e58252edce049
result: success
```

## Proven workflow

```text
H3 cell click
  -> GET /api/v1/geo/h3-cells/:h3_index
  -> persisted address list
  -> GET /api/v1/coverage/address
  -> GET /api/v1/geo/addresses/:address_id/provenance
```

The H3 inspection capability reads already-persisted coverage point records only.
It does not crawl providers, invoke provider checkers, geocode, browse, or expose raw SQL.

## Trusted production fixture

```text
H3 cell:
  891e6385687ffff

Address:
  d1cdbb61-98c7-4045-b70a-21ed4b4e6dca
  Київ, Клавдіївська 40А

provider_count:
  1

availability_count:
  2

technologies:
  gig
  xgpon

freshness:
  stale
```

## Production assertions

The live proof passed:

```text
H3 cell detail returns trusted address       ✓
address coverage reuses existing read        ✓
geo provenance reuses existing read          ✓
invalid H3 -> 400                            ✓
valid unknown H3 -> 404                      ✓
Explorer composes read-only inspection path  ✓
service metadata advanced to VS15            ✓
```

## Permanent guardrail

CI includes:

```text
scripts/validate-map-inspection-boundary.mjs
```

It prevents the H3 inspection module from acquiring external collection or browser dependencies and requires the Explorer to compose the existing cell-detail, coverage, and provenance read surfaces.

## Deliberate deferrals

VS15 does not add:

- provider crawling or probing;
- geocoding;
- building geometry;
- competition/confidence scoring;
- a generic SQL or database MCP surface;
- background map polling;
- new MCP geo tools.
