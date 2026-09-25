import { captureArtifactSnapshot } from "../evidence/snapshot";
import { persistSourceSnapshot } from "../evidence/postgres-store";
import { findSource } from "../sources/registry";
import {
  getLatestCoverageCheckerProbe,
  persistCoverageCheckerInterfaceObservation,
} from "./store";

const PROBE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const SOURCE_SLUG = "lanet-coverage";

export interface BrowserRunBinding {
  quickAction(
    action: "accessibilityTree",
    options: Record<string, unknown>,
  ): Promise<Response>;
}

export interface CoverageCheckerControl {
  role: string;
  name: string | null;
  value: string | null;
  disabled: boolean | null;
  checked: boolean | null;
}

export interface CoverageCheckerInterfaceObservation {
  id: string;
  schema_name: "coverage-checker-interface-observation";
  schema_version: "1";
  extractor: "browser-run-accessibility-tree";
  extractor_version: "1";
  normalizer_version: "1";
  extracted_at: string;
  validation_status: "valid" | "partial" | "invalid";
  validation_errors: Array<{ code: string }>;
  payload: {
    schema_version: "coverage-checker-interface-observation.v1";
    source_slug: string;
    url: string;
    controls: CoverageCheckerControl[];
    interactive_control_count: number;
    browser_ms_used: number | null;
  };
}

export interface CoverageCheckerProbeResult {
  status: "collected" | "cooldown" | "source_unavailable";
  snapshot_id: string | null;
  observation_id: string | null;
  controls: number;
  browser_ms_used: number | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized.slice(0, 500) : null;
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function collectControls(value: unknown): CoverageCheckerControl[] {
  const controls: CoverageCheckerControl[] = [];
  const seen = new Set<unknown>();
  const interestingRoles = new Set([
    "textbox",
    "combobox",
    "searchbox",
    "button",
    "link",
    "option",
    "listbox",
  ]);

  function visit(node: unknown): void {
    if (node === null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }

    const record = node as Record<string, unknown>;
    const role = nullableText(record.role);

    if (role && interestingRoles.has(role.toLocaleLowerCase())) {
      controls.push({
        role: role.toLocaleLowerCase(),
        name: nullableText(record.name),
        value: nullableText(record.value),
        disabled: nullableBoolean(record.disabled),
        checked: nullableBoolean(record.checked),
      });
    }

    for (const child of Object.values(record)) {
      visit(child);
    }
  }

  visit(value);

  const deduped = new Map<string, CoverageCheckerControl>();

  for (const control of controls) {
    const key = [
      control.role,
      control.name ?? "",
      control.value ?? "",
      String(control.disabled),
      String(control.checked),
    ].join("|");

    if (!deduped.has(key)) {
      deduped.set(key, control);
    }
  }

  return [...deduped.values()].slice(0, 200);
}

function parseBrowserMs(response: Response): number | null {
  const raw = response.headers.get("x-browser-ms-used");
  if (!raw) return null;

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function probeLanetCoverageChecker(
  browser: BrowserRunBinding,
  bucket: R2Bucket,
  database: Hyperdrive,
): Promise<CoverageCheckerProbeResult> {
  const source = findSource(SOURCE_SLUG);
  if (!source) {
    return {
      status: "source_unavailable",
      snapshot_id: null,
      observation_id: null,
      controls: 0,
      browser_ms_used: null,
    };
  }

  const latest = await getLatestCoverageCheckerProbe(database, source.id);
  if (latest) {
    const ageMs = Date.now() - new Date(latest.fetched_at).getTime();
    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < PROBE_COOLDOWN_MS) {
      return {
        status: "cooldown",
        snapshot_id: latest.snapshot_id,
        observation_id: latest.observation_id,
        controls: latest.control_count,
        browser_ms_used: latest.browser_ms_used,
      };
    }
  }

  const response = await browser.quickAction("accessibilityTree", {
    url: source.canonical_url,
    interestingOnly: true,
    gotoOptions: {
      waitUntil: "networkidle0",
      timeout: 30_000,
    },
  });

  const browserMsUsed = parseBrowserMs(response);
  const bodyText = await response.text();

  let payload: unknown = null;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    payload = null;
  }

  const controls = collectControls(payload);
  const hasAddressInput = controls.some((control) =>
    ["textbox", "combobox", "searchbox"].includes(control.role),
  );
  const hasAction = controls.some((control) => control.role === "button");

  const validationStatus =
    response.ok && hasAddressInput && hasAction
      ? "valid"
      : response.ok && controls.length > 0
        ? "partial"
        : "invalid";

  const validationErrors: Array<{ code: string }> = [];

  if (!response.ok) {
    validationErrors.push({ code: "browser_run_not_successful" });
  }
  if (!hasAddressInput) {
    validationErrors.push({ code: "address_input_not_found" });
  }
  if (!hasAction) {
    validationErrors.push({ code: "action_button_not_found" });
  }

  const snapshot = await captureArtifactSnapshot(bucket, {
    sourceId: source.id,
    requestedUrl: source.canonical_url,
    finalUrl: source.canonical_url,
    body: bodyText,
    contentType:
      response.headers.get("content-type") ??
      "application/json; charset=utf-8",
    httpStatus: response.status,
    responseHeaders: {
      ...(browserMsUsed === null
        ? {}
        : { "x-browser-ms-used": String(browserMsUsed) }),
    },
  });

  await persistSourceSnapshot(database, source, snapshot, {
    capture_kind: "coverage_checker_probe",
  });

  const observation: CoverageCheckerInterfaceObservation = {
    id: crypto.randomUUID(),
    schema_name: "coverage-checker-interface-observation",
    schema_version: "1",
    extractor: "browser-run-accessibility-tree",
    extractor_version: "1",
    normalizer_version: "1",
    extracted_at: new Date().toISOString(),
    validation_status: validationStatus,
    validation_errors: validationErrors,
    payload: {
      schema_version: "coverage-checker-interface-observation.v1",
      source_slug: source.slug,
      url: source.canonical_url,
      controls,
      interactive_control_count: controls.length,
      browser_ms_used: browserMsUsed,
    },
  };

  await persistCoverageCheckerInterfaceObservation(
    database,
    snapshot.id,
    observation,
  );

  console.log("coverage_checker_probe", {
    source: source.slug,
    status: validationStatus,
    snapshot_id: snapshot.id,
    observation_id: observation.id,
    controls: controls.length,
    browser_ms_used: browserMsUsed,
  });

  return {
    status: "collected",
    snapshot_id: snapshot.id,
    observation_id: observation.id,
    controls: controls.length,
    browser_ms_used: browserMsUsed,
  };
}
