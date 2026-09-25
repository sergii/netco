import { withPostgresClient } from "../db/postgres";
import type { SnapshotRecord } from "../evidence/snapshot";
import type { SourceDefinition } from "../sources/registry";
import type { PersistedAddress } from "./address";

const PROJECTION_VERSION = "address-availability/v1";
const FRESHNESS_MS = 24 * 60 * 60 * 1000;

export type CoverageResult =
  | "orderable"
  | "unavailable"
  | "needs_verification";

export interface CoverageOrderabilityObservation {
  id: string;
  schema_name: "coverage-orderability-observation";
  schema_version: "1";
  extractor: "browser-run-address-checker";
  extractor_version: "1";
  normalizer_version: "1";
  extracted_at: string;
  validation_status: "valid" | "partial" | "invalid";
  validation_errors: Array<{ code: string }>;
  payload: {
    schema_version: "coverage-orderability-observation.v1";
    source_slug: string;
    provider_slug: string;
    checker_url: string;
    address_id: string;
    address: {
      country_code: string;
      city: string;
      street: string;
      house_number: string;
      corpus: string | null;
      building_letter: string | null;
      normalized_key: string;
      display: string;
    };
    result: CoverageResult;
    service_kind: "internet";
    technologies: string[];
    evidence_markers: string[];
    confidence: number | null;
  };
}

export interface PersistCoverageOrderabilityResult {
  observation_id: string;
  claim_id: string | null;
  inserted: boolean;
}

function coverageClaimValue(
  observation: CoverageOrderabilityObservation,
): Record<string, unknown> | null {
  if (observation.validation_status !== "valid") return null;

  if (observation.payload.result === "needs_verification") {
    return null;
  }

  return {
    value: observation.payload.result === "orderable",
    state: observation.payload.result,
    service_kind: observation.payload.service_kind,
    technologies: observation.payload.technologies,
  };
}

