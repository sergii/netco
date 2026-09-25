import { captureHttpSnapshot, type SnapshotRecord } from "../evidence/snapshot";
import { extractRegisteredSourceIdentity, type IdentityObservation } from "./identity";
import { discoverSnapshotUrls } from "../crawl/discovery";
import { fetchCrawlCandidates } from "../crawl/candidate-fetch";
import { extractPendingDomainEvidence } from "../extraction/runner";
import {
  collectionEnabledSources,
  findSource,
} from "../sources/registry";
import {
  getLatestSourceSnapshot,
  getLatestSourceSnapshotRecord,
  persistIdentityObservation,
  persistSourceSnapshot,
  persistUrlDiscoveryObservation,
} from "./postgres-store";

const COLLECTION_COOLDOWN_MS = 30 * 60 * 1000;

export interface CollectionResult {
  status: "collected" | "cooldown";
  snapshot: SnapshotRecord | null;
  observation: IdentityObservation | null;
  claims_emitted: number;
  latest_snapshot_id: string | null;
  latest_fetched_at: string | null;
  retry_after_seconds: number;
}

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
    allowedHosts: source.crawl_hosts,
    maxRedirects: 5,
  });
}

export async function collectAndPersistKnownSource(
  bucket: R2Bucket,
  database: Hyperdrive,
  slug: string,
): Promise<CollectionResult> {
  const source = findSource(slug);

  if (!source) {
    throw new Error("source_not_found");
  }

  const latest = await getLatestSourceSnapshot(
    database,
    source.id,
    source.canonical_url,
  );

  if (latest) {
    const ageMs = Date.now() - new Date(latest.fetched_at).getTime();

    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < COLLECTION_COOLDOWN_MS) {
      return {
        status: "cooldown",
        snapshot: null,
        observation: null,
        claims_emitted: 0,
        latest_snapshot_id: latest.id,
        latest_fetched_at: latest.fetched_at,
        retry_after_seconds: Math.ceil(
          (COLLECTION_COOLDOWN_MS - ageMs) / 1000,
        ),
      };
    }
  }

  const snapshot = await captureHttpSnapshot(bucket, {
    url: source.canonical_url,
    sourceId: source.id,
    allowedHosts: source.crawl_hosts,
    maxRedirects: 5,
  });

  await persistSourceSnapshot(
    database,
    source,
    snapshot,
    { capture_kind: "source_root" },
  );

  const observation = await extractRegisteredSourceIdentity(
    bucket,
    source,
    snapshot,
  );

  const claimsEmitted = await persistIdentityObservation(
    database,
    source,
    snapshot,
    observation,
  );

  return {
    status: "collected",
    snapshot,
    observation,
    claims_emitted: claimsEmitted,
    latest_snapshot_id: snapshot.id,
    latest_fetched_at: snapshot.fetched_at,
    retry_after_seconds: Math.ceil(COLLECTION_COOLDOWN_MS / 1000),
  };
}


export async function collectScheduledSources(
  bucket: R2Bucket,
  database: Hyperdrive,
): Promise<void> {
  for (const source of collectionEnabledSources()) {
    try {
      const result = await collectAndPersistKnownSource(
        bucket,
        database,
        source.slug,
      );

      const snapshot =
        result.snapshot ??
        (await getLatestSourceSnapshotRecord(
          database,
          source.id,
          source.canonical_url,
        ));

      let discoveredCount: number | null = null;
      let crawlCandidateCount: number | null = null;
      let discoveryInserted = false;
      let crawlAttempted = 0;
      let crawlCollected = 0;
      let crawlSkippedCooldown = 0;
      let crawlFailed = 0;

      if (snapshot) {
        const discovery = await discoverSnapshotUrls(
          bucket,
          source,
          snapshot,
        );

        const discoveryPersistence =
          await persistUrlDiscoveryObservation(
            database,
            snapshot,
            discovery,
          );
        discoveryInserted = discoveryPersistence.inserted;
        discoveredCount = discovery.payload.discovered_count;
        crawlCandidateCount = discovery.payload.crawl_candidate_count;

        if (discovery.validation_status === "valid") {
          const crawl = await fetchCrawlCandidates(
            bucket,
            database,
            source,
            snapshot.id,
            discoveryPersistence.id,
            discovery,
          );

          crawlAttempted = crawl.attempted;
          crawlCollected = crawl.collected;
          crawlSkippedCooldown = crawl.skipped_cooldown;
          crawlFailed = crawl.failed;
        }
      }

      const domainExtraction = await extractPendingDomainEvidence(
        bucket,
        database,
        source,
      );

      console.log("scheduled_source_collection", {
        source: source.slug,
        status: result.status,
        latest_snapshot_id: result.latest_snapshot_id,
        claims_emitted: result.claims_emitted,
        discovered_count: discoveredCount,
        crawl_candidate_count: crawlCandidateCount,
        discovery_inserted: discoveryInserted,
        crawl_attempted: crawlAttempted,
        crawl_collected: crawlCollected,
        crawl_skipped_cooldown: crawlSkippedCooldown,
        crawl_failed: crawlFailed,
        domain_extraction_attempted: domainExtraction.attempted,
        domain_extraction_inserted: domainExtraction.inserted,
        domain_claims_emitted: domainExtraction.claims_emitted,
        domain_extraction_invalid: domainExtraction.invalid,
        domain_extraction_partial: domainExtraction.partial,
        domain_extraction_failed: domainExtraction.failed,
      });
    } catch (error) {
      console.error("scheduled_source_collection_failed", {
        source: source.slug,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }
}
