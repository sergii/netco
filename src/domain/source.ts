export type SourceKind =
  | "official_registry"
  | "official_website"
  | "address_checker"
  | "official_api"
  | "partner_feed"
  | "aggregator"
  | "user_report"
  | "forum"
  | "social"
  | "manual";

export interface SourceDefinition {
  id: string;
  slug: string;
  kind: SourceKind;
  name: string;
  canonicalUrl: string;
  providerCandidateName?: string;
}

export interface FetchedSnapshot {
  id: string;
  sourceId: string;
  url: string;
  fetchedAt: string;
  httpStatus: number;
  responseHeaders: Record<string, string>;
  contentType: string | null;
  contentLength: number;
  contentHash: string;
  body: ArrayBuffer;
}

export interface StoredSnapshotBody {
  bodyRef: string;
  contentHash: string;
  deduplicated: boolean;
}
