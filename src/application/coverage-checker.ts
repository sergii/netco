import {
  getCoverageCheckerInterface,
  getCoverageCheckerInteraction,
} from "../coverage/store";
import { findSource, type SourceDefinition } from "../sources/registry";
import {
  capabilityFailure,
  capabilityOk,
  type CapabilityResult,
} from "./result";

function checkerSource(
  providerSlug: string,
): CapabilityResult<SourceDefinition> {
  const source = findSource(`${providerSlug}-coverage`);

  if (!source || source.kind !== "address_checker") {
    return capabilityFailure("coverage_checker_not_registered", {
      provider: providerSlug,
    });
  }

  return capabilityOk(source);
}

function sourceDescriptor(source: SourceDefinition) {
  return {
    id: source.id,
    slug: source.slug,
    kind: source.kind,
    canonical_url: source.canonical_url,
  };
}

export async function getProviderCoverageCheckerInterface(
  database: Hyperdrive,
  providerSlug: string,
): Promise<CapabilityResult<Record<string, unknown>>> {
  const sourceResult = checkerSource(providerSlug);
  if (!sourceResult.ok) return sourceResult;

  const observation = await getCoverageCheckerInterface(
    database,
    sourceResult.value.id,
  );

  if (!observation) {
    return capabilityFailure("coverage_checker_probe_not_found", {
      provider: providerSlug,
    });
  }

  return capabilityOk({
    provider: providerSlug,
    source: sourceDescriptor(sourceResult.value),
    interface: observation,
  });
}

export async function getProviderCoverageCheckerInteraction(
  database: Hyperdrive,
  providerSlug: string,
): Promise<CapabilityResult<Record<string, unknown>>> {
  const sourceResult = checkerSource(providerSlug);
  if (!sourceResult.ok) return sourceResult;

  const interaction = await getCoverageCheckerInteraction(
    database,
    sourceResult.value.id,
  );

  if (!interaction) {
    return capabilityFailure("coverage_checker_interaction_not_found", {
      provider: providerSlug,
    });
  }

  return capabilityOk({
    provider: providerSlug,
    source: sourceDescriptor(sourceResult.value),
    interaction,
  });
}
