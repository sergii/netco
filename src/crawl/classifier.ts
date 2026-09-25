export type PageClassification =
  | "plans"
  | "coverage"
  | "technology"
  | "connection"
  | "contacts"
  | "about_legal"
  | "faq_support"
  | "account"
  | "unknown";

export interface ClassifiedLink {
  url: string;
  host: string;
  path: string;
  anchor_text: string | null;
  classification: PageClassification;
  relevance_score: number;
  crawl_candidate: boolean;
  matched_terms: string[];
}

interface Rule {
  classification: PageClassification;
  score: number;
  terms: readonly string[];
}

const RULES: readonly Rule[] = [
  {
    classification: "plans",
    score: 95,
    terms: [
      "tariff",
      "tariffs",
      "pricing",
      "price",
      "plans",
      "plan",
      "тариф",
      "тарифи",
      "ціни",
      "цены",
      "пакет",
    ],
  },
  {
    classification: "coverage",
    score: 95,
    terms: [
      "coverage",
      "availability",
      "check-address",
      "address-check",
      "покрит",
      "доступн",
      "адрес",
    ],
  },
  {
    classification: "technology",
    score: 90,
    terms: [
      "gpon",
      "xpon",
      "xgpon",
      "pon",
      "fiber",
      "fibre",
      "ftth",
      "оптик",
      "технолог",
    ],
  },
  {
    classification: "connection",
    score: 85,
    terms: [
      "connect",
      "connection",
      "order",
      "install",
      "підключ",
      "подключ",
      "заявк",
    ],
  },
  {
    classification: "contacts",
    score: 75,
    terms: ["contact", "contacts", "контакт"],
  },
  {
    classification: "about_legal",
    score: 70,
    terms: [
      "about",
      "company",
      "legal",
      "license",
      "documents",
      "про-нас",
      "про_нас",
      "компан",
      "ліценз",
      "лиценз",
      "реквіз",
      "реквиз",
      "документ",
    ],
  },
  {
    classification: "faq_support",
    score: 65,
    terms: [
      "faq",
      "support",
      "help",
      "knowledge",
      "підтрим",
      "поддерж",
      "допомог",
      "помощ",
    ],
  },
  {
    classification: "account",
    score: 20,
    terms: [
      "login",
      "logout",
      "billing",
      "account",
      "cabinet",
      "stat",
      "кабінет",
      "кабинет",
      "оплата",
      "payment",
    ],
  },
];

function searchable(url: URL, anchorText: string | null): string {
  const raw = [
    url.hostname,
    url.pathname,
    url.search,
    anchorText ?? "",
  ].join(" ");

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Malformed percent-encoding is evidence too; classification can use raw text.
  }

  return decoded
    .toLocaleLowerCase()
    .replace(/[._/+?=&%-]+/g, " ");
}

const EXACT_TOKEN_TERMS = new Set([
  "pon",
  "gpon",
  "xpon",
  "xgpon",
  "ftth",
]);

function matchesTerm(
  haystack: string,
  tokens: ReadonlySet<string>,
  term: string,
): boolean {
  const normalized = term.toLocaleLowerCase();

  if (EXACT_TOKEN_TERMS.has(normalized)) {
    return tokens.has(normalized);
  }

  return haystack.includes(normalized);
}

export function classifyDiscoveredLink(
  url: URL,
  anchorText: string | null,
): ClassifiedLink {
  const haystack = searchable(url, anchorText);
  const tokens = new Set(
    haystack.split(/\s+/).filter(Boolean),
  );

  for (const rule of RULES) {
    const matchedTerms = rule.terms.filter((term) =>
      matchesTerm(haystack, tokens, term),
    );

    if (matchedTerms.length > 0) {
      return {
        url: url.toString(),
        host: url.hostname.toLowerCase(),
        path: url.pathname,
        anchor_text: anchorText,
        classification: rule.classification,
        relevance_score: rule.score,
        crawl_candidate: rule.score >= 60 && rule.classification !== "account",
        matched_terms: matchedTerms,
      };
    }
  }

  return {
    url: url.toString(),
    host: url.hostname.toLowerCase(),
    path: url.pathname,
    anchor_text: anchorText,
    classification: "unknown",
    relevance_score: 10,
    crawl_candidate: false,
    matched_terms: [],
  };
}
