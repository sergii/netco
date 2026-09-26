export interface OperatorWriteEnv {
  OPERATOR_WRITES_ENABLED?: string;
}

export interface OperatorWriteIdentity {
  email: string;
}

export type OperatorWriteAuthorization =
  | {
      ok: true;
      identity: OperatorWriteIdentity;
    }
  | {
      ok: false;
      status: number;
      error: string;
      details: Record<string, unknown>;
    };

export function operatorWritesEnabled(
  env: OperatorWriteEnv,
): boolean {
  return env.OPERATOR_WRITES_ENABLED === "true";
}

export function authorizeOperatorWrite(
  request: Request,
  env: OperatorWriteEnv,
): OperatorWriteAuthorization {
  if (!operatorWritesEnabled(env)) {
    return {
      ok: false,
      status: 503,
      error: "operator_writes_disabled",
      details: {
        boundary: "cloudflare_access",
        activation_required: true,
      },
    };
  }

  const accessJwt =
    request.headers.get("cf-access-jwt-assertion");
  const email =
    request.headers.get("cf-access-authenticated-user-email");

  if (!accessJwt || !email) {
    return {
      ok: false,
      status: 403,
      error: "operator_access_required",
      details: {
        boundary: "cloudflare_access",
      },
    };
  }

  return {
    ok: true,
    identity: {
      email,
    },
  };
}
