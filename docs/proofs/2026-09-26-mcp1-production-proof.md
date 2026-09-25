# MCP1 production proof - read-only application capability adapter

Date: 2026-09-26

Status: production-proven

Issue: #80

Implementation PR: #81

Proof boundary correction: #83

One-shot production proof trigger: #84

Production proof workflow run:

```text
MCP Production Proof #2
run id: 36202714487
head SHA: 75ede7c3724cbc017c74f06764558d61d319f751
result: success
```

## Proven architecture

The production MCP endpoint remains a thin adapter over existing Netco application capabilities:

```text
MCP
  -> findProvidersForAddress(...)
  -> checkProviderAvailability(...)
  -> domain / projections / evidence / database
```

There is no MCP self-HTTP call back into Netco.

The public MCP surface contains exactly two tools:

```text
find_providers_for_address
check_availability
```

Both are read-only, non-destructive, idempotent, and closed-world.

## Secret and trust boundary

The production Worker secret was provisioned out-of-band:

```text
MCP_TOKEN
type = secret_text
```

The ChatGPT Cloudflare Inspector remained read-only throughout the proof.

The repository declares the secret as required in `wrangler.jsonc`, but does not contain its value.

The live GitHub acceptance client receives the same bearer value independently as:

```text
NETCO_MCP_TOKEN
```

This credential authenticates only to Netco's `/mcp` endpoint. It is not a Cloudflare API credential and does not grant deployment or infrastructure mutation rights.

## Production assertions

The live production run proved:

```text
out-of-band MCP_TOKEN authenticated live      ✓
unauthenticated MCP rejected                   ✓
authenticated discovery passed                 ✓
exactly two read-only tools exposed            ✓
find_providers_for_address production call     ✓
check_availability production call             ✓
MCP token isolated from normal Netco API       ✓
no self-HTTP business path remains CI-enforced ✓
```

The tool calls used real persisted production coverage data.

## Invariants preserved

- no raw database/query tool surface
- no provider crawling or browser actions through MCP
- no duplicate address normalization or coverage business logic in the MCP adapter
- no self-HTTP
- no Cloudflare write credential in the MCP proof workflow
- no ChatGPT Cloudflare write path
- normal Netco API semantics do not change when the MCP bearer is presented
- MCP remains an adapter over `src/application/*`
- production front-door boundaries remain unchanged

## Operational note

The temporary push trigger used only to create the one-shot production proof was removed after the successful run. The workflow returns to explicit `workflow_dispatch` only.
