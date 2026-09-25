import {
  launch,
  type BrowserWorker,
  type Locator,
  type Page,
} from "@cloudflare/playwright";
import { captureArtifactSnapshot } from "../evidence/snapshot";
import { persistSourceSnapshot } from "../evidence/postgres-store";
import { findSource } from "../sources/registry";
import {
  getLatestCoverageCheckerInteractionProbe,
  persistCoverageCheckerInteractionObservation,
} from "./store";

const SOURCE_SLUG = "lanet-coverage";
const INTERACTION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const LANET_ACCEPTANCE_FIXTURE = {
  country_code: "UA",
  city: "Київ",
  street: "Клавдіївська",
  house_number: "40А",
} as const;

interface OptionSnapshot {
  label: string;
  value: string;
}

interface ControlSnapshot {
  kind: "street" | "house";
  role: string;
  accessible_name: string | null;
  tag_name: string | null;
  selected_label: string | null;
  selected_value: string | null;
  options_sample: OptionSnapshot[];
}

export interface CoverageCheckerInteractionObservation {
  id: string;
  schema_name: "coverage-checker-interaction-observation";
  schema_version: "1";
  extractor: "browser-run-playwright";
  extractor_version: "1";
  normalizer_version: "1";
  extracted_at: string;
  validation_status: "valid" | "partial" | "invalid";
  validation_errors: Array<{ code: string }>;
  payload: {
    schema_version: "coverage-checker-interaction-observation.v1";
    source_slug: string;
    provider_slug: string;
    checker_url: string;
    fixture: typeof LANET_ACCEPTANCE_FIXTURE;
    page_url: string;
    page_title: string;
    street_control: ControlSnapshot | null;
    house_control: ControlSnapshot | null;
    evidence_markers: string[];
    evidence_excerpt: string | null;
    body_text_length: number;
  };
}

export interface CoverageCheckerInteractionProbeResult {
  status: "collected" | "cooldown" | "source_unavailable";
  snapshot_id: string | null;
  observation_id: string | null;
  validation_status: "valid" | "partial" | "invalid" | null;
}

function normalized(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("uk-UA")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function optionMatches(label: string, target: string): boolean {
  const haystack = normalized(label);
  const needle = normalized(target);

  return haystack === needle ||
    haystack.endsWith(` ${needle}`) ||
    haystack.includes(needle);
}

async function optionSnapshots(locator: Locator): Promise<OptionSnapshot[]> {
  try {
    return await locator.locator("option").evaluateAll((options) =>
      options.slice(0, 300).map((option) => {
        const element = option as unknown as {
          textContent: string | null;
          value: string;
        };
        return {
          label: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
          value: element.value,
        };
      }),
    );
  } catch {
    return [];
  }
}

async function tagName(locator: Locator): Promise<string | null> {
  try {
    return await locator.evaluate((element) =>
      element.tagName.toLocaleLowerCase(),
    );
  } catch {
    return null;
  }
}

async function chooseNativeSelect(
  locator: Locator,
  target: string,
): Promise<ControlSnapshot | null> {
  const tag = await tagName(locator);
  if (tag !== "select") return null;

  const options = await optionSnapshots(locator);
  const candidate = options.find((option) =>
    optionMatches(option.label, target),
  );

  if (!candidate) {
    return {
      kind: "street",
      role: "combobox",
      accessible_name: null,
      tag_name: tag,
      selected_label: null,
      selected_value: null,
      options_sample: options.slice(0, 30),
    };
  }

  await locator.selectOption(candidate.value);

  return {
    kind: "street",
    role: "combobox",
    accessible_name: null,
    tag_name: tag,
    selected_label: candidate.label,
    selected_value: candidate.value,
    options_sample: options.slice(0, 30),
  };
}

async function clickNamedOption(
  page: Page,
  target: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const option = page
      .getByRole("option")
      .filter({ hasText: target })
      .first();

    if (await option.count()) {
      await option.click();
      return true;
    }

    const text = page.getByText(target, { exact: false }).first();
    if (await text.count()) {
      await text.click();
      return true;
    }

    await page.waitForTimeout(250);
  }

  return false;
}

