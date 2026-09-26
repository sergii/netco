# RFC 0028 - Fail-Closed Operator Write Boundary

Date: 2026-09-26
Status: Implementation slice

Issue: #111

## Context

VS16 established the first stable operator address workspace.

The next CRM capabilities will be mutable:
- notes;
- activity events;
- tasks;
- leads;
- connection requests;
- calls.

Netco must not introduce browser API keys, embedded passwords, or unauthenticated write routes merely to ship the first mutation.

The desired human identity boundary is already defined in RFC 0017:

```text
Internet
  -> Cloudflare Access
  -> Netco Worker
  -> operator application capabilities
```

At implementation time, the Cloudflare account still has no Access application targeting the `netco` Worker.

## Decision

All non-GET requests in the operator namespace:

```text
/api/v1/operator/*
```

pass through one central write authorization boundary before any specific mutation handler may execute.

Production defaults to:

```text
operator writes = disabled
mode            = fail_closed
boundary        = cloudflare_access
```

The runtime flag is opt-in:

```text
OPERATOR_WRITES_ENABLED=true
```

Absence of the flag or any value other than the exact string `true` keeps writes disabled.

## Access identity

After writes are explicitly enabled, the Worker requires Cloudflare Access identity headers:

```text
Cf-Access-Jwt-Assertion
Cf-Access-Authenticated-User-Email
```

The email becomes the initial operator actor identity for append-only CRM events.

This application check is not a replacement for Cloudflare Access.

The flag may be enabled only after a Worker-scoped Access application is production-proven. Until then, requests fail before any mutation capability executes.

## Current Cloudflare state

The connected account currently exposes Access applications for other private Workers and preview traffic, but no Access application targets `netco`.

Therefore VS17 deliberately leaves writes disabled.

## Failure semantics

When the write flag is disabled:

```text
HTTP 503
error = operator_writes_disabled
boundary = cloudflare_access
activation_required = true
```

If writes are enabled but the expected Access identity headers are absent:

```text
HTTP 403
error = operator_access_required
boundary = cloudflare_access
```

## Read compatibility

Existing GET routes remain unchanged.

In particular:

```text
GET /api/v1/operator/addresses/:address_id
```

continues to serve the VS16 read-only workspace.

## Guardrail

CI statically verifies:

- the exact opt-in write flag;
- the fail-closed error;
- Access identity header checks;
- central authorization in the operator route;
- service metadata describing the boundary;
- Wrangler does not enable operator writes before Access proof.

## Activation checklist

Writes can be enabled only after all of the following are true:

1. Cloudflare Access application targets Worker `netco`;
2. owner authentication is production-proven;
3. unauthenticated requests are denied before the Worker;
4. required CRM database migration is applied with owner-level DB credentials;
5. the write endpoint has its own production acceptance;
6. `OPERATOR_WRITES_ENABLED=true` is explicitly deployed.

## Next boundary

VS18 can now define Notes + Activity Timeline behind this boundary.

The intended first mutation is:

```text
operator
  -> add note to Address
  -> append-only activity row
  -> timeline read model
```

No update/delete endpoint is required for the first slice.
