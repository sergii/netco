import {
  listAddressCoverageInventory,
  type CoverageInventoryFreshness,
} from "../coverage/orderability";
import { getDatabaseStatus } from "../db/status";
import {
  capabilityFailure,
  capabilityOk,
  type CapabilityResult,
} from "./result";

export async function listCoverageInventory(
  database: Hyperdrive,
  freshness: string | null | undefined,
): Promise<CapabilityResult<Record<string, unknown>>> {
  const status = await getDatabaseStatus(database);

  if (!status.coverage_schema_ready) {
    return capabilityFailure("coverage_schema_unavailable", {
      coverage_tables: status.coverage_tables,
    });
  }

  const requestedFreshness = freshness ?? "all";

  if (
    requestedFreshness !== "all" &&
    requestedFreshness !== "fresh" &&
    requestedFreshness !== "stale"
  ) {
    return capabilityFailure("freshness_invalid", {
      allowed: ["all", "fresh", "stale"],
    });
  }

  return capabilityOk(
    await listAddressCoverageInventory(
      database,
      requestedFreshness as CoverageInventoryFreshness,
    ),
  );
}
