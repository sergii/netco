import type { UrlDiscoveryObservation } from "./discovery";
import { buildPagePurposeObservation } from "./page-purpose";
import { captureHttpSnapshot } from "../evidence/snapshot";
import {
  getLatestSnapshotForUrl,
  persistPagePurposeObservation,
  persistSourceSnapshot,
} from "../evidence/postgres-store";
import type { SourceDefinition } from "../sources/registry";

const CANDIDATE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const CANDIDATE_MAX_BYTES = 1024 * 1024;

export interface CandidateFetchResult {
  attempted: number;
  collected: number;
  skipped_cooldown: number;
  failed: number;
  snapshots: string[];
}

function stillCoolingDown(fetchedAt: string): boolean {
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < CANDIDATE_COOLDOWN_MS;
}

export async function fetchCrawlCandidates(
  bucket: R2Bucket,
  database: Hyperdrive,
  source: SourceDefinition,
  discoveredFromSnapshotId: string,
  discovery: UrlDiscoveryObservation,
): Promise<CandidateFetchResult> {
  const candidates = discovery.payload.links
    .filter((link) => link.crawl_candidate)
    .slice(0, source.crawl_page_budget);

  const result: CandidateFetchResult = {
    attempted: candidates.length,
    collected: 0,
    skipped_cooldown: 0,
    failed: 0,
    snapshots: [],
  };

  for (const link of candidates) {
    try {
      const latest = await getLatestSnapshotForUrl(
        database,
        source.id,
        link.url,
      );

      if (latest && stillCoolingDown(latest.fetched_at)) {
        result.skipped_cooldown += 1;
        continue;
      }

      const snapshot = await captureHttpSnapshot(bucket, {
        url: link.url,
        sourceId: source.id,
        maxBytes: CANDIDATE_MAX_BYTES,
      });

      await persistSourceSnapshot(database, source, snapshot);

      const observation = buildPagePurposeObservation(
        source,
        discoveredFromSnapshotId,
        link,
        snapshot,
      );

      await persistPagePurposeObservation(
        database,
        snapshot,
        observation,
      );

      result.collected += 1;
      result.snapshots.push(snapshot.id);
    } catch (error) {
      result.failed += 1;
      console.error("crawl_candidate_fetch_failed", {
        source: source.slug,
        url: link.url,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  return result;
}
