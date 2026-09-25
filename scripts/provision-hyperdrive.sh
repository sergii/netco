#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="ancient-haze-86966909"
BRANCH="production"
ROLE="hyperdrive-user"
HYPERDRIVE_NAME="netco-db"

if ! command -v neon >/dev/null 2>&1; then
  echo "Neon CLI is not installed. Run: npm i -g neon@latest" >&2
  exit 1
fi

if [ ! -f ".neon" ]; then
  echo "This repo is not linked to Neon. Run:" >&2
  echo "  neon link --project-id ${PROJECT_ID} --branch ${BRANCH} -y" >&2
  exit 1
fi

echo "Checking Neon role ${ROLE} on ${BRANCH}..."
roles_json="$(neon roles list --project-id "${PROJECT_ID}" --branch "${BRANCH}" --output json)"

if printf '%s' "${roles_json}" | node -e '
  let input = "";
  process.stdin.on("data", c => input += c);
  process.stdin.on("end", () => {
    const rows = JSON.parse(input);
    process.exit(rows.some(r => r.name === "hyperdrive-user") ? 0 : 1);
  });
'; then
  echo "Neon role ${ROLE} already exists."
else
  echo "Creating Neon role ${ROLE}..."
  neon roles create \
    --project-id "${PROJECT_ID}" \
    --branch "${BRANCH}" \
    --name "${ROLE}"
fi

echo "Resolving a dedicated Neon connection string for ${ROLE}..."
connection_string="$(
  neon connection-string "${BRANCH}" \
    --project-id "${PROJECT_ID}" \
    --role-name "${ROLE}" \
    --ssl require
)"

if [ -z "${connection_string}" ]; then
  echo "Neon returned an empty connection string." >&2
  exit 1
fi

echo "Checking Cloudflare authentication..."
if ! npx wrangler whoami >/dev/null 2>&1; then
  echo "Wrangler is not authenticated. Opening Cloudflare login..."
  npx wrangler login
fi

echo "Checking whether Hyperdrive ${HYPERDRIVE_NAME} already exists..."
if npx wrangler hyperdrive list 2>/dev/null | grep -Fq "${HYPERDRIVE_NAME}"; then
  echo "Hyperdrive ${HYPERDRIVE_NAME} already exists."
else
  echo "Creating Hyperdrive ${HYPERDRIVE_NAME}..."
  npx wrangler hyperdrive create "${HYPERDRIVE_NAME}" \
    --connection-string="${connection_string}"
fi

unset connection_string

echo
echo "Hyperdrive bootstrap complete."
echo "Next: inspect the generated Hyperdrive ID and add it as DATABASE in wrangler.jsonc."
