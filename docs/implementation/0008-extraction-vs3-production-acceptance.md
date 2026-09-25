# Implementation 0008 - Extraction VS3 Production Acceptance

Date: 2026-09-25
Status: Proven in production

## Goal

Prove the complete deterministic extraction boundary:

```text
immutable crawl candidate snapshot
  -> page-purpose observation
  -> typed domain extraction
  -> validation
  -> source-backed claims
```

No canonical provider projection is written by the extractor.

## Production version

Final accepted extractor:

```text
deterministic-domain-html
extractor_version: 4
```

Production commit:

```text
9593ae38316d2746ef3edc7b9e6720896c6f6161
```

The Cloudflare build for that commit completed successfully.

## Reprocessing history

Extractor versions 1, 2, and 3 remain append-only historical observations.

They were not rewritten or deleted.

The same immutable R2 snapshots were reprocessed by newer extractor versions to improve semantics.

## Representative accepted evidence

### Coverage entrypoint

Snapshot:

```text
210c7ca5-7c61-4083-a323-ea837d21b131
```

Observation:

```text
44c32afa-03e9-4214-9791-654ae017b264
coverage-entrypoint-observation
extractor_version: 4
validation: valid
```

Payload:

```text
checker_url: https://www.lanet.ua/map/
checker_kind: address
geographic_hint: Київ
evidence_marker: Карта покриття
```

Claim:

```text
coverage.checker_entrypoint
```

This claim means the official source exposes an address-level checker.

It does not assert availability at any specific address.

### Plan catalog entry

Snapshot:

```text
0da79b82-8c51-4108-9a03-c2428db47adc
```

Observation:

```text
3270b3c3-fc4d-4bcf-9124-c9dd16a9ab09
plan-observation
extractor_version: 4
validation: valid
```

Extracted evidence:

```text
name: PON.T
technology: xpon
download_mbps: 5000
promo_price: 67.00 UAH
promo_duration_months: 6
monthly_price: null
price_after_promo: null
evidence_marker: «PON.T»
```

Claim:

```text
plan.catalog_entry
```

The v4 semantics intentionally keep the observed 67 UAH value as a promotional price instead of incorrectly promoting it to the normal monthly recurring price.

### Technology

Snapshot:

```text
73499b98-de38-4b9f-bdc3-a9b1f6d2b3e7
```

Observation:

```text
46f8a6b8-0b32-4c01-9335-5a169b43676b
technology-observation
extractor_version: 4
validation: valid
```

Extracted evidence:

```text
technology: xpon
observed_label: PON
evidence_marker: PON
```

Claim:

```text
service.technology
```

Footer/navigation false positives from earlier extractor versions are excluded by the accepted extractor.

## Evidence locator

Every emitted claim retains:

- source slug;
- source snapshot;
- domain observation;
- page-purpose observation;
- R2 body reference;
- deterministic body-text marker.

## Acceptance schedule

For production acceptance only, cron was temporarily set to:

```text
* * * * *
```

After acceptance the normal production cadence was restored to:

```text
17 3 * * *
```

## Result

Extraction VS3 is production-proven.

The system now has real structured provider evidence and claims for:

```text
plan.catalog_entry
service.technology
coverage.checker_entrypoint
```

## Next slice

The next boundary is claim resolution and product read models.

Initial targets:

```text
Plan identity
PlanVersion
provider_current_plans
provider_current_technologies
provider profile projection
```

Historical observations and claims remain the source of truth. Projections must be rebuildable.