async function chooseStreet(page: Page): Promise<ControlSnapshot> {
  const combobox = page
    .getByRole("combobox", { name: "Виберіть вулицю" })
    .first();

  await combobox.waitFor({ state: "visible", timeout: 20_000 });

  const native = await chooseNativeSelect(
    combobox,
    LANET_ACCEPTANCE_FIXTURE.street,
  );

  if (native?.selected_label) {
    return {
      ...native,
      kind: "street",
      accessible_name: "Виберіть вулицю",
    };
  }

  await combobox.click();

  try {
    await combobox.fill(LANET_ACCEPTANCE_FIXTURE.street);
  } catch {
    // Some Select2-style comboboxes expose a non-editable role.
  }

  await page.waitForTimeout(600);

  if (
    !(await clickNamedOption(
      page,
      LANET_ACCEPTANCE_FIXTURE.street,
    ))
  ) {
    throw new Error("coverage_street_option_not_found");
  }

  return {
    kind: "street",
    role: "combobox",
    accessible_name: "Виберіть вулицю",
    tag_name: await tagName(combobox),
    selected_label: LANET_ACCEPTANCE_FIXTURE.street,
    selected_value: null,
    options_sample: native?.options_sample ?? [],
  };
}

async function continueStreetStep(page: Page): Promise<void> {
  const button = page
    .getByRole("button", { name: /продовжити/i })
    .first();

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await button.count()) {
      if (await enabled(button)) {
        await button.click();
        await page.waitForTimeout(500);
        return;
      }
    }

    await page.waitForTimeout(200);
  }

  const text = page
    .getByText("Продовжити", { exact: false })
    .first();

  if (await text.count()) {
    await text.click();
    await page.waitForTimeout(500);
    return;
  }

  throw new Error("coverage_street_continue_not_found");
}

async function enabled(locator: Locator): Promise<boolean> {
  try {
    return await locator.isEnabled();
  } catch {
    return false;
  }
}

async function waitForHouseControl(page: Page): Promise<Locator> {
  const button = page
    .getByRole("button", { name: "Будинок" })
    .first();

  if (await button.count()) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (await enabled(button)) return button;
      await page.waitForTimeout(250);
    }
  }

  const combobox = page
    .getByRole("combobox", { name: /будинок/i })
    .first();

  if (await combobox.count()) {
    return combobox;
  }

  throw new Error("coverage_house_control_not_enabled");
}

async function findNativeHouseSelect(
  page: Page,
): Promise<{ locator: Locator; options: OptionSnapshot[] } | null> {
  const selects = page.locator("select");
  const count = await selects.count();

  for (let index = 0; index < count; index += 1) {
    const locator = selects.nth(index);
    const options = await optionSnapshots(locator);

    if (
      options.some((option) =>
        optionMatches(
          option.label,
          LANET_ACCEPTANCE_FIXTURE.house_number,
        ),
      )
    ) {
      return { locator, options };
    }
  }

  return null;
}

async function chooseHouse(page: Page): Promise<ControlSnapshot> {
  const control = await waitForHouseControl(page);

  const native = await findNativeHouseSelect(page);
  if (native) {
    const candidate = native.options.find((option) =>
      optionMatches(
        option.label,
        LANET_ACCEPTANCE_FIXTURE.house_number,
      ),
    );

    if (candidate) {
      await native.locator.selectOption(candidate.value);
      return {
        kind: "house",
        role: "combobox",
        accessible_name: "Будинок",
        tag_name: await tagName(native.locator),
        selected_label: candidate.label,
        selected_value: candidate.value,
        options_sample: native.options.slice(0, 30),
      };
    }
  }

  await control.click();
  await page.waitForTimeout(600);

  if (
    !(await clickNamedOption(
      page,
      LANET_ACCEPTANCE_FIXTURE.house_number,
    ))
  ) {
    throw new Error("coverage_house_option_not_found");
  }

  return {
    kind: "house",
    role: "button",
    accessible_name: "Будинок",
    tag_name: await tagName(control),
    selected_label: LANET_ACCEPTANCE_FIXTURE.house_number,
    selected_value: null,
    options_sample: native?.options.slice(0, 30) ?? [],
  };
}

function evidenceExcerpt(
  bodyText: string,
  needles: readonly string[],
): string | null {
  const normalizedBody = normalized(bodyText);

  for (const needle of needles) {
    const index = normalizedBody.indexOf(normalized(needle));
    if (index < 0) continue;

    const start = Math.max(0, index - 500);
    const end = Math.min(normalizedBody.length, index + 1_500);
    return normalizedBody.slice(start, end);
  }

  return normalizedBody.slice(0, 2_000) || null;
}

function evidenceMarkers(bodyText: string): string[] {
  const candidates = [
    LANET_ACCEPTANCE_FIXTURE.street,
    LANET_ACCEPTANCE_FIXTURE.house_number,
    "підключ",
    "покрит",
    "доступ",
    "інтернет",
    "PON",
  ];

  const normalizedBody = normalized(bodyText);

  return candidates.filter((candidate) =>
    normalizedBody.includes(normalized(candidate)),
  );
}

