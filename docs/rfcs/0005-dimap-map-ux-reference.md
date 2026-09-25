# RFC 0005 - DIMAP-Inspired Map UX, Layer Model, Radar, and Realtime Ingestion Status

Date: 2026-09-25  
Status: Reference / non-normative  
Related: RFC 0004 - Cloudflare, Neon, Geospatial Intelligence, Maps, and MCP

## Context

DIMAP is a useful external reference for how a dense geospatial product can expose many independent map layers without forcing the user into a single fixed visualization.

This RFC records product and architecture ideas inspired by that interaction model.

It does **not** make DIMAP a dependency, data source, API dependency, or implementation requirement.

We do not copy DIMAP data, scrape private APIs, or depend on undocumented behavior.

## Decision

Netco should treat the map as a composable geospatial workbench rather than a single visualization.

The core model is:

```text
Map
  -> base map
  -> infrastructure layers
  -> analytical layers
  -> evidence/confidence layers
  -> point/radius exploration
  -> temporal state
```

All map layers must ultimately query the same canonical Geo Query Engine described in RFC 0004.

## 1. Base map is independent from product data

Base-map rendering and Netco data are separate concerns.

Candidate base-map modes:

- light cartographic;
- dark cartographic;
- satellite;
- terrain where useful.

The selected base map must not alter Netco query semantics.

## 2. Layer control is first-class

Users should be able to independently enable, disable, and tune map layers.

Candidate infrastructure layers:

- buildings;
- administrative boundaries;
- provider network geometries;
- fiber / GPON availability;
- technology presence;
- provider footprints.

Candidate analytical layers:

- competition;
- fiber availability;
- GPON competition;
- price;
- maximum speed;
- blackout resilience;
- provider independence;
- market opportunity;
- data confidence.

Layer state should be serializable into URL/query state so a map view can be reproduced and shared.

## 3. Confidence is a layer, not hidden metadata

Netco should expose data quality spatially.

For any map metric, users should be able to inspect:

- confidence;
- observation age;
- number of supporting claims;
- source diversity;
- unresolved conflicts;
- whether the area is not collected versus genuinely empty.

Confidence should be visualizable independently from the business metric.

This preserves the RFC 0001 distinction between:

```text
known absence
not collected
not found
stale
conflicting
unverified
```

## 4. Radar mode

Introduce a point-centered exploration mode.

Working name:

```text
Provider Radar
```

Input:

- address;
- map click;
- device location;
- latitude / longitude.

Example radii:

- 250 m;
- 500 m;
- 1 km;
- 3 km;
- custom radius.

The result may include:

- providers observed nearby;
- fiber/GPON presence;
- known building coverage;
- nearby provider infrastructure;
- plan and price distribution;
- maximum observed speeds;
- resilience signals;
- confidence gaps.

The radius is an analytical scope, not a claim that service is available at every point inside the radius.

Exact address availability remains a separate predicate.

## 5. Building-level transition

At low zoom, Netco may aggregate data into H3 cells.

At building-level zoom, the map should transition toward exact geometry and address-level facts.

Conceptually:

```text
country/city
  -> H3 aggregate cells

neighborhood
  -> smaller H3 / provider geometry

street/building
  -> PostGIS building geometry + scoped claims
```

A user should not be shown a coarse H3 cell as if it were exact building availability.

## 6. Realtime ingestion status

Long-running ingestion, enrichment, crawler, and resolution work should be observable in the UI.

Candidate events:

```text
source_scheduled
source_fetch_started
page_discovered
snapshot_stored
extraction_started
observation_validated
claims_emitted
resolution_required
projection_rebuilt
ingestion_completed
ingestion_failed
```

These events may later be streamed through SSE or WebSocket.

The transport is not decided by this RFC.

The event model must be transport-independent.

## 7. Map inspection panel

Clicking an area, provider geometry, H3 cell, or building should open an inspection panel rather than only a tooltip.

The panel should separate:

```text
Canonical view
Evidence
Conflicts
History
Confidence
Source freshness
```

A user should be able to answer:

> Why does Netco believe this?

without leaving the map.

## 8. Temporal map state

Map queries should support a time selector where historical data exists.

Examples:

- provider competition six months ago;
- historical maximum advertised speed;
- plan price evolution;
- technology rollout;
- confidence improvement over time.

Historical visualization must be derived from append-only observations/claims rather than overwritten provider state.

## 9. Visual encoding

Avoid a single overloaded heatmap.

Prefer explicit metric selection.

Possible channels:

- fill intensity -> metric magnitude;
- outline -> conflict or opportunity;
- pattern/hatching -> low confidence;
- numeric labels -> exact aggregate value when legible;
- opacity -> optional secondary signal.

The UI must not rely on color alone.

## 10. Shared query contract

Map UI, API, and MCP must use the same query semantics.

Example:

```text
metric = fiber_availability
geography = point_radius
point = 50.45, 30.52
radius = 1000m
time = now
min_confidence = 0.7
```

Equivalent requests should return semantically equivalent results across:

- map UI;
- HTTP API;
- MCP tools.

## 11. Lite mode

A reduced-complexity map mode is worth supporting.

Possible Lite defaults:

- one base map;
- provider availability;
- maximum speed;
- confidence;
- Provider Radar.

Advanced users can switch to the full layer workbench.

This keeps the product approachable while preserving analytical depth.

## 12. Non-goals

This RFC does not propose:

- importing DIMAP datasets;
- reverse-engineering DIMAP private APIs;
- cloning DIMAP UI pixel-for-pixel;
- depending on DIMAP uptime or implementation;
- exposing a generic SQL map endpoint;
- treating proximity as proof of service availability.

## 13. Implementation sequence

Suggested sequence after Evidence Spine is operational:

### VS1 - Map shell

- MapLibre;
- Kyiv viewport;
- base-map selector;
- URL-persisted viewport/layer state.

### VS2 - H3 analytical layer

- one metric;
- confidence alongside metric;
- legend;
- click inspection.

### VS3 - Provider Radar

- point/address input;
- radius;
- Geo Query Engine;
- provider/technology/confidence result.

### VS4 - Building geometry

- PostGIS buildings;
- transition from H3 aggregates to building facts.

### VS5 - Evidence panel

- supporting claims;
- sources;
- snapshot timestamps;
- conflicts;
- confidence.

### VS6 - Realtime ingestion status

- event model;
- SSE or WebSocket transport;
- source/job progress UI.

## Consequences

Positive:

- the map becomes a reusable analytical surface rather than a one-off page;
- confidence and provenance become visible product features;
- the same geo semantics power UI, API, and MCP;
- future metrics can be added as layers instead of bespoke pages.

Costs:

- layer state and legends need disciplined UX;
- multiple spatial resolutions require explicit semantics;
- realtime ingestion introduces another delivery channel;
- temporal queries increase storage and query complexity.

## Reference

DIMAP is recorded only as an external UX/reference point:

```text
https://dimap.live/
```

Any future use of external data or APIs requires separate source/licensing/terms review.
