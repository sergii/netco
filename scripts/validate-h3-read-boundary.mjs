import { readFileSync } from "node:fs";

const source = readFileSync("src/geo/h3-cells.ts", "utf8");

const required = [
  'from "h3-js"',
  'getCoveragePointRecords',
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`H3 boundary missing required token: ${token}`);
  }
}

const forbidden = [
  /\bfetch\s*\(/,
  /Browser/,
  /SNAPSHOTS/,
  /collector/i,
  /geocod/i,
  /checker/i,
];

for (const pattern of forbidden) {
  if (pattern.test(source)) {
    throw new Error(`H3 boundary contains forbidden external-collection pattern: ${pattern}`);
  }
}

console.log("✓ H3 read boundary uses persisted coverage records only");
