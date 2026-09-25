export interface SourceDefinition {
  id: string;
  subject_id: string;
  provider_id: string;
  slug: string;
  provider_slug: string;
  kind: "official_website" | "address_checker";
  name: string;
  canonical_url: string;
  provider_candidate_name: string | null;
  identity_markers: readonly string[];
  collection_enabled: boolean;
  crawl_hosts: readonly string[];
  crawl_page_budget: number;
}

export const SOURCES: readonly SourceDefinition[] = [
  {
    id: "5fa2a53c-9df0-4c44-a54e-8a58af59730c",
    subject_id: "6caf6ed2-e26b-4d59-bae8-b2805e6edafe",
    provider_id: "a4e1b0ef-32f3-4d92-9a38-ef36c87c3a40",
    slug: "teremki",
    provider_slug: "teremki",
    kind: "official_website",
    name: "Teremki@LAN official website",
    canonical_url: "https://www.teremki.net.ua/",
    provider_candidate_name: "Teremki@LAN",
    identity_markers: ["teremki", "Teremki@LAN", "ТЕРЕМКИ"],
    collection_enabled: false,
    crawl_hosts: ["teremki.net.ua", "www.teremki.net.ua", "stat.teremki.net.ua"],
    crawl_page_budget: 2,
  },
  {
    id: "eebfc808-4e2d-4bc8-af56-676b413a53ab",
    subject_id: "6caf6ed2-e26b-4d59-bae8-b2805e6edafe",
    provider_id: "a4e1b0ef-32f3-4d92-9a38-ef36c87c3a40",
    slug: "teremki-billing",
    provider_slug: "teremki",
    kind: "official_website",
    name: "Teremki@LAN billing",
    canonical_url: "https://stat.teremki.net.ua/login.php",
    provider_candidate_name: "Teremki@LAN",
    identity_markers: ["teremki", "Teremki@LAN", "ТЕРЕМКИ"],
    collection_enabled: false,
    crawl_hosts: ["teremki.net.ua", "www.teremki.net.ua", "stat.teremki.net.ua"],
    crawl_page_budget: 2,
  },
  {
    id: "027a5f15-9feb-45c7-84a3-6c32d8f066bc",
    subject_id: "820ee63f-3b2e-4b34-b1d5-3cc7bceab64d",
    provider_id: "4bf8f950-5943-4f43-a820-457de9d4beef",
    slug: "lanet-coverage",
    provider_slug: "lanet",
    kind: "address_checker",
    name: "Lanet official coverage checker",
    canonical_url: "https://www.lanet.ua/map/",
    provider_candidate_name: "Мережа Ланет",
    identity_markers: ["lanet", "Мережа Ланет", "Ланет"],
    collection_enabled: false,
    crawl_hosts: ["lanet.ua", "www.lanet.ua"],
    crawl_page_budget: 0,
  },
  {
    id: "0d3a76b0-57d8-4b8e-b743-7d87b79f8c89",
    subject_id: "820ee63f-3b2e-4b34-b1d5-3cc7bceab64d",
    provider_id: "4bf8f950-5943-4f43-a820-457de9d4beef",
    slug: "lanet",
    provider_slug: "lanet",
    kind: "official_website",
    name: "Lanet official website",
    canonical_url: "https://www.lanet.ua/",
    provider_candidate_name: "Мережа Ланет",
    identity_markers: ["lanet", "Мережа Ланет", "Ланет"],
    collection_enabled: false,
    crawl_hosts: ["lanet.ua", "www.lanet.ua"],
    crawl_page_budget: 5,
  },
];

export function collectionEnabledSources(): readonly SourceDefinition[] {
  return SOURCES.filter((source) => source.collection_enabled);
}

export function findSource(slug: string): SourceDefinition | undefined {
  return SOURCES.find((source) => source.slug === slug);
}
