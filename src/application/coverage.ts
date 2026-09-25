import {
  normalizeAddress,
  type AddressInput,
} from "../coverage/address";
import {
  getAddressAvailability,
  getAllAddressAvailability,
} from "../coverage/orderability";
import { getDatabaseStatus } from "../db/status";
import {
  capabilityFailure,
  capabilityOk,
  type CapabilityResult,
} from "./result";

export async function findProvidersForAddress(
  database: Hyperdrive,
  input: AddressInput,
): Promise<CapabilityResult<Record<string, unknown>>> {
  const status = await getDatabaseStatus(database);

  if (!status.coverage_schema_ready) {
    return capabilityFailure("coverage_schema_unavailable", {
      coverage_tables: status.coverage_tables,
    });
  }

  let normalized;

  try {
    normalized = normalizeAddress(input);
  } catch (error) {
    return capabilityFailure(
      error instanceof Error ? error.message : "address_invalid",
    );
  }

  const availability = await getAllAddressAvailability(
    database,
    normalized.normalized_key,
  );

  return capabilityOk({
    query: {
      normalized_key: normalized.normalized_key,
      display: normalized.display,
    },
    ...availability,
  });
}

export async function checkProviderAvailability(
  database: Hyperdrive,
  providerSlug: string,
  input: AddressInput,
): Promise<CapabilityResult<Record<string, unknown>>> {
  const status = await getDatabaseStatus(database);

  if (!status.coverage_schema_ready) {
    return capabilityFailure("coverage_schema_unavailable", {
      coverage_tables: status.coverage_tables,
    });
  }

  let normalized;

  try {
    normalized = normalizeAddress(input);
  } catch (error) {
    return capabilityFailure(
      error instanceof Error ? error.message : "address_invalid",
    );
  }

  const availability = await getAddressAvailability(
    database,
    providerSlug,
    normalized.normalized_key,
  );

  if (!availability) {
    return capabilityFailure("address_coverage_not_observed", {
      provider: providerSlug,
      address: {
        normalized_key: normalized.normalized_key,
        display: normalized.display,
      },
    });
  }

  return capabilityOk(availability);
}
