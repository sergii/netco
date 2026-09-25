# Implementation 0005 - First Production Evidence Ingestion

Date: 2026-09-25
Status: Proven in production

## Acceptance result

Evidence Spine VS1 completed its first end-to-end production ingestion through:

```text
Cloudflare Worker
  -> provider source
  -> R2
  -> Hyperdrive
  -> Neon PostgreSQL
  -> observation
  -> claims
  -> provenance API
```

## Database readiness

Production reported 5/5 required Evidence Spine tables, a reachable Hyperdrive-backed database, and the expected `content_length` column.

## Attempt 1 - provider root

Source:

```text
https://www.teremki.net.ua/
```

Result:

```text
HTTP 526
content-type: text/plain; charset=UTF-8
content-length: 16
```

Snapshot:

```text
b8ad9417-29da-471c-8c4b-3c99b27e4510
```

The observation was correctly marked `invalid` and emitted zero claims.

This snapshot and observation remain append-only evidence. They are not deleted or rewritten.

## Attempt 2 - official billing source

A separate source record was added for:

```text
https://stat.teremki.net.ua/login.php
```

It points to the same provider-candidate subject but retains independent source provenance.

Result:

```text
HTTP 200
content-type: text/html; charset=windows-1251
content-length: 2816
```

Snapshot:

```text
3fb51192-2365-4caa-b88c-bf0fd2acfab9
```

SHA-256:

```text
b92b3e335bd118fb8ec199ba87bf767dadd1fe59a5c46a8a924f54eebb63978a
```

R2 body:

```text
blobs/sha256/b9/b92b3e335bd118fb8ec199ba87bf767dadd1fe59a5c46a8a924f54eebb63978a
```

Observation:

```text
e151b07b-7253-476a-af04-5feef267e7e9
validation_status: valid
matched markers: teremki, Teremki@LAN
```

Two claims were emitted:

```text
identity.display_name
web.official_site
```

The production acceptance workflow verified the snapshot, observation, claims, and provenance endpoint.

## Character encoding

The accepted page declares `windows-1251`.

The original observation used default text decoding, so its Cyrillic page-title segment was mojibake while the ASCII identity markers still validated correctly.

The extractor now decodes stored bytes using the declared charset when supported.

The historical observation remains unchanged.

## Trigger hardening

The public POST collection endpoint used only for the acceptance test has been removed.

Production collection now runs from the Worker's scheduled handler.

Current schedule:

```text
17 3 * * *
```

Only sources explicitly marked `collection_enabled` are scheduled.

The failing root source stays registered but is disabled for scheduled collection. The working billing source is enabled.

## Next slice

Next, add page discovery and classification before broad crawling:

```text
source root
  -> discover URLs
  -> classify page purpose
  -> select relevant pages
  -> snapshot
  -> structured extraction
  -> claims
```

Browser-based crawling remains an adapter behind the same Evidence Spine contract.
