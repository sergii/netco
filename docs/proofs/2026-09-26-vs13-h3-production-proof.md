# VS13 production proof - deterministic H3 coverage aggregation

Date: 2026-09-26

Status: production-proven

Issue: #74

Implementation PR: #88

Acceptance PR: #89

Production implementation SHA:

```text
4b8cf5a227b7d16ec791a0f61aaa07b23f38539f
```

Production proof workflow:

```text
H3 Production Proof #1
run id: 36204843441
result: success
```

## Proven slice

Netco now assigns already persisted coverage points to H3 cells deterministically:

```text
persisted coverage records
  -> latitude / longitude
  -> h3-js latLngToCell(...)
  -> cell aggregation
  -> GeoJSON Polygon features
```

No external collection, geocoding, provider probing, browser action, or self-HTTP is part of the H3 path.

The permanent CI guard `scripts/validate-h3-read-boundary.mjs` enforces that the H3 aggregation module consumes persisted coverage records and does not introduce an external collection path.

## Production endpoint

```text
GET /api/v1/geo/h3-cells?resolution=<0..15>
```

Optional viewport parameters reuse the existing all-or-nothing WGS84 semantics:

```text
west
south
east
north
```

## Cell semantics

Each cell reports:

```text
h3_index
resolution
address_count
fresh_address_count
provider_count
availability_count
technologies
source_point_ids
```

`provider_count` is distinct across all persisted addresses in the cell.

`availability_count` counts the persisted availability rows represented by those addresses.

## Production assertions

The known trusted Kyiv point was queried at H3 resolution 9 inside the VS12 viewport.

The live proof passed:

```text
trusted Kyiv point -> one H3 cell       ✓
provider_count == 1                     ✓
availability_count == 2                 ✓
technologies == [gig, xgpon]            ✓
cell polygon is closed GeoJSON          ✓
outside-Kyiv viewport -> zero cells     ✓
invalid resolution -> HTTP 400          ✓
missing resolution -> HTTP 400          ✓
incomplete viewport -> HTTP 400         ✓
```

The source point remained:

```text
d1cdbb61-98c7-4045-b70a-21ed4b4e6dca
```

## Deliberate deferrals

VS13 does not introduce:

- a materialized `geo_cells` table;
- multi-resolution caches;
- competition/confidence/opportunity scores;
- MapLibre rendering;
- PostGIS polygon operations;
- new MCP tools.

The next product boundary can consume this H3 capability from the map/UI layer before exposing broader MCP geo tools.
