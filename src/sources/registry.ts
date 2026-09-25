export interface SourceDefinition {
  id: string;
  slug: string;
  kind: "official_website";
  name: string;
  canonical_url: string;
  provider_candidate_name: string | null;
}

export const SOURCES: readonly SourceDefinition[] = [
  {
    id: "5fa2a53c-9df0-4c44-a54e-8a58af59730c",
    slug: "teremki",
    kind: "official_website",
    name: "Teremki@LAN official website",
    canonical_url: "https://www.teremki.net.ua/",
    provider_candidate_name: "Teremki@LAN",
  },
];

export function findSource(slug: string): SourceDefinition | undefined {
  return SOURCES.find((source) => source.slug === slug);
}
