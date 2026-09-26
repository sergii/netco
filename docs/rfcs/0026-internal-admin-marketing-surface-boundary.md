# RFC 0026 - Internal Admin and Marketing Surface Boundary

Date: 2026-09-26
Status: Accepted

## Context

Netco currently serves two very different product goals:

1. an internal operator/admin workspace for inspecting provider knowledge, coverage, evidence, geo state, and future CRM workflows;
2. a future public-facing marketing/discovery site for explaining the product and presenting selected user-facing capabilities.

Mixing these goals in one page caused layout instability and competing UX priorities.

## Decision

The current Netco Explorer becomes the internal admin / CRM surface.

Its primary layout is a persistent left sidebar with a stable right-hand workspace.

Current admin navigation:

- Огляд
- Карта
- Провайдери
- Джерела
- Докази
- Система

The sidebar also owns environment status and admin identity.

The workspace title and content change by section, but the shell itself remains stable.

## Map behavior

The map is an admin workspace, not a marketing hero.

When the Map section is active:

- the sidebar remains fixed;
- the workspace header remains stable;
- the map consumes the remaining viewport height;
- detail overflow is confined to the map inspector;
- the whole page should not need vertical scrolling for ordinary map inspection.

## Marketing surface

The future marketing site is a separate product surface.

It may reuse:
- brand tokens;
- selected read-only application capabilities;
- map components;
- provider/address discovery concepts.

It must not reuse the internal admin information architecture by default.

Marketing concerns such as hero copy, conversion CTAs, public pricing, SEO, storytelling, and onboarding are intentionally deferred.

## CRM direction

The admin surface is allowed to evolve toward CRM/operator workflows.

Likely future entities include:

- operator notes;
- tasks;
- leads;
- contacts;
- connection requests;
- calls;
- installation status;
- audit/activity history.

These concepts should be added through vertical slices rather than by prematurely designing a complete CRM schema.

## Next product boundary

The next slice is an Operator Address Workspace.

Existing VS15 already proves:

```text
H3 cell
  -> address
  -> coverage
  -> provenance
```

The next step is to turn that technical chain into a persistent address-centered operator workflow without adding new external collection.
