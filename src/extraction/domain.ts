import type { SnapshotRecord } from "../evidence/snapshot";
import type { SourceDefinition } from "../sources/registry";
import {
  decodeSnapshotBody,
  extractHtmlTitle,
  htmlToPrimaryText,
  htmlToText,
  normalizedEvidenceText,
} from "./html";

export type DomainObservation =
  | PlanObservation
  | TechnologyObservation
  | CoverageEntrypointObservation;

export interface ClaimDraft {
  predicate: string;
  value: Record<string, unknown>;
  extraction_confidence: number;
  evidence_marker: string;
}

export interface DomainExtractionResult {
  observation: DomainObservation;
  claims: ClaimDraft[];
}

interface ObservationBase {
  id: string;
  schema_version: "1";
  extractor: "deterministic-domain-html";
  extractor_version: "3";
  normalizer_version: "1";
  extracted_at: string;
  validation_status: "valid" | "partial" | "invalid";
  validation_errors: Array<{ code: string }>;
}

export interface PlanObservation extends ObservationBase {
  schema_name: "plan-observation";
  payload: {
    schema_version: "plan-observation.v1";
    source_slug: string;
    url: string;
    page_title: string | null;
    plans: Array<{
      name: string;
      download_mbps: number | null;
      technology: string | null;
      monthly_price: { amount: string; currency: "UAH" } | null;
      promo_price: { amount: string; currency: "UAH" } | null;
      promo_duration_months: number | null;
      price_after_promo: null;
      evidence_marker: string;
    }>;
  };
}

export interface TechnologyObservation extends ObservationBase {
  schema_name: "technology-observation";
  payload: {
    schema_version: "technology-observation.v1";
    source_slug: string;
    url: string;
    page_title: string | null;
    technologies: Array<{
      technology: "gpon" | "xpon" | "ftth";
      observed_label: string;
      evidence_marker: string;
    }>;
  };
}

export interface CoverageEntrypointObservation extends ObservationBase {
  schema_name: "coverage-entrypoint-observation";
  payload: {
    schema_version: "coverage-entrypoint-observation.v1";
    source_slug: string;
    url: string;
    page_title: string | null;
    checker_kind: "address";
    checker_url: string;
    geographic_hint: string | null;
    evidence_marker: string | null;
  };
}

function baseObservation(): Omit<ObservationBase, "validation_status" | "validation_errors"> {
  return {
    id: crypto.randomUUID(),
    schema_version: "1",
    extractor: "deterministic-domain-html",
    extractor_version: "3",
    normalizer_version: "1",
    extracted_at: new Date().toISOString(),
  };
}

function money(amount: string): { amount: string; currency: "UAH" } {
  return {
    amount: Number(amount.replace(",", ".")).toFixed(2),
    currency: "UAH",
  };
}

function inferPlanTechnology(name: string): string | null {
  const normalized = normalizedEvidenceText(name);

  if (/\bgpon\b/.test(normalized)) return "gpon";
  if (/\b(?:xgpon|xpon|pon)\b/.test(normalized)) return "xpon";
  if (/\bftth\b/.test(normalized)) return "ftth";

  return null;
}

function extractPlans(text: string): PlanObservation["payload"]["plans"] {
  const quotePattern = /[«"]([^»"]{1,64})[»"]/g;
  const matches = [...text.matchAll(quotePattern)];
  const plans = new Map<
    string,
    PlanObservation["payload"]["plans"][number]
  >();

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const name = match[1]?.replace(/\s+/g, " ").trim();
    const start = match.index ?? 0;
    const nextStart = matches[index + 1]?.index ?? text.length;
    const segment = text.slice(start, Math.min(nextStart, start + 900));

    if (!name) continue;

    const speedMatch =
      segment.match(
        /\b(\d{2,5})\b(?=[\s\S]{0,90}?(?:швидкість[\s\S]{0,30}?)?(?:мбіт\s*\/\s*с|мбіт\/с|mbit\s*\/\s*s|mbps)\b)/i,
      ) ??
      segment.match(
        /\b(\d{2,5})\s*(?:мбіт\s*\/\s*с|мбіт\/с|mbit\s*\/\s*s|mbps)\b/i,
      );
    const priceMatch = segment.match(
      /(?:^|\s)(\d{1,5}(?:[.,]\d{1,2})?)\s*грн(?=\s|[/.,;:)]|$)/i,
    );
    const promoDurationMatch = segment.match(
      /\b(?:протягом|перші|перших)\s+(\d{1,2})\s+місяц/i,
    );

    if (!speedMatch && !priceMatch) {
      continue;
    }

    const downloadMbps = speedMatch ? Number(speedMatch[1]) : null;
    const price = priceMatch ? money(priceMatch[1]) : null;
    const promoDurationMonths = promoDurationMatch
      ? Number(promoDurationMatch[1])
      : null;

    const plan = {
      name,
      download_mbps: downloadMbps,
      technology: inferPlanTechnology(name),
      monthly_price: promoDurationMonths ? null : price,
      promo_price: promoDurationMonths ? price : null,
      promo_duration_months: promoDurationMonths,
      price_after_promo: null,
      evidence_marker: match[0],
    };

    const key = [
      plan.name.toLocaleLowerCase(),
      plan.download_mbps ?? "",
      plan.monthly_price?.amount ?? "",
      plan.promo_price?.amount ?? "",
    ].join("|");

    if (!plans.has(key)) {
      plans.set(key, plan);
    }
  }

  return [...plans.values()];
}

