import { captureHttpSnapshot, type SnapshotRecord } from "../evidence/snapshot";
import { findSource } from "../sources/registry";

export async function collectKnownSource(
  bucket: R2Bucket,
  slug: string,
): Promise<SnapshotRecord> {
  const source = findSource(slug);

  if (!source) {
    throw new Error("source_not_found");
  }

  return captureHttpSnapshot(bucket, {
    url: source.canonical_url,
    sourceId: source.id,
  });
}
