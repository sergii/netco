import {
  cellToBoundary,
  latLngToCell,
} from "h3-js";
import {
  getCoveragePointFeatureCollection,
  type CoverageViewport,
} from "./coverage-points";

interface CoveragePointProperties {
  address_id: string;
  freshness_state: "fresh" | "stale";
  provider_ids: string[];
  availability_count: number;
  technologies: string[];
}

interface CoveragePointFeature {
  id: string;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: CoveragePointProperties;
}

interface CoveragePointCollection {
  features: CoveragePointFeature[];
}

interface H3CellAccumulator {
  h3_index: string;
  point_ids: Set<string>;
  provider_ids: Set<string>;
  technologies: Set<string>;
  availability_count: number;
  fresh_address_count: number;
}

export async function getCoverageH3CellFeatureCollection(
  database: Hyperdrive,
  resolution: number,
  viewport: CoverageViewport | null = null,
): Promise<Record<string, unknown>> {
  const pointCollection = (await getCoveragePointFeatureCollection(
    database,
    "present",
    viewport,
  )) as unknown as CoveragePointCollection;

  const cells = new Map<string, H3CellAccumulator>();

  for (const point of pointCollection.features) {
    const [longitude, latitude] = point.geometry.coordinates;
    const h3Index = latLngToCell(
      latitude,
      longitude,
      resolution,
    );

    const cell = cells.get(h3Index) ?? {
      h3_index: h3Index,
      point_ids: new Set<string>(),
      provider_ids: new Set<string>(),
      technologies: new Set<string>(),
      availability_count: 0,
      fresh_address_count: 0,
    };

    cell.point_ids.add(point.id);

    for (const providerId of point.properties.provider_ids ?? []) {
      cell.provider_ids.add(providerId);
    }

    for (const technology of point.properties.technologies ?? []) {
      cell.technologies.add(technology);
    }

    cell.availability_count +=
      Number(point.properties.availability_count) || 0;

    if (point.properties.freshness_state === "fresh") {
      cell.fresh_address_count += 1;
    }

    cells.set(h3Index, cell);
  }

  const features = [...cells.values()]
    .sort((left, right) =>
      left.h3_index.localeCompare(right.h3_index),
    )
    .map((cell) => ({
      type: "Feature" as const,
      id: cell.h3_index,
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          cellToBoundary(cell.h3_index, true),
        ],
      },
      properties: {
        h3_index: cell.h3_index,
        resolution,
        address_count: cell.point_ids.size,
        fresh_address_count: cell.fresh_address_count,
        provider_count: cell.provider_ids.size,
        availability_count: cell.availability_count,
        technologies: [...cell.technologies].sort(),
        source_point_ids: [...cell.point_ids].sort(),
      },
    }));

  return {
    type: "FeatureCollection",
    aggregation: "h3",
    resolution,
    viewport,
    count: features.length,
    features,
  };
}
