import { SOURCES, findSource } from "../sources/registry";

export interface SourceRouteResult {
  status: number;
  body: unknown;
}

export function sourceRoute(pathname: string): SourceRouteResult | null {
  if (pathname === "/api/v1/sources") {
    return {
      status: 200,
      body: {
        sources: SOURCES.map((source) => ({
          id: source.id,
          slug: source.slug,
          kind: source.kind,
          name: source.name,
          canonical_url: source.canonicalUrl,
          provider_candidate_name: source.providerCandidateName ?? null,
        })),
      },
    };
  }

  const match = pathname.match(/^\/api\/v1\/sources\/([a-z0-9-]+)$/);
  if (!match) {
    return null;
  }

  const source = findSource(match[1]);

  if (!source) {
    return {
      status: 404,
      body: {
        error: "source_not_found",
        source: match[1],
      },
    };
  }

  return {
    status: 200,
    body: {
      source: {
        id: source.id,
        slug: source.slug,
        kind: source.kind,
        name: source.name,
        canonical_url: source.canonicalUrl,
        provider_candidate_name: source.providerCandidateName ?? null,
      },
    },
  };
}