function extractTechnologyLabels(
  text: string,
): TechnologyObservation["payload"]["technologies"] {
  const normalized = normalizedEvidenceText(text);
  const patterns: Array<{
    pattern: RegExp;
    technology: "gpon" | "xpon" | "ftth";
    label: string;
  }> = [
    { pattern: /\bxgpon\b/, technology: "xpon", label: "XGPON" },
    { pattern: /\bgpon\b/, technology: "gpon", label: "GPON" },
    { pattern: /\bxpon\b/, technology: "xpon", label: "XPON" },
    { pattern: /\bftth\b/, technology: "ftth", label: "FTTH" },
    { pattern: /\bpon\b/, technology: "xpon", label: "PON" },
  ];

  const found = new Map<
    string,
    TechnologyObservation["payload"]["technologies"][number]
  >();

  for (const candidate of patterns) {
    if (!candidate.pattern.test(normalized)) continue;

    const existing = found.get(candidate.technology);

    // Prefer a more specific observed label over generic PON.
    if (!existing || existing.observed_label === "PON") {
      found.set(candidate.technology, {
        technology: candidate.technology,
        observed_label: candidate.label,
        evidence_marker: candidate.label,
      });
    }
  }

  return [...found.values()];
}

function invalidForSnapshot(
  schemaName:
    | "plan-observation"
    | "technology-observation"
    | "coverage-entrypoint-observation",
  source: SourceDefinition,
  snapshot: SnapshotRecord,
  pageTitle: string | null,
  code: string,
): DomainExtractionResult {
  const common = {
    ...baseObservation(),
    schema_name: schemaName,
    validation_status: "invalid" as const,
    validation_errors: [{ code }],
  };

  if (schemaName === "plan-observation") {
    return {
      observation: {
        ...common,
        schema_name: schemaName,
        payload: {
          schema_version: "plan-observation.v1",
          source_slug: source.slug,
          url: snapshot.final_url,
          page_title: pageTitle,
          plans: [],
        },
      },
      claims: [],
    };
  }

  if (schemaName === "technology-observation") {
    return {
      observation: {
        ...common,
        schema_name: schemaName,
        payload: {
          schema_version: "technology-observation.v1",
          source_slug: source.slug,
          url: snapshot.final_url,
          page_title: pageTitle,
          technologies: [],
        },
      },
      claims: [],
    };
  }

  return {
    observation: {
      ...common,
      schema_name: schemaName,
      payload: {
        schema_version: "coverage-entrypoint-observation.v1",
        source_slug: source.slug,
        url: snapshot.final_url,
        page_title: pageTitle,
        checker_kind: "address",
        checker_url: snapshot.final_url,
        geographic_hint: null,
        evidence_marker: null,
      },
    },
    claims: [],
  };
}

