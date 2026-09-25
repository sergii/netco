import { classifyDiscoveredLink, type ClassifiedLink } from "./classifier";
import type { SnapshotRecord } from "../evidence/snapshot";
import type { SourceDefinition } from "../sources/registry";

export interface UrlDiscoveryObservation {
  id: string;
  schema_name: "url-discovery-observation";
  schema_version: "1";
  extractor: "html-anchor-discovery";
  extractor_version: "1";
  normalizer_version: "1";
  extracted_at: string;
  validation_status: "valid" | "partial" | "invalid";
  validation_errors: Array<{ code: string }>;
  payload: {
    source_slug: string;
    base_url: string;
    discovered_count: number;
    crawl_candidate_count: number;
    links: ClassifiedLink[];
  };
}

const MAX_DISCOVERED_LINKS = 100;
const MAX_ANCHOR_TEXT = 200;

function decodeHtmlText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ANCHOR_TEXT);
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

function normalizeDiscoveredUrl(
  rawHref: string,
  baseUrl: string,
  allowedHosts: ReadonlySet<string>,
): URL | null {
  const href = rawHref.trim();

  if (
    href === "" ||
    href.startsWith("#") ||
    /^(mailto|tel|javascript|data):/i.test(href)
  ) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(href, baseUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  if (url.username || url.password) {
    return null;
  }

  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    return null;
  }

  if (
    /\.(?:avif|bmp|css|gif|ico|jpe?g|js|m4a|mp3|mp4|ogg|png|svg|webm|webp|woff2?|zip)$/i.test(
      url.pathname,
    )
  ) {
    return null;
  }

  url.hash = "";

  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLowerCase();
    if (
      normalized.startsWith("utm_") ||
      ["fbclid", "gclid", "yclid"].includes(normalized)
    ) {
      url.searchParams.delete(key);
    }
  }

  url.searchParams.sort();

  return url;
}

export async function discoverSnapshotUrls(
  bucket: R2Bucket,
  source: SourceDefinition,
  snapshot: SnapshotRecord,
): Promise<UrlDiscoveryObservation> {
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
  const allowedHosts = new Set(
    source.crawl_hosts.map((host) => host.toLocaleLowerCase()),
  );
  const discovered = new Map<string, ClassifiedLink>();
  const anchorPattern =
    /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))[^>]*>([\s\S]*?)<\/a>/gi;

  if (successful && html) {
    for (const match of body.matchAll(anchorPattern)) {
      const href = match[1] ?? match[2] ?? match[3] ?? "";
      const anchorText = decodeHtmlText(match[4] ?? "") || null;
      const url = normalizeDiscoveredUrl(
        href,
        snapshot.final_url,
        allowedHosts,
      );

      if (!url) continue;

      const normalized = url.toString();
      if (!discovered.has(normalized)) {
        discovered.set(
          normalized,
          classifyDiscoveredLink(url, anchorText),
        );
      }

      if (discovered.size >= MAX_DISCOVERED_LINKS) break;
    }
  }

  const links = [...discovered.values()].sort((a, b) => {
    if (a.relevance_score !== b.relevance_score) {
      return b.relevance_score - a.relevance_score;
    }
    return a.url.localeCompare(b.url);
  });

  if (errors.length === 0 && links.length === 0) {
    errors.push({ code: "no_links_discovered" });
  }

  return {
    id: crypto.randomUUID(),
    schema_name: "url-discovery-observation",
    schema_version: "1",
    extractor: "html-anchor-discovery",
    extractor_version: "1",
    normalizer_version: "1",
    extracted_at: new Date().toISOString(),
    validation_status:
      errors.some((error) =>
        ["http_status_not_successful", "content_type_not_html"].includes(
          error.code,
        ),
      )
        ? "invalid"
        : links.length > 0
          ? "valid"
          : "partial",
    validation_errors: errors,
    payload: {
      source_slug: source.slug,
      base_url: snapshot.final_url,
      discovered_count: links.length,
      crawl_candidate_count: links.filter((link) => link.crawl_candidate).length,
      links,
    },
  };
}
