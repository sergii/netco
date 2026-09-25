# Implementation 0001 - Worker Bootstrap

Date: 2026-09-25
Status: Source bootstrapped, Cloudflare deployment blocked by connector authorization

## Worker

Production Worker name:

```text
netco
```

Naming follows the repository convention: Workers do not receive a `-worker` suffix.

## Initial HTTP surface

```text
GET /
GET /healthz
GET /api/v1/meta
```

The API intentionally starts small.

The first real capability will be the Evidence Spine from RFC 0003:

```text
source snapshot
  -> validated observation
  -> claims
  -> provenance
```

## Cloudflare configuration

The repository contains `wrangler.jsonc` with:

- module Worker entrypoint;
- compatibility date 2026-09-25;
- `nodejs_compat`;
- workers.dev enabled;
- preview URLs disabled;
- logs enabled;
- traces enabled.

## Deployment status

A direct Cloudflare API upload was attempted through the connected Cloudflare integration.

Read access works and confirmed that no existing `netco` Worker conflicts with the chosen name.

Both a full module upload and a minimal service-worker upload were rejected with:

```text
No access to the specified resource.
```

This indicates the active Cloudflare credential does not currently authorize Worker script writes for this account.

No existing Cloudflare resource was modified.

## Deployment paths

### Preferred

Grant the connected Cloudflare credential Worker script edit permission, then deploy `netco` directly.

### Repository fallback

A manual GitHub Actions workflow exists at:

```text
.github/workflows/deploy.yml
```

It expects:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

as GitHub secrets.

It does not auto-deploy on push, so missing secrets cannot create noisy failed production deployments.

## Next slice

After the first successful deployment:

1. verify `/healthz` on workers.dev;
2. add Neon connection through Hyperdrive;
3. create the Evidence Spine schema;
4. expose provenance for one provider observation;
5. add R2 snapshot storage.
