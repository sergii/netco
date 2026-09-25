# Hyperdrive bootstrap

Use the linked Neon production branch to create a dedicated database role and Cloudflare Hyperdrive configuration without copying credentials into chat or Git.

```bash
./scripts/provision-hyperdrive.sh
```

The script targets:

```text
Neon project: ancient-haze-86966909
Neon branch:  production
Neon role:    hyperdrive-user
Hyperdrive:   netco-db
```

It keeps the Neon connection string in a shell variable only and unsets it after Wrangler finishes.

After successful creation, inspect Cloudflare for the Hyperdrive ID and add this binding to `wrangler.jsonc`:

```jsonc
"hyperdrive": [
  {
    "binding": "DATABASE",
    "id": "<netco-db id>"
  }
]
```

Do not commit `.env.local`, `.neon`, or database credentials.
