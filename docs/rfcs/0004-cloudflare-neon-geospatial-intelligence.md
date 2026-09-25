# RFC 0004 - Cloudflare, Neon, Geospatial Intelligence, Maps, and MCP

Status: Draft  
Date: 2026-09-25

## Purpose

Extend Netco from a provider catalog and evidence system into a geospatial intelligence platform.

This RFC records the current preferred technical direction for:

- Cloudflare-native execution;
- Neon PostgreSQL as the primary relational store;
- PostGIS for exact spatial operations;
- H3 for spatial aggregation;
- R2 for immutable evidence and large artifacts;
- MapLibre for interactive maps;
- a shared Geo Query Engine used by UI, HTTP API, and MCP;
- map encodings that communicate metric value, confidence, and exceptional states without relying on color alone.

This RFC is additive. Earlier RFCs remain historical records of prior thinking.

## Decision summary

The current preferred architecture is:

```text
Web / API / MCP
      |
Cloudflare Workers
      |
  Hyperdrive
      |
Neon PostgreSQL
 + PostGIS
 + pg_trgm
      |
  +---+--------------------+
  |                        |
canonical knowledge      geospatial data
claims                   buildings
aliases                  geometries
plans                    H3 cells
resolution               spatial indexes
projections              geo metrics

Cloudflare R2
  raw source snapshots
  imported datasets
  large generated artifacts
  optional vector tiles / exports

Cloudflare Workflows
  durable ingestion
  enrichment
  recomputation
  human-review waits

Cloudflare Queues
  fan-out jobs
  retries
  bulk enrichment

Cloudflare Browser Run
  dynamic provider websites
  address checkers
  structured extraction
```

D1 is not required for V1.

It may later be introduced as an edge-oriented projection/cache layer if measurements show a clear benefit.

## Relationship to RFC 0003

RFC 0003 defined PostgreSQL/Rails-oriented schema boundaries.

This RFC keeps the PostgreSQL schema direction but changes the preferred deployment hypothesis:

```text
Previous implementation hypothesis:
Rails + PostgreSQL first

Current implementation hypothesis:
Cloudflare Workers + Neon PostgreSQL first
```

Rails is no longer assumed to be required for V1.

The data model remains intentionally portable to ordinary PostgreSQL.

## Why Neon

Netco needs both relational integrity and real spatial capabilities.

A single PostgreSQL system of record gives us:

- foreign keys and transactions;
- JSONB where useful;
- pg_trgm for name matching;
- PostGIS for geometry and spatial indexes;
- ordinary SQL for analytical projections;
- one canonical relational store for identity, claims, plans, coverage, and geo data.

Neon is the current preferred managed PostgreSQL deployment target.

Cloudflare Workers reach it through Hyperdrive.

## Why D1 is not the primary database

D1 remains useful, but it should not be introduced only because Netco runs on Cloudflare.

Netco's geospatial roadmap includes:

- polygon containment;
- radius searches;
- proximity to provider infrastructure;
- building and district intersections;
- spatial joins;
- possible future network corridor analysis.

Those queries naturally fit PostGIS.

Using Neon as the system of record avoids prematurely splitting identity and geo truth across two databases.

D1 may later store selected read projections such as:

```text
current_provider_summary
popular_address_results
current_h3_metrics
```

only if edge locality materially improves measured performance or cost.

## Spatial model: PostGIS + H3

PostGIS and H3 solve different problems.

### PostGIS

PostGIS is for exact geometry.

Examples:

```text
Which buildings are inside this district?
Which buildings are within 2 km of this network?
Which infrastructure intersects this polygon?
What is the nearest network segment?
Which addresses are inside the current viewport?
```

Potential geometry types:

```text
POINT
LINESTRING
MULTILINESTRING
POLYGON
MULTIPOLYGON
```

### H3

H3 is for aggregation and stable spatial buckets.

Examples:

```text
providers_count
gpon_providers_count
median_monthly_price
competition_index
resilience_index
data_confidence
opportunity_index
```

per spatial cell.

Conceptually:

```text
PostGIS = exact geography
H3      = analytical grid
```

Do not force H3 to replace building geometry.

Do not force PostGIS to recompute every city-level map aggregate on every request.

## H3 storage

A first projection can be:

```text
geo_cells
  h3_index text
  resolution integer

  buildings_count integer
  residential_buildings_count integer

  providers_count integer
  independent_providers_count integer

  gpon_providers_count integer
  fiber_providers_count integer

  median_monthly_price numeric
  median_gigabit_price numeric

  competition_index numeric
  resilience_index numeric
  opportunity_index numeric
  confidence_index numeric

  observed_at timestamptz
  rebuilt_at timestamptz
  projection_version text
```

The final set of metrics should evolve from real product queries.

Do not create one universal Netco score.

## Geo metric model

Metrics are separate dimensions.

