# RFC-0020: Complete the HTTP thin-adapter boundary

Status: Proposed  
Date: 2026-09-26

## Context

RFC-0016 and RFC-0019 moved most reusable Netco read behavior out of HTTP route handlers and into application capabilities.

Two meaningful seams remained:

1. coverage checker interface and interaction reads still performed source lookup and evidence-store orchestration inside `coverageRoute`
2. service metadata and evidence readiness logic still lived directly in the Worker `fetch` dispatcher

These behaviors are useful outside HTTP and should not be owned by URL routing.

## Decision

Extract the remaining reusable logic into application capabilities.

New capabilities:

```text
getProviderCoverageCheckerInterface
getProviderCoverageCheckerInteraction
getEvidencePipelineStatus
getServiceMeta
getEvidenceStatus
```

### Coverage checker

The application layer owns:

- mapping a provider slug to its registered address-checker source
- checker source validation
- loading the latest checker interface observation
- loading the latest checker interaction observation
- transport-neutral not-found failures
- assembling the provider/source/observation result

The HTTP route owns:

- matching `checker-interface` and `checker-interaction` paths
- checking the Database binding exists
- mapping capability failure codes to HTTP statuses

### Service status

The application layer owns:

- the evidence-pipeline readiness model
- the advertised Netco capability matrix
- combining runtime binding presence with database schema status

The Worker dispatcher owns:

- identifying the requested HTTP path
- constructing the runtime binding-presence input
- selecting HTTP 200 versus 503 for evidence readiness
- request IDs and response serialization

## Compatibility

No endpoint shape changes are intended.

The following remain compatible:

```text
GET /api/v1/coverage/{provider}/checker-interface
GET /api/v1/coverage/{provider}/checker-interaction
GET /api/v1/meta
GET /api/v1/evidence/status
```

## Result

After this slice, Netco's HTTP implementation is primarily protocol adaptation:

```text
HTTP path/query/status/JSON
          |
          v
application capabilities
          |
          v
domain / projections / evidence / database
```

A future MCP or Worker RPC adapter can invoke the same application capabilities without routing through Netco's own public HTTP surface.
