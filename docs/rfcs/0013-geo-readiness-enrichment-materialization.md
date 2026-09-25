# RFC 0013 - Geo Readiness, Enrichment Backlog, and Trusted Point Materialization

Date: 2026-09-25
Status: Production boundary proven

## Context

Coverage knowledge became address-centric in VS6 and inventory-ready in VS7.

The next requirement is geospatial representation without inventing coordinates or prematurely coupling Netco to a geocoder.

This RFC records three additive slices:

- VS8 - Geo coverage point projection
- VS9 - Geo enrichment backlog
- VS10 - trusted geo evidence and coordinate materialization

## VS8 - Geo coverage point projection

Production endpoint:

```text
GET /api/v1/geo/coverage-points?geometry=all|present|missing
```

The response is a GeoJSON FeatureCollection-like projection.

Each Address with persisted coverage becomes one Feature.

When both coordinates exist:

```text
geometry = Point
geometry_state = present
```

When coordinates are missing:

```text
geometry = null
geometry_state = missing
```

The projection never invents coordinates.

Production acceptance proved:

```text
all_count     = 1
present_count = 0
missing_count = 1

geometry_present = 0
geometry_missing = 1
```

The Kyiv / Клавдіївська / 40А fixture remained:

```text
geometry        = null
geometry_state  = missing
freshness_state = fresh
provider_count  = 1
availability_count = 2
technologies    = [gig, xgpon]
```

## VS9 - Geo enrichment backlog

Production endpoint:

```text
GET /api/v1/geo/enrichment-backlog
```

The backlog contains coverage Addresses whose latitude or longitude is missing.

It is a read-only planning projection, not a job executor.

Initial deterministic ordering is:

```text
fresh before stale
  -> more providers
  -> more availability rows
  -> stable normalized address key
```

Production acceptance proved one item:

```text
priority           = 1
reason             = geometry_missing
freshness_state    = fresh
provider_count     = 1
availability_count = 2
technologies       = [gig, xgpon]
```

No geocoder or external service is called.

## VS10 - Trusted geo evidence boundary

Coordinates may become canonical Address projection values only through evidence.

Typed payload:

```text
geo-point-observation.v1
```

Required dimensions include:

```text
address_id
latitude
longitude
acquisition_method
granularity
precision_meters
source_reference
observed_at
```

Allowed acquisition methods currently describe provenance semantics rather than approved vendors:

```text
official_dataset
open_dataset
approved_geocoder
operator_verified
imported
```

A coordinate may materialize only when all of the following hold:

```text
valid geo-point-observation
  +
asserted geo.point claim
  +
claim value exactly matches observation payload
  +
claim subject is the Address
```

The materializer updates only:

```text
addresses.latitude
addresses.longitude
```

Historical source snapshot, observation, and claim remain the provenance record.

## Scheduled materialization

The daily Worker may scan the database for valid geo point claims and materialize them.

This process is DB-only.

It performs:

```text
no geocoder call
no provider request
no browser interaction
```

Without valid geo evidence it is a no-op.

## Production non-fabrication proof

After deploying VS10, production reported:

```text
stage = geo-evidence-materialization-vs10
geo_evidence_materialization = true
provider_collection_enabled = false
```

The public fixture still reported:

```text
geometry = null
geometry_state = missing
backlog_priority = 1
```

This proves that enabling the materializer does not create coordinates without trusted evidence.

## Next boundary

The next slice must choose the first actual coordinate source.

That source decision is separate from the materialization mechanism.

The first positive proof should remain one bounded public fixture and must preserve immutable evidence and licensing/source attribution.

No bulk geocoding is implied by this RFC.
