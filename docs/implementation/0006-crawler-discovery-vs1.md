# Implementation 0006 - Crawler Discovery VS1 Production Acceptance

Date: 2026-09-25
Status: Proven in production

## Goal

Prove deterministic URL discovery on top of an existing immutable provider snapshot without issuing another provider fetch.

## Production path

```text
existing R2 snapshot
  -> scheduled Worker invocation
  -> HTML link extraction
  -> host allowlist
  -> URL normalization
  -> deterministic classification
  -> url-discovery-observation
  -> read-only discovery API
```

## Acceptance setup

The normal production schedule is:

```text
17 3 * * *
```

For acceptance only, the cron was temporarily changed to:

```text
* * * * *
```

The source remained inside its collection cooldown, so the scheduled run reused the latest immutable snapshot and did not issue a new provider fetch.

After acceptance, the daily schedule was restored.

## Source

```text
source: teremki-billing
URL: https://stat.teremki.net.ua/login.php
source id: eebfc808-4e2d-4bc8-af56-676b413a53ab
```

Input snapshot:

```text
3fb51192-2365-4caa-b88c-bf0fd2acfab9
```

## Scheduled invocation

Cloudflare Workers Observability recorded:

```text
trigger: * * * * *
eventType: scheduled
outcome: ok
source: teremki-billing
status: cooldown
latest_snapshot_id: 3fb51192-2365-4caa-b88c-bf0fd2acfab9
discovery_inserted: true
discovered_count: 1
crawl_candidate_count: 0
```

This proves discovery can operate independently on an already stored snapshot.

## Discovery observation

Observation:

```text
80863cee-bf02-41e8-a68a-669e18ce79d0
```

Validation:

```text
valid
```

Discovered URL:

```text
https://stat.teremki.net.ua/account.php
```

Classification:

```text
account
```

Matched terms:

```text
account
stat
```

Relevance score:

```text
20
```

Crawl candidate:

```text
false
```

This is expected. A login/account page is not a high-value source for public plans, coverage, technology, connection, contacts, or legal facts.

## API acceptance

The read-only endpoint returned the persisted observation:

```text
GET /api/v1/sources/teremki-billing/discovery
```

The production GitHub acceptance poller completed successfully after the scheduled observation appeared.

## Result

Crawler Discovery VS1 is proven.

The current Teremki billing page is intentionally a poor crawl seed because it exposes only an account link. This is useful evidence that URL classification prevents a crawler from following every same-host link blindly.

## Next slice

Crawler VS2 should use a richer public provider website and:

```text
root snapshot
  -> discover URLs
  -> choose high-relevance candidates
  -> fetch bounded candidate set
  -> R2 snapshots
  -> page-purpose observations
  -> structured provider claims
```

Candidate fetch constraints should include:

- explicit host allowlist;
- small page budget;
- byte limits;
- per-source cooldown;
- no arbitrary public target URL;
- append-only snapshots for every attempted page.

Cloudflare Browser Run /crawl remains a later adapter for JS-heavy or sitemap-heavy sites.
