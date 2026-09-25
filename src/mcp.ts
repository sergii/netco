import {
  checkProviderAvailability,
  findProvidersForAddress,
} from "./application/coverage";
import type { AddressInput } from "./coverage/address";
import type { Env } from "./index";

export const MCP_PROTOCOL_VERSION = "2026-07-28";
export const NETCO_MCP_SERVER = {
  name: "netco",
  version: "0.1.0",
} as const;

export const FIND_PROVIDERS_TOOL = "find_providers_for_address";
export const CHECK_AVAILABILITY_TOOL = "check_availability";

type JsonRpcId = string | number;

interface ModernMcpRequest {
  id: JsonRpcId;
  method: "server/discover" | "tools/list" | "tools/call";
  params: Record<string, unknown>;
}

export async function handleMcpRequest(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  if (!env.MCP_TOKEN) {
    return mcpHttpError(
      null,
      -32001,
      "Netco MCP is not configured",
      503,
      requestId,
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${env.MCP_TOKEN}`) {
    return mcpHttpError(
      null,
      -32001,
      "Authentication required",
      401,
      requestId,
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return mcpHttpError(null, -32700, "Parse error", 400, requestId);
  }

  let mcpRequest: ModernMcpRequest;
  try {
    mcpRequest = normalizeModernRequest(payload, request.headers);
  } catch (error) {
    return mcpHttpError(
      extractId(payload),
      -32600,
      error instanceof Error ? error.message : "Invalid MCP request",
      400,
      requestId,
    );
  }

  if (mcpRequest.method === "server/discover") {
    return mcpResult(
      mcpRequest.id,
      {
        supportedVersions: [MCP_PROTOCOL_VERSION],
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        instructions:
          "Netco MCP exposes a deliberately narrow read-only coverage surface over existing application capabilities.",
        resultType: "complete",
        ttlMs: 0,
        cacheScope: "private",
        _meta: serverMeta(),
      },
      requestId,
    );
  }

  if (mcpRequest.method === "tools/list") {
    return mcpResult(
      mcpRequest.id,
      {
        tools: [findProvidersTool(), checkAvailabilityTool()],
        resultType: "complete",
        ttlMs: 0,
        cacheScope: "private",
        _meta: serverMeta(),
      },
      requestId,
    );
  }

  if (!env.DATABASE) {
    return toolError(
      mcpRequest.id,
      "database_unavailable",
      "Netco database binding is unavailable",
      requestId,
    );
  }

  if (mcpRequest.params.name === FIND_PROVIDERS_TOOL) {
    const input = normalizeFindProvidersInput(mcpRequest.params);
    if (input instanceof Error) {
      return toolError(
        mcpRequest.id,
        "invalid_arguments",
        input.message,
        requestId,
      );
    }

    const result = await findProvidersForAddress(env.DATABASE, input.address);
    if (!result.ok) {
      return capabilityToolError(mcpRequest.id, result, requestId);
    }

    return mcpResult(
      mcpRequest.id,
      {
        content: [
          {
            type: "text",
            text: "Returned Netco provider coverage observations for the address.",
          },
        ],
        structuredContent: result.value,
        isError: false,
        resultType: "complete",
        _meta: serverMeta(),
      },
      requestId,
    );
  }

  if (mcpRequest.params.name === CHECK_AVAILABILITY_TOOL) {
    const input = normalizeCheckAvailabilityInput(mcpRequest.params);
    if (input instanceof Error) {
      return toolError(
        mcpRequest.id,
        "invalid_arguments",
        input.message,
        requestId,
      );
    }

    const result = await checkProviderAvailability(
      env.DATABASE,
      input.provider,
      input.address,
    );
    if (!result.ok) {
      return capabilityToolError(mcpRequest.id, result, requestId);
    }

    return mcpResult(
      mcpRequest.id,
      {
        content: [
          {
            type: "text",
            text: "Returned the persisted Netco provider availability observation.",
          },
        ],
        structuredContent: result.value,
        isError: false,
        resultType: "complete",
        _meta: serverMeta(),
      },
      requestId,
    );
  }

  return mcpHttpError(
    mcpRequest.id,
    -32602,
    "Unknown tool name",
    200,
    requestId,
  );
}

function normalizeModernRequest(
  payload: unknown,
  headers: Headers,
): ModernMcpRequest {
  const object = requireObject(payload, "request");
  if (object.jsonrpc !== "2.0") {
    throw new Error("jsonrpc must be 2.0");
  }

  const id = requireRequestId(object.id);
  const method = object.method;
  if (
    method !== "server/discover" &&
    method !== "tools/list" &&
    method !== "tools/call"
  ) {
    throw new Error("Unsupported MCP method");
  }

  if (headers.get("mcp-protocol-version") !== MCP_PROTOCOL_VERSION) {
    throw new Error("MCP-Protocol-Version header mismatch");
  }
  if (headers.get("mcp-method") !== method) {
    throw new Error("Mcp-Method header mismatch");
  }

  const params =
    object.params === undefined ? {} : requireObject(object.params, "params");
  const meta = requireObject(params._meta, "params._meta");

  if (
    meta["io.modelcontextprotocol/protocolVersion"] !== MCP_PROTOCOL_VERSION
  ) {
    throw new Error("Unsupported MCP protocol version");
  }

  requireObject(
    meta["io.modelcontextprotocol/clientCapabilities"],
    "clientCapabilities",
  );

  if (method === "tools/call") {
    const name = params.name;
    if (name !== FIND_PROVIDERS_TOOL && name !== CHECK_AVAILABILITY_TOOL) {
      throw new Error("Unknown tool name");
    }
    if (headers.get("mcp-name") !== name) {
      throw new Error("Mcp-Name header mismatch");
    }
  }

  return {
    id,
    method,
    params,
  };
}

function normalizeFindProvidersInput(
  params: Record<string, unknown>,
): { address: AddressInput } | Error {
  if (params.name !== FIND_PROVIDERS_TOOL) {
    return new Error("Unknown tool name");
  }

  try {
    return {
      address: shallowAddressInput(
        requireObject(params.arguments, "arguments").address,
      ),
    };
  } catch (error) {
    return error instanceof Error ? error : new Error("Invalid arguments");
  }
}

function normalizeCheckAvailabilityInput(
  params: Record<string, unknown>,
): { provider: string; address: AddressInput } | Error {
  if (params.name !== CHECK_AVAILABILITY_TOOL) {
    return new Error("Unknown tool name");
  }

  try {
    const args = requireObject(params.arguments, "arguments");
    const provider = requireString(args.provider, "provider", 128);
    return {
      provider,
      address: shallowAddressInput(args.address),
    };
  } catch (error) {
    return error instanceof Error ? error : new Error("Invalid arguments");
  }
}

function shallowAddressInput(value: unknown): AddressInput {
  const object = requireObject(value, "address");
  const allowed = new Set([
    "country_code",
    "region",
    "city",
    "district",
    "street",
    "house_number",
    "corpus",
    "building_letter",
    "postal_code",
    "latitude",
    "longitude",
  ]);

  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) {
      throw new Error("address contains an unknown field");
    }
  }

  return {
    country_code: passString(object.country_code, "address.country_code"),
    city: passString(object.city, "address.city"),
    street: passString(object.street, "address.street"),
    house_number: passString(object.house_number, "address.house_number"),
    ...optionalString(object, "region"),
    ...optionalString(object, "district"),
    ...optionalString(object, "corpus"),
    ...optionalString(object, "building_letter"),
    ...optionalString(object, "postal_code"),
    ...optionalNumber(object, "latitude"),
    ...optionalNumber(object, "longitude"),
  };
}

function findProvidersTool(): Record<string, unknown> {
  return {
    name: FIND_PROVIDERS_TOOL,
    title: "Find providers for address",
    description:
      "Read persisted Netco coverage observations across providers for one address.",
    inputSchema: {
      type: "object",
      properties: {
        address: addressSchema(),
      },
      required: ["address"],
      additionalProperties: false,
    },
    annotations: readOnlyAnnotations(),
  };
}

function checkAvailabilityTool(): Record<string, unknown> {
  return {
    name: CHECK_AVAILABILITY_TOOL,
    title: "Check provider availability",
    description:
      "Read the persisted Netco availability observation for one provider and address.",
    inputSchema: {
      type: "object",
      properties: {
        provider: {
          type: "string",
        },
        address: addressSchema(),
      },
      required: ["provider", "address"],
      additionalProperties: false,
    },
    annotations: readOnlyAnnotations(),
  };
}

function addressSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      country_code: { type: "string" },
      region: { type: ["string", "null"] },
      city: { type: "string" },
      district: { type: ["string", "null"] },
      street: { type: "string" },
      house_number: { type: "string" },
      corpus: { type: ["string", "null"] },
      building_letter: { type: ["string", "null"] },
      postal_code: { type: ["string", "null"] },
      latitude: { type: ["number", "null"] },
      longitude: { type: ["number", "null"] },
    },
    required: ["country_code", "city", "street", "house_number"],
    additionalProperties: false,
  };
}

function readOnlyAnnotations(): Record<string, boolean> {
  return {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
}

function capabilityToolError(
  id: JsonRpcId,
  result: { ok: false; code: string; details?: Record<string, unknown> },
  requestId: string,
): Response {
  return mcpResult(
    id,
    {
      content: [
        {
          type: "text",
          text: `Netco capability failed: ${result.code}`,
        },
      ],
      isError: true,
      resultType: "complete",
      _meta: {
        ...serverMeta(),
        "netco.errorCode": result.code,
        ...(result.details === undefined
          ? {}
          : { "netco.errorDetails": result.details }),
      },
    },
    requestId,
  );
}

function toolError(
  id: JsonRpcId,
  code: string,
  message: string,
  requestId: string,
): Response {
  return mcpResult(
    id,
    {
      content: [{ type: "text", text: message }],
      isError: true,
      resultType: "complete",
      _meta: {
        ...serverMeta(),
        "netco.errorCode": code,
      },
    },
    requestId,
  );
}

function serverMeta(): Record<string, unknown> {
  return {
    "io.modelcontextprotocol/serverInfo": NETCO_MCP_SERVER,
  };
}

function mcpResult(
  id: JsonRpcId,
  result: Record<string, unknown>,
  requestId: string,
): Response {
  return mcpResponse(
    {
      jsonrpc: "2.0",
      id,
      result,
    },
    200,
    requestId,
  );
}

function mcpHttpError(
  id: JsonRpcId | null,
  code: number,
  message: string,
  status: number,
  requestId: string,
): Response {
  return mcpResponse(
    {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
      },
    },
    status,
    requestId,
  );
}

function mcpResponse(
  body: Record<string, unknown>,
  status: number,
  requestId: string,
): Response {
  const event = "event: message\ndata: " + JSON.stringify(body) + "\n\n";
  return new Response(event, {
    status,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      "x-request-id": requestId,
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    },
  });
}

function requireObject(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(field + " must be an object");
  }
  return value as Record<string, unknown>;
}

function requireRequestId(value: unknown): JsonRpcId {
  if (typeof value === "string" && value.length > 0 && value.length <= 256) {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }
  throw new Error("JSON-RPC id must be a string or integer");
}

function requireString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(field + " must be a non-empty string");
  }
  const result = value.trim();
  if (result.length > maxLength) {
    throw new Error(field + " is too long");
  }
  return result;
}

function passString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(field + " must be a string");
  }
  return value;
}

function optionalString(
  object: Record<string, unknown>,
  key: keyof AddressInput,
): Partial<AddressInput> {
  const value = object[key];
  if (value === undefined) return {};
  if (value !== null && typeof value !== "string") {
    throw new Error("address." + key + " must be a string or null");
  }
  return { [key]: value } as Partial<AddressInput>;
}

function optionalNumber(
  object: Record<string, unknown>,
  key: "latitude" | "longitude",
): Partial<AddressInput> {
  const value = object[key];
  if (value === undefined) return {};
  if (value !== null && typeof value !== "number") {
    throw new Error("address." + key + " must be a number or null");
  }
  return { [key]: value } as Partial<AddressInput>;
}

function extractId(payload: unknown): JsonRpcId | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return null;
  }
  const id = (payload as Record<string, unknown>).id;
  return typeof id === "string" || typeof id === "number" ? id : null;
}
