# RFC 0014 - First Trusted Coordinate Source

Date: 2026-09-25
Status: Production proven

## Context

VS10 established the rule that Address coordinates may materialize only through immutable evidence, a valid geo-point observation, and an asserted geo.point claim.

VS11 chooses and proves the first actual coordinate source for one bounded public fixture.

The acceptance Address is:

```text
UA
Київ
Клавдіївська
40А
```

## Source decision

The first trusted coordinate source is OpenStreetMap data accessed through the public Nominatim search service for one bounded research lookup.

The accepted OSM object is:

```text
osm_type = way
osm_id   = 344896684
category = building
type     = apartments
```

Source reference:

```text
https://www.openstreetmap.org/way/344896684
```

Observed source coordinates:

```text
latitude  = 50.4784296
longitude = 30.3402236
```

The matched display address was:

```text
40-А, Клавдіївська вулиця, Сахалін, Святошинський район, Київ, 03164, Україна
```

## Bounded-use policy

This proof does not introduce a general geocoding dependency.

The probe was intentionally bounded and stopped after a confirmed building-level match.

No periodic geocoding, autocomplete, city enumeration, or bulk enrichment is enabled.

Netco records:

```text
service = Nominatim
dataset = OpenStreetMap
license = ODbL
attribution = © OpenStreetMap contributors
collection_mode = bounded_single_fixture
collection_complete = true
```

Future geocoding volume requires a separate source and capacity decision.

## Evidence path

The accepted source result was frozen and persisted through the existing evidence spine:

```text
bounded source result
  -> R2 artifact
  -> source_snapshot
  -> geo-point-observation.v1
  -> asserted geo.point claim
  -> Address materialization
  -> GeoJSON coverage point
```

Production provenance identifiers:

```text
address_id     = d1cdbb61-98c7-4045-b70a-21ed4b4e6dca
source_id      = 7d9e1c5d-bb74-4e80-a499-3df34d59e9f4
snapshot_id    = 9a7e03c8-0ee9-4478-80cd-542cf84356a0
observation_id = 7eb165e5-a915-4e90-9b5a-e7e8718185de
claim_id       = aa76fa04-e5c7-4d16-86c7-3d4daef5d4f1
```

The source observation retains the original precision:

```text
50.4784296
30.3402236
```

The current Address projection columns use six decimal places, so the GeoJSON projection is:

```text
[30.340224, 50.478430]
```

The projection rounding does not alter the source evidence or claim value.

## Production acceptance

VS11 production acceptance proved:

```text
GET /api/v1/geo/coverage-points?geometry=present
  -> one Point for Клавдіївська 40А

GET /api/v1/geo/enrichment-backlog
  -> count = 0

GET /api/v1/geo/addresses/{address_id}/provenance
  -> source + snapshot + observation + claim
```

The point still carries the existing coverage projection:

```text
provider_count     = 1
availability_count = 2
technologies       = [gig, xgpon]
freshness_state    = fresh
```

## Cleanup

The one-time ingestion path existed only to move the already acquired bounded result into the production evidence spine.

After production acceptance it was removed.

Production retains only the read-only provenance endpoint.

No geocoder call exists in the scheduler or ordinary request path.

## Next boundary

The next geo slice should prove viewport-bounded reads over persisted geometry before introducing a basemap or H3 aggregation.

The first candidate is:

```text
bbox / viewport
  -> persisted coverage points
  -> deterministic GeoJSON response
```

This remains DB-only and does not require new external collection.
