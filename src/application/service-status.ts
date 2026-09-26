import {
  getDatabaseStatus,
  type DatabaseStatus,
} from "../db/status";

export interface RuntimeBindingState {
  snapshots: boolean;
  database: boolean;
  browser: boolean;
}

function unavailableDatabaseStatus(): DatabaseStatus {
  return {
    reachable: false,
    schema_ready: false,
    required_tables: 0,
    content_length_column: false,
    projection_schema_ready: false,
    projection_tables: 0,
    coverage_schema_ready: false,
    coverage_tables: 0,
  };
}

export function getEvidencePipelineStatus(
  bindings: RuntimeBindingState,
) {
  return {
    ready: bindings.snapshots && bindings.database,
    bindings: {
      snapshots: bindings.snapshots,
      database: bindings.database,
    },
    pipeline: {
      snapshot_capture: bindings.snapshots,
      relational_index: bindings.database,
      observations: bindings.database,
      claims: bindings.database,
      provenance: bindings.snapshots && bindings.database,
      coverage_browser: bindings.browser,
    },
  };
}

export function getServiceMeta(bindings: RuntimeBindingState) {
  const evidence = getEvidencePipelineStatus(bindings);

  return {
    service: "netco",
    version: "0.1.0",
    stage: "map-cell-inspection-vs15",
    capabilities: {
      evidence: evidence.ready,
      snapshots: evidence.bindings.snapshots,
      database: evidence.bindings.database,
      sources: true,
      url_discovery: true,
      bounded_crawl: true,
      domain_extraction: true,
      source_backed_claims: true,
      provider_resolution: true,
      provider_projections: true,
      providers: true,
      coverage_checker_probe: false,
      coverage_checker_interaction: false,
      provider_collection_enabled: false,
      address_coverage: true,
      geo: true,
      geo_evidence_materialization: true,
      trusted_geo_source: "openstreetmap-nominatim-bounded-fixture",
      geo_viewport_query: true,
      h3_aggregation: true,
      map: true,
      map_cell_inspection: true,
      mcp: true,
    },
  };
}

export async function getEvidenceStatus(
  bindings: RuntimeBindingState,
  database?: Hyperdrive,
) {
  const evidence = getEvidencePipelineStatus(bindings);
  const databaseStatus = database
    ? await getDatabaseStatus(database)
    : unavailableDatabaseStatus();

  return {
    ...evidence,
    ready:
      evidence.bindings.snapshots &&
      databaseStatus.schema_ready,
    database: databaseStatus,
  };
}
