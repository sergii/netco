import type { SnapshotRecord } from "./snapshot";
import type { SourceDefinition } from "../sources/registry";

export type ObservationValidationStatus = "valid" | "partial" | "invalid";

export interface IdentityObservation {
  id: string;
  schema_name: "provider-identity-observation";
  schema_version: "1";
  extractor: "registered-source-identity";
  extractor_version: "1";
  normalizer_version: "1";
  extracted_at: string;
  validation_status: ObservationValidationStatus;
  validation_errors: Array<{ code: string }>;
  payload: {
    source_slug: string;
    provider_candidate_name: string | null;
    page_title: string | null;
    matched_identity_markers: string[];
    final_url: string;
    http_status: number;
  };
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return null;
  }

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

export async function extractRegisteredSourceIdentity(
  bucket: R2Bucket,
  source: SourceDefinition,
  snapshot: SnapshotRecord,
): Promise<IdentityObservation> {
  const body = await bucket.get(snapshot.body_ref);

  if (!body) {
    throw new Error("snapshot_body_missing");
  }

  const bytes = await body.arrayBuffer();
  const charset = snapshot.content_type
    ?.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1]
    ?.trim();

  let text: string;
  try {
    text = new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    text = new TextDecoder("utf-8").decode(bytes);
  }

  const normalizedBody = normalizeText(text);

  const matchedIdentityMarkers = source.identity_markers.filter((marker) =>
    normalizedBody.includes(normalizeText(marker)),
  );

  const httpSuccessful =
    snapshot.http_status >= 200 && snapshot.http_status < 400;

  const validationErrors: Array<{ code: string }> = [];

  if (!httpSuccessful) {
    validationErrors.push({ code: "http_status_not_successful" });
  }

  if (matchedIdentityMarkers.length === 0) {
    validationErrors.push({ code: "identity_marker_not_found" });
  }

  const validationStatus: ObservationValidationStatus =
    httpSuccessful && matchedIdentityMarkers.length > 0
      ? "valid"
      : httpSuccessful
        ? "partial"
        : "invalid";

  return {
    id: crypto.randomUUID(),
    schema_name: "provider-identity-observation",
    schema_version: "1",
    extractor: "registered-source-identity",
    extractor_version: "1",
    normalizer_version: "1",
    extracted_at: new Date().toISOString(),
    validation_status: validationStatus,
    validation_errors: validationErrors,
    payload: {
      source_slug: source.slug,
      provider_candidate_name: source.provider_candidate_name,
      page_title: extractTitle(text),
      matched_identity_markers: matchedIdentityMarkers,
      final_url: snapshot.final_url,
      http_status: snapshot.http_status,
    },
  };
}
