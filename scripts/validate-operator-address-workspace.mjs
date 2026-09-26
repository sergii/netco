import fs from "node:fs";

const application = fs.readFileSync(
  "src/application/operator-address.ts",
  "utf8",
);
const route = fs.readFileSync("src/routes/operator.ts", "utf8");
const explorer = fs.readFileSync("src/ui/explorer.ts", "utf8");

for (const forbidden of [
  "captureHttpSnapshot",
  "collectScheduledSources",
  "materializePendingAddressGeoPoints",
  "BROWSER",
]) {
  if (application.includes(forbidden)) {
    throw new Error(
      `operator address workspace must remain read-only: ${forbidden}`,
    );
  }
}

for (const required of [
  "getAllAddressAvailability",
  "getAddressGeoProvenance",
  "getCoverageEvidenceTrail",
]) {
  if (!application.includes(required)) {
    throw new Error(
      `operator address workspace is missing read composition: ${required}`,
    );
  }
}

if (!route.includes("api\\/v1\\/operator\\/addresses")) {
  throw new Error("operator address route is missing");
}

for (const required of [
  'data-tab="addresses"',
  'id="address-workspace"',
  "/api/v1/coverage/addresses?freshness=all",
  "/api/v1/operator/addresses/",
]) {
  if (!explorer.includes(required)) {
    throw new Error(
      `Explorer is missing VS16 operator workflow marker: ${required}`,
    );
  }
}

console.log("VS16 operator address workspace boundary is valid.");
