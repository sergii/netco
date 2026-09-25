export interface SourceDefinition {
  id: string;
  subject_id: string;
  slug: string;
  kind: "official_website";
  name: string;
  canonical_url: string;
  provider_candidate_name: string | null;
  identity_markers: readonly string[];
}

export const SOURCES: readonly SourceDefinition[] = [
  {
    id: "5fa2a53c-9df0-4c44-a54e-8a58af59730c",
    subject_id: "6caf6ed2-e26b-4d59-bae8-b2805e6edafe",
    slug: "teremki",
    kind: "official_website",
    name: "Teremki@LAN official website",
    canonical_url: "https://www.teremki.net.ua/",
    provider_candidate_name: "Teremki@LAN",
    identity_markers: ["teremki", "Teremki@LAN", "ТЕРЕМКИ"],
  },
];

export function findSource(slug: string): SourceDefinition | undefined {
  return SOURCES.find((source) => source.slug === slug);
}
