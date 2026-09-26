import fs from "node:fs";

const migration = fs.readFileSync(
  "migrations/0006_operator_address_activity.sql",
  "utf8",
);
const route = fs.readFileSync("src/routes/operator.ts", "utf8");
const app = fs.readFileSync(
  "src/application/operator-activity.ts",
  "utf8",
);

const failures = [];
const need = (source, text, label) => {
  if (!source.includes(text)) failures.push(label);
};

need(
  migration,
  "CREATE TABLE operator_address_activity",
  "activity table missing",
);
need(
  migration,
  "CHECK (activity_type IN ('note_added'))",
  "activity type must be constrained",
);
need(
  migration,
  "GRANT SELECT, INSERT ON TABLE operator_address_activity",
  "runtime role must only receive append/read privileges",
);
need(
  migration,
  "REVOKE UPDATE, DELETE, TRUNCATE ON TABLE operator_address_activity",
  "runtime role must not mutate existing activity",
);
need(
  route,
  "authorizeOperatorWrite(request, env)",
  "note write must remain behind VS17 authorization",
);
need(
  route,
  'request.method === "POST" && noteMatch',
  "notes POST handler missing",
);
need(
  route,
  "getOperatorAddressActivity",
  "activity read route missing",
);
need(
  app,
  "operator_activity_schema_unavailable",
  "schema-unavailable state must be explicit",
);
need(
  app,
  "length > 4000",
  "note length validation missing",
);

if (failures.length) {
  console.error("Operator activity validation failed:");
  failures.forEach((failure) => console.error("- " + failure));
  process.exit(1);
}

console.log("Operator activity validation passed.");
