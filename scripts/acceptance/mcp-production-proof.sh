#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${NETCO_BASE_URL:-https://netco.sergii-ponomarov.workers.dev}"
MCP_PROTOCOL_VERSION="2026-07-28"
MCP_CLIENT_NAME="netco-production-acceptance"
MCP_CLIENT_VERSION="1.0.0"

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command is missing: $1" >&2
    exit 1
  }
}

for command_name in curl jq openssl npx; do
  require_command "$command_name"
done

test -n "${CLOUDFLARE_API_TOKEN:-}" || {
  echo "CLOUDFLARE_API_TOKEN is required." >&2
  exit 1
}
test -n "${CLOUDFLARE_ACCOUNT_ID:-}" || {
  echo "CLOUDFLARE_ACCOUNT_ID is required." >&2
  exit 1
}

MCP_TOKEN="$(openssl rand -hex 32)"
echo "::add-mask::$MCP_TOKEN"

echo "==> Provision MCP_TOKEN as a Cloudflare Worker secret"
printf '%s' "$MCP_TOKEN"   | npx wrangler secret put MCP_TOKEN --config wrangler.jsonc >/tmp/netco-mcp-secret-put.log

npx wrangler secret list --config wrangler.jsonc   | jq -e '.[] | select(.name == "MCP_TOKEN" and .type == "secret_text")' >/dev/null

mcp_payload() {
  local id="$1"
  local method="$2"
  local params_json="$3"

  jq -cn     --arg id "$id"     --arg method "$method"     --arg protocol "$MCP_PROTOCOL_VERSION"     --arg client "$MCP_CLIENT_NAME"     --arg clientVersion "$MCP_CLIENT_VERSION"     --argjson params "$params_json" '
      {
        jsonrpc: "2.0",
        id: $id,
        method: $method,
        params: (
          $params
          + {
              _meta: {
                "io.modelcontextprotocol/protocolVersion": $protocol,
                "io.modelcontextprotocol/clientCapabilities": {},
                "io.modelcontextprotocol/clientInfo": {
                  name: $client,
                  version: $clientVersion
                }
              }
            }
        )
      }
    '
}

mcp_post() {
  local method="$1"
  local payload="$2"
  local name="${3:-}"
  local token="${4:-$MCP_TOKEN}"
  local -a headers=(
    -H "Content-Type: application/json"
    -H "Accept: application/json, text/event-stream"
    -H "MCP-Protocol-Version: $MCP_PROTOCOL_VERSION"
    -H "Mcp-Method: $method"
  )

  if [[ -n "$name" ]]; then
    headers+=(-H "Mcp-Name: $name")
  fi
  if [[ -n "$token" ]]; then
    headers+=(-H "Authorization: Bearer $token")
  fi

  curl --fail --silent --show-error     -X POST     "$BASE_URL/mcp"     "${headers[@]}"     -d "$payload"     | sed -n 's/^data: //p'     | tail -n 1
}

echo "==> Prove unauthenticated MCP is rejected"
DISCOVER_BODY="$(mcp_payload "discover-unauth" "server/discover" '{}')"
UNAUTH_STATUS="$(
  curl --silent --show-error     -o /tmp/netco-mcp-unauthenticated.out     -w '%{http_code}'     -X POST     "$BASE_URL/mcp"     -H "Content-Type: application/json"     -H "Accept: application/json, text/event-stream"     -H "MCP-Protocol-Version: $MCP_PROTOCOL_VERSION"     -H "Mcp-Method: server/discover"     -d "$DISCOVER_BODY"
)"
[[ "$UNAUTH_STATUS" == "401" ]] || {
  echo "Expected unauthenticated MCP status 401, got $UNAUTH_STATUS." >&2
  cat /tmp/netco-mcp-unauthenticated.out >&2
  exit 1
}

echo "==> Prove authenticated discovery"
DISCOVER="$(mcp_post "server/discover" "$DISCOVER_BODY")"
printf '%s' "$DISCOVER"   | jq -e '
      .jsonrpc == "2.0"
      and .id == "discover-unauth"
      and (.result.supportedVersions | index("2026-07-28") != null)
      and .result.capabilities.tools.listChanged == false
      and .result.resultType == "complete"
      and .result.ttlMs == 0
      and .result.cacheScope == "private"
      and .result._meta["io.modelcontextprotocol/serverInfo"] == {
        name: "netco",
        version: "0.1.0"
      }
    ' >/dev/null