export async function probeLanetCoverageInteraction(
  browserWorker: BrowserWorker,
  bucket: R2Bucket,
  database: Hyperdrive,
): Promise<CoverageCheckerInteractionProbeResult> {
  const source = findSource(SOURCE_SLUG);

  if (!source) {
    return {
      status: "source_unavailable",
      snapshot_id: null,
      observation_id: null,
      validation_status: null,
    };
  }

  const latest = await getLatestCoverageCheckerInteractionProbe(
    database,
    source.id,
  );

  if (latest) {
    const ageMs =
      Date.now() - new Date(latest.fetched_at).getTime();

    if (
      Number.isFinite(ageMs) &&
      ageMs >= 0 &&
      ageMs < INTERACTION_COOLDOWN_MS
    ) {
      return {
        status: "cooldown",
        snapshot_id: latest.snapshot_id,
        observation_id: latest.observation_id,
        validation_status: latest.validation_status,
      };
    }
  }

  const browser = await launch(browserWorker);

  try {
    const page = await browser.newPage();

    await page.goto(source.canonical_url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    const validationErrors: Array<{ code: string }> = [];
    let streetControl: ControlSnapshot | null = null;
    let houseControl: ControlSnapshot | null = null;

    try {
      streetControl = await chooseStreet(page);
    } catch (error) {
      validationErrors.push({
        code:
          error instanceof Error
            ? error.message
            : "coverage_street_selection_failed",
      });
    }

    if (streetControl) {
      try {
        await continueStreetStep(page);
        houseControl = await chooseHouse(page);
      } catch (error) {
        validationErrors.push({
          code:
            error instanceof Error
              ? error.message
              : "coverage_house_selection_failed",
        });
      }
    }

    await page.waitForTimeout(1_500);

    const bodyText = (await page.locator("body").innerText())
      .replace(/\r/g, "")
      .slice(0, 250_000);
    const markers = evidenceMarkers(bodyText);
    const excerpt = evidenceExcerpt(bodyText, [
      LANET_ACCEPTANCE_FIXTURE.house_number,
      LANET_ACCEPTANCE_FIXTURE.street,
      "підключ",
      "покрит",
    ]);

    const interactionArtifact = {
      schema_version: "coverage-checker-interaction-artifact.v1",
      source_slug: source.slug,
      provider_slug: source.provider_slug,
      checker_url: source.canonical_url,
      fixture: LANET_ACCEPTANCE_FIXTURE,
      page_url: page.url(),
      page_title: await page.title(),
      street_control: streetControl,
      house_control: houseControl,
      evidence_markers: markers,
      evidence_excerpt: excerpt,
      body_text: bodyText,
    };

    const snapshot = await captureArtifactSnapshot(bucket, {
      sourceId: source.id,
      requestedUrl: source.canonical_url,
      finalUrl: page.url(),
      body: JSON.stringify(interactionArtifact),
      contentType: "application/json; charset=utf-8",
      httpStatus: 200,
    });

    await persistSourceSnapshot(database, source, snapshot, {
      capture_kind: "coverage_checker_result",
    });

    const validSelection =
      streetControl !== null && houseControl !== null;

    const observation: CoverageCheckerInteractionObservation = {
      id: crypto.randomUUID(),
      schema_name: "coverage-checker-interaction-observation",
      schema_version: "1",
      extractor: "browser-run-playwright",
      extractor_version: "1",
      normalizer_version: "1",
      extracted_at: new Date().toISOString(),
      validation_status: validSelection
        ? "valid"
        : validationErrors.length > 0
          ? "partial"
          : "invalid",
      validation_errors: validationErrors,
      payload: {
        schema_version:
          "coverage-checker-interaction-observation.v1",
        source_slug: source.slug,
        provider_slug: source.provider_slug,
        checker_url: source.canonical_url,
        fixture: LANET_ACCEPTANCE_FIXTURE,
        page_url: page.url(),
        page_title: await page.title(),
        street_control: streetControl,
        house_control: houseControl,
        evidence_markers: markers,
        evidence_excerpt: excerpt,
        body_text_length: bodyText.length,
      },
    };

    await persistCoverageCheckerInteractionObservation(
      database,
      snapshot.id,
      observation,
    );

    console.log("coverage_checker_interaction_probe", {
      source: source.slug,
      status: observation.validation_status,
      snapshot_id: snapshot.id,
      observation_id: observation.id,
      page_url: observation.payload.page_url,
      street_selected:
        observation.payload.street_control?.selected_label ?? null,
      house_selected:
        observation.payload.house_control?.selected_label ?? null,
      evidence_markers: observation.payload.evidence_markers,
    });

    return {
      status: "collected",
      snapshot_id: snapshot.id,
      observation_id: observation.id,
      validation_status: observation.validation_status,
    };
  } finally {
    await browser.close();
  }
}
