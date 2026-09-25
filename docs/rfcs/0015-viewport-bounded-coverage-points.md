# RFC 0015 - Viewport-Bounded Coverage Point Reads

Date: 2026-09-25
Status: Production proven

## Context

VS11 produced the first trusted Address coordinate with full provenance.

Before introducing MapLibre, basemap dependencies, PostGIS geometry tables, or H3 aggregation, Netco needs a deterministic spatial read boundary for an ordinary map viewport.

## Decision

The existing GeoJSON endpoint supports an optional WGS84 viewport:

```text
GET /api/v1/geo/coverage-points
  ?geometry=present
  &west=...
  &south=...
  &east=...
  &north=...
```

Viewport parameters are all-or-nothing.

If any of the four bounds is supplied, all four are required.

Validation rules:

```text
-180 <= west < east <= 180
 -90 <= south < north <= 90
```

Viewport queries operate only on already materialized Address latitude/longitude.

They perform no external collection, geocoding, provider request, or browser interaction.

## Geometry semantics

Without a viewport, the existing `geometry=all|present|missing` behavior remains unchanged.

With a viewport:

```text
geometry=present -> valid
geometry=all     -> valid, but only spatially matchable persisted geometry can be returned
geometry=missing -> invalid
```

Missing geometry cannot be meaningfully tested against a bounding box.

## Production acceptance

The trusted VS11 point is:

```text
Address:
  Київ, Клавдіївська 40А

Projected Point:
  [30.340224, 50.478430]
```

A bounding box containing the point:

```text
west  = 30.33
south = 50.47
east  = 30.35
north = 50.49
```

returned:

```text
count = 1
```

A bounding box outside Kyiv:

```text
west  = 31
south = 51
east  = 32
north = 52
```

returned:

```text
count = 0
```

The returned feature preserved:

```text
address_id         = d1cdbb61-98c7-4045-b70a-21ed4b4e6dca
provider_count     = 1
availability_count = 2
technologies       = [gig, xgpon]
geometry_state     = present
freshness_state    = fresh
```

Validation acceptance also proved:

```text
incomplete viewport         -> HTTP 400
west >= east                -> HTTP 400
geometry=missing + viewport -> HTTP 400
```

The completed VS11 one-time ingestion route also remained absent:

```text
POST /__internal/vs11/... -> HTTP 404
```

## API contract

The viewport parameters are included in the OpenAPI 3.2.1 contract and therefore appear in the Scalar API reference.

## Next boundary

The next geo slice should introduce deterministic H3 assignment over already persisted points.

A minimal first proof is:

```text
persisted Point
  -> H3 cell at one explicit resolution
  -> cell aggregation
  -> provider / technology counts
```

No new source data is required.
