# RFC-0021: Narrow MCP read-capability adapter

Status: Proposed  
Date: 2026-09-26

## Context

Netco now has a transport-independent application layer and an HTTP surface that is primarily protocol adaptation.

The next integration need is a small MCP surface for agents without:

- routing MCP back through Netco HTTP
- duplicating address normalization or coverage lookup rules
- exposing arbitrary database access
- exposing the entire Netco API
- adding write/remediation behavior

At implementation time, the Cloudflare account does not expose a Netco Access application through the connected read-only inspection path.

Therefore adding an unauthenticated `/mcp` route would create a new public machine entry point and is not acceptable.

## Decision

Add one MCP endpoint:

```text
POST /mcp
```

with exactly two tools in the first slice:

```text
find_providers_for_address
check_availability
```

The mapping is direct:

```text
find_providers_for_address
  -> findProvidersForAddress(...)

check_availability
  -> checkProviderAvailability(...)
```

No MCP implementation may call Netco through `fetch()`.

## Authentication

MCP uses a dedicated Worker secret:

```text
MCP_TOKEN
```

and requires:

```http
Authorization: Bearer <MCP_TOKEN>
```

The endpoint fails closed when the secret is not configured.

This token protects only the MCP entry point. It does not become a credential for the rest of the Netco HTTP API.

This is an intentionally narrow bootstrap boundary. A future Cloudflare Access service-token or OAuth boundary may replace it without changing the application capabilities or tool semantics.

## MCP protocol

The first implementation uses the same modern protocol profile already exercised by Operational:

```text
2026-07-28
```

Supported methods:

- `server/discover`
- `tools/list`
- `tools/call`

Responses use a single Streamable HTTP SSE exchange.

## Tool: find_providers_for_address

Input:

```json
{
  "address": {
    "country_code": "UA",
    "city": "Kyiv",
    "street": "Example",
    "house_number": "1"
  }
}
```

The MCP adapter performs only protocol-shape validation.

Domain validation remains in the application capability through the existing address normalization logic.

The result is the existing transport-neutral capability value.

## Tool: check_availability

Input:

```json
{
  "provider": "provider-slug",
  "address": {
    "country_code": "UA",
    "city": "Kyiv",
    "street": "Example",
    "house_number": "1"
  }
}
```

The result is the existing persisted provider availability observation.

## Safety boundaries

MCP1 is read-only.

It does not expose:

- source discovery
- crawling
- browser automation
- provider probing
- evidence ingestion
- SQL
- generic projection reads
- arbitrary URLs
- arbitrary HTTP
- write operations

The tool annotations explicitly mark both tools as read-only and non-destructive.

## CI proof

`scripts/validate-mcp-adapter.mjs` enforces:

- direct imports of the two application capabilities
- exactly the two intended tool constants
- read-only annotations
- no `fetch()` call in the adapter

Normal CI additionally proves:

- TypeScript compilation
- Worker bundle generation

## Production proof boundary

Merging/deploying the code is safe before machine authentication is provisioned because `/mcp` fails closed when `MCP_TOKEN` is absent.

The production invocation proof is complete only after:

1. `MCP_TOKEN` is provisioned as a Worker secret
2. unauthenticated `/mcp` is rejected
3. authenticated `tools/list` returns exactly two tools
4. both tools execute against real production application capabilities
5. the rest of the Netco API does not accept the MCP token as application authorization
6. no Cloudflare Access/private-front-door protection is weakened
