import { sourceRoute } from "./routes/sources";

export interface Env {
  SNAPSHOTS?: R2Bucket;
  DB?: Hyperdrive;
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

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const id = requestId(request);
    const headers = { "x-request-id": id };

    if (request.method === "GET" && url.pathname === "/healthz") {
      return json(
        {
          status: "ok",
          service: "netco",
          version: "0.2.0",
        },
        200,
        headers,
      );
    }

    if (request.method === "GET" && url.pathname === "/api/v1/meta") {
      return json(
        {
          service: "netco",
          version: "0.2.0",
          stage: "evidence-spine-vs1",
          capabilities: {
            sources: true,
            snapshot_fetcher: true,
            snapshot_storage: Boolean(env.SNAPSHOTS),
            postgres: Boolean(env.DB),
            evidence: Boolean(env.SNAPSHOTS && env.DB),
            geo: false,
            mcp: false,
          },
        },
        200,
        headers,
      );
    }

    if (request.method === "GET") {
      const result = sourceRoute(url.pathname);
      if (result) {
        return json(result.body as JsonValue, result.status, headers);
      }
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json(
        {
          name: "Netco",
          description:
            "Evidence-backed internet provider and geospatial intelligence API",
          endpoints: [
            "/healthz",
            "/api/v1/meta",
            "/api/v1/sources",
            "/api/v1/sources/teremki",
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
} satisfies ExportedHandler<Env>;
