import {
  getLatestUrlDiscoveryObservation,
  getRecentDomainExtractions,
  getRecentPagePurposeObservations,
  getSourceProvenance,
} from "../evidence/postgres-store";
import { findSource } from "../sources/registry";
import {
  capabilityFailure,
  capabilityOk,
  type CapabilityResult,
} from "./result";
import { sourceEvidenceDescriptor } from "./sources";

export type SourceEvidenceKind =
  | "provenance"
  | "discovery"
  | "crawl"
  | "extractions";

export async function getSourceEvidence(
  database: Hyperdrive,
  sourceSlug: string,
  kind: SourceEvidenceKind,
): Promise<CapabilityResult<Record<string, unknown>>> {
  const source = findSource(sourceSlug);

  if (!source) {
    return capabilityFailure("source_not_found", {
      source: sourceSlug,
    });
  }

  if (kind === "extractions") {
    return capabilityOk({
      source: sourceEvidenceDescriptor(source),
      extractions: await getRecentDomainExtractions(
        database,
        source.id,
      ),
    });
  }

  if (kind === "discovery") {
    return capabilityOk({
      source: sourceEvidenceDescriptor(source),
      discovery: await getLatestUrlDiscoveryObservation(
        database,
        source.id,
      ),
    });
  }

  if (kind === "crawl") {
    return capabilityOk({
      source: sourceEvidenceDescriptor(source),
      pages: await getRecentPagePurposeObservations(
        database,
        source.id,
      ),
    });
  }

  const provenance = await getSourceProvenance(database, source);

  return capabilityOk(
    provenance as unknown as Record<string, unknown>,
  );
}
