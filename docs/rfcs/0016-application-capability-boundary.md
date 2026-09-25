# RFC-0016: Application capability boundary

Status: Proposed  
Date: 2026-09-25

## Context

Netco now has an OpenAPI 3.2.1 contract and Scalar reference for its HTTP surface. That proved the HTTP boundary, but the product does not currently need to make HTTP the internal architecture.

The next architectural requirement is to make business capabilities reusable by:

- existing HTTP routes
- the Netco UI
- scheduled work
- a future MCP connector
- a future private Worker-to-Worker RPC adapter

without requiring those callers to make public HTTP requests back into Netco.

## Decision

Introduce a transport-independent application layer under:

```text
src/application/
```

The first extracted capabilities are:

```text
listProviders
getProvider
findProvidersForAddress
checkProviderAvailability
```

HTTP routes remain adapters. They are responsible for HTTP-specific concerns such as:

- method/path matching
- query-string parsing
- binding availability
- HTTP status selection
- JSON response formatting

Application capabilities are responsible for:

- domain validation
- schema readiness needed by the capability
- calling projections/orderability stores
- returning transport-neutral success/failure results

## Result model

Capabilities return a discriminated result:

```ts
{ ok: true, value: ... }

{ ok: false, code: "...", details?: ... }
```

They do not return `Response` objects and do not know about HTTP status codes.

## Why this matters

A future MCP adapter should be able to do:

```ts
await findProvidersForAddress(env.DATABASE, address)
```

rather than:

```ts
await fetch("https://netco.../api/v1/coverage/address?...") 
```

Likewise, if Netco is split into multiple Cloudflare Workers, a private binding/RPC adapter can invoke the same application capability.

## HTTP compatibility

This slice must preserve the current HTTP contract and response bodies for:

- `GET /api/v1/providers`
- `GET /api/v1/providers/{provider}`
- `GET /api/v1/coverage/address`
- `GET /api/v1/coverage/{provider}/address`

No public API expansion is implied by this refactor.

## Follow-up

After this slice:

1. move additional reusable read capabilities behind the application boundary
2. decide whether `/docs`, `/openapi.json`, and `/api/v1/*` should remain internet-reachable
3. if an agent integration is needed, add a deliberately small MCP adapter over selected capabilities
4. if multiple Workers are introduced, prefer private Service Bindings/RPC for internal communication
