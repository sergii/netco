export type CapabilityFailure = {
  ok: false;
  code: string;
  details?: Record<string, unknown>;
};

export type CapabilityResult<T> =
  | {
      ok: true;
      value: T;
    }
  | CapabilityFailure;

export function capabilityOk<T>(value: T): CapabilityResult<T> {
  return { ok: true, value };
}

export function capabilityFailure(
  code: string,
  details?: Record<string, unknown>,
): CapabilityFailure {
  return details
    ? { ok: false, code, details }
    : { ok: false, code };
}
