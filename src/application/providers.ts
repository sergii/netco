import { getDatabaseStatus } from "../db/status";
import {
  getProviderProjection,
  listProviderProjections,
} from "../projection/provider";
import {
  capabilityFailure,
  capabilityOk,
  type CapabilityResult,
} from "./result";

export async function listProviders(
  database: Hyperdrive,
): Promise<
  CapabilityResult<{
    providers: Array<Record<string, unknown>>;
  }>
> {
  const status = await getDatabaseStatus(database);

  if (!status.projection_schema_ready) {
    return capabilityFailure("projection_schema_unavailable", {
      projection_tables: status.projection_tables,
    });
  }

  return capabilityOk({
    providers: await listProviderProjections(database),
  });
}

export async function getProvider(
  database: Hyperdrive,
  providerSlug: string,
): Promise<CapabilityResult<Record<string, unknown>>> {
  const status = await getDatabaseStatus(database);

  if (!status.projection_schema_ready) {
    return capabilityFailure("projection_schema_unavailable", {
      projection_tables: status.projection_tables,
    });
  }

  const provider = await getProviderProjection(database, providerSlug);

  if (!provider) {
    return capabilityFailure("provider_not_found", {
      provider: providerSlug,
    });
  }

  return capabilityOk(provider);
}