export async function persistCoverageOrderability(
  database: Hyperdrive,
  source: SourceDefinition,
  snapshot: SnapshotRecord,
  address: PersistedAddress,
  observation: CoverageOrderabilityObservation,
): Promise<PersistCoverageOrderabilityResult> {
  return withPostgresClient(database, async (client) => {
    await client.query("BEGIN");

    try {
      const inserted = await client.query<{ id: string }>(
        `
          INSERT INTO observations (
            id,
            source_snapshot_id,
            schema_name,
            schema_version,
            extractor,
            extractor_version,
            normalizer_version,
            extracted_at,
            payload,
            validation_status,
            validation_errors
          )
          SELECT
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8::timestamptz,
            $9::jsonb,
            $10,
            $11::jsonb
          WHERE NOT EXISTS (
            SELECT 1
            FROM observations
            WHERE source_snapshot_id = $2
              AND schema_name = $3
              AND extractor = $5
              AND extractor_version = $6
          )
          RETURNING id
        `,
        [
          observation.id,
          snapshot.id,
          observation.schema_name,
          observation.schema_version,
          observation.extractor,
          observation.extractor_version,
          observation.normalizer_version,
          observation.extracted_at,
          JSON.stringify(observation.payload),
          observation.validation_status,
          JSON.stringify(observation.validation_errors),
        ],
      );

      const insertedRow = inserted.rows[0];
      if (!insertedRow) {
        const existing = await client.query<{
          id: string;
          claim_id: string | null;
        }>(
          `
            SELECT
              o.id,
              (
                SELECT c.id
                FROM claims c
                WHERE c.observation_id = o.id
                  AND c.predicate = 'coverage.orderable'
                ORDER BY c.created_at DESC
                LIMIT 1
              ) AS claim_id
            FROM observations o
            WHERE o.source_snapshot_id = $1
              AND o.schema_name = $2
              AND o.extractor = $3
              AND o.extractor_version = $4
            ORDER BY o.extracted_at DESC
            LIMIT 1
          `,
          [
            snapshot.id,
            observation.schema_name,
            observation.extractor,
            observation.extractor_version,
          ],
        );

        const row = existing.rows[0];
        if (!row) {
          throw new Error("coverage_observation_persistence_failed");
        }

        await client.query("COMMIT");
        return {
          observation_id: row.id,
          claim_id: row.claim_id,
          inserted: false,
        };
      }

      const claimValue = coverageClaimValue(observation);
      let claimId: string | null = null;

      if (claimValue) {
        claimId = crypto.randomUUID();

        await client.query(
          `
            INSERT INTO claims (
              id,
              subject_id,
              predicate,
              value,
              scope_subject_id,
              source_id,
              source_snapshot_id,
              observation_id,
              observed_at,
              extraction_confidence,
              status,
              metadata
            )
            VALUES (
              $1,
              $2,
              'coverage.orderable',
              $3::jsonb,
              $4,
              $5,
              $6,
              $7,
              $8::timestamptz,
              $9,
              'asserted',
              $10::jsonb
            )
          `,
          [
            claimId,
            source.subject_id,
            JSON.stringify(claimValue),
            address.id,
            source.id,
            snapshot.id,
            insertedRow.id,
            snapshot.fetched_at,
            observation.payload.confidence,
            JSON.stringify({
              source_slug: source.slug,
              checker_url: observation.payload.checker_url,
              address_normalized_key: address.normalized_key,
              evidence_locator: {
                kind: "browser_checker_result",
                body_ref: snapshot.body_ref,
                markers: observation.payload.evidence_markers,
              },
            }),
          ],
        );
      }

      await client.query("COMMIT");

      return {
        observation_id: insertedRow.id,
        claim_id: claimId,
        inserted: true,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function rebuildProviderAddressAvailability(
  database: Hyperdrive,
  source: SourceDefinition,
  addressId: string,
): Promise<number> {
  return withPostgresClient(database, async (client) => {
    await client.query("BEGIN");

    try {
      await client.query(
        `
          DELETE FROM provider_address_availability
          WHERE provider_id = $1
            AND address_id = $2
        `,
        [source.provider_id, addressId],
      );

      const latest = await client.query<{
        id: string;
        value: Record<string, unknown>;
        observed_at: Date | string;
      }>(
        `
          SELECT
            id,
            value,
            observed_at
          FROM claims
          WHERE subject_id = $1
            AND scope_subject_id = $2
            AND predicate = 'coverage.orderable'
            AND status = 'asserted'
          ORDER BY observed_at DESC, created_at DESC, id DESC
          LIMIT 1
        `,
        [source.subject_id, addressId],
      );

      const claim = latest.rows[0];
      if (!claim) {
        await client.query("COMMIT");
        return 0;
      }

      const value = claim.value ?? {};
      const orderable = value.value === true;
      const state =
        typeof value.state === "string"
          ? value.state
          : orderable
            ? "orderable"
            : "unavailable";
      const serviceKind =
        typeof value.service_kind === "string"
          ? value.service_kind
          : "internet";
      const technologies = Array.isArray(value.technologies)
        ? value.technologies
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim().toLocaleLowerCase())
            .filter(Boolean)
        : [];

      const normalizedTechnologies =
        technologies.length > 0 ? [...new Set(technologies)] : ["unknown"];

      const observedAt = new Date(claim.observed_at);
      const freshUntil = new Date(
        observedAt.getTime() + FRESHNESS_MS,
      ).toISOString();

      for (const technology of normalizedTechnologies) {
        await client.query(
          `
            INSERT INTO provider_address_availability (
              provider_id,
              address_id,
              service_kind,
              technology,
              availability_state,
              observed_at,
              fresh_until,
              supporting_claim_id,
              projection_version,
              rebuilt_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6::timestamptz,
              $7::timestamptz,
              $8,
              $9,
              now()
            )
          `,
          [
            source.provider_id,
            addressId,
            serviceKind,
            technology,
            state,
            observedAt.toISOString(),
            freshUntil,
            claim.id,
            PROJECTION_VERSION,
          ],
        );
      }

      await client.query("COMMIT");
      return normalizedTechnologies.length;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function getAddressAvailability(
  database: Hyperdrive,
  providerSlug: string,
  normalizedKey: string,
): Promise<Record<string, unknown> | null> {
  return withPostgresClient(database, async (client) => {
    const address = await client.query<{
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
      normalized_key: string;
    }>(
      `
        SELECT
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
        FROM addresses a
        WHERE a.normalized_key = $1
        LIMIT 1
      `,
      [normalizedKey],
    );

    const addressRow = address.rows[0];
    if (!addressRow) return null;

    const provider = await client.query<{ provider_id: string }>(
      `
        SELECT provider_id
        FROM provider_profiles
        WHERE slug = $1
        LIMIT 1
      `,
      [providerSlug],
    );

    const providerRow = provider.rows[0];
    if (!providerRow) return null;

    const availability = await client.query<{
      service_kind: string;
      technology: string;
      availability_state: string;
      observed_at: Date | string;
      fresh_until: Date | string | null;
      supporting_claim_id: string;
      projection_version: string;
      rebuilt_at: Date | string;
    }>(
      `
        SELECT
          service_kind,
          technology,
          availability_state,
          observed_at,
          fresh_until,
          supporting_claim_id,
          projection_version,
          rebuilt_at
        FROM provider_address_availability
        WHERE provider_id = $1
          AND address_id = $2
        ORDER BY service_kind, technology
      `,
      [providerRow.provider_id, addressRow.id],
    );

    return {
      provider: providerSlug,
      address: addressRow,
      availability: availability.rows.map((row) => ({
        ...row,
        observed_at: new Date(row.observed_at).toISOString(),
        fresh_until:
          row.fresh_until === null
            ? null
            : new Date(row.fresh_until).toISOString(),
        rebuilt_at: new Date(row.rebuilt_at).toISOString(),
      })),
    };
  });
}


export async function getAllAddressAvailability(
  database: Hyperdrive,
  normalizedKey: string,
): Promise<Record<string, unknown>> {
  return withPostgresClient(database, async (client) => {
    const address = await client.query<{
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
      normalized_key: string;
    }>(
      `
        SELECT
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
        FROM addresses a
        WHERE a.normalized_key = $1
        LIMIT 1
      `,
      [normalizedKey],
    );

    const addressRow = address.rows[0];

    if (!addressRow) {
      return {
        address: null,
        normalized_key: normalizedKey,
        providers: [],
      };
    }

    const availability = await client.query<{
      provider_id: string;
      provider_slug: string | null;
      provider_display_name: string | null;
      service_kind: string;
      technology: string;
      availability_state: string;
      observed_at: Date | string;
      fresh_until: Date | string | null;
      supporting_claim_id: string;
      projection_version: string;
      rebuilt_at: Date | string;
    }>(
      `
        SELECT
          paa.provider_id,
          pp.slug AS provider_slug,
          pp.display_name AS provider_display_name,
          paa.service_kind,
          paa.technology,
          paa.availability_state,
          paa.observed_at,
          paa.fresh_until,
          paa.supporting_claim_id,
          paa.projection_version,
          paa.rebuilt_at
        FROM provider_address_availability paa
        LEFT JOIN provider_profiles pp
          ON pp.provider_id = paa.provider_id
        WHERE paa.address_id = $1
        ORDER BY
          pp.display_name NULLS LAST,
          pp.slug NULLS LAST,
          paa.provider_id,
          paa.service_kind,
          paa.technology
      `,
      [addressRow.id],
    );

    const providers = new Map<
      string,
      {
        provider_id: string;
        slug: string | null;
        display_name: string | null;
        availability: Array<Record<string, unknown>>;
      }
    >();

    for (const row of availability.rows) {
      const current = providers.get(row.provider_id) ?? {
        provider_id: row.provider_id,
        slug: row.provider_slug,
        display_name: row.provider_display_name,
        availability: [],
      };

      current.availability.push({
        service_kind: row.service_kind,
        technology: row.technology,
        availability_state: row.availability_state,
        observed_at: new Date(row.observed_at).toISOString(),
        fresh_until:
          row.fresh_until === null
            ? null
            : new Date(row.fresh_until).toISOString(),
        supporting_claim_id: row.supporting_claim_id,
        projection_version: row.projection_version,
        rebuilt_at: new Date(row.rebuilt_at).toISOString(),
      });

      providers.set(row.provider_id, current);
    }

    return {
      address: addressRow,
      normalized_key: normalizedKey,
      providers: [...providers.values()],
    };
  });
}
