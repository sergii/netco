import type {
  FetchedSnapshot,
  StoredSnapshotBody,
} from "../domain/source";

function bodyKey(contentHash: string): string {
  return `sha256/${contentHash.slice(0, 2)}/${contentHash}`;
}

export class R2SnapshotStore {
  constructor(private readonly bucket: R2Bucket) {}

  async storeBody(snapshot: FetchedSnapshot): Promise<StoredSnapshotBody> {
    const key = bodyKey(snapshot.contentHash);
    const existing = await this.bucket.head(key);

    if (existing) {
      return {
        bodyRef: key,
        contentHash: snapshot.contentHash,
        deduplicated: true,
      };
    }

    await this.bucket.put(key, snapshot.body, {
      httpMetadata: snapshot.contentType
        ? { contentType: snapshot.contentType }
        : undefined,
      customMetadata: {
        sha256: snapshot.contentHash,
      },
    });

    return {
      bodyRef: key,
      contentHash: snapshot.contentHash,
      deduplicated: false,
    };
  }
}
