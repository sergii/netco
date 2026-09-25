import type { SnapshotRecord } from "../evidence/snapshot";
import { findSource } from "../sources/registry";
import { ensureAddress } from "./address";
import { LANET_ACCEPTANCE_FIXTURE } from "./interaction-probe";
import { classifyLanetCoverageResult } from "./lanet-classifier";
import {
  persistCoverageOrderability,
  rebuildProviderAddressAvailability,
  type CoverageOrderabilityObservation,
} from "./orderability";
import { getLatestCoverageCheckerInteractionProbe } from "./store";

const SOURCE_SLUG = "lanet-coverage";

interface InteractionArtifact {
  schema_version?: string;
  source_slug?: string;
  provider_slug?: string;
  body_text?: string;
}

export interface LanetOrderabilityMaterializationResult {
  status:
    | "materialized"
    | "interaction_unavailable"
    | "source_unavailable"
    | "snapshot_unavailable";
  snapshot_id: string | null;
  observation_id: string | null;
  claim_id: string | null;
  result: "orderable" | "unavailable" | "needs_verification" | null;
  projection_rows: number;
}

async function readJson<T>(
  bucket: R2Bucket,
  key: string,
): Promise<T | null> {
  const object = await bucket.get(key);
  if (!object) return null;

  return JSON.parse(await object.text()) as T;
}

export async function materializeLanetCoverageOrderability(
  bucket: R2Bucket,
  database: Hyperdrive,
): Promise<LanetOrderabilityMaterializationResult> {
  const source = findSource(SOURCE_SLUG);

  if (!source) {
    return {
      status: "source_unavailable",
      snapshot_id: null,
      observation_id: null,
      claim_id: null,
      result: null,
      projection_rows: 0,
    };
  }

  const interaction = await getLatestCoverageCheckerInteractionProbe(
    database,
    source.id,
  );

  if (!interaction || interaction.validation_status !== "valid") {
    return {
      status: "interaction_unavailable",
      snapshot_id: interaction?.snapshot_id ?? null,
      observation_id: null,
      claim_id: null,
      result: null,
      projection_rows: 0,
    };
  }

  const snapshot = await readJson<SnapshotRecord>(
    bucket,
    `snapshots/${interaction.snapshot_id}.json`,
  );

  if (!snapshot || snapshot.source_id !== source.id) {
    return {
      status: "snapshot_unavailable",
      snapshot_id: interaction.snapshot_id,
      observation_id: null,
      claim_id: null,
      result: null,
      projection_rows: 0,
    };
  }

  const artifact = await readJson<InteractionArtifact>(
    bucket,
    snapshot.body_ref,
  );

  if (
    !artifact ||
    artifact.schema_version !==
      "coverage-checker-interaction-artifact.v1" ||
    artifact.source_slug !== source.slug ||
    typeof artifact.body_text !== "string"
  ) {
    return {
      status: "snapshot_unavailable",
      snapshot_id: snapshot.id,
      observation_id: null,
      claim_id: null,
      result: null,
      projection_rows: 0,
    };
  }

  const address = await ensureAddress(
    database,
    LANET_ACCEPTANCE_FIXTURE,
  );
  const classification = classifyLanetCoverageResult(
    artifact.body_text,
    LANET_ACCEPTANCE_FIXTURE.house_number,
  );

  const observation: CoverageOrderabilityObservation = {
    id: crypto.randomUUID(),
    schema_name: "coverage-orderability-observation",
    schema_version: "1",
    extractor: "browser-run-address-checker",
    extractor_version: "1",
    normalizer_version: "1",
    extracted_at: new Date().toISOString(),
    validation_status: "valid",
    validation_errors: [],
    payload: {
      schema_version: "coverage-orderability-observation.v1",
      source_slug: source.slug,
      provider_slug: source.provider_slug,
      checker_url: source.canonical_url,
      address_id: address.id,
      address: {
        country_code: address.country_code,
        city: address.city,
        street: address.street,
        house_number: address.house_number,
        corpus: address.corpus,
        building_letter: address.building_letter,
        normalized_key: address.normalized_key,
        display: address.display,
      },
      result: classification.result,
      service_kind: "internet",
      technologies: classification.technologies,
      evidence_markers: classification.evidence_markers,
      confidence: classification.confidence,
    },
  };

  const persisted = await persistCoverageOrderability(
    database,
    source,
    snapshot,
    address,
    observation,
  );

  const projectionRows =
    persisted.claim_id === null
      ? 0
      : await rebuildProviderAddressAvailability(
          database,
          source,
          address.id,
        );

  console.log("coverage_orderability_materialized", {
    source: source.slug,
    snapshot_id: snapshot.id,
    observation_id: persisted.observation_id,
    claim_id: persisted.claim_id,
    result: classification.result,
    technologies: classification.technologies,
    projection_rows: projectionRows,
    inserted: persisted.inserted,
  });

  return {
    status: "materialized",
    snapshot_id: snapshot.id,
    observation_id: persisted.observation_id,
    claim_id: persisted.claim_id,
    result: classification.result,
    projection_rows: projectionRows,
  };
}
