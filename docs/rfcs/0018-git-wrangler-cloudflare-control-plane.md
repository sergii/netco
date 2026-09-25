# RFC-0018: Git and Wrangler as the Cloudflare control plane

Status: Proposed  
Date: 2026-09-26

## Context

RFC-0017 defined the desired privacy boundary for Netco: the production Worker should eventually sit behind Cloudflare Access.

The implementation mechanism matters as much as the target state.

Netco must not accumulate production configuration that exists only because somebody clicked in the Cloudflare dashboard or issued an imperative API/MCP write. That state is difficult to review, reproduce, roll back, and audit.

The current operational rule is therefore stricter:

> Production Cloudflare state is changed only through deterministic configuration stored in Git.

For Worker-owned configuration, Wrangler configuration is the authoritative mechanism.

## Decision

Netco Cloudflare management follows these rules:

1. `wrangler.jsonc` in Git is the source of truth for every production setting that Wrangler can declaratively manage.
2. Production changes are applied from committed configuration through the normal deployment path.
3. The Cloudflare Inspector connector remains read-only and is used for verification and drift inspection.
4. Do not use the Cloudflare dashboard as a production configuration mechanism.
5. Do not use imperative Cloudflare API or MCP writes as a production configuration mechanism.
6. Do not add a second privileged "operator" MCP merely to bypass this rule.
7. If Cloudflare exposes a resource through API/dashboard but not through Wrangler configuration, that resource remains unmanaged until an explicitly adopted deterministic Git-managed mechanism exists.

## Cloudflare Access consequence

As of 2026-09-26, Cloudflare documents Worker production Access configuration through the Workers dashboard and the Access Applications API.

Wrangler currently exposes an `access.dev` block for local Access identity simulation, but it does not provide a production `wrangler.jsonc` declaration for creating the Worker-scoped Access application or its authorization policy.

Therefore:

- do not create `Netco Private` manually
- do not create it through the Cloudflare API
- do not grant write access to the read-only Inspector for this purpose
- keep RFC-0017 as the desired privacy architecture
- defer applying that Access boundary while Wrangler cannot own it declaratively under the current control-plane rule

The desired-state file introduced by RFC-0017 is documentation only. It is not an executable production control plane.

## Current production exposure

The committed Worker configuration currently contains:

```json
{
  "workers_dev": true,
  "preview_urls": false
}
```

Therefore the production Worker remains reachable through its `workers.dev` hostname.

This is an explicit known state, not an accidental configuration gap.

Turning `workers_dev` off would also remove the current browser entry point because Netco does not yet have another Git-managed private route. That change is not part of this RFC.

## Determinism requirement

A Cloudflare production change is acceptable only if all of the following are true:

1. the intended state is represented in Git
2. the mechanism can reproduce that state from a clean environment
3. review happens before application
4. rollback is represented by another Git change
5. read-only production inspection can verify the resulting state
6. no hidden dashboard-only step is required to recreate the system

## Wrangler boundary

Wrangler may manage, where supported:

- Worker source and compatibility settings
- bindings
- Hyperdrive bindings
- R2 bindings
- Browser Rendering bindings
- cron triggers
- `workers_dev`
- preview URL settings
- observability settings
- routes/domains when represented in Wrangler configuration
- other Worker configuration supported by the active Wrangler schema

Unsupported account-level resources are not silently managed through ad-hoc API calls.

## Future options

If Cloudflare later adds production Worker Access configuration to Wrangler, Netco can implement RFC-0017 directly in `wrangler.jsonc`.

If Netco later decides that a broader Git-managed infrastructure control plane is necessary, that should be a separate architectural decision, for example adopting Terraform/OpenTofu. It must not happen implicitly as an exception to this rule.

Until one of those decisions occurs, Access remains deliberately unapplied.

## Verification

The read-only Cloudflare Inspector should be used to compare live state against the committed Wrangler-owned state after deployments.

The expected model is:

```text
Git
  |
  v
wrangler.jsonc
  |
  v
CI / deploy
  |
  v
Cloudflare
  |
  v
read-only Inspector verification
```

There is no imperative production-write path around this flow.
