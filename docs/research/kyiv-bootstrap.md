# Kyiv Provider Bootstrap Research

Status: Working notes  
Date: 2026-09-25

## Working market model

Do not treat "number of Kyiv internet providers" as one universal number.

Netco should distinguish:

```text
active residential providers
known consumer brands
legal entities
network operators
B2B-only providers
legacy/inactive brands
```

A useful initial assumption is that the active residential market is much smaller than the full provider/entity universe.

The bootstrap should therefore ingest broadly and classify later rather than deleting unfamiliar or apparently inactive entities.

## Canonical bootstrap flow

```text
official registry
  ->
legal entities
  ->
brand resolution
  ->
official websites
  ->
services
  ->
territory
  ->
plans
  ->
coverage
  ->
address availability
```

## Priority source classes

### Official registry

Use the Ukrainian electronic communications provider registry as the authoritative starting point for legal entities, activity territory, service types, and related registration data.

This should be the base registry layer, not the final consumer-facing catalog.

### Provider websites

Use official provider sites for:

- current brand identity;
- current retail plans;
- connection conditions;
- technology claims;
- official address checkers;
- current promotions;
- current contacts.

### Address checkers

Provider-side availability checkers are strategically important because they can answer a more useful question than city-level coverage:

> Can this exact building or address order this service now?

Treat returned availability as a scoped observation.

### Aggregators

Aggregators can help discover:

- providers missing from initial seed data;
- local brands;
- historical aliases;
- approximate coverage;
- technology hints.

Aggregator data should not silently override higher-authority claims.

## Initial entity categories

Each discovered entity should eventually receive one or more classifications:

```text
residential
business
wholesale
mobile
fixed
active
inactive
legacy
unknown
```

Classification should itself retain provenance.

## Provider seed candidates

Initial research identified many Kyiv-facing provider or network names, including large national operators and local networks.

Examples include:

```text
Київстар
Воля
Ланет
Triolan
Укртелеком
Vodafone Gigabit Net
IPnet
KyivLink
UTELS
Коло.ТБ
НАШНЕТ
Teremki LAN
Bilink
ФРІНЕТ
Vega
LocalNet
GreeNet
Darnytsia.Net
Kievline
Lucky.Net
```

This list is a discovery seed only. It must not be treated as a verified active-provider list.

## Why this matters

The product is not primarily:

> a page listing providers in Kyiv.

The stronger product is:

```text
address
  ->
canonical building
  ->
available providers
  ->
actual availability
  ->
access technology
  ->
power-outage resilience
  ->
current price
  ->
price after promotion
  ->
installation and equipment cost
  ->
historical changes
```

That turns Netco from a directory into a normalized broadband availability and evidence system.

## Example consumer comparison

```text
Address: example building

Provider      Technology   Speed   Promo   Regular   Evidence
----------------------------------------------------------------
Provider A    GPON         1 Gb    149     299       official
Provider B    GPON         1 Gb    199     399       official
Provider C    FTTB         1 Gb    -       300       aggregator
```

The actual production view should also expose freshness and limitations rather than implying precision unsupported by evidence.

## Important research questions

- Which official data source gives stable legal-entity identifiers?
- Which Kyiv providers expose structured address-availability endpoints?
- How should Ukrainian address normalization be implemented?
- How should network technology claims be normalized?
- Can power-outage resilience be verified beyond marketing claims?
- Which providers operate their own network versus resell another network?
- Which brands have historical renames, acquisitions, or successors?
- Which plan terms are required to calculate realistic 12-month cost?
- How frequently do tariffs and promotions change?
- Which coverage facts can be known at building, entrance, or apartment level?

## Immediate next data milestone

Build Provider Registry V1:

1. ingest the official legal-provider universe relevant to Kyiv;
2. retain every source record append-only;
3. create observed entities;
4. attach known consumer-brand candidates;
5. run reversible entity resolution;
6. surface unresolved matches;
7. enrich active residential candidates from official websites;
8. produce the first canonical provider projection.
