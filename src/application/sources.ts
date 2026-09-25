import {
  SOURCES,
  findSource,
  type SourceDefinition,
} from "../sources/registry";
import {
  capabilityFailure,
  capabilityOk,
  type CapabilityResult,
} from "./result";

function serializeSource(source: SourceDefinition) {
  return {
    id: source.id,
    slug: source.slug,
    provider_id: source.provider_id,
    provider_slug: source.provider_slug,
    kind: source.kind,
    name: source.name,
    canonical_url: source.canonical_url,
    provider_candidate_name: source.provider_candidate_name,
  };
}

export function listSources(): {
  sources: Array<ReturnType<typeof serializeSource>>;
} {
  return {
    sources: SOURCES.map(serializeSource),
  };
}

export function getSource(
  sourceSlug: string,
): CapabilityResult<{
  source: ReturnType<typeof serializeSource>;
}> {
  const source = findSource(sourceSlug);

  if (!source) {
    return capabilityFailure("source_not_found", {
      source: sourceSlug,
    });
  }

  return capabilityOk({
    source: serializeSource(source),
  });
}

export function sourceEvidenceDescriptor(source: SourceDefinition) {
  return {
    id: source.id,
    slug: source.slug,
    name: source.name,
    canonical_url: source.canonical_url,
  };
}
