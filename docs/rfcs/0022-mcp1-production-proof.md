# RFC-0022: MCP1 production proof

Status: Proven  
Date: 2026-09-26

## Context

RFC-0021 introduced the first narrow Netco MCP adapter over the transport-neutral application layer.

The adapter exposes exactly two read-only tools:

```text
find_providers_for_address
check_availability
```

The remaining acceptance requirement was a live production proof with the configured MCP credential.

## Proof

GitHub Actions workflow:

```text
MCP Production Proof
run #2
run id: 36202714487
```

completed successfully against:

```text
https://netco.sergii-ponomarov.workers.dev
```

The proof exercised the deployed Worker and real persisted production coverage observations.

## Proven properties

The live acceptance run proved:

1. requests without MCP authentication are rejected
2. authenticated server discovery succeeds
3. `tools/list` exposes exactly two tools
4. both tools declare read-only, non-destructive annotations
5. `find_providers_for_address` executes against the production `findProvidersForAddress` application capability
6. `check_availability` executes against the production `checkProviderAvailability` application capability
7. the MCP credential does not become authorization for the normal Netco HTTP API
8. static CI continues to reject self-HTTP business routing from the MCP adapter

## Architecture proven

```text
MCP request
    |
    v
narrow MCP adapter
    |
    +--> findProvidersForAddress
    |
    +--> checkProviderAvailability
             |
             v
       application layer
             |
             v
      persisted Netco data
```

There is no MCP -> Netco HTTP -> application loop.

## Workflow trigger

A temporary push trigger was added only to execute this one production proof with the configured GitHub environment credential.

After the successful proof, the workflow returns to manual-only:

```yaml
on:
  workflow_dispatch:
```

This keeps live production acceptance explicit rather than running on every repository push.

## Credential boundary

The acceptance credential is supplied through the GitHub `production` environment secret `NETCO_MCP_TOKEN`.

The Worker expects a runtime secret named `MCP_TOKEN`, declared as required in `wrangler.jsonc`.

Secret values are not stored in Git.

## Remaining control-plane issue

The application and proof are production-proven, but secret-value provisioning remains a separate control-plane concern.

Cloudflare inspection observed deployments with `source: dash` while the MCP secret was being established. Under RFC-0018, production state should ultimately be reproducible through the Git/Wrangler deployment path rather than hidden dashboard mutation.

Therefore the next infrastructure follow-up is to make Worker secret synchronization an explicit Git-triggered Wrangler operation while keeping the secret value outside Git.

This does not invalidate the MCP application proof; it records the remaining infrastructure determinism gap.