Initial candidates:

```text
competition
fiber_availability
gpon_competition
price
maximum_speed
blackout_resilience
provider_independence
market_opportunity
data_confidence
```

Each metric needs:

```text
metric_key
value
unit
normalization_method
calculation_version
supporting_time_window
confidence
```

A displayed normalized value must remain traceable to raw components.

## Competition is not provider count

A useful competition metric may eventually consider:

```text
provider diversity
technology diversity
price competition
speed competition
provider independence
resilience competition
monopoly penalty
```

Do not hard-code the final formula before we have actual Kyiv data.

The UI should always allow inspection of the underlying components.

## Opportunity metric

A separate opportunity layer can support B2B/provider planning.

Potential components:

```text
residential density
low provider competition
low fiber penetration
high price pressure
demand signals
proximity to existing network
data confidence
```

Conceptually:

```text
Opportunity =
  addressable_demand
  x lack_of_competition
  x lack_of_fiber
  x economic_attractiveness
  x deployment_feasibility
```

The exact model must be empirical and versioned.

## Map rendering

MapLibre is the preferred web map renderer.

The primary overview should not be a classic blurred heatmap.

Heatmaps are useful for point density, but Netco often answers a categorical or aggregated area question.

The preferred overview is an adaptive H3 honeycomb layer.

## Visual encoding

Do not rely on red/yellow/green alone.

Each cell may communicate multiple dimensions through independent visual channels.

### Fill intensity

Represents the selected metric magnitude.

Example:

```text
lighter fill = lower metric value
darker fill  = higher metric value
```

Color may be used, but the design must remain interpretable without color.

### Numeric label

At an appropriate zoom level, render a value such as:

```text
2 ISP
5 ISP
78
349 UAH
3 GPON
```

depending on the selected metric.

### Pattern

Represents evidence quality or uncertainty.

Examples:

```text
solid     = high-confidence recent evidence
hatched   = incomplete evidence
dotted    = stale evidence
special   = insufficient evidence
```

This intentionally separates:

```text
what Netco believes
from
how certain Netco is
```

### Outline

Represents exceptional state.

Examples:

```text
normal outline = ordinary cell
thick outline  = high opportunity
dashed outline = material conflict
alert outline  = operational anomaly
```

The final UI should expose a legend for all encodings.

## Zoom-dependent representation

The map should change representation as the user zooms.

### City overview

Use larger H3 cells.

Show:

```text
competition
fiber penetration
resilience
opportunity
confidence
```

### Neighborhood / block level

Use smaller H3 cells.

Show more direct values such as:

```text
provider count
GPON provider count
median price
```

### Building level

Stop emphasizing hexagons.

Show actual buildings and building-scoped availability.

Example:

```text
Building
  providers: 5
  GPON providers: 3
  latest verification: 2 days ago
```

### Building detail

Clicking a building should resolve into provider evidence:

```text
Provider A   GPON
Provider B   GPON
Provider C   FTTB
Provider D   Ethernet
```

with plan and provenance details.

## Confidence map

Data confidence is itself a first-class map layer.

Possible input dimensions:

```text
freshness
source authority
coverage depth
claim conflicts
verification method
last successful address check
```

Example interpretation:

```text
recent verified evidence
partial evidence
stale evidence
insufficient evidence
```

This is useful not only to users but to the enrichment engine.

## Geo-driven enrichment

Low-confidence cells can generate work.

```text
low-confidence H3 cells
  ->
identify providers relevant to those cells
  ->
run address-checker jobs
  ->
new snapshots
  ->
new observations
  ->
new claims
  ->
rebuild geo projections
```

This creates a self-improving geographic knowledge loop.

## Geo bounded context

Introduce a dedicated bounded context:

```text
Geo
  CanonicalAddress
  AddressAlias
  Building
  Geometry
  H3Cell
  GeoMetric
  GeoProjection
  GeoQuery
  MapLayer
```

This bounded context consumes canonical claims but does not own provider identity.

## Geo Query Engine

UI, HTTP API, and MCP must use the same semantic query layer.

Do not implement separate business logic for each surface.

```text
                Geo Query Engine
              /        |        \
             /         |         \
           UI         HTTP        MCP
```

Conceptual request:

```json
{
  "metric": "competition",
  "geography": {
    "city": "Kyiv",
    "h3_resolution": 9
  },
  "filters": {
    "technology": "gpon"
  },
  "time": {
    "mode": "current"
  }
}
```

The engine may choose:

- precomputed H3 projections;
- PostGIS;
- ordinary relational projections;
- a combination.

Clients should not need to know.

## MCP

Netco can expose domain-level tools.

Initial candidates:

```text
find_providers
get_provider
compare_providers
get_address_availability
get_area_metric
get_area_competition
get_area_resilience
get_area_confidence
get_coverage
get_price_distribution
explain_geo_cell
find_underserved_areas
find_expansion_opportunities
```