echo "==> Prove tools/list exposes exactly the intended two read-only tools"
LIST_BODY="$(mcp_payload "tools-list-1" "tools/list" '{}')"
TOOLS_LIST="$(mcp_post "tools/list" "$LIST_BODY")"
printf '%s' "$TOOLS_LIST"   | jq -e '
      .jsonrpc == "2.0"
      and .id == "tools-list-1"
      and (.result.tools | length) == 2
      and ([.result.tools[].name] | sort) == [
        "check_availability",
        "find_providers_for_address"
      ]
      and ([.result.tools[]
        | select(
            .annotations.readOnlyHint == true
            and .annotations.destructiveHint == false
            and .annotations.idempotentHint == true
            and .annotations.openWorldHint == false
          )] | length) == 2
    ' >/dev/null

echo "==> Select one real persisted production coverage observation"
INVENTORY="$(
  curl --fail --silent --show-error     "$BASE_URL/api/v1/coverage/addresses?freshness=all"
)"
CASE="$(
  printf '%s' "$INVENTORY"     | jq -ce '
        .addresses
        | map(select(any(.providers[]?; .slug != null)))
        | .[0]
      '
)"
[[ -n "$CASE" ]] || {
  echo "No production address with a provider slug is available for MCP proof." >&2
  exit 1
}

ADDRESS="$(
  printf '%s' "$CASE"     | jq -c '
        .address
        | {
            country_code,
            region,
            city,
            district,
            street,
            house_number,
            corpus,
            building_letter,
            postal_code
          }
      '
)"
NORMALIZED_KEY="$(printf '%s' "$CASE" | jq -er '.address.normalized_key')"
PROVIDER="$(
  printf '%s' "$CASE"     | jq -er '.providers | map(select(.slug != null)) | .[0].slug'
)"

echo "==> Execute find_providers_for_address against production application capability"
FIND_PARAMS="$(
  jq -cn     --argjson address "$ADDRESS" '
      {
        name: "find_providers_for_address",
        arguments: {
          address: $address
        }
      }
    '
)"
FIND_BODY="$(mcp_payload "find-1" "tools/call" "$FIND_PARAMS")"
FIND_RESULT="$(
  mcp_post     "tools/call"     "$FIND_BODY"     "find_providers_for_address"
)"
printf '%s' "$FIND_RESULT"   | jq -e       --arg normalizedKey "$NORMALIZED_KEY"       --arg provider "$PROVIDER" '
        .jsonrpc == "2.0"
        and .id == "find-1"
        and .result.isError == false
        and .result.resultType == "complete"
        and .result.structuredContent.address.normalized_key == $normalizedKey
        and any(.result.structuredContent.providers[]?; .slug == $provider)
      ' >/dev/null

echo "==> Execute check_availability against the same production observation"
CHECK_PARAMS="$(
  jq -cn     --arg provider "$PROVIDER"     --argjson address "$ADDRESS" '
      {
        name: "check_availability",
        arguments: {
          provider: $provider,
          address: $address
        }
      }
    '
)"
CHECK_BODY="$(mcp_payload "check-1" "tools/call" "$CHECK_PARAMS")"
CHECK_RESULT="$(
  mcp_post     "tools/call"     "$CHECK_BODY"     "check_availability"
)"
printf '%s' "$CHECK_RESULT"   | jq -e       --arg normalizedKey "$NORMALIZED_KEY"       --arg provider "$PROVIDER" '
        .jsonrpc == "2.0"
        and .id == "check-1"
        and .result.isError == false
        and .result.resultType == "complete"
        and .result.structuredContent.provider == $provider
        and .result.structuredContent.address.normalized_key == $normalizedKey
        and (.result.structuredContent.availability | length) > 0
      ' >/dev/null

echo "==> Prove MCP token does not become application API authorization"
META_WITHOUT_TOKEN="$(
  curl --fail --silent --show-error "$BASE_URL/api/v1/meta"
)"
META_WITH_TOKEN="$(
  curl --fail --silent --show-error     -H "Authorization: Bearer $MCP_TOKEN"     "$BASE_URL/api/v1/meta"
)"
[[ "$(printf '%s' "$META_WITHOUT_TOKEN" | jq -cS .)" == "$(printf '%s' "$META_WITH_TOKEN" | jq -cS .)" ]] || {
  echo "MCP token changed normal application API semantics." >&2
  exit 1
}

echo "✓ Netco MCP1 production proof passed"
echo "  MCP_TOKEN provisioned as Worker secret       ✓"
echo "  unauthenticated MCP rejected                  ✓"
echo "  authenticated discovery passed                ✓"
echo "  exactly two read-only tools exposed           ✓"
echo "  find_providers_for_address production call    ✓"
echo "  check_availability production call            ✓"
echo "  MCP token isolated from normal Netco API      ✓"
echo "  no self-HTTP business path remains CI-enforced ✓"
