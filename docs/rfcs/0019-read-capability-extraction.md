# RFC-0019: Extract reusable read capabilities

Status: Proposed  
Date: 2026-09-26

## Context

RFC-0016 introduced the application capability boundary and extracted the first provider and address-availability flows.

The remaining read endpoints still contain reusable business/query rules inside HTTP route handlers:

- sources
- evidence views
- coverage inventory
- geo provenance
- geo enrichment backlog
- coverage point geometry and viewport validation

These reads are likely future inputs to the Netco UI, MCP tools, Worker RPC, and operator workflows.

## Decision

Move reusable read flows into transport-neutral modules under `src/application`.

New application capabilities:

```text
listSources
getSource
getSourceEvidence
listCoverageInventory
getAddressGeoEvidence
listGeoEnrichmentBacklog
listCoveragePoints
```

HTTP routes remain responsible for:

- HTTP method/path matching
- extracting path parameters
- reading query strings
- converting query-string numbers
- checking whether a Cloudflare binding exists
- mapping capability failures to HTTP status codes
- serializing the final response

Application capabilities own:

- source lookup
- coverage/projection schema readiness where required
- freshness validation
- geometry filter validation
- viewport completeness/range validation
- DB/projection/store orchestration
- transport-neutral success/failure semantics

## Compatibility requirement

The refactor must preserve the current response semantics of:

```text
GET /api/v1/sources
GET /api/v1/sources/{slug}
GET /api/v1/sources/{slug}/provenance
GET /api/v1/sources/{slug}/discovery
GET /api/v1/sources/{slug}/crawl
GET /api/v1/sources/{slug}/extractions
GET /api/v1/coverage/addresses
GET /api/v1/geo/coverage-points
GET /api/v1/geo/enrichment-backlog
GET /api/v1/geo/addresses/{address_id}/provenance
```

No endpoint is added or removed.

## Result

After this slice, the HTTP layer is primarily a protocol adapter over reusable application capabilities.

The intended shape becomes:

```text
HTTP / future MCP / future RPC
             |
             v
      application capabilities
             |
             v
domain + projections + evidence stores
```

This keeps protocol choice separate from Netco business/query behavior.
