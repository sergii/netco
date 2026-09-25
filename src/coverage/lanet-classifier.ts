import type { CoverageResult } from "./orderability";

export interface LanetCoverageClassification {
  result: CoverageResult;
  technologies: string[];
  evidence_markers: string[];
  confidence: number | null;
}

const ORDERABLE_MARKERS = [
  "Послуга Інтернет",
  "Доступна у всьому будинку",
  "Замовити підключення",
] as const;

const TECHNOLOGY_MARKERS = [
  ["GIG (мідна вита пара)", "gig"],
  ["XGPON (оптичне волокно)", "xgpon"],
] as const;

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("uk-UA")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function resultWindow(
  bodyText: string,
  houseNumber: string,
): string | null {
  const body = normalize(bodyText);
  const houseMarker = normalize(`б. ${houseNumber}`);
  const houseIndex = body.indexOf(houseMarker);

  if (houseIndex < 0) return null;

  const serviceMarker = normalize("Послуга Інтернет");
  const serviceIndex = body.indexOf(serviceMarker, houseIndex);

  if (serviceIndex < 0 || serviceIndex - houseIndex > 1_500) {
    return null;
  }

  const mapBoundary = body.indexOf(normalize("Leaflet |"), serviceIndex);
  const end =
    mapBoundary >= 0
      ? mapBoundary
      : Math.min(body.length, serviceIndex + 4_000);

  return body.slice(serviceIndex, end);
}

export function classifyLanetCoverageResult(
  bodyText: string,
  houseNumber: string,
): LanetCoverageClassification {
  const window = resultWindow(bodyText, houseNumber);

  if (!window) {
    return {
      result: "needs_verification",
      technologies: [],
      evidence_markers: [],
      confidence: null,
    };
  }

  const matchedOrderableMarkers = ORDERABLE_MARKERS.filter((marker) =>
    window.includes(normalize(marker)),
  );

  const technologies = TECHNOLOGY_MARKERS.filter(([marker]) =>
    window.includes(normalize(marker)),
  ).map(([, technology]) => technology);

  if (matchedOrderableMarkers.length === ORDERABLE_MARKERS.length) {
    return {
      result: "orderable",
      technologies,
      evidence_markers: [
        `б. ${houseNumber}`,
        ...matchedOrderableMarkers,
        ...TECHNOLOGY_MARKERS.filter(([marker]) =>
          window.includes(normalize(marker)),
        ).map(([marker]) => marker),
      ],
      confidence: 1,
    };
  }

  return {
    result: "needs_verification",
    technologies,
    evidence_markers: matchedOrderableMarkers,
    confidence: null,
  };
}
