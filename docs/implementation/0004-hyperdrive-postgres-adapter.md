# Implementation 0004 - Hyperdrive Postgres Adapter

Date: 2026-09-25  
Status: Proposed in PR

## Purpose

Prepare the Evidence Spine for Neon without changing production behavior before a Hyperdrive binding exists.

## Driver

Netco uses `pg` (node-postgres) through Cloudflare Hyperdrive.

The Worker creates a short-lived `Client` per operation using:

```text
DATABASE.connectionString
```

Hyperdrive owns the underlying connection pooling.

## Persistence path

`collectAndPersistKnownSource()` performs:

```text
registered source
  -> HTTP fetch
  -> R2 content-addressed blob
  -> R2 append-only snapshot manifest
  -> PostgreSQL transaction
       -> insert source if absent
       -> append source_snapshots row
```

The snapshot insert is intentionally not an upsert.

Repeated fetches therefore remain append-only even when the physical R2 body is deduplicated.

## Source mutation policy

The initial source seed uses:

```sql
ON CONFLICT (id) DO NOTHING
```

This avoids silently rewriting an existing source definition during collection.

Changes to source identity or canonical URL should be explicit migration/domain decisions.

## Migration

`migrations/0002_snapshot_content_length.sql` adds `content_length` so relational metadata preserves the exact fetched body size already present in `source-snapshot.v1`.

## Remaining infrastructure

The Worker binding is planned as:

```text
DATABASE -> Hyperdrive netco-db -> Neon PostgreSQL
```

The binding is deliberately not declared until the Neon origin exists.

## Next acceptance test

After Neon + Hyperdrive are connected:

1. apply migrations 0001 and 0002;
2. run one controlled `collectAndPersistKnownSource(..., "teremki")`;
3. confirm the R2 manifest and PostgreSQL row share the same snapshot UUID and SHA-256;
4. repeat and confirm a new snapshot row is appended while identical bytes reuse the R2 blob.
