import type { SourceDefinition } from "../domain/source";

export const SOURCES: readonly SourceDefinition[] = [
  {
    id: "5fa2a53c-9df0-4c44-a54e-8a58af59730c",
    slug: "teremki",
    kind: "official_website",
    name: "Teremki@LAN official website",
    canonicalUrl: "https://www.teremki.net.ua/",
    providerCandidateName: "Teremki@LAN",
  },
];

export function findSource(slug: string): SourceDefinition | undefined {
  return SOURCES.find((source) => source.slug === slug);
}
