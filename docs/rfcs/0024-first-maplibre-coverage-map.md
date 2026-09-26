# RFC 0024 - First MapLibre Coverage Map

Date: 2026-09-26
Status: Production proven

## Context

VS11 through VS13 proved the persisted geo pipeline:

```text
trusted coordinate
  -> GeoJSON point
  -> viewport query
  -> H3 assignment
  -> H3 aggregation
```

VS14 turns that backend into the first visible map surface without introducing any new collection behavior.

## Decision

Netco Explorer has a dedicated Map tab rendered with MapLibre GL JS.

The map reads only:

```text
GET /api/v1/geo/h3-cells
  ?resolution=9
  &west=...
  &south=...
  &east=...
  &north=...
```

The presentation stack is:

```text
MapLibre GL JS 6.11.2
OpenFreeMap Liberty basemap
Netco H3 GeoJSON overlay
```

The basemap is replaceable and has no effect on Netco query semantics.

## Interaction model

The first map slice intentionally remains small.

It provides:

- a Kyiv-oriented initial viewport centered near the first trusted point;
- H3 resolution 9;
- viewport-scoped H3 reads;
- refresh on `moveend` only;
- URL-persisted longitude, latitude, and zoom;
- polygon click selection;
- a compact cell inspector;
- visible OpenStreetMap/OpenFreeMap attribution.

It does not provide:

- automatic geocoding;
- provider crawling;
- provider checker calls;
- background map polling;
- building polygons;
- competition scoring;
- confidence scoring;
- customer/CRM state.

## Security / CSP

The Explorer content-security policy was expanded only for the chosen map dependencies.

Allowed external presentation origins are limited to:

```text
https://unpkg.com
https://tiles.openfreemap.org
```

Netco application data still comes only from the same-origin Netco API.

## Production acceptance

The live Explorer proved:

```text
Map tab present
MapLibre module reachable
OpenFreeMap Liberty style reachable
H3 viewport request successful
```

Production H3 fixture:

```text
h3_index          = 891e6385687ffff
resolution        = 9
address_count     = 1
provider_count    = 1
availability_count = 2
technologies      = [gig, xgpon]
source_point_id   = d1cdbb61-98c7-4045-b70a-21ed4b4e6dca
```

The current coverage observation is stale according to its freshness window.

That state is preserved rather than converted into a false fresh or unavailable result.

## Basemap boundary

OpenFreeMap is a temporary hosted basemap choice for this product proof.

The map architecture must continue to treat:

```text
basemap
!=
Netco product data
```

Changing basemap providers later must not change:

- Netco H3 indexes;
- coverage semantics;
- evidence provenance;
- application capability contracts.

## Next boundary

The next product slice should make map selection useful rather than add more backend primitives.

Recommended VS15:

```text
H3 cell click
  -> cell summary
  -> address list
  -> address coverage
  -> provenance
```

This becomes the first real map inspection workflow and preserves the product question:

> Why does Netco believe this?
