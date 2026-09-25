import { withPostgresClient } from "../db/postgres";

export interface AddressInput {
  country_code: string;
  region?: string | null;
  city: string;
  district?: string | null;
  street: string;
  house_number: string;
  corpus?: string | null;
  building_letter?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface NormalizedAddress {
  country_code: string;
  region: string | null;
  city: string;
  district: string | null;
  street: string;
  house_number: string;
  corpus: string | null;
  building_letter: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  normalized_key: string;
  display: string;
}

export interface PersistedAddress extends NormalizedAddress {
  id: string;
}

function clean(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function keyPart(value: string | null): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("uk-UA")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedStreetForKey(value: string): string {
  return keyPart(value)
    .replace(
      /^(?:вулиця|вул\.?|проспект|просп\.?|пр-т|провулок|пров\.?|бульвар|бул\.?)\s+/u,
      "",
    )
    .trim();
}

function normalizedHouseForKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleUpperCase("uk-UA")
    .replace(/\s+/g, "")
    .replace(/[\u2010-\u2015]/g, "-");
}

export function normalizeAddress(input: AddressInput): NormalizedAddress {
  const countryCode = clean(input.country_code)?.toUpperCase();
  const city = clean(input.city);
  const street = clean(input.street);
  const houseNumber = clean(input.house_number);

  if (!countryCode || countryCode.length !== 2) {
    throw new Error("address_country_code_invalid");
  }
  if (!city) throw new Error("address_city_required");
  if (!street) throw new Error("address_street_required");
  if (!houseNumber) throw new Error("address_house_number_required");

  const region = clean(input.region);
  const district = clean(input.district);
  const corpus = clean(input.corpus);
  const buildingLetter = clean(input.building_letter);
  const postalCode = clean(input.postal_code);
  const latitude = input.latitude ?? null;
  const longitude = input.longitude ?? null;

  if (
    (latitude === null) !== (longitude === null) ||
    (latitude !== null && (latitude < -90 || latitude > 90)) ||
    (longitude !== null && (longitude < -180 || longitude > 180))
  ) {
    throw new Error("address_coordinates_invalid");
  }

  const normalizedKey = [
    countryCode.toLocaleLowerCase(),
    keyPart(region),
    keyPart(city),
    normalizedStreetForKey(street),
    normalizedHouseForKey(houseNumber).toLocaleLowerCase("uk-UA"),
    keyPart(corpus),
    keyPart(buildingLetter),
  ].join("|");

  const house = [houseNumber, corpus, buildingLetter]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return {
    country_code: countryCode,
    region,
    city,
    district,
    street,
    house_number: houseNumber,
    corpus,
    building_letter: buildingLetter,
    postal_code: postalCode,
    latitude,
    longitude,
    normalized_key: normalizedKey,
    display: `${city}, ${street}, ${house}`,
  };
}

export async function ensureAddress(
  database: Hyperdrive,
  input: AddressInput,
): Promise<PersistedAddress> {
  const normalized = normalizeAddress(input);

  return withPostgresClient(database, async (client) => {
    await client.query("BEGIN");

    try {
      const existing = await client.query<{ id: string }>(
        `
          SELECT id
          FROM addresses
          WHERE normalized_key = $1
          LIMIT 1
        `,
        [normalized.normalized_key],
      );

      if (existing.rows[0]) {
        await client.query("COMMIT");
        return { id: existing.rows[0].id, ...normalized };
      }

      const candidateId = crypto.randomUUID();

      await client.query(
        `
          INSERT INTO subjects (id, kind)
          VALUES ($1, 'address')
        `,
        [candidateId],
      );

      const inserted = await client.query<{ id: string }>(
        `
          INSERT INTO addresses (
            id,
            country_code,
            region,
            city,
            district,
            street,
            house_number,
            corpus,
            building_letter,
            postal_code,
            latitude,
            longitude,
            normalized_key
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13
          )
          ON CONFLICT (normalized_key)
          DO UPDATE SET normalized_key = EXCLUDED.normalized_key
          RETURNING id
        `,
        [
          candidateId,
          normalized.country_code,
          normalized.region,
          normalized.city,
          normalized.district,
          normalized.street,
          normalized.house_number,
          normalized.corpus,
          normalized.building_letter,
          normalized.postal_code,
          normalized.latitude,
          normalized.longitude,
          normalized.normalized_key,
        ],
      );

      const addressId = inserted.rows[0].id;

      if (addressId !== candidateId) {
        await client.query(
          `
            DELETE FROM subjects
            WHERE id = $1
          `,
          [candidateId],
        );
      }

      await client.query("COMMIT");

      return { id: addressId, ...normalized };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function findAddress(
  database: Hyperdrive,
  input: AddressInput,
): Promise<PersistedAddress | null> {
  const normalized = normalizeAddress(input);

  return withPostgresClient(database, async (client) => {
    const result = await client.query<{
      id: string;
      country_code: string;
      region: string | null;
      city: string;
      district: string | null;
      street: string;
      house_number: string;
      corpus: string | null;
      building_letter: string | null;
      postal_code: string | null;
      latitude: string | number | null;
      longitude: string | number | null;
      normalized_key: string;
    }>(
      `
        SELECT
          id,
          country_code,
          region,
          city,
          district,
          street,
          house_number,
          corpus,
          building_letter,
          postal_code,
          latitude,
          longitude,
          normalized_key
        FROM addresses
        WHERE normalized_key = $1
        LIMIT 1
      `,
      [normalized.normalized_key],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      country_code: row.country_code,
      region: row.region,
      city: row.city,
      district: row.district,
      street: row.street,
      house_number: row.house_number,
      corpus: row.corpus,
      building_letter: row.building_letter,
      postal_code: row.postal_code,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      normalized_key: row.normalized_key,
      display: normalized.display,
    };
  });
}