Avoid a generic public `run_sql` MCP tool.

The MCP contract should express business intent.

Example:

```json
{
  "city": "Kyiv",
  "max_distance_from_network_m": 2000,
  "min_residential_buildings": 300,
  "max_gpon_providers": 1
}
```

The Geo Query Engine may compile this to PostGIS internally.

## Temporal maps

The append-only knowledge model enables historical map reconstruction.

Potential timeline views:

```text
GPON expansion
provider entry and exit
price changes
competition changes
resilience changes
data-confidence improvement
```

Geo projections should therefore be versioned and reproducible for a requested effective time where data permits.

Do not discard historical geo claims after projection rebuild.

## R2 responsibilities

R2 is the preferred store for immutable or large binary/text artifacts:

```text
raw HTML
source snapshots
downloaded registry exports
GeoJSON imports
large generated exports
optional vector tiles
historical bulk artifacts
```

Relational metadata and provenance stay in PostgreSQL.

## Cloudflare Workflows

Use Workflows for durable multi-step operations such as:

```text
provider enrichment
address-space verification campaign
city-wide projection rebuild
registry import
large geo recomputation
human-review continuation
```

A workflow can coordinate steps while all business evidence remains persisted independently.

## Cloudflare Queues

Use Queues for fan-out and independent jobs.

Examples:

```text
provider discovered
address check requested
snapshot changed
projection invalidated
cell needs refresh
```

A dead-letter path should exist for repeated failures.

## Browser Run

Use Browser Run only when ordinary HTTP extraction is insufficient.

Priority examples:

```text
dynamic address checker
JavaScript-rendered plan pages
interactive street/building selector
API discovery from browser network activity
```

Raw captured evidence must still enter the normal snapshot -> observation -> claim pipeline.

## PostGIS data model candidates

Potential future tables:

```text
buildings
  subject_id
  address_id
  geometry geometry(Polygon, 4326)
  centroid geometry(Point, 4326)
  h3_r8
  h3_r9
  h3_r10

provider_network_geometries
  provider_id
  geometry
  geometry_type
  source_id
  observed_at
  valid_from
  valid_to

administrative_areas
  id
  kind
  name
  geometry
```

Only introduce geometry fields when a real source and query require them.

## Spatial indexes

When PostGIS tables appear, use GiST indexes for geometry columns involved in spatial filters.

Example:

```sql
CREATE INDEX buildings_geometry_gist
ON buildings
USING GIST (geometry);
```

Use ordinary B-tree indexes for H3 identifiers and categorical filters.

## Accessibility and map correctness

Map design must avoid treating color as the only signal.

Requirements:

- accessible palette;
- text labels where useful;
- pattern or shape encoding for confidence;
- legend always available;
- no implied precision beyond source evidence;
- explicit "unknown" state;
- visible freshness or confidence on drill-down.

## V1 geo slice

The first geospatial vertical slice should remain small.

### Input

A small Kyiv area with:

- canonical buildings or addresses;
- 2-5 known providers;
- a few technology and availability claims.

### Processing

```text
lat/lon
  ->
H3 assignment
  ->
cell aggregation
  ->
competition + confidence projection
```

### Output

MapLibre renders:

- H3 cells;
- provider count;
- confidence pattern;
- building drill-down.

### Acceptance

The system can answer both:

```text
What is the provider competition around this building?
```

and:

```text
Why does Netco believe that?
```

The second answer must point back to evidence.

## Implementation order

After Evidence Spine and basic entity resolution:

```text
Geo VS1
  addresses/buildings + lat/lon + H3

Geo VS2
  H3 competition/confidence projection

Geo VS3
  MapLibre adaptive map

Geo VS4
  PostGIS exact spatial queries

Geo VS5
  shared Geo Query Engine

Geo VS6
  MCP domain tools

Geo VS7
  opportunity analysis
```

## Open questions

- Which source should provide canonical Ukrainian building geometry?
- Which H3 resolutions best fit Kyiv at each zoom level?
- Should H3 indexes be computed in application code or through a PostgreSQL extension?
- Which map tile source should be used for basemap rendering?
- At what volume should generated vector tiles move to R2?
- Which exact dimensions belong in Competition V1?
- How should confidence be normalized across heterogeneous sources?
- Which geo queries justify dedicated materialized projections?
- Is D1 ever materially beneficial once Hyperdrive + Neon performance is measured?

## Current preferred stack

```text
Cloudflare Workers
Cloudflare Hyperdrive
Neon PostgreSQL
PostGIS
pg_trgm
H3
Cloudflare R2
Cloudflare Workflows
Cloudflare Queues
Cloudflare Browser Run
MapLibre GL JS
MCP
```

This is a hypothesis to validate through vertical slices, not an irreversible infrastructure commitment.
