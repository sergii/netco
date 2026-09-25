# Implementation 0007 - Crawler VS2 Production Acceptance

Date: 2026-09-25
Status: Proven in production

## Goal

Prove bounded fetching of high-relevance provider pages selected by deterministic URL discovery.

The production path is now:

```text
provider root
  -> immutable root snapshot
  -> URL discovery observation
  -> crawl_candidate=true
  -> bounded candidate fetch
  -> immutable candidate snapshot
  -> page-purpose observation
```

## Acceptance source

Official Lanet website:

```text
https://www.lanet.ua/
```

Source ID:

```text
0d3a76b0-57d8-4b8e-b743-7d87b79f8c89
```

## Root evidence

Root snapshot:

```text
287ebeb4-178b-46a1-b4e6-ba5cd1ac4055
```

Discovery observation:

```text
1cb1c101-6ef2-4bd9-b3c8-d34453fc14d4
```

Validation:

```text
valid
```

Counts:

```text
discovered URLs: 49
crawl candidates: 11
page budget: 5
```

## Candidate pages fetched

The five highest-priority candidates were captured successfully.

### Coverage

```text
https://www.lanet.ua/map/
classification: coverage
HTTP: 200
snapshot: 210c7ca5-7c61-4083-a323-ea837d21b131
observation: 19a6cf5b-cc34-440e-afb2-45be2a10ba8b
```

### Plans

```text
https://www.lanet.ua/tariffs/
classification: plans
HTTP: 200
snapshot: 0da79b82-8c51-4108-9a03-c2428db47adc
observation: 6f37c1ec-d3d9-4094-adc3-fcf5f42f3dd2
```

```text
https://www.lanet.ua/tariffs/iptv/
classification: plans
HTTP: 200
snapshot: dd46b432-b17d-47ab-90ba-bcb8f1cbaa3d
observation: 3441cd98-c093-4061-8a9d-3a9407d2f1d5
```

### Technology

```text
https://www.lanet.ua/internet/pon-2/
classification: technology
HTTP: 200
snapshot: 73499b98-de38-4b9f-bdc3-a9b1f6d2b3e7
observation: e7a9c1fa-70bb-4e27-9614-8fb7efb6e9ae
```

```text
https://www.lanet.ua/pon/
classification: technology
HTTP: 200
snapshot: a6ed65f1-8ea3-4b7c-81ab-1021362a35cc
observation: 7bbefdce-ee89-406f-a8b9-79f2e40f3fb7
```

All five page-purpose observations were `valid`.

## Provenance hardening

The production implementation now records:

- `capture_kind=source_root` for root snapshots;
- `capture_kind=crawl_candidate` for candidate snapshots;
- parent root snapshot ID;
- persisted discovery observation ID;
- expected classification;
- relevance score.

Redirects are followed manually and every hop must stay inside the source's configured host allowlist.

Candidate responses are limited to 1 MiB and candidate URLs have a 24-hour cooldown.

## Classifier finding

Acceptance exposed a useful false positive.

This URL:

```text
https://www.lanet.ua/social-responsibility/
```

was initially classified as `technology` because the short token `pon` occurs inside the English word `responsibility`.

The historical discovery observation remains unchanged.

The classifier was corrected so technology acronyms:

```text
PON
GPON
XPON
XGPON
FTTH
```

must match normalized tokens rather than arbitrary substrings.

Future discovery observations will use the corrected classifier.

## Acceptance schedule

For production acceptance only, cron was temporarily set to:

```text
* * * * *
```

After successful acceptance, normal cadence was restored to:

```text
17 3 * * *
```

## Next slice

Crawler VS3 should perform structured deterministic extraction from fetched candidate pages.

Initial target observations:

```text
plan-observation
technology-observation
coverage-entrypoint-observation
connection-observation
```

These observations should be validated before emitting domain claims.

No candidate page should mutate canonical provider projections directly.
