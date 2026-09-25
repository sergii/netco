import { withPostgresClient } from "../db/postgres";
import type { SourceDefinition } from "../sources/registry";

const RESOLVER_VERSION = "official-source-self/v1";
const PROJECTION_VERSION = "provider-projection/v1";

interface ClaimRow {
  id: string;
  value: Record<string, unknown>;
  source_id: string;
  observation_id: string | null;
  observed_at: Date | string;
  created_at: Date | string;
}

interface PlanRow {
  id: string;
  canonical_name: string;
  normalized_name: string;
}

function iso(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function normalizePlanName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function latestIdentityClaim(
  client: import("pg").Client,
  subjectId: string,
  predicate: string,
): Promise<ClaimRow | null> {
  const result = await client.query<ClaimRow>(
    `
      SELECT
        c.id,
        c.value,
        c.source_id,
        c.observation_id,
        c.observed_at,
        c.created_at
      FROM claims c
      JOIN sources s ON s.id = c.source_id
      WHERE c.subject_id = $1
        AND c.predicate = $2
        AND c.status = 'asserted'
        AND s.kind = 'official_website'
      ORDER BY c.observed_at DESC, c.created_at DESC, c.id DESC
      LIMIT 1
    `,
    [subjectId, predicate],
  );

  return result.rows[0] ?? null;
}

async function ensureCanonicalProvider(
  client: import("pg").Client,
  source: SourceDefinition,
): Promise<{
  provider_id: string;
  resolution_case_id: string;
  display_name: string;
  website: string | null;
}> {
  const [displayClaim, websiteClaim] = await Promise.all([
    latestIdentityClaim(
      client,
      source.subject_id,
      "identity.display_name",
    ),
    latestIdentityClaim(
      client,
      source.subject_id,
      "web.official_site",
    ),
  ]);

  const displayName = displayClaim
    ? String(asObject(displayClaim.value).value ?? "").trim()
    : "";

  if (!displayClaim || !displayName) {
    throw new Error("provider_identity_claim_required");
  }

  const website = websiteClaim
    ? String(asObject(websiteClaim.value).url ?? "").trim() || null
    : null;

  await client.query(
    `
      INSERT INTO subjects (id, kind)
      VALUES ($1, 'service_provider')
      ON CONFLICT (id) DO NOTHING
    `,
    [source.provider_id],
  );

  const subject = await client.query<{ kind: string }>(
    `
      SELECT kind
      FROM subjects
      WHERE id = $1
    `,
    [source.provider_id],
  );

  if (subject.rows[0]?.kind !== "service_provider") {
    throw new Error("canonical_subject_kind_conflict");
  }

  await client.query(
    `
      INSERT INTO entities (
        id,
        entity_type,
        lifecycle_status
      )
      VALUES ($1, 'service_provider', 'unknown')
      ON CONFLICT (id) DO NOTHING
    `,
    [source.provider_id],
  );

  const entity = await client.query<{ entity_type: string }>(
    `
      SELECT entity_type
      FROM entities
      WHERE id = $1
    `,
    [source.provider_id],
  );

  if (entity.rows[0]?.entity_type !== "service_provider") {
    throw new Error("canonical_subject_type_conflict");
  }

  const resolutionCase = await client.query<{ id: string }>(
    `
      INSERT INTO resolution_cases (
        observed_subject_id,
        status,
        resolver_version,
        resolved_at
      )
      VALUES ($1, 'matched', $2, now())
      ON CONFLICT (observed_subject_id, resolver_version)
      DO UPDATE SET
        status = 'matched',
        resolved_at = EXCLUDED.resolved_at
      RETURNING id
    `,
    [source.subject_id, RESOLVER_VERSION],
  );

  const resolutionCaseId = resolutionCase.rows[0].id;

  const candidate = await client.query<{ id: string }>(
    `
      INSERT INTO resolution_candidates (
        resolution_case_id,
        candidate_subject_id,
        score,
        rank
      )
      VALUES ($1, $2, 1.0000, 1)
      ON CONFLICT (resolution_case_id, candidate_subject_id)
      DO UPDATE SET
        score = EXCLUDED.score,
        rank = EXCLUDED.rank
      RETURNING id
    `,
    [resolutionCaseId, source.provider_id],
  );

  const candidateId = candidate.rows[0].id;

  await client.query(
    `
      INSERT INTO resolution_evidence (
        resolution_candidate_id,
        signal,
        direction,
        strength,
        value,
        source_id
      )
      VALUES (
        $1,
        'official_identity_claim',
        'positive',
        1.0000,
        $2::jsonb,
        $3
      )
      ON CONFLICT (resolution_candidate_id, signal)
      DO UPDATE SET
        direction = EXCLUDED.direction,
        strength = EXCLUDED.strength,
        value = EXCLUDED.value,
        source_id = EXCLUDED.source_id
    `,
    [
      candidateId,
      JSON.stringify({
        claim_id: displayClaim.id,
        display_name: displayName,
      }),
      displayClaim.source_id,
    ],
  );

  if (websiteClaim && website) {
    await client.query(
      `
        INSERT INTO resolution_evidence (
          resolution_candidate_id,
          signal,
          direction,
          strength,
          value,
          source_id
        )
        VALUES (
          $1,
          'official_site_claim',
          'positive',
          1.0000,
          $2::jsonb,
          $3
        )
        ON CONFLICT (resolution_candidate_id, signal)
        DO UPDATE SET
          direction = EXCLUDED.direction,
          strength = EXCLUDED.strength,
          value = EXCLUDED.value,
          source_id = EXCLUDED.source_id
      `,
      [
        candidateId,
        JSON.stringify({
          claim_id: websiteClaim.id,
          website,
        }),
        websiteClaim.source_id,
      ],
    );
  }

  await client.query(
    `
      INSERT INTO resolution_decisions (
        resolution_case_id,
        decision,
        canonical_subject_id,
        confidence,
        decided_by,
        resolver_version,
        rationale
      )
      SELECT
        $1,
        'MATCH',
        $2,
        1.0000,
        'rule',
        $3,
        $4::jsonb
      WHERE NOT EXISTS (
        SELECT 1
        FROM resolution_decisions
        WHERE resolution_case_id = $1
          AND decision = 'MATCH'
          AND canonical_subject_id = $2
          AND resolver_version = $3
      )
    `,
    [
      resolutionCaseId,
      source.provider_id,
      RESOLVER_VERSION,
      JSON.stringify({
        policy: RESOLVER_VERSION,
        rationale:
          "Official-source identity is promoted to the bootstrap canonical provider subject without merging distinct observed subjects.",
      }),
    ],
  );

  return {
    provider_id: source.provider_id,
    resolution_case_id: resolutionCaseId,
    display_name: displayName,
    website,
  };
}

async function latestAcceptedDomainClaims(
  client: import("pg").Client,
  subjectId: string,
  schemaName: string,
  predicate: string,
): Promise<ClaimRow[]> {
  const result = await client.query<ClaimRow>(
    `
      WITH ranked_observations AS (
        SELECT
          o.id,
          row_number() OVER (
            PARTITION BY o.source_snapshot_id, o.schema_name
            ORDER BY
              CASE
                WHEN o.extractor_version ~ '^[0-9]+$'
                  THEN o.extractor_version::integer
                ELSE 0
              END DESC,
              o.extracted_at DESC,
              o.id DESC
          ) AS rank
        FROM observations o
        WHERE o.schema_name = $2
          AND o.validation_status = 'valid'
      )
      SELECT
        c.id,
        c.value,
        c.source_id,
        c.observation_id,
        c.observed_at,
        c.created_at
      FROM claims c
      JOIN ranked_observations ro
        ON ro.id = c.observation_id
       AND ro.rank = 1
      WHERE c.subject_id = $1
        AND c.predicate = $3
        AND c.status = 'asserted'
      ORDER BY c.observed_at ASC, c.created_at ASC, c.id ASC
    `,
    [subjectId, schemaName, predicate],
  );

  return result.rows;
}

async function ensurePlan(
  client: import("pg").Client,
  providerId: string,
  name: string,
): Promise<PlanRow> {
  const normalizedName = normalizePlanName(name);

  const existing = await client.query<PlanRow>(
    `
      SELECT id, canonical_name, normalized_name
      FROM plans
      WHERE provider_entity_id = $1
        AND normalized_name = $2
      LIMIT 1
    `,
    [providerId, normalizedName],
  );

  if (existing.rows[0]) {
    await client.query(
      `
        UPDATE plans
        SET canonical_name = $2
        WHERE id = $1
          AND canonical_name IS DISTINCT FROM $2
      `,
      [existing.rows[0].id, name],
    );

    return {
      ...existing.rows[0],
      canonical_name: name,
    };
  }

  const planId = crypto.randomUUID();

  await client.query(
    `
      INSERT INTO subjects (id, kind)
      VALUES ($1, 'plan')
    `,
    [planId],
  );

  await client.query(
    `
      INSERT INTO plans (
        id,
        provider_entity_id,
        canonical_name,
        normalized_name,
        lifecycle_status
      )
      VALUES ($1, $2, $3, $4, 'unknown')
    `,
    [planId, providerId, name, normalizedName],
  );

  return {
    id: planId,
    canonical_name: name,
    normalized_name: normalizedName,
  };
}

async function syncPlanVersions(
  client: import("pg").Client,
  observedSubjectId: string,
  providerId: string,
): Promise<{ plans: number; versions_inserted: number }> {
  const claims = await latestAcceptedDomainClaims(
    client,
    observedSubjectId,
    "plan-observation",
    "plan.catalog_entry",
  );

  const planIds = new Set<string>();
  let versionsInserted = 0;

  for (const claim of claims) {
    const value = asObject(claim.value);
    const name = String(value.name ?? "").trim();

    if (!name) {
      continue;
    }

    const plan = await ensurePlan(client, providerId, name);
    planIds.add(plan.id);

    const existingVersion = await client.query<{ id: string }>(
      `
        SELECT id
        FROM plan_versions
        WHERE supporting_claim_id = $1
        LIMIT 1
      `,
      [claim.id],
    );

    if (existingVersion.rows[0]) {
      continue;
    }

    const versionId = crypto.randomUUID();

    await client.query(
      `
        INSERT INTO subjects (id, kind)
        VALUES ($1, 'plan_version')
      `,
      [versionId],
    );

    await client.query(
      `
        INSERT INTO plan_versions (
          id,
          plan_id,
          observed_at,
          terms,
          source_id,
          observation_id,
          supporting_claim_id
        )
        VALUES (
          $1,
          $2,
          $3::timestamptz,
          $4::jsonb,
          $5,
          $6,
          $7
        )
      `,
      [
        versionId,
        plan.id,
        iso(claim.observed_at),
        JSON.stringify(value),
        claim.source_id,
        claim.observation_id,
        claim.id,
      ],
    );

    versionsInserted += 1;
  }

  return {
    plans: planIds.size,
    versions_inserted: versionsInserted,
  };
}

async function rebuildCurrentPlans(
  client: import("pg").Client,
  providerId: string,
): Promise<number> {
  await client.query(
    `
      DELETE FROM provider_current_plans
      WHERE provider_id = $1
    `,
    [providerId],
  );

  const inserted = await client.query(
    `
      INSERT INTO provider_current_plans (
        provider_id,
        plan_id,
        plan_version_id,
        canonical_name,
        terms,
        observed_at,
        supporting_claim_id,
        projection_version,
        rebuilt_at
      )
      SELECT
        $1,
        latest.plan_id,
        latest.plan_version_id,
        latest.canonical_name,
        latest.terms,
        latest.observed_at,
        latest.supporting_claim_id,
        $2,
        now()
      FROM (
        SELECT DISTINCT ON (p.id)
          p.id AS plan_id,
          pv.id AS plan_version_id,
          p.canonical_name,
          pv.terms,
          pv.observed_at,
          pv.supporting_claim_id,
          pv.created_at
        FROM plans p
        JOIN plan_versions pv
          ON pv.plan_id = p.id
        WHERE p.provider_entity_id = $1
        ORDER BY
          p.id,
          pv.observed_at DESC,
          pv.created_at DESC,
          pv.id DESC
      ) latest
    `,
    [providerId, PROJECTION_VERSION],
  );

  return inserted.rowCount ?? 0;
}

async function rebuildCurrentTechnologies(
  client: import("pg").Client,
  observedSubjectId: string,
  providerId: string,
): Promise<number> {
  await client.query(
    `
      DELETE FROM provider_current_technologies
      WHERE provider_id = $1
    `,
    [providerId],
  );

  const inserted = await client.query(
    `
      WITH ranked_observations AS (
        SELECT
          o.id,
          row_number() OVER (
            PARTITION BY o.source_snapshot_id, o.schema_name
            ORDER BY
              CASE
                WHEN o.extractor_version ~ '^[0-9]+$'
                  THEN o.extractor_version::integer
                ELSE 0
              END DESC,
              o.extracted_at DESC,
              o.id DESC
          ) AS rank
        FROM observations o
        WHERE o.schema_name = 'technology-observation'
          AND o.validation_status = 'valid'
      ),
      current_claims AS (
        SELECT DISTINCT ON (c.value->>'technology')
          c.id,
          c.value,
          c.observed_at,
          c.created_at
        FROM claims c
        JOIN ranked_observations ro
          ON ro.id = c.observation_id
         AND ro.rank = 1
        WHERE c.subject_id = $1
          AND c.predicate = 'service.technology'
          AND c.status = 'asserted'
          AND NULLIF(c.value->>'technology', '') IS NOT NULL
        ORDER BY
          c.value->>'technology',
          c.observed_at DESC,
          c.created_at DESC,
          c.id DESC
      )
      INSERT INTO provider_current_technologies (
        provider_id,
        technology,
        observed_label,
        observed_at,
        supporting_claim_id,
        projection_version,
        rebuilt_at
      )
      SELECT
        $2,
        value->>'technology',
        NULLIF(value->>'observed_label', ''),
        observed_at,
        id,
        $3,
        now()
      FROM current_claims
    `,
    [observedSubjectId, providerId, PROJECTION_VERSION],
  );

  return inserted.rowCount ?? 0;
}

async function rebuildProviderProfile(
  client: import("pg").Client,
  source: SourceDefinition,
  observedSubjectId: string,
  providerId: string,
  displayName: string,
  website: string | null,
): Promise<void> {
  const technologies = await client.query<{ technology: string }>(
    `
      SELECT technology
      FROM provider_current_technologies
      WHERE provider_id = $1
      ORDER BY technology
    `,
    [providerId],
  );

  const latestObservation = await client.query<{
    last_observed_at: Date | string | null;
  }>(
    `
      SELECT max(observed_at) AS last_observed_at
      FROM claims
      WHERE subject_id = $1
        AND status = 'asserted'
    `,
    [observedSubjectId],
  );

  const currentTechnologies = technologies.rows.map(
    (row) => row.technology,
  );
  const lastObservedAt =
    latestObservation.rows[0]?.last_observed_at ?? null;

  await client.query(
    `
      INSERT INTO provider_profiles (
        provider_id,
        slug,
        display_name,
        canonical_brand_name,
        website,
        lifecycle_status,
        current_technologies,
        last_observed_at,
        projection_version,
        rebuilt_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $3,
        $4,
        'unknown',
        $5::jsonb,
        $6::timestamptz,
        $7,
        now()
      )
      ON CONFLICT (provider_id)
      DO UPDATE SET
        slug = EXCLUDED.slug,
        display_name = EXCLUDED.display_name,
        canonical_brand_name = EXCLUDED.canonical_brand_name,
        website = EXCLUDED.website,
        lifecycle_status = EXCLUDED.lifecycle_status,
        current_technologies = EXCLUDED.current_technologies,
        last_observed_at = EXCLUDED.last_observed_at,
        projection_version = EXCLUDED.projection_version,
        rebuilt_at = EXCLUDED.rebuilt_at
    `,
    [
      providerId,
      source.provider_slug,
      displayName,
      website,
      JSON.stringify(currentTechnologies),
      lastObservedAt ? iso(lastObservedAt) : null,
      PROJECTION_VERSION,
    ],
  );
}

export interface ProviderProjectionResult {
  status: "rebuilt" | "skipped";
  provider_id: string | null;
  resolution_case_id: string | null;
  plans: number;
  plan_versions_inserted: number;
  current_plans: number;
  current_technologies: number;
}

export async function rebuildProviderProjection(
  database: Hyperdrive,
  source: SourceDefinition,
): Promise<ProviderProjectionResult> {
  return withPostgresClient(database, async (client) => {
    await client.query("BEGIN");

    try {
      const displayClaim = await latestIdentityClaim(
        client,
        source.subject_id,
        "identity.display_name",
      );

      if (!displayClaim) {
        await client.query("COMMIT");
        return {
          status: "skipped",
          provider_id: null,
          resolution_case_id: null,
          plans: 0,
          plan_versions_inserted: 0,
          current_plans: 0,
          current_technologies: 0,
        };
      }

      const canonical = await ensureCanonicalProvider(
        client,
        source,
      );

      const planSync = await syncPlanVersions(
        client,
        source.subject_id,
        canonical.provider_id,
      );

      const currentPlans = await rebuildCurrentPlans(
        client,
        canonical.provider_id,
      );

      const currentTechnologies =
        await rebuildCurrentTechnologies(
          client,
          source.subject_id,
          canonical.provider_id,
        );

      await rebuildProviderProfile(
        client,
        source,
        source.subject_id,
        canonical.provider_id,
        canonical.display_name,
        canonical.website,
      );

      await client.query("COMMIT");

      return {
        status: "rebuilt",
        provider_id: canonical.provider_id,
        resolution_case_id: canonical.resolution_case_id,
        plans: planSync.plans,
        plan_versions_inserted: planSync.versions_inserted,
        current_plans: currentPlans,
        current_technologies: currentTechnologies,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function getProviderProjection(
  database: Hyperdrive,
  slug: string,
): Promise<Record<string, unknown> | null> {
  return withPostgresClient(database, async (client) => {
    const profile = await client.query<{
      provider_id: string;
      slug: string;
      display_name: string | null;
      canonical_brand_name: string | null;
      legal_name: string | null;
      edrpou: string | null;
      website: string | null;
      lifecycle_status: string;
      residential: boolean | null;
      business: boolean | null;
      current_technologies: unknown;
      last_observed_at: Date | string | null;
      projection_version: string;
      rebuilt_at: Date | string;
    }>(
      `
        SELECT *
        FROM provider_profiles
        WHERE slug = $1
        LIMIT 1
      `,
      [slug],
    );

    const row = profile.rows[0];

    if (!row) {
      return null;
    }

    const [plans, technologies, resolution] = await Promise.all([
      client.query<{
        plan_id: string;
        plan_version_id: string;
        canonical_name: string;
        terms: unknown;
        observed_at: Date | string;
        supporting_claim_id: string;
      }>(
        `
          SELECT
            plan_id,
            plan_version_id,
            canonical_name,
            terms,
            observed_at,
            supporting_claim_id
          FROM provider_current_plans
          WHERE provider_id = $1
          ORDER BY canonical_name, plan_id
        `,
        [row.provider_id],
      ),
      client.query<{
        technology: string;
        observed_label: string | null;
        observed_at: Date | string;
        supporting_claim_id: string;
      }>(
        `
          SELECT
            technology,
            observed_label,
            observed_at,
            supporting_claim_id
          FROM provider_current_technologies
          WHERE provider_id = $1
          ORDER BY technology
        `,
        [row.provider_id],
      ),
      client.query<{
        resolution_case_id: string;
        decision: string;
        confidence: string | number | null;
        resolver_version: string | null;
        created_at: Date | string;
      }>(
        `
          SELECT
            rc.id AS resolution_case_id,
            rd.decision,
            rd.confidence,
            rd.resolver_version,
            rd.created_at
          FROM resolution_cases rc
          JOIN LATERAL (
            SELECT
              decision,
              confidence,
              resolver_version,
              created_at
            FROM resolution_decisions
            WHERE resolution_case_id = rc.id
              AND canonical_subject_id = $1
            ORDER BY created_at DESC, id DESC
            LIMIT 1
          ) rd ON true
          WHERE rd.decision IS NOT NULL
          ORDER BY rc.created_at DESC
          LIMIT 1
        `,
        [row.provider_id],
      ),
    ]);

    return {
      provider: {
        id: row.provider_id,
        slug: row.slug,
        display_name: row.display_name,
        canonical_brand_name: row.canonical_brand_name,
        legal_name: row.legal_name,
        edrpou: row.edrpou,
        website: row.website,
        lifecycle_status: row.lifecycle_status,
        residential: row.residential,
        business: row.business,
        current_technologies: row.current_technologies,
        last_observed_at: row.last_observed_at
          ? iso(row.last_observed_at)
          : null,
        projection_version: row.projection_version,
        rebuilt_at: iso(row.rebuilt_at),
      },
      current_plans: plans.rows.map((plan) => ({
        ...plan,
        observed_at: iso(plan.observed_at),
      })),
      current_technologies: technologies.rows.map(
        (technology) => ({
          ...technology,
          observed_at: iso(technology.observed_at),
        }),
      ),
      resolution: resolution.rows[0]
        ? {
            ...resolution.rows[0],
            confidence:
              resolution.rows[0].confidence === null
                ? null
                : Number(resolution.rows[0].confidence),
            created_at: iso(resolution.rows[0].created_at),
          }
        : null,
    };
  });
}

export async function listProviderProjections(
  database: Hyperdrive,
): Promise<Array<Record<string, unknown>>> {
  return withPostgresClient(database, async (client) => {
    const result = await client.query<{
      provider_id: string;
      slug: string;
      display_name: string | null;
      website: string | null;
      current_technologies: unknown;
      last_observed_at: Date | string | null;
      projection_version: string;
      rebuilt_at: Date | string;
    }>(
      `
        SELECT
          provider_id,
          slug,
          display_name,
          website,
          current_technologies,
          last_observed_at,
          projection_version,
          rebuilt_at
        FROM provider_profiles
        ORDER BY display_name NULLS LAST, slug
      `,
    );

    return result.rows.map((row) => ({
      ...row,
      last_observed_at: row.last_observed_at
        ? iso(row.last_observed_at)
        : null,
      rebuilt_at: iso(row.rebuilt_at),
    }));
  });
}
