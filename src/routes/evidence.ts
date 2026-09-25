import { getSourceProvenance } from "../evidence/postgres-store";
import { findSource } from "../sources/registry";

export interface EvidenceRouteEnv {
  DATABASE?: Hyperdrive;
}

export interface AsyncRouteResult {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

function matchSourceProvenancePath(pathname: string): string | null {
  return pathname.match(
    /^\/api\/v1\/sources\/([a-z0-9-]+)\/provenance$/,
  )?.[1] ?? null;
}

export async function evidenceRoute(
  request: Request,
  env: EvidenceRouteEnv,
): Promise<AsyncRouteResult | null> {
  if (request.method !== "GET") {
    return null;
  }

  const url = new URL(request.url);
  const slug = matchSourceProvenancePath(url.pathname);

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

  const provenance = await getSourceProvenance(env.DATABASE, source);
  return {
    status: 200,
    body: provenance as unknown as Record<string, unknown>,
  };
}
