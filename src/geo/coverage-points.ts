import { withPostgresClient } from "../db/postgres";

export type CoverageGeometryFilter = "all" | "present" | "missing";

export interface CoverageViewport {
  west: number;
  south: number;
  east: number;
  north: number;
}

export async function getCoveragePointFeatureCollection(
  database: Hyperdrive,
  geometryFilter: CoverageGeometryFilter = "all",
  viewport: CoverageViewport | null = null,
): Promise<Record<string, unknown>> {
  return withPostgresClient(database, async (client) => {
    const result = await client.query<{
      address_id: string;
      country_code: string;
      region: string | null;
      city: string;
      district: string | null;
      street: string;
      house_number: string;
      corpus: string | null;
      building_letter: string | null;
      postal_code: string | null;
      normalized_key: string;
      latitude: string | number | null;
      longitude: string | number | null;
      provider_count: string | number;
      availability_count: string | number;
      technologies: string[];
      latest_observed_at: Date | string;
      has_fresh: boolean;
    }>(
      `
        SELECT
          a.id AS address_id,
          a.country_code,
          a.region,
          a.city,
          a.district,
          a.street,
          a.house_number,
          a.corpus,
          a.building_letter,
          a.postal_code,
          a.normalized_key,
          a.latitude,
          a.longitude,
          count(DISTINCT paa.provider_id) AS provider_count,
          count(*) AS availability_count,
          array_agg(DISTINCT paa.technology ORDER BY paa.technology)
            AS technologies,
          max(paa.observed_at) AS latest_observed_at,
          bool_or(
            paa.fresh_until IS NOT NULL
            AND paa.fresh_until > now()
          ) AS has_fresh
        FROM addresses a
        JOIN provider_address_availability paa
          ON paa.address_id = a.id
        WHERE (
          $1::boolean = false
          OR (
            a.latitude IS NOT NULL
            AND a.longitude IS NOT NULL
            AND a.longitude >= $2
            AND a.latitude >= $3
            AND a.longitude <= $4
            AND a.latitude <= $5
          )
        )
        GROUP BY
          a.id,
          a.country_code,
          a.region,
          a.city,
          a.district,
          a.street,
          a.house_number,
          a.corpus,
          a.building_letter,
          a.postal_code,
          a.normalized_key,
          a.latitude,
          a.longitude
        ORDER BY
          a.country_code,
          a.city,
          a.street,
          a.house_number,
          a.id
      `,
      [
        viewport !== null,
        viewport?.west ?? 0,
        viewport?.south ?? 0,
        viewport?.east ?? 0,
        viewport?.north ?? 0,
      ],
    );

    const features = result.rows
      .map((row) => {
        const latitude =
          row.latitude === null ? null : Number(row.latitude);
        const longitude =
          row.longitude === null ? null : Number(row.longitude);
        const hasGeometry =
          latitude !== null &&
          longitude !== null &&
          Number.isFinite(latitude) &&
          Number.isFinite(longitude);

        return {
          type: "Feature" as const,
          id: row.address_id,
          geometry: hasGeometry
            ? {
                type: "Point" as const,
                coordinates: [longitude, latitude],
              }
            : null,
          properties: {
            address_id: row.address_id,
            normalized_key: row.normalized_key,
            country_code: row.country_code,
            region: row.region,
            city: row.city,
            district: row.district,
            street: row.street,
            house_number: row.house_number,
            corpus: row.corpus,
            building_letter: row.building_letter,
            postal_code: row.postal_code,
            geometry_state: hasGeometry ? "present" : "missing",
            freshness_state: row.has_fresh ? "fresh" : "stale",
            provider_count: Number(row.provider_count),
            availability_count: Number(row.availability_count),
            technologies: row.technologies,
            latest_observed_at: new Date(
              row.latest_observed_at,
            ).toISOString(),
          },
        };
      })
      .filter((feature) => {
        if (geometryFilter === "all") return true;

        return geometryFilter === "present"
          ? feature.geometry !== null
          : feature.geometry === null;
      });

    const geocodedCount = features.filter(
      (feature) => feature.geometry !== null,
    ).length;

    return {
      type: "FeatureCollection",
      geometry_filter: geometryFilter,
      viewport,
      count: features.length,
      summary: {
        geometry_present: geocodedCount,
        geometry_missing: features.length - geocodedCount,
      },
      features,
    };
  });
}
