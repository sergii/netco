import { getOperatorAddressWorkspace } from "../application/operator-address";
import {
  addOperatorAddressNote,
  getOperatorAddressActivity,
} from "../application/operator-activity";
import type { CapabilityFailure } from "../application/result";
import {
  authorizeOperatorWrite,
  type OperatorWriteEnv,
} from "../security/operator-write";

export interface OperatorRouteEnv extends OperatorWriteEnv {
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
      : failure.code === "operator_note_invalid"
        ? 400
        : failure.code === "coverage_schema_unavailable" ||
            failure.code === "operator_activity_schema_unavailable"
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

async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function operatorRoute(
  request: Request,
  env: OperatorRouteEnv,
): Promise<OperatorRouteResult | null> {
  const url = new URL(request.url);

  if (!url.pathname.startsWith("/api/v1/operator/")) {
    return null;
  }

  const workspaceMatch = url.pathname.match(
    /^\/api\/v1\/operator\/addresses\/([0-9a-f-]+)$/,
  );
  const activityMatch = url.pathname.match(
    /^\/api\/v1\/operator\/addresses\/([0-9a-f-]+)\/activity$/,
  );
  const noteMatch = url.pathname.match(
    /^\/api\/v1\/operator\/addresses\/([0-9a-f-]+)\/notes$/,
  );

  if (request.method === "GET") {
    if (!env.DATABASE) {
      return {
        status: 503,
        body: { error: "database_binding_unavailable" },
      };
    }

    if (workspaceMatch) {
      const result = await getOperatorAddressWorkspace(
        env.DATABASE,
        workspaceMatch[1],
      );

      return result.ok
        ? { status: 200, body: result.value }
        : failureResult(result);
    }

    if (activityMatch) {
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam === null ? 50 : Number(limitParam);

      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return {
          status: 400,
          body: {
            error: "operator_activity_limit_invalid",
            minimum: 1,
            maximum: 100,
          },
        };
      }

      const result = await getOperatorAddressActivity(
        env.DATABASE,
        activityMatch[1],
        limit,
      );

      return result.ok
        ? { status: 200, body: result.value }
        : failureResult(result);
    }

    return null;
  }

  const authorization = authorizeOperatorWrite(request, env);

  if (!authorization.ok) {
    return {
      status: authorization.status,
      body: {
        error: authorization.error,
        ...authorization.details,
      },
    };
  }

  if (request.method === "POST" && noteMatch) {
    if (!env.DATABASE) {
      return {
        status: 503,
        body: { error: "database_binding_unavailable" },
      };
    }

    const body = await readJsonBody(request);
    if (!body) {
      return {
        status: 400,
        body: { error: "operator_note_json_required" },
      };
    }

    const result = await addOperatorAddressNote(
      env.DATABASE,
      noteMatch[1],
      body.body,
      authorization.identity.email,
    );

    return result.ok
      ? { status: 201, body: result.value }
      : failureResult(result);
  }

  return {
    status: 404,
    body: {
      error: "operator_write_route_not_found",
    },
  };
}
