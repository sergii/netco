import { sourceRoute } from "./routes/sources";
import { evidenceRoute } from "./routes/evidence";
import {
  getEvidenceStatus,
  getServiceMeta,
  type RuntimeBindingState,
} from "./application/service-status";
import { collectScheduledSources } from "./evidence/collector";
import { providerRoute } from "./routes/providers";
import { coverageRoute } from "./routes/coverage";
import { geoRoute } from "./routes/geo";
import { operatorRoute } from "./routes/operator";
import { materializePendingAddressGeoPoints } from "./geo/evidence";
import type { BrowserWorker } from "@cloudflare/playwright";
import { explorerPage } from "./ui/explorer";
import { apiDocsPage } from "./ui/api-docs";
import OPENAPI_DOCUMENT from "../openapi/openapi.json";
import { handleMcpRequest } from "./mcp";

export interface Env {
  SNAPSHOTS?: R2Bucket;
  DATABASE?: Hyperdrive;
  BROWSER?: BrowserWorker;
  MCP_TOKEN?: string;
  OPERATOR_WRITES_ENABLED?: string;
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

function runtimeBindingState(env: Env): RuntimeBindingState {
  return {
    snapshots: Boolean(env.SNAPSHOTS),
    database: Boolean(env.DATABASE),
    browser: Boolean(env.BROWSER),
  };
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const id = requestId(request);
    const headers = { "x-request-id": id };
    const bindings = runtimeBindingState(env);

    if (request.method === "POST" && url.pathname === "/mcp") {
      return handleMcpRequest(request, env, id);
    }

    if (request.method === "GET" && url.pathname === "/") {
      return explorerPage();
    }

    if (
      request.method === "GET" &&
      (url.pathname === "/docs" || url.pathname === "/docs/")
    ) {
      return apiDocsPage();
    }

    if (request.method === "GET" && url.pathname === "/openapi.json") {
      return json(OPENAPI_DOCUMENT as unknown as JsonValue, 200, headers);
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
        getServiceMeta(
          bindings,
          env.OPERATOR_WRITES_ENABLED === "true",
        ) as unknown as JsonValue,
        200,
        headers,
      );
    }

    if (request.method === "GET" && url.pathname === "/api/v1/evidence/status") {
      const status = await getEvidenceStatus(
        bindings,
        env.DATABASE,
      );

      return json(
        status as unknown as JsonValue,
        status.ready ? 200 : 503,
        headers,
      );
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

    const operatorResult = await operatorRoute(request, env);
    if (operatorResult) {
      return json(
        operatorResult.body as JsonValue,
        operatorResult.status,
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
          documentation: {
            openapi: "/openapi.json",
            reference: "/docs",
          },
          endpoints: [
            "/healthz",
            "/api/v1/meta",
            "/api/v1/evidence/status",
            "/api/v1/sources",
            "/api/v1/providers",
            "/api/v1/coverage/address",
            "/api/v1/coverage/addresses",
            "/api/v1/geo/coverage-points",
            "/api/v1/geo/h3-cells",
            "/api/v1/geo/h3-cells/:h3_index",
            "/api/v1/geo/enrichment-backlog",
            "/api/v1/geo/addresses/:address_id/provenance",
            "/api/v1/operator/addresses/:address_id",
            "/api/v1/operator/addresses/:address_id/activity",
            "/api/v1/operator/addresses/:address_id/notes",
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

    ctx.waitUntil(
      materializePendingAddressGeoPoints(env.DATABASE)
        .then((result) => {
          console.log("geo_point_materialization", result);
        })
        .catch((error) => {
          console.error("geo_point_materialization_failed", {
            error:
              error instanceof Error
                ? error.message
                : "unknown_error",
          });
        }),
    );
  },
} satisfies ExportedHandler<Env>;
