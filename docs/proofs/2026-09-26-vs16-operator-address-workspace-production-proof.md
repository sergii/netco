# VS16 production proof - operator address workspace

Date: 2026-09-26

Status: production-proven

Issue: #102

Implementation PR: #107

Production-proof PR: #109

## Production implementation

Implementation merge SHA:

```text
d34a7bd5e9df5591471e290ea032130469913b9a
```

Cloudflare build:

```text
bbe31ea3-3446-4b26-a5f8-2aab832df574
outcome: success
source commit: d34a7bd5e9df5591471e290ea032130469913b9a
```

Worker deployment:

```text
deployment: 79514ea9-c9b1-4cd8-a93d-ee399897c463
version: ec924f0a-f78f-4ba2-8bef-825a6fd5c041
version number: 100
traffic: 100%
```

## Production proof

Workflow:

```text
VS16 Operator Address Workspace Production Proof
run id: 36261738449
result: success
```

Trusted address:

```text
d1cdbb61-98c7-4045-b70a-21ed4b4e6dca
UA / Київ / Клавдіївська / 40А
```

## Proven slice

Production now exposes:

```text
GET /api/v1/operator/addresses/:address_id
```

The live proof verified that the operator workspace composes already persisted state only:

```text
canonical address
  + persisted map position
  + provider availability
  + technologies
  + freshness
  + supporting claim IDs
  + coverage claim -> observation -> snapshot -> source trail
  + geo provenance
  + data-quality flags
  + read-only notes placeholder
  -> operator address workspace
```

## Live assertions

The production proof passed:

```text
trusted address returned                       ✓
canonical structured address matched           ✓
persisted coordinates returned                 ✓
provider_count == 1                            ✓
availability_count == 2                        ✓
technologies == [gig, xgpon]                   ✓
freshness == stale                             ✓
supporting claim IDs present                   ✓
coverage evidence trail present                ✓
geo provenance present                         ✓
coverage_stale quality flag present            ✓
operator notes remain placeholder-only         ✓
unknown address -> HTTP 404                    ✓
Explorer exposes address workspace             ✓
service metadata stage == VS16                 ✓
operator_address_workspace capability == true  ✓
```

## Read boundary

Permanent CI guard:

```text
scripts/validate-operator-address-workspace.mjs
```

The guard prevents the VS16 application capability from acquiring crawler, browser, collection, or geo-materialization dependencies and requires composition of the existing persisted coverage and provenance reads.

The production-proof workflow is manual-only after the initial successful proof.

## Deferred

VS16 deliberately does not add mutable CRM state:

- operator note persistence;
- tasks;
- leads;
- connection requests;
- calls;
- installation state;
- provider probing;
- geocoding or crawling from the operator request path.
