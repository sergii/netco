import { cellToBoundary, latLngToCell } from "h3-js";
import {
  getCoveragePointRecords,
  type CoverageViewport,
} from "./coverage-points";

interface CellAccumulator {
  addressIds: Set<string>;
  freshAddressIds: Set<string>;
  providerIds: Set<string>;
  availabilityCount: number;
  technologies: Set<string>;
}

export async function getH3CoverageCellFeatureCollection(
  database: Hyperdrive,
  resolution: number,
  viewport: CoverageViewport | null = null,
): Promise<Record<string, unknown>> {
  const records = await getCoveragePointRecords(database, viewport);
  const cells = new Map<string, CellAccumulator>();

  for (const record of records) {
    if (
      record.latitude === null ||
      record.longitude === null ||
      !Number.isFinite(record.latitude) ||
      !Number.isFinite(record.longitude)
    ) {
      continue;
    }

    const h3Index = latLngToCell(
      record.latitude,
      record.longitude,
      resolution,
    );
    const cell = cells.get(h3Index) ?? {
      addressIds: new Set<string>(),
      freshAddressIds: new Set<string>(),
      providerIds: new Set<string>(),
      availabilityCount: 0,
      technologies: new Set<string>(),
    };

    cell.addressIds.add(record.address_id);
    if (record.has_fresh) {
      cell.freshAddressIds.add(record.address_id);
    }

    for (const providerId of record.provider_ids) {
      cell.providerIds.add(providerId);
    }

    for (const technology of record.technologies) {
      cell.technologies.add(technology);
    }

    cell.availabilityCount += record.availability_count;
    cells.set(h3Index, cell);
  }

  const features = [...cells.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([h3Index, cell]) => ({
      type: "Feature" as const,
      id: h3Index,
      geometry: {
        type: "Polygon" as const,
        coordinates: [cellToBoundary(h3Index, true)],
      },
      properties: {
        h3_index: h3Index,
        resolution,
        address_count: cell.addressIds.size,
        fresh_address_count: cell.freshAddressIds.size,
        provider_count: cell.providerIds.size,
        availability_count: cell.availabilityCount,
        technologies: [...cell.technologies].sort(),
        source_point_ids: [...cell.addressIds].sort(),
      },
    }));

  return {
    type: "FeatureCollection",
    resolution,
    viewport,
    count: features.length,
    features,
  };
}
