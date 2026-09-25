import {
  getProvider,
  listProviders,
} from "../application/providers";
import type { CapabilityFailure } from "../application/result";

export interface ProviderRouteEnv {
  DATABASE?: Hyperdrive;
}

export interface ProviderRouteResult {
  status: number;
  body: Record<string, unknown>;
}

function failureResult(
  failure: CapabilityFailure,
): ProviderRouteResult {
  const status =
    failure.code === "provider_not_found"
      ? 404
      : failure.code === "projection_schema_unavailable"
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

export async function providerRoute(
  request: Request,
  env: ProviderRouteEnv,
): Promise<ProviderRouteResult | null> {
  if (request.method !== "GET") {
    return null;
  }

  const url = new URL(request.url);

  if (url.pathname === "/api/v1/providers") {
    if (!env.DATABASE) {
      return {
        status: 503,
        body: { error: "database_binding_unavailable" },
      };
    }

    const result = await listProviders(env.DATABASE);

    return result.ok
      ? { status: 200, body: result.value }
      : failureResult(result);
  }

  const match = url.pathname.match(
    /^\/api\/v1\/providers\/([a-z0-9-]+)$/,
  );

  if (!match) {
    return null;
  }

  if (!env.DATABASE) {
    return {
      status: 503,
      body: { error: "database_binding_unavailable" },
    };
  }

  const result = await getProvider(env.DATABASE, match[1]);

  return result.ok
    ? { status: 200, body: result.value }
    : failureResult(result);
}
