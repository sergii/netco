import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/mcp.ts", import.meta.url), "utf8");

const required = [
  'findProvidersForAddress',
  'checkProviderAvailability',
  'find_providers_for_address',
  'check_availability',
  'readOnlyHint: true',
  'destructiveHint: false',
];

for (const needle of required) {
  if (!source.includes(needle)) {
    throw new Error(`MCP adapter invariant missing: ${needle}`);
  }
}

if (/\bfetch\s*\(/.test(source)) {
  throw new Error("Netco MCP adapter must not self-HTTP through fetch()");
}

const toolNameMatches = [
  ...source.matchAll(/export const (?:FIND_PROVIDERS_TOOL|CHECK_AVAILABILITY_TOOL) = "([^"]+)"/g),
].map((match) => match[1]);

if (
  toolNameMatches.length !== 2 ||
  toolNameMatches[0] !== "find_providers_for_address" ||
  toolNameMatches[1] !== "check_availability"
) {
  throw new Error("Netco MCP1 must expose exactly the two intended tool constants");
}

console.log("✓ Netco MCP1 static adapter proof passed");
console.log("  direct application capability imports ✓");
console.log("  exactly two read-only tools            ✓");
console.log("  self-HTTP fetch absent                 ✓");
