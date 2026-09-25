import type { ClassifiedLink } from "./classifier";
import type { SnapshotRecord } from "../evidence/snapshot";
import type { SourceDefinition } from "../sources/registry";

export interface PagePurposeObservation {
  id: string;
  schema_name: "page-purpose-observation";
  schema_version: "1";
  extractor: "classified-crawl-page";
  extractor_version: "1";
  normalizer_version: "1";
  extracted_at: string;
  validation_status: "valid" | "partial" | "invalid";
  validation_errors: Array<{ code: string }>;
  payload: {
    source_slug: string;
    requested_url: string;
    final_url: string;
    expected_classification: ClassifiedLink["classification"];
    relevance_score: number;
    matched_terms: string[];
    http_status: number;
    content_type: string | null;
    page_title: string | null;
    identity_marker_matches: string[];
  };
}

function decodeBody(bytes: ArrayBuffer, contentType: string | null): string {
  const charset = contentType
    ?.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1]
    ?.trim();

  try {
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;

  return match[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export async function observePagePurpose(
  bucket: R2Bucket,
  source: SourceDefinition,
  candidate: ClassifiedLink,
  snapshot: SnapshotRecord,
): Promise<PagePurposeObservation> {
  const errors: Array<{ code: string }> = [];
  const successful =
    snapshot.http_status >= 200 && snapshot.http_status < 400;
  const html =
    snapshot.content_type?.toLocaleLowerCase().includes("text/html") ?? false;

  if (!successful) errors.push({ code: "http_status_not_successful" });
  if (!html) errors.push({ code: "content_type_not_html" });

  const object = await bucket.get(snapshot.body_ref);
  if (!object) throw new Error("snapshot_body_missing");

  const body = decodeBody(
    await object.arrayBuffer(),
    snapshot.content_type,
  );
  const normalized = normalizeText(body);
  const identityMarkerMatches = source.identity_markers.filter((marker) =>
    normalized.includes(normalizeText(marker)),
  );

  if (identityMarkerMatches.length === 0) {
    errors.push({ code: "provider_identity_marker_not_found" });
  }

  return {
    id: crypto.randomUUID(),
    schema_name: "page-purpose-observation",
    schema_version: "1",
    extractor: "classified-crawl-page",
    extractor_version: "1",
    normalizer_version: "1",
    extracted_at: new Date().toISOString(),
    validation_status:
      !successful || !html
        ? "invalid"
        : identityMarkerMatches.length > 0
          ? "valid"
          : "partial",
    validation_errors: errors,
    payload: {
      source_slug: source.slug,
      requested_url: candidate.url,
      final_url: snapshot.final_url,
      expected_classification: candidate.classification,
      relevance_score: candidate.relevance_score,
      matched_terms: candidate.matched_terms,
      http_status: snapshot.http_status,
      content_type: snapshot.content_type,
      page_title: extractTitle(body),
      identity_marker_matches: identityMarkerMatches,
    },
  };
}
