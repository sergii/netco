import { sourceRoute } from "./routes/sources";
import { evidenceRoute } from "./routes/evidence";
import { getDatabaseStatus } from "./db/status";
import { collectScheduledSources } from "./evidence/collector";
import { providerRoute } from "./routes/providers";
import { coverageRoute } from "./routes/coverage";
import { geoRoute } from "./routes/geo";
import type { BrowserWorker } from "@cloudflare/playwright";
import { explorerPage } from "./ui/explorer";

export interface Env {
  SNAPSHOTS?: R2Bucket;
  DATABASE?: Hyperdrive;
  BROWSER?: BrowserWorker;
}

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function json(
  data: JsonValue,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function requestId(request: Request): string {
  return request.headers.get("cf-ray") ?? crypto.randomUUID();
}

function evidenceStatus(env: Env) {
  const snapshots = Boolean(env.SNAPSHOTS);
  const database = Boolean(env.DATABASE);

  return {
    ready: snapshots && database,
    bindings: {
      snapshots,
      database,
    },
    pipeline: {
      snapshot_capture: snapshots,
      relational_index: database,
      observations: database,
      claims: database,
      provenance: snapshots && database,
      coverage_browser: Boolean(env.BROWSER),
    },
  };
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const id = requestId(request);
    const headers = { "x-request-id": id };
    const evidence = evidenceStatus(env);

    if (request.method === "GET" && url.pathname === "/") {
      return explorerPage();
    }

    if (request.method === "GET" && url.pathname === "/healthz") {
      return json(
        {
          status: "ok",
          service: "netco",
          version: "0.1.0",
        },
        200,
        headers,
      );
    }

    if (request.method === "GET" && url.pathname === "/api/v1/meta") {
      return json(
        {
          service: "netco",
          version: "0.1.0",
          stage: "geo-coverage-points-vs8",
          capabilities: {
            evidence: evidence.ready,
            snapshots: evidence.bindings.snapshots,
            database: evidence.bindings.database,
            sources: true,
            url_discovery: true,
            bounded_crawl: true,
            domain_extraction: true,
            source_backed_claims: true,
            provider_resolution: true,
            provider_projections: true,
            providers: true,
            coverage_checker_probe: false,
            coverage_checker_interaction: false,
            provider_collection_enabled: false,
            address_coverage: true,
            geo: true,
            mcp: false,
          },
        },
        200,
        headers,
      );
    }

    if (request.method === "GET" && url.pathname === "/api/v1/evidence/status") {
      const database = env.DATABASE
        ? await getDatabaseStatus(env.DATABASE)
        : {
            reachable: false,
            schema_ready: false,
            required_tables: 0,
            content_length_column: false,
            projection_schema_ready: false,
            projection_tables: 0,
            coverage_schema_ready: false,
            coverage_tables: 0,
          };

      const status = {
        ...evidence,
        ready: evidence.bindings.snapshots && database.schema_ready,
        database: { ...database },
      };

      return json(status, status.ready ? 200 : 503, headers);
    }

    const coverageResult = await coverageRoute(request, env);
    if (coverageResult) {
      return json(
        coverageResult.body as JsonValue,
        coverageResult.status,
        headers,
      );
    }

    const geoResult = await geoRoute(request, env);
    if (geoResult) {
      return json(
        geoResult.body as JsonValue,
        geoResult.status,
        headers,
      );
    }

    const providerResult = await providerRoute(request, env);
    if (providerResult) {
      return json(
        providerResult.body as JsonValue,
        providerResult.status,
        headers,
      );
    }

    const evidenceResult = await evidenceRoute(request, env);
    if (evidenceResult) {
      return json(
        evidenceResult.body as JsonValue,
        evidenceResult.status,
        { ...headers, ...evidenceResult.headers },
      );
    }

    if (request.method === "GET") {
      const result = sourceRoute(url.pathname);
      if (result) {
        return json(result.body as JsonValue, result.status, headers);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/v1") {
      return json(
        {
          name: "Netco API",
          description:
            "Evidence-backed internet provider and geospatial intelligence API",
          endpoints: [
            "/healthz",
            "/api/v1/meta",
            "/api/v1/evidence/status",
            "/api/v1/sources",
            "/api/v1/providers",
            "/api/v1/coverage/address",
            "/api/v1/coverage/addresses",
            "/api/v1/geo/coverage-points",
            "/api/v1/coverage/lanet/checker-interface",
            "/api/v1/coverage/lanet/checker-interaction",
            "/api/v1/coverage/lanet/address",
          ],
        },
        200,
        headers,
      );
    }

    return json(
      {
        error: "not_found",
        request_id: id,
      },
      404,
      headers,
    );
  },
  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    if (!env.SNAPSHOTS || !env.DATABASE) {
      console.error("scheduled_collection_bindings_unavailable", {
        snapshots: Boolean(env.SNAPSHOTS),
        database: Boolean(env.DATABASE),
      });
      return;
    }

    ctx.waitUntil(collectScheduledSources(env.SNAPSHOTS, env.DATABASE));

  },
} satisfies ExportedHandler<Env>;
