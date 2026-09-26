# RFC-0017: Private front door with Cloudflare Access

Status: Proposed  
Date: 2026-09-25

## Context

Netco is currently an internal/private product. The OpenAPI and Scalar work proved the HTTP contract, but that does not imply that the HTTP surface should be publicly reachable.

The production Worker is currently reachable through:

```text
https://netco.web33.workers.dev
```

The application layer introduced in RFC-0016 is now transport-independent, so restricting the public HTTP front door does not change the domain/application architecture.

## Decision

Protect the entire Netco Worker with Cloudflare Access.

Desired boundary:

```text
Internet
   |
Cloudflare Access
   |
Netco Worker
   |
application capabilities
   |
Neon / R2 / Browser
```

Access should attach to the Worker itself rather than to individual API paths. This protects every current and future hostname associated with the Worker.

The initial policy should reuse the existing private personal Access policy already present in the Cloudflare account.

## Protected surface

The default is deny-before-Worker for unauthenticated callers.

This includes:

```text
/
/docs
/openapi.json
/api/v1
/api/v1/*
/healthz
```

No public path override is required for the initial private phase.

If an external uptime probe is needed later, a deliberately minimal health endpoint may be considered separately. It should not expose application data.

## Why Access instead of application API keys

Netco currently needs browser access for the owner, not a public partner API.

Cloudflare Access provides the correct front-door identity boundary without introducing:

- application-managed passwords
- API keys stored in browser code
- JWT issuance logic inside Netco
- duplicate authentication systems
- public HTTP endpoints merely for internal use

Future machine integrations should get their own narrow boundary:

- MCP connector authentication for ChatGPT/agents
- service tokens for machine-to-machine access where appropriate
- Worker Service Bindings/RPC for private Cloudflare-to-Cloudflare communication

## OpenAPI and Scalar

OpenAPI and Scalar remain useful after the Worker becomes private.

They become authenticated internal developer/operator tooling rather than public API documentation.

The contract remains available at:

```text
/openapi.json
/docs
```

after successful Access authentication.

## Desired Cloudflare state

See:

```text
infra/cloudflare/access/netco.private.json
```

The desired state is:

- target: Worker `netco`
- destination type: `worker`
- scope: production and preview traffic for this Worker
- session duration: 168 hours
- policy: reuse the existing personal-only Access policy
- public overrides: none

## Current implementation status

Repository state is ready for this boundary.

At capture time, the connected Cloudflare API credential can read Access applications but cannot create or update them. Cloudflare returns:

```text
1010 auth.forbidden
```

Therefore the Access configuration is not considered applied until a credential with Access write permission performs the change and the resulting Access application is verified.

This is an infrastructure-permission blocker, not an application-code blocker.

## Acceptance

The slice is complete when:

1. a Worker-scoped Access application targets `netco`
2. unauthenticated requests do not reach the Worker
3. an authorized owner session can open the Netco UI
4. the same authorized session can open `/docs` and `/openapi.json`
5. existing API behavior remains unchanged after authentication
6. the Access application is visible through the Cloudflare API
7. no application-level API key or password is introduced solely for this private phase

## Follow-up

After the private front door is proven:

1. continue extracting reusable application capabilities
2. decide whether any health surface should intentionally be public
3. add a small MCP adapter only when an agent integration is actually needed
4. keep machine authorization independent from human browser Access
