import { sourceRoute } from "./routes/sources";
import { getDatabaseStatus } from "./db/status";

export interface Env {
  SNAPSHOTS?: R2Bucket;
  DATABASE?: Hyperdrive;
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
    },
  };
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const id = requestId(request);
    const headers = { "x-request-id": id };
    const evidence = evidenceStatus(env);

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
          stage: "evidence-spine-vs1",
          capabilities: {
            evidence: evidence.ready,
            snapshots: evidence.bindings.snapshots,
            database: evidence.bindings.database,
            sources: true,
            providers: false,
            geo: false,
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
          };

      const status = {
        ...evidence,
        ready: evidence.bindings.snapshots && database.schema_ready,
        database,
      };

      return json(status, status.ready ? 200 : 503, headers);
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
            "/api/v1/evidence/status",
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
