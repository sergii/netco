# RFC-0023: Single production deploy owner

Status: Accepted  
Date: 2026-09-26

## Context

Netco accumulated two possible production deployment paths:

1. Cloudflare Workers Builds connected to GitHub branch `main`
2. a repository GitHub Actions workflow at `.github/workflows/deploy.yml`, triggered manually or through `.github/deploy-request`

Read-only Cloudflare inspection confirmed that the active automatic production path is Cloudflare Workers Builds.

The Worker build configuration is connected to:

```text
repository: sergii/netco
branch: main
deploy command: npx wrangler deploy
```

Recent production deployments from this path are recorded by Cloudflare with `source: wrangler`.

Keeping a second deploy owner increases the risk of duplicate deployments, divergent credentials, and ambiguity about which system owns production rollout.

## Decision

Cloudflare Workers Builds is the single production deployment owner for Netco.

The production flow is:

```text
GitHub main
    |
    v
Cloudflare Workers Builds
    |
    v
npx wrangler deploy
    |
    v
Netco Worker production
```

Wrangler configuration in Git remains the authoritative Worker configuration.

The read-only Cloudflare Inspector remains the production verification path.

## Removed deployment path

Remove:

```text
.github/workflows/deploy.yml
.github/deploy-request
```

No GitHub Actions workflow may independently deploy the Netco Worker unless a later RFC explicitly changes deployment ownership.

## Invariants

1. Exactly one automatic production deploy owner exists.
2. Production code/config originates from committed `main`.
3. Worker deployment uses Wrangler.
4. The Cloudflare Inspector remains read-only.
5. No manual dashboard code/config changes are part of the normal deployment path.
6. A future deploy-owner change must be explicit and reviewable in Git.

## Secrets

`wrangler.jsonc` declares required Worker secret names, including `MCP_TOKEN`.

Secret values remain outside Git.

Cloudflare supports uploading secrets through Wrangler, including `wrangler deploy --secrets-file`. The current Workers Builds command remains `npx wrangler deploy`; secret-value synchronization is therefore a separate follow-up concern and must not create a second deployment owner.

## Verification

Read-only Cloudflare inspection confirmed:

```text
provider: GitHub
repository: sergii/netco
branch: main
deploy command: npx wrangler deploy
previews: disabled
```

The duplicate repository deployment workflow can therefore be removed without changing the active production deployment path.
