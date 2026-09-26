import { getOperatorAddressWorkspace } from "../application/operator-address";
import type { CapabilityFailure } from "../application/result";

export interface OperatorRouteEnv {
  DATABASE?: Hyperdrive;
}

export interface OperatorRouteResult {
  status: number;
  body: Record<string, unknown>;
}

function failureResult(
  failure: CapabilityFailure,
): OperatorRouteResult {
  const status =
    failure.code === "operator_address_not_found"
      ? 404
      : failure.code === "coverage_schema_unavailable"
        ? 503
        : 500;

  return {
    status,
    body: {
      error: failure.code,
      ...(failure.details ?? {}),
    },
  };
}

export async function operatorRoute(
  request: Request,
  env: OperatorRouteEnv,
): Promise<OperatorRouteResult | null> {
  if (request.method !== "GET") return null;

  const url = new URL(request.url);
  const match = url.pathname.match(
    /^\/api\/v1\/operator\/addresses\/([0-9a-f-]+)$/,
  );

  if (!match) return null;

  if (!env.DATABASE) {
    return {
      status: 503,
      body: { error: "database_binding_unavailable" },
    };
  }

  const result = await getOperatorAddressWorkspace(
    env.DATABASE,
    match[1],
  );

  return result.ok
    ? { status: 200, body: result.value }
    : failureResult(result);
}
