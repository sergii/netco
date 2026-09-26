#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${NETCO_BASE_URL:-https://netco.web33.workers.dev}"

echo "==> Validate trusted Kyiv point at H3 resolution 9"
KYIV="$(
  curl --fail --silent --show-error     "$BASE_URL/api/v1/geo/h3-cells?resolution=9&west=30.33&south=50.47&east=30.35&north=50.49"
)"

printf '%s' "$KYIV" | jq -e '
  .type == "FeatureCollection"
  and .resolution == 9
  and .count == 1
  and (.features | length) == 1
  and .features[0].type == "Feature"
  and .features[0].geometry.type == "Polygon"
  and (.features[0].geometry.coordinates | length) == 1
  and (.features[0].geometry.coordinates[0] | length) >= 7
  and .features[0].geometry.coordinates[0][0]
      == .features[0].geometry.coordinates[0][-1]
  and .features[0].properties.resolution == 9
  and (.features[0].properties.h3_index | type) == "string"
  and (.features[0].properties.h3_index | length) > 0
  and .features[0].properties.address_count == 1
  and (.features[0].properties.fresh_address_count >= 0)
  and (.features[0].properties.fresh_address_count <= 1)
  and .features[0].properties.provider_count == 1
  and .features[0].properties.availability_count == 2
  and .features[0].properties.technologies == ["gig", "xgpon"]
  and .features[0].properties.source_point_ids
      == ["d1cdbb61-98c7-4045-b70a-21ed4b4e6dca"]
' >/dev/null

echo "==> Validate outside-Kyiv viewport"
OUTSIDE="$(
  curl --fail --silent --show-error     "$BASE_URL/api/v1/geo/h3-cells?resolution=9&west=31&south=51&east=32&north=52"
)"
printf '%s' "$OUTSIDE" | jq -e '
  .type == "FeatureCollection"
  and .resolution == 9
  and .count == 0
  and .features == []
' >/dev/null

echo "==> Validate invalid resolution"
INVALID_STATUS="$(
  curl --silent --show-error     -o /tmp/netco-h3-invalid.json     -w '%{http_code}'     "$BASE_URL/api/v1/geo/h3-cells?resolution=16"
)"
[[ "$INVALID_STATUS" == "400" ]]
jq -e '.error == "h3_resolution_invalid"' /tmp/netco-h3-invalid.json >/dev/null

echo "==> Validate missing resolution"
MISSING_STATUS="$(
  curl --silent --show-error     -o /tmp/netco-h3-missing.json     -w '%{http_code}'     "$BASE_URL/api/v1/geo/h3-cells"
)"
[[ "$MISSING_STATUS" == "400" ]]
jq -e '.error == "h3_resolution_required"' /tmp/netco-h3-missing.json >/dev/null

echo "==> Validate incomplete viewport"
VIEWPORT_STATUS="$(
  curl --silent --show-error     -o /tmp/netco-h3-viewport.json     -w '%{http_code}'     "$BASE_URL/api/v1/geo/h3-cells?resolution=9&west=30.33"
)"
[[ "$VIEWPORT_STATUS" == "400" ]]
jq -e '.error == "viewport_incomplete"' /tmp/netco-h3-viewport.json >/dev/null

echo "✓ Netco VS13 H3 production proof passed"
echo "  trusted Kyiv point -> one H3 cell       ✓"
echo "  provider_count == 1                     ✓"
echo "  availability_count == 2                 ✓"
echo "  technologies == [gig, xgpon]            ✓"
echo "  cell polygon is closed GeoJSON           ✓"
echo "  outside-Kyiv viewport -> zero cells      ✓"
echo "  invalid resolution -> HTTP 400           ✓"
echo "  missing resolution -> HTTP 400           ✓"
echo "  incomplete viewport -> HTTP 400          ✓"
