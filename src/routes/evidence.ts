import {
  getSourceEvidence,
  type SourceEvidenceKind,
} from "../application/evidence";

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
  suffix: SourceEvidenceKind,
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
  const matches: Array<[SourceEvidenceKind, string | null]> = [
    ["provenance", matchSourcePath(url.pathname, "provenance")],
    ["discovery", matchSourcePath(url.pathname, "discovery")],
    ["crawl", matchSourcePath(url.pathname, "crawl")],
    ["extractions", matchSourcePath(url.pathname, "extractions")],
  ];
  const matched = matches.find(([, slug]) => slug !== null);

  if (!matched) {
    return null;
  }

  if (!env.DATABASE) {
    return {
      status: 503,
      body: { error: "database_binding_unavailable" },
    };
  }

  const [kind, slug] = matched;
  const result = await getSourceEvidence(
    env.DATABASE,
    slug!,
    kind,
  );

  return result.ok
    ? {
        status: 200,
        body: result.value,
      }
    : {
        status: result.code === "source_not_found" ? 404 : 500,
        body: {
          error: result.code,
          ...(result.details ?? {}),
        },
      };
}
