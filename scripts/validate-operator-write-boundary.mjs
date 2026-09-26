import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const security = read("src/security/operator-write.ts");
const route = read("src/routes/operator.ts");
const index = read("src/index.ts");
const meta = read("src/application/service-status.ts");
const wrangler = read("wrangler.jsonc");

const failures = [];

function requireText(source, text, label) {
  if (!source.includes(text)) failures.push(label);
}

requireText(
  security,
  'env.OPERATOR_WRITES_ENABLED === "true"',
  "operator writes must require explicit true",
);
requireText(
  security,
  '"operator_writes_disabled"',
  "disabled state must be explicit",
);
requireText(
  security,
  'request.headers.get("cf-access-jwt-assertion")',
  "write boundary must require Cloudflare Access JWT header",
);
requireText(
  security,
  'request.headers.get("cf-access-authenticated-user-email")',
  "write boundary must capture authenticated operator identity",
);
requireText(
  route,
  'url.pathname.startsWith("/api/v1/operator/")',
  "operator route must own the operator namespace",
);
requireText(
  route,
  "authorizeOperatorWrite(request, env)",
  "non-GET operator requests must pass central authorization",
);
requireText(
  index,
  "OPERATOR_WRITES_ENABLED?: string",
  "worker env must expose the explicit write switch",
);
requireText(
  meta,
  'boundary: "cloudflare_access"',
  "service metadata must describe the Access boundary",
);

if (/OPERATOR_WRITES_ENABLED[^\n]*true/.test(wrangler)) {
  failures.push(
    "wrangler must not enable operator writes before Access production proof",
  );
}

if (failures.length > 0) {
  console.error("Operator write boundary validation failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("Operator write boundary validation passed.");
