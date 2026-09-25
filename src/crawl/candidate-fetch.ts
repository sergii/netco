import type { UrlDiscoveryObservation } from "./discovery";
import { observePagePurpose } from "./page-purpose";
import { captureHttpSnapshot, type SnapshotRecord } from "../evidence/snapshot";
import {
  getLatestCandidateFetch,
  persistCrawlCandidateSnapshot,
  persistPagePurposeObservation,
} from "../evidence/postgres-store";
import type { SourceDefinition } from "../sources/registry";

const CANDIDATE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const CANDIDATE_MAX_BYTES = 1024 * 1024;

export interface CrawlCandidateResult {
  url: string;
  classification: string;
  status: "fetched" | "cooldown" | "failed";
  snapshot_id: string | null;
  observation_id: string | null;
  http_status: number | null;
  error: string | null;
}

function stillCoolingDown(fetchedAt: string): boolean {
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  return (
    Number.isFinite(ageMs) &&
    ageMs >= 0 &&
    ageMs < CANDIDATE_COOLDOWN_MS
  );
}

export async function fetchCrawlCandidates(
  bucket: R2Bucket,
  database: Hyperdrive,
  source: SourceDefinition,
  parentSnapshot: SnapshotRecord,
  discovery: UrlDiscoveryObservation,
): Promise<CrawlCandidateResult[]> {
  if (!source.crawl_enabled || source.crawl_page_budget <= 0) {
    return [];
  }

  const candidates = discovery.payload.links
    .filter((link) => link.crawl_candidate)
    .sort((a, b) => {
      if (a.relevance_score !== b.relevance_score) {
        return b.relevance_score - a.relevance_score;
      }
      return a.url.localeCompare(b.url);
    })
    .slice(0, source.crawl_page_budget);

  const results: CrawlCandidateResult[] = [];

  for (const candidate of candidates) {
    try {
      const latest = await getLatestCandidateFetch(
        database,
        source.id,
        candidate.url,
      );

      if (latest && stillCoolingDown(latest.fetched_at)) {
        results.push({
          url: candidate.url,
          classification: candidate.classification,
          status: "cooldown",
          snapshot_id: null,
          observation_id: null,
          http_status: null,
          error: null,
        });
        continue;
      }

      const snapshot = await captureHttpSnapshot(bucket, {
        url: candidate.url,
        sourceId: source.id,
        maxBytes: CANDIDATE_MAX_BYTES,
        allowedHosts: source.crawl_hosts,
        maxRedirects: 5,
      });

      await persistCrawlCandidateSnapshot(
        database,
        source,
        snapshot,
        {
          parent_snapshot_id: parentSnapshot.id,
          discovery_observation_id: discovery.id,
          candidate,
        },
      );

      const observation = await observePagePurpose(
        bucket,
        source,
        candidate,
        snapshot,
      );

      await persistPagePurposeObservation(
        database,
        snapshot,
        observation,
      );

      results.push({
        url: candidate.url,
        classification: candidate.classification,
        status: "fetched",
        snapshot_id: snapshot.id,
        observation_id: observation.id,
        http_status: snapshot.http_status,
        error: null,
      });
    } catch (error) {
      results.push({
        url: candidate.url,
        classification: candidate.classification,
        status: "failed",
        snapshot_id: null,
        observation_id: null,
        http_status: null,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  return results;
}
