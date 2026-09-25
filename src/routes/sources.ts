import {
  getSource,
  listSources,
} from "../application/sources";

export interface SourceRouteResult {
  status: number;
  body: unknown;
}

export function sourceRoute(pathname: string): SourceRouteResult | null {
  if (pathname === "/api/v1/sources") {
    return {
      status: 200,
      body: listSources(),
    };
  }

  const match = pathname.match(/^\/api\/v1\/sources\/([a-z0-9-]+)$/);
  if (!match) {
    return null;
  }

  const result = getSource(match[1]);

  return result.ok
    ? {
        status: 200,
        body: result.value,
      }
    : {
        status: 404,
        body: {
          error: result.code,
          ...(result.details ?? {}),
        },
      };
}
