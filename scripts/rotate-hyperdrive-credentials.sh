#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="ancient-haze-86966909"
BRANCH="production"
BRANCH_ID="br-solitary-violet-b2uosraz"
ROLE="hyperdrive-user"
DATABASE="neondb"
HYPERDRIVE_ID="a8f6ce20ac9f4541bf8758cf10eb7948"
WRANGLER="./node_modules/.bin/wrangler"

if ! command -v neon >/dev/null 2>&1; then
  echo "Neon CLI is not installed." >&2
  exit 1
fi

if [ ! -x "${WRANGLER}" ]; then
  echo "Local Wrangler is not installed. Run: npm install" >&2
  exit 1
fi

echo "Resetting Neon password for ${ROLE}..."
reset_json="$(
  neon api     "/projects/${PROJECT_ID}/branches/${BRANCH_ID}/roles/${ROLE}/reset_password"     -X POST
)"

new_password="$(
  printf '%s' "${reset_json}" | node -e '
    let input = "";
    process.stdin.on("data", c => input += c);
    process.stdin.on("end", () => {
      const data = JSON.parse(input);
      const password = data?.role?.password;
      if (!password) process.exit(1);
      process.stdout.write(password);
    });
  '
)"

if [ -z "${new_password}" ]; then
  echo "Neon password reset succeeded but no password was returned." >&2
  exit 1
fi

echo "Resolving Neon endpoint metadata..."
connection_string="$(
  neon connection-string "${BRANCH}"     --project-id "${PROJECT_ID}"     --role-name "${ROLE}"     --database-name "${DATABASE}"     --ssl require
)"

mapfile -t connection_parts < <(
  CONNECTION_STRING="${connection_string}" node -e '
    const url = new URL(process.env.CONNECTION_STRING);
    console.log(url.hostname);
    console.log(url.port || "5432");
    console.log(decodeURIComponent(url.username));
    console.log(decodeURIComponent(url.password));
    console.log(url.pathname.replace(/^\//, ""));
  '
)

origin_host="${connection_parts[0]}"
origin_port="${connection_parts[1]}"
origin_user="${connection_parts[2]}"
origin_password="${connection_parts[3]}"
database="${connection_parts[4]}"

if [ "${origin_password}" != "${new_password}" ]; then
  echo "Neon returned inconsistent role credentials after reset." >&2
  exit 1
fi

echo "Updating Cloudflare Hyperdrive credentials..."
"${WRANGLER}" hyperdrive update "${HYPERDRIVE_ID}"   --origin-host "${origin_host}"   --origin-port "${origin_port}"   --origin-user "${origin_user}"   --origin-password "${origin_password}"   --database "${database}"

unset reset_json new_password connection_string origin_password
unset connection_parts

echo "Credential rotation complete."
echo "The previous Neon password is now invalid for new connections."