export async function extractDomainEvidence(
  bucket: R2Bucket,
  source: SourceDefinition,
  snapshot: SnapshotRecord,
  classification: string,
): Promise<DomainExtractionResult | null> {
  const object = await bucket.get(snapshot.body_ref);
  if (!object) throw new Error("snapshot_body_missing");

  const html = decodeSnapshotBody(
    await object.arrayBuffer(),
    snapshot.content_type,
  );
  const pageTitle = extractHtmlTitle(html);
  const text = htmlToText(html);
  const primaryText = htmlToPrimaryText(html);

  const successful =
    snapshot.http_status >= 200 && snapshot.http_status < 400;
  const isHtml =
    snapshot.content_type?.toLocaleLowerCase().includes("text/html") ?? false;

  if (classification === "plans") {
    if (!successful) {
      return invalidForSnapshot(
        "plan-observation",
        source,
        snapshot,
        pageTitle,
        "http_status_not_successful",
      );
    }
    if (!isHtml) {
      return invalidForSnapshot(
        "plan-observation",
        source,
        snapshot,
        pageTitle,
        "content_type_not_html",
      );
    }

    const plans = extractPlans(text);
    const observation: PlanObservation = {
      ...baseObservation(),
      schema_name: "plan-observation",
      validation_status: plans.length > 0 ? "valid" : "partial",
      validation_errors:
        plans.length > 0 ? [] : [{ code: "no_plan_cards_extracted" }],
      payload: {
        schema_version: "plan-observation.v1",
        source_slug: source.slug,
        url: snapshot.final_url,
        page_title: pageTitle,
        plans,
      },
    };

    return {
      observation,
      claims:
        observation.validation_status === "valid"
          ? plans.map((plan) => ({
              predicate: "plan.catalog_entry",
              value: {
                name: plan.name,
                download_mbps: plan.download_mbps,
                technology: plan.technology,
                monthly_price: plan.monthly_price,
                promo_price: plan.promo_price,
                promo_duration_months: plan.promo_duration_months,
                price_after_promo: plan.price_after_promo,
              },
              extraction_confidence:
                plan.download_mbps !== null &&
                (plan.monthly_price !== null || plan.promo_price !== null)
                  ? 0.94
                  : 0.86,
              evidence_marker: plan.evidence_marker,
            }))
          : [],
    };
  }

  if (classification === "technology") {
    if (!successful) {
      return invalidForSnapshot(
        "technology-observation",
        source,
        snapshot,
        pageTitle,
        "http_status_not_successful",
      );
    }
    if (!isHtml) {
      return invalidForSnapshot(
        "technology-observation",
        source,
        snapshot,
        pageTitle,
        "content_type_not_html",
      );
    }

    const technologies = extractTechnologyLabels(primaryText);
    const observation: TechnologyObservation = {
      ...baseObservation(),
      schema_name: "technology-observation",
      validation_status: technologies.length > 0 ? "valid" : "partial",
      validation_errors:
        technologies.length > 0
          ? []
          : [{ code: "no_supported_technology_marker" }],
      payload: {
        schema_version: "technology-observation.v1",
        source_slug: source.slug,
        url: snapshot.final_url,
        page_title: pageTitle,
        technologies,
      },
    };

    return {
      observation,
      claims:
        observation.validation_status === "valid"
          ? technologies.map((technology) => ({
              predicate: "service.technology",
              value: {
                technology: technology.technology,
                observed_label: technology.observed_label,
              },
              extraction_confidence: 0.96,
              evidence_marker: technology.evidence_marker,
            }))
          : [],
    };
  }

  if (classification === "coverage") {
    if (!successful) {
      return invalidForSnapshot(
        "coverage-entrypoint-observation",
        source,
        snapshot,
        pageTitle,
        "http_status_not_successful",
      );
    }
    if (!isHtml) {
      return invalidForSnapshot(
        "coverage-entrypoint-observation",
        source,
        snapshot,
        pageTitle,
        "content_type_not_html",
      );
    }

    const normalized = normalizedEvidenceText(text);
    const marker =
      text.match(/карта\s+покриття/i)?.[0] ??
      text.match(/перевір[^.]{0,80}адрес/i)?.[0] ??
      null;
    const checkerDetected =
      marker !== null ||
      /\/map\/?$/i.test(new URL(snapshot.final_url).pathname);
    const geographicHint = normalized.includes("київ") ? "Київ" : null;

    const observation: CoverageEntrypointObservation = {
      ...baseObservation(),
      schema_name: "coverage-entrypoint-observation",
      validation_status: checkerDetected ? "valid" : "partial",
      validation_errors: checkerDetected
        ? []
        : [{ code: "address_checker_marker_not_found" }],
      payload: {
        schema_version: "coverage-entrypoint-observation.v1",
        source_slug: source.slug,
        url: snapshot.final_url,
        page_title: pageTitle,
        checker_kind: "address",
        checker_url: snapshot.final_url,
        geographic_hint: geographicHint,
        evidence_marker: marker,
      },
    };

    return {
      observation,
      claims:
        observation.validation_status === "valid"
          ? [
              {
                predicate: "coverage.checker_entrypoint",
                value: {
                  url: snapshot.final_url,
                  scope: "address",
                  geographic_hint: geographicHint,
                },
                extraction_confidence: 0.98,
                evidence_marker: marker ?? snapshot.final_url,
              },
            ]
          : [],
    };
  }

  return null;
}
