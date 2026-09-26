#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${NETCO_BASE_URL:-https://netco.web33.workers.dev}"
ADDRESS_ID="d1cdbb61-98c7-4045-b70a-21ed4b4e6dca"

echo "==> VS16 operator address workspace"
WORKSPACE_JSON="$(
  curl --fail --silent --show-error     "$BASE_URL/api/v1/operator/addresses/$ADDRESS_ID"
)"

printf '%s' "$WORKSPACE_JSON" | jq -e   --arg address "$ADDRESS_ID" '
    .address.id == $address
    and .address.country_code == "UA"
    and .address.city == "Київ"
    and .address.street == "Клавдіївська"
    and .address.house_number == "40А"
    and .map.geometry_state == "present"
    and (.map.latitude | type) == "number"
    and (.map.longitude | type) == "number"
    and .coverage.provider_count == 1
    and .coverage.availability_count == 2
    and .coverage.technologies == ["gig","xgpon"]
    and .coverage.freshness_state == "stale"
    and (.supporting_claim_ids | length) >= 1
    and (.evidence.coverage | length) >= 1
    and (.evidence.coverage[0].claim.id | type) == "string"
    and (.evidence.coverage[0].observation.id | type) == "string"
    and (.evidence.coverage[0].snapshot.id | type) == "string"
    and (.evidence.coverage[0].source.name | type) == "string"
    and (.evidence.geo.claim.id | type) == "string"
    and (.evidence.geo.observation.id | type) == "string"
    and (.evidence.geo.snapshot.id | type) == "string"
    and (.evidence.geo.source.name | type) == "string"
    and .data_quality.status == "needs_attention"
    and (.data_quality.flags | index("coverage_stale")) != null
    and .operator.notes == null
    and .operator.notes_state == "placeholder"
  ' >/dev/null

echo "==> Unknown address is deterministic 404"
UNKNOWN_STATUS="$(
  curl --silent --show-error     -o /tmp/netco-vs16-unknown.json     -w '%{http_code}'     "$BASE_URL/api/v1/operator/addresses/00000000-0000-0000-0000-000000000000"
)"
[[ "$UNKNOWN_STATUS" == "404" ]] || {
  echo "Expected unknown operator address status 404, got $UNKNOWN_STATUS" >&2
  cat /tmp/netco-vs16-unknown.json >&2
  exit 1
}
jq -e '.error == "operator_address_not_found"'   /tmp/netco-vs16-unknown.json >/dev/null

echo "==> Explorer exposes address workspace"
EXPLORER_HTML="$(curl --fail --silent --show-error "$BASE_URL/")"
for marker in   'data-tab="addresses"'   'id="address-workspace"'   '/api/v1/coverage/addresses?freshness=all'   '/api/v1/operator/addresses/'   'Робоче місце'
do
  grep -F "$marker" <<<"$EXPLORER_HTML" >/dev/null || {
    echo "Explorer is missing VS16 marker: $marker" >&2
    exit 1
  }
done

echo "==> Service metadata reflects VS16"
META_JSON="$(curl --fail --silent --show-error "$BASE_URL/api/v1/meta")"
printf '%s' "$META_JSON" | jq -e '
  .stage == "operator-address-workspace-vs16"
  and .capabilities.address_coverage == true
  and .capabilities.geo == true
  and .capabilities.map_cell_inspection == true
  and .capabilities.operator_address_workspace == true
  and .capabilities.mcp == true
' >/dev/null

echo "✓ Netco VS16 production proof passed"
echo "  operator address workspace is live           ✓"
echo "  canonical address + map position              ✓"
echo "  provider availability + technologies          ✓"
echo "  freshness + supporting claim IDs              ✓"
echo "  coverage evidence trail                       ✓"
echo "  geo provenance                                ✓"
echo "  data-quality flags                            ✓"
echo "  notes placeholder remains read-only           ✓"
echo "  unknown address -> 404                        ✓"
echo "  Explorer exposes operator workflow            ✓"
echo "  service metadata advanced to VS16             ✓"
