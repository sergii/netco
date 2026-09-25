import type { SourceDefinition } from "../domain/source";
import { HttpFetcher } from "./http-fetcher";
import { R2SnapshotStore } from "./r2-snapshot-store";

export interface CollectedSourceSnapshot {
  snapshotId: string;
  sourceId: string;
  url: string;
  fetchedAt: string;
  httpStatus: number;
  responseHeaders: Record<string, string>;
  contentType: string | null;
  contentLength: number;
  contentHash: string;
  bodyRef: string;
  bodyDeduplicated: boolean;
}

export async function collectSource(
  source: SourceDefinition,
  snapshots: R2Bucket,
): Promise<CollectedSourceSnapshot> {
  const fetcher = new HttpFetcher();
  const store = new R2SnapshotStore(snapshots);

  const snapshot = await fetcher.fetch(source);
  const stored = await store.storeBody(snapshot);

  return {
    snapshotId: snapshot.id,
    sourceId: snapshot.sourceId,
    url: snapshot.url,
    fetchedAt: snapshot.fetchedAt,
    httpStatus: snapshot.httpStatus,
    responseHeaders: snapshot.responseHeaders,
    contentType: snapshot.contentType,
    contentLength: snapshot.contentLength,
    contentHash: snapshot.contentHash,
    bodyRef: stored.bodyRef,
    bodyDeduplicated: stored.deduplicated,
  };
}
