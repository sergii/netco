import type { ClassifiedLink } from "./classifier";
import type { SnapshotRecord } from "../evidence/snapshot";
import type { SourceDefinition } from "../sources/registry";

export interface PagePurposeObservation {
  id: string;
  schema_name: "page-purpose-observation";
  schema_version: "1";
  extractor: "classified-crawl-candidate";
  extractor_version: "1";
  normalizer_version: "1";
  extracted_at: string;
  validation_status: "valid" | "invalid";
  validation_errors: Array<{ code: string }>;
  payload: {
    source_slug: string;
    discovered_from_snapshot_id: string;
    url: string;
    classification: ClassifiedLink["classification"];
    relevance_score: number;
    anchor_text: string | null;
    matched_terms: string[];
    http_status: number;
    content_type: string | null;
    fetched_snapshot_id: string;
  };
}

export function buildPagePurposeObservation(
  source: SourceDefinition,
  discoveredFromSnapshotId: string,
  link: ClassifiedLink,
  snapshot: SnapshotRecord,
): PagePurposeObservation {
  const successful =
    snapshot.http_status >= 200 && snapshot.http_status < 400;

  return {
    id: crypto.randomUUID(),
    schema_name: "page-purpose-observation",
    schema_version: "1",
    extractor: "classified-crawl-candidate",
    extractor_version: "1",
    normalizer_version: "1",
    extracted_at: new Date().toISOString(),
    validation_status: successful ? "valid" : "invalid",
    validation_errors: successful
      ? []
      : [{ code: "http_status_not_successful" }],
    payload: {
      source_slug: source.slug,
      discovered_from_snapshot_id: discoveredFromSnapshotId,
      url: link.url,
      classification: link.classification,
      relevance_score: link.relevance_score,
      anchor_text: link.anchor_text,
      matched_terms: link.matched_terms,
      http_status: snapshot.http_status,
      content_type: snapshot.content_type,
      fetched_snapshot_id: snapshot.id,
    },
  };
}
