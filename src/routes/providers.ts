import {
  getProviderProjection,
  listProviderProjections,
} from "../projection/provider";
import { getDatabaseStatus } from "../db/status";

export interface ProviderRouteEnv {
  DATABASE?: Hyperdrive;
}

export interface ProviderRouteResult {
  status: number;
  body: Record<string, unknown>;
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

    const status = await getDatabaseStatus(env.DATABASE);
    if (!status.projection_schema_ready) {
      return {
        status: 503,
        body: {
          error: "projection_schema_unavailable",
          projection_tables: status.projection_tables,
        },
      };
    }

    const providers = await listProviderProjections(env.DATABASE);

    return {
      status: 200,
      body: { providers },
    };
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

  const status = await getDatabaseStatus(env.DATABASE);
  if (!status.projection_schema_ready) {
    return {
      status: 503,
      body: {
        error: "projection_schema_unavailable",
        projection_tables: status.projection_tables,
      },
    };
  }

  const provider = await getProviderProjection(
    env.DATABASE,
    match[1],
  );

  if (!provider) {
    return {
      status: 404,
      body: {
        error: "provider_not_found",
        provider: match[1],
      },
    };
  }

  return {
    status: 200,
    body: provider,
  };
}
