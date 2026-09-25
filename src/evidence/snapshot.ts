export interface SnapshotRecord {
  schema_version: "source-snapshot.v1";
  id: string;
  source_id: string | null;
  requested_url: string;
  final_url: string;
  fetched_at: string;
  http_status: number;
  response_headers: Record<string, string>;
  content_type: string | null;
  content_length: number;
  sha256: string;
  body_ref: string;
}

export interface CaptureSnapshotInput {
  url: string;
  sourceId?: string | null;
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

export function normalizeEvidenceUrl(raw: string): URL {
  const url = new URL(raw);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("unsupported_url_scheme");
  }

  if (url.username || url.password) {
    throw new Error("credentials_in_url_not_allowed");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    throw new Error("local_address_not_allowed");
  }

  return url;
}

function safeResponseHeaders(headers: Headers): Record<string, string> {
  const allowed = [
    "cache-control",
    "content-language",
    "content-type",
    "etag",
    "last-modified",
  ];

  return Object.fromEntries(
    allowed
      .map((name) => [name, headers.get(name)] as const)
      .filter((entry): entry is readonly [string, string] => entry[1] !== null),
  );
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function captureHttpSnapshot(
  bucket: R2Bucket,
  input: CaptureSnapshotInput,
): Promise<SnapshotRecord> {
  const requestedUrl = normalizeEvidenceUrl(input.url);
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;

  const response = await fetch(requestedUrl, {
    redirect: "follow",
    headers: {
      "user-agent": "Netco/0.1 (+https://github.com/sergii/netco)",
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.1",
    },
  });

  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("response_too_large");
  }

  const body = await response.arrayBuffer();
  if (body.byteLength > maxBytes) {
    throw new Error("response_too_large");
  }

  const hash = await sha256Hex(body);
  const snapshotId = crypto.randomUUID();
  const bodyRef = `blobs/sha256/${hash.slice(0, 2)}/${hash}`;
  const contentType = response.headers.get("content-type");

  const existing = await bucket.head(bodyRef);
  if (!existing) {
    await bucket.put(bodyRef, body, {
      httpMetadata: contentType ? { contentType } : undefined,
      customMetadata: {
        sha256: hash,
      },
    });
  }

  const record: SnapshotRecord = {
    schema_version: "source-snapshot.v1",
    id: snapshotId,
    source_id: input.sourceId ?? null,
    requested_url: requestedUrl.toString(),
    final_url: response.url || requestedUrl.toString(),
    fetched_at: new Date().toISOString(),
    http_status: response.status,
    response_headers: safeResponseHeaders(response.headers),
    content_type: contentType,
    content_length: body.byteLength,
    sha256: hash,
    body_ref: bodyRef,
  };

  await bucket.put(
    `snapshots/${snapshotId}.json`,
    JSON.stringify(record),
    {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: {
        snapshot_id: snapshotId,
        sha256: hash,
      },
    },
  );

  return record;
}
