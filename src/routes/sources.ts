import { SOURCES, findSource } from "../sources/registry";

export interface SourceRouteResult {
  status: number;
  body: Record<string, unknown>;
}

export function sourceRoute(pathname: string): SourceRouteResult | null {
  if (pathname === "/api/v1/sources") {
    return {
      status: 200,
      body: {
        sources: SOURCES,
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
    body: { source },
  };
}
