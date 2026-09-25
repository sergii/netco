import { extractDomainEvidence } from "./domain";
import {
  getPendingDomainExtractionPages,
  persistDomainExtraction,
} from "../evidence/postgres-store";
import type { SourceDefinition } from "../sources/registry";

export interface DomainExtractionRunResult {
  attempted: number;
  inserted: number;
  claims_emitted: number;
  invalid: number;
  partial: number;
  failed: number;
}

export async function extractPendingDomainEvidence(
  bucket: R2Bucket,
  database: Hyperdrive,
  source: SourceDefinition,
): Promise<DomainExtractionRunResult> {
  const pages = await getPendingDomainExtractionPages(
    database,
    source.id,
    10,
  );

  const result: DomainExtractionRunResult = {
    attempted: pages.length,
    inserted: 0,
    claims_emitted: 0,
    invalid: 0,
    partial: 0,
    failed: 0,
  };

  for (const page of pages) {
    try {
      const extraction = await extractDomainEvidence(
        bucket,
        source,
        page.snapshot,
        page.classification,
      );

      if (!extraction) {
        continue;
      }

      const persisted = await persistDomainExtraction(
        database,
        source,
        page.snapshot,
        page.page_purpose_observation_id,
        extraction,
      );

      if (persisted.inserted) {
        result.inserted += 1;
      }

      result.claims_emitted += persisted.claims_emitted;

      if (extraction.observation.validation_status === "invalid") {
        result.invalid += 1;
      }

      if (extraction.observation.validation_status === "partial") {
        result.partial += 1;
      }
    } catch (error) {
      result.failed += 1;
      console.error("domain_extraction_failed", {
        source: source.slug,
        snapshot_id: page.snapshot.id,
        classification: page.classification,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  return result;
}
