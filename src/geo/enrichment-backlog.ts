import { withPostgresClient } from "../db/postgres";

export async function getGeoEnrichmentBacklog(
  database: Hyperdrive,
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
        WHERE a.latitude IS NULL
           OR a.longitude IS NULL
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
          a.normalized_key
      `,
    );

    const ranked = result.rows
      .map((row) => ({
        address_id: row.address_id,
        normalized_key: row.normalized_key,
        address: {
          country_code: row.country_code,
          region: row.region,
          city: row.city,
          district: row.district,
          street: row.street,
          house_number: row.house_number,
          corpus: row.corpus,
          building_letter: row.building_letter,
          postal_code: row.postal_code,
        },
        reason: "geometry_missing",
        freshness_state: row.has_fresh ? "fresh" : "stale",
        provider_count: Number(row.provider_count),
        availability_count: Number(row.availability_count),
        technologies: row.technologies,
        latest_observed_at: new Date(
          row.latest_observed_at,
        ).toISOString(),
      }))
      .sort((left, right) => {
        const freshnessOrder =
          Number(right.freshness_state === "fresh") -
          Number(left.freshness_state === "fresh");
        if (freshnessOrder !== 0) return freshnessOrder;

        const providerOrder =
          right.provider_count - left.provider_count;
        if (providerOrder !== 0) return providerOrder;

        const availabilityOrder =
          right.availability_count - left.availability_count;
        if (availabilityOrder !== 0) return availabilityOrder;

        return left.normalized_key.localeCompare(
          right.normalized_key,
          "uk",
        );
      })
      .map((item, index) => ({
        priority: index + 1,
        ...item,
      }));

    return {
      count: ranked.length,
      items: ranked,
    };
  });
}
