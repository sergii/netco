import {
  getLatestCrawlPages,
  getLatestUrlDiscoveryObservation,
  getSourceProvenance,
} from "../evidence/postgres-store";
import { findSource } from "../sources/registry";

export interface EvidenceRouteEnv {
  DATABASE?: Hyperdrive;
}

export interface AsyncRouteResult {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

function matchSourcePath(
  pathname: string,
  suffix: "provenance" | "discovery" | "crawl-pages",
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
  if (request.method !== "GET") {
    return null;
  }

  const url = new URL(request.url);
  const provenanceSlug = matchSourcePath(url.pathname, "provenance");
  const discoverySlug = matchSourcePath(url.pathname, "discovery");
  const crawlPagesSlug = matchSourcePath(url.pathname, "crawl-pages");
  const slug = provenanceSlug ?? discoverySlug ?? crawlPagesSlug;

  if (!slug) {
    return null;
  }

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

  if (crawlPagesSlug) {
    const pages = await getLatestCrawlPages(
      env.DATABASE,
      source.id,
    );

    return {
      status: 200,
      body: {
        source: {
          id: source.id,
          slug: source.slug,
          name: source.name,
          canonical_url: source.canonical_url,
        },
        pages,
      },
    };
  }

  if (discoverySlug) {
    const discovery = await getLatestUrlDiscoveryObservation(
      env.DATABASE,
      source.id,
    );

    return {
      status: 200,
      body: {
        source: {
          id: source.id,
          slug: source.slug,
          name: source.name,
          canonical_url: source.canonical_url,
        },
        discovery,
      },
    };
  }

  const provenance = await getSourceProvenance(env.DATABASE, source);

  return {
    status: 200,
    body: provenance as unknown as Record<string, unknown>,
  };
}
