import { captureHttpSnapshot, type SnapshotRecord } from "../evidence/snapshot";
import { findSource } from "../sources/registry";
import { persistSourceSnapshot } from "./postgres-store";

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

export async function collectAndPersistKnownSource(
  bucket: R2Bucket,
  database: Hyperdrive,
  slug: string,
): Promise<SnapshotRecord> {
  const source = findSource(slug);

  if (!source) {
    throw new Error("source_not_found");
  }

  const snapshot = await captureHttpSnapshot(bucket, {
    url: source.canonical_url,
    sourceId: source.id,
  });

  await persistSourceSnapshot(database, source, snapshot);

  return snapshot;
}
