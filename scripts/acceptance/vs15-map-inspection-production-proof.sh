#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${NETCO_BASE_URL:-https://netco.sergii-ponomarov.workers.dev}"
CELL="891e6385687ffff"
ADDRESS_ID="d1cdbb61-98c7-4045-b70a-21ed4b4e6dca"

echo "==> H3 cell detail"
CELL_JSON="$(curl --fail --silent --show-error "$BASE_URL/api/v1/geo/h3-cells/$CELL")"
printf '%s' "$CELL_JSON" | jq -e   --arg cell "$CELL"   --arg address "$ADDRESS_ID" '
    .h3_index == $cell
    and .resolution == 9
    and .address_count == 1
    and (.addresses | length) == 1
    and .addresses[0].address_id == $address
    and .addresses[0].provider_count == 1
    and .addresses[0].availability_count == 2
    and .addresses[0].technologies == ["gig","xgpon"]
    and .addresses[0].freshness_state == "stale"
  ' >/dev/null

echo "==> Existing address coverage read"
COVERAGE_JSON="$(
  curl --fail --silent --show-error --get     "$BASE_URL/api/v1/coverage/address"     --data-urlencode "country_code=UA"     --data-urlencode "city=Київ"     --data-urlencode "street=Клавдіївська"     --data-urlencode "house_number=40А"
)"
printf '%s' "$COVERAGE_JSON" | jq -e '
  (.providers | length) == 1
  and (.providers[0].availability | length) == 2
  and ([.providers[0].availability[].technology] | sort) == ["gig","xgpon"]
' >/dev/null

echo "==> Existing geo provenance read"
PROVENANCE_JSON="$(
  curl --fail --silent --show-error     "$BASE_URL/api/v1/geo/addresses/$ADDRESS_ID/provenance"
)"
printf '%s' "$PROVENANCE_JSON" | jq -e   --arg address "$ADDRESS_ID" '
    .address_id == $address
    and (.claim.id | type) == "string"
    and (.observation.id | type) == "string"
    and (.snapshot.id | type) == "string"
    and (.source.name | type) == "string"
  ' >/dev/null

echo "==> Invalid H3 input is a deterministic 400"
INVALID_STATUS="$(
  curl --silent --show-error     -o /tmp/netco-vs15-invalid.json     -w '%{http_code}'     "$BASE_URL/api/v1/geo/h3-cells/not-a-cell"
)"
[[ "$INVALID_STATUS" == "400" ]] || {
  echo "Expected invalid H3 status 400, got $INVALID_STATUS" >&2
  cat /tmp/netco-vs15-invalid.json >&2
  exit 1
}
jq -e '.error == "h3_cell_invalid"' /tmp/netco-vs15-invalid.json >/dev/null

echo "==> Valid but unknown H3 input is a deterministic 404"
UNKNOWN_CELL="$(
  node --input-type=module -e     'import { latLngToCell } from "h3-js"; console.log(latLngToCell(51.5,31.5,9));'
)"
UNKNOWN_STATUS="$(
  curl --silent --show-error     -o /tmp/netco-vs15-unknown.json     -w '%{http_code}'     "$BASE_URL/api/v1/geo/h3-cells/$UNKNOWN_CELL"
)"
[[ "$UNKNOWN_STATUS" == "404" ]] || {
  echo "Expected unknown H3 status 404, got $UNKNOWN_STATUS for $UNKNOWN_CELL" >&2
  cat /tmp/netco-vs15-unknown.json >&2
  exit 1
}
jq -e '.error == "h3_cell_not_found"' /tmp/netco-vs15-unknown.json >/dev/null

echo "==> Explorer composes existing read capabilities"
EXPLORER_HTML="$(curl --fail --silent --show-error "$BASE_URL/")"
for marker in   'Inspect evidence'   '/api/v1/geo/h3-cells/'   '/api/v1/coverage/address?'   '/api/v1/geo/addresses/'
do
  grep -F "$marker" <<<"$EXPLORER_HTML" >/dev/null || {
    echo "Explorer is missing marker: $marker" >&2
    exit 1
  }
done

echo "==> Service metadata reflects VS15"
META_JSON="$(curl --fail --silent --show-error "$BASE_URL/api/v1/meta")"
printf '%s' "$META_JSON" | jq -e '
  .stage == "map-cell-inspection-vs15"
  and .capabilities.h3_aggregation == true
  and .capabilities.map == true
  and .capabilities.map_cell_inspection == true
  and .capabilities.mcp == true
' >/dev/null

echo "✓ Netco VS15 production proof passed"
echo "  H3 cell detail returns trusted address       ✓"
echo "  address coverage reuses existing read        ✓"
echo "  geo provenance reuses existing read          ✓"
echo "  invalid H3 -> 400                            ✓"
echo "  valid unknown H3 -> 404                      ✓"
echo "  Explorer composes read-only inspection path  ✓"
echo "  service metadata advanced to VS15            ✓"
