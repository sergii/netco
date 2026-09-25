import {
  getLatestUrlDiscoveryObservation,
  getRecentDomainExtractions,
  getRecentPagePurposeObservations,
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
  suffix: "provenance" | "discovery" | "crawl" | "extractions",
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
  const crawlSlug = matchSourcePath(url.pathname, "crawl");
  const extractionsSlug = matchSourcePath(url.pathname, "extractions");
  const slug =
    provenanceSlug ?? discoverySlug ?? crawlSlug ?? extractionsSlug;

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

  if (extractionsSlug) {
    const extractions = await getRecentDomainExtractions(
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
        extractions,
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

  if (crawlSlug) {
    const pages = await getRecentPagePurposeObservations(
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

  const provenance = await getSourceProvenance(env.DATABASE, source);

  return {
    status: 200,
    body: provenance as unknown as Record<string, unknown>,
  };
}
