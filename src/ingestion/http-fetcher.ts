import type { FetchedSnapshot, SourceDefinition } from "../domain/source";

const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;

const SAFE_RESPONSE_HEADERS = [
  "cache-control",
  "content-language",
  "content-type",
  "etag",
  "last-modified",
] as const;

function safeHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};

  for (const name of SAFE_RESPONSE_HEADERS) {
    const value = headers.get(name);
    if (value !== null) {
      result[name] = value;
    }
  }

  return result;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export class HttpFetcher {
  async fetch(source: SourceDefinition): Promise<FetchedSnapshot> {
    const response = await fetch(source.canonicalUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.1",
      },
    });

    const body = await response.arrayBuffer();

    if (body.byteLength > MAX_SNAPSHOT_BYTES) {
      throw new Error(
        `snapshot_too_large: ${body.byteLength} bytes exceeds ${MAX_SNAPSHOT_BYTES}`,
      );
    }

    const fetchedAt = new Date().toISOString();
    const contentHash = await sha256Hex(body);

    return {
      id: crypto.randomUUID(),
      sourceId: source.id,
      url: response.url || source.canonicalUrl,
      fetchedAt,
      httpStatus: response.status,
      responseHeaders: safeHeaders(response.headers),
      contentType: response.headers.get("content-type"),
      contentLength: body.byteLength,
      contentHash,
      body,
    };
  }
}
