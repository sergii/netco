import fs from "node:fs";

const h3 = fs.readFileSync("src/geo/h3-cells.ts", "utf8");
const explorer = fs.readFileSync("src/ui/explorer.ts", "utf8");

const forbidden = [
  "fetch(",
  "BROWSER",
  "checker-interaction",
  "checker-interface",
  "nominatim",
];

for (const token of forbidden) {
  if (h3.includes(token)) {
    throw new Error(`H3 cell inspection must remain persisted-data only: found ${token}`);
  }
}

for (const required of [
  "getCoveragePointRecords",
  "getH3CoverageCellDetail",
  "latLngToCell",
]) {
  if (!h3.includes(required)) {
    throw new Error(`Missing persisted H3 inspection boundary: ${required}`);
  }
}

for (const required of [
  "/api/v1/geo/h3-cells/",
  "/api/v1/coverage/address?",
  "/api/v1/geo/addresses/",
]) {
  if (!explorer.includes(required)) {
    throw new Error(`Map inspection UI must reuse existing read capability: ${required}`);
  }
}

console.log("✓ map inspection remains a persisted read-only composition");
