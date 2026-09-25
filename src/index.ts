export interface Env {}

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
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const id = requestId(request);
    const headers = { "x-request-id": id };

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
          stage: "bootstrap",
          capabilities: {
            evidence: false,
            providers: false,
            geo: false,
            mcp: false,
          },
        },
        200,
        headers,
      );
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json(
        {
          name: "Netco",
          description:
            "Evidence-backed internet provider and geospatial intelligence API",
          endpoints: ["/healthz", "/api/v1/meta"],
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
