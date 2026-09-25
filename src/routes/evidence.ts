import { collectAndPersistKnownSource } from "../evidence/collector";
import { getSourceProvenance } from "../evidence/postgres-store";
import { findSource } from "../sources/registry";

export interface EvidenceRouteEnv {
  SNAPSHOTS?: R2Bucket;
  DATABASE?: Hyperdrive;
}

export interface AsyncRouteResult {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

function matchSourcePath(
  pathname: string,
  suffix: "collect" | "provenance",
): string | null {
  const pattern = new RegExp(
    `^/api/v1/sources/([a-z0-9-]+)/${suffix}$`,
  );
  return pathname.match(pattern)?.[1] ?? null;
}

export async function evidenceRoute(
  request: Request,
  env: EvidenceRouteEnv,
): Promise<AsyncRouteResult | null> {
  const url = new URL(request.url);

  if (request.method === "GET") {
    const slug = matchSourcePath(url.pathname, "provenance");

    if (slug) {
      const source = findSource(slug);

      if (!source) {
        return {
          status: 404,
          body: { error: "source_not_found", source: slug },
        };
      }

      if (!env.DATABASE) {
        return {
          status: 503,
          body: { error: "database_binding_unavailable" },
        };
      }

      const provenance = await getSourceProvenance(env.DATABASE, source);
      return {
        status: 200,
        body: provenance as unknown as Record<string, unknown>,
      };
    }
  }

  if (request.method === "POST") {
    const slug = matchSourcePath(url.pathname, "collect");

    if (slug) {
      if (!findSource(slug)) {
        return {
          status: 404,
          body: { error: "source_not_found", source: slug },
        };
      }

      if (!env.SNAPSHOTS || !env.DATABASE) {
        return {
          status: 503,
          body: {
            error: "evidence_bindings_unavailable",
            snapshots: Boolean(env.SNAPSHOTS),
            database: Boolean(env.DATABASE),
          },
        };
      }

      try {
        const result = await collectAndPersistKnownSource(
          env.SNAPSHOTS,
          env.DATABASE,
          slug,
        );

        return {
          status: result.status === "collected" ? 201 : 200,
          headers: {
            "retry-after": String(result.retry_after_seconds),
          },
          body: {
            status: result.status,
            latest_snapshot_id: result.latest_snapshot_id,
            latest_fetched_at: result.latest_fetched_at,
            retry_after_seconds: result.retry_after_seconds,
            snapshot: result.snapshot
              ? {
                  id: result.snapshot.id,
                  fetched_at: result.snapshot.fetched_at,
                  http_status: result.snapshot.http_status,
                  final_url: result.snapshot.final_url,
                  content_type: result.snapshot.content_type,
                  content_length: result.snapshot.content_length,
                  sha256: result.snapshot.sha256,
                  body_ref: result.snapshot.body_ref,
                }
              : null,
            observation: result.observation
              ? {
                  id: result.observation.id,
                  validation_status: result.observation.validation_status,
                  page_title: result.observation.payload.page_title,
                  matched_identity_markers:
                    result.observation.payload.matched_identity_markers,
                }
              : null,
            claims_emitted: result.claims_emitted,
          },
        };
      } catch (error) {
        return {
          status: 502,
          body: {
            error: "source_collection_failed",
            source: slug,
            detail:
              error instanceof Error ? error.message : "unknown_error",
          },
        };
      }
    }
  }

  return null;
}
