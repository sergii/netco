# RFC 0027 - Map Representation Ladder

Date: 2026-09-26
Status: Production proven

## Context

Netco's internal map is becoming an operator surface rather than a single-purpose H3 visualization.

Future usage will require multiple ways to inspect the same geography at different levels of detail while keeping the map stable and visually dense.

The UI therefore needs an explicit representation contract before the admin grows into high-density tables, filters, CRM state, and richer infrastructure layers.

## Decision

The Map workspace exposes a persistent coarse-to-fine representation ladder above the map:

```text
Райони -> Зони H3 -> Будинки
```

The levels are represented as visible pills rather than a hidden select.

This makes the available spatial modes discoverable without opening another control.

## Current implementation

### Райони

Visible but disabled.

It becomes active only after Netco has a trusted district geometry/projection boundary.

### Зони H3

Production active.

Data source:

```text
GET /api/v1/geo/h3-cells
```

This is the aggregated analytical layer.

### Будинки

Production active.

Data source:

```text
GET /api/v1/geo/coverage-points?geometry=present
```

This is the finest currently persisted address-level spatial layer.

## Interaction contract

Changing representation level:

- does not resize the map;
- does not recenter the map;
- keeps the same viewport;
- changes only the Netco overlay/query;
- persists the selected level in URL map state.

Selecting either an H3 zone or a building opens the same left overlay drawer.

The drawer:

- slides over the map;
- never changes map dimensions;
- can be closed with its close button;
- can be closed with Escape;
- closes when the operator clicks empty map space;
- can change content without closing when another object is selected.

## Important modeling note

This is a representation ladder, not necessarily a strict domain containment tree.

Administrative geography and analytical grids are different concepts.

For example:

```text
district polygon
!=
H3 parent cell
```

An H3 cell may overlap an administrative boundary.

Therefore the UI may order levels from coarse to fine while the domain model keeps their spatial semantics independent.

## Future extension

Likely future representation modes include:

```text
Місто
Райони
Зони
Будинки
```

Additional infrastructure overlays such as nodes, fiber routes, cabinets, outages, or planned construction should be modeled as overlays or object families rather than forced into the same containment ladder.

H3 resolution may later adapt automatically to zoom instead of becoming a long list of user-facing resolution pills.

## High-density admin boundary

The interaction contract should survive a later UI stack migration.

A future high-density admin may use:

- React for complex workspace composition;
- TanStack Query for server-state/cache coordination;
- TanStack Table for dense lists, sorting, filtering, and column control;
- MapLibre for the spatial canvas.

Those libraries are implementation choices, not domain boundaries.

The stable product contract is:

```text
representation level
+ viewport
+ selected object
+ overlay inspector
```

## Production acceptance

Production proves:

- all three pills are visible;
- H3 zones are selectable;
- building points are selectable;
- district mode is visibly unavailable rather than silently absent;
- trusted viewport returns one H3 zone;
- trusted viewport returns one building point;
- the left overlay drawer is present in the live admin;
- no external collection is triggered.

## Next boundary

The next product slice remains the Operator Address Workspace.

The map drawer is the fast inspection surface.

A durable Address Workspace should be the deeper operator surface for:

- canonical address;
- coverage;
- provenance;
- freshness;
- quality flags;
- notes;
- future CRM activity.
