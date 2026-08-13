/**
 * RN-G6-SRV / B3 — the new reverse lookup
 * `GET /api/vnext/results/kpi/scorecards/for-kpi/:kpiId` (kpiScorecard.routes.ts,
 * `listVisibleScorecardsForKpi`), against a REAL Postgres.
 *
 * `listVisibleScorecardsForKpi` is a route-local, unexported helper (same
 * posture as that file's own pre-existing `loadVisibleScorecard` for
 * `GET /:scorecardId` — see its header comment on why: a narrow,
 * self-contained query rather than growing `kpiScorecardRepository.ts`'s
 * own exported contract for one route file's convenience). Since it cannot
 * be imported, this file duplicates its query VERBATIM — the identical
 * precedent `kpiScorecardRepositoryRoutesRealdb.test.ts` already
 * established for `loadVisibleScorecard` itself ("the query text is copied
 * verbatim ... a drift between the two would only ever be a copy-paste
 * error, not a fundamentally untested code path").
 *
 * Proves the two-step AC #4 visibility this route's own header comment
 * states: (1) the KPI itself must be visible to the caller — otherwise the
 * whole answer is `[]`, regardless of scorecard visibility; (2) ONLY
 * scorecards the caller can ALSO see (independently) are named — a caller
 * who can see the KPI but NOT a given scorecard must never learn that
 * scorecard exists just because the (visible) KPI is on it.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `kpi-b3-forkpi-it-org-${tag}`;
const USER_A = `kpi-b3-forkpi-it-owner-${tag}`; // owns the KPI and the scorecard
const USER_B = `kpi-b3-forkpi-it-outsider-${tag}`; // no ownership anywhere

let client: Client;
let reachable = false;

type VisibilityModule = typeof import('../../../server/src/services/resultsVnext/platform/visibilityScopedQuery.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let wrapWithVisibilityScope: VisibilityModule['wrapWithVisibilityScope'];
let VISIBILITY_CTE_PARAM_COUNT: number;
let acquirePgClient: () => Promise<import('pg').PoolClient>;
let closePgPool: (() => Promise<void>) | undefined;
let kpiPolicyId: string;
let scorecardPolicyId: string;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<string> {
  const result = await client.query<{ policy_id: string }>(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)
     RETURNING policy_id`,
    [ORG_ID, domain, mode, createdBy]
  );
  return result.rows[0]!.policy_id;
}

async function insertFixtureKpi(kpiId: string, versionId: string, ownerUserId: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, owner_user_id, created_by)
     VALUES ($1, $2, $3, 'active', $4, $4)`,
    [kpiId, ORG_ID, `KPI-${kpiId.slice(0, 8)}`, ownerUserId]
  );
  await client.query(
    `INSERT INTO rvn_kpi_definition_versions
       (definition_version_id, kpi_id, organization_id, version_number, name, unit, target_geometry,
        target_min, approval_status, created_by, effective_from)
     VALUES ($1, $2, $3, 1, 'IT fixture KPI', 'unit', 'threshold_min', 100, 'approved', $4, now())`,
    [versionId, kpiId, ORG_ID, ownerUserId]
  );
  await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`, [
    versionId,
    kpiId,
  ]);
}

async function insertResourceVisibility(
  resourceType: 'kpi' | 'kpi_scorecard',
  resourceId: string,
  policyId: string,
  mode: 'OPEN_ORG' | 'PRIVATE',
  ownerUserId: string
): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility
       (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [resourceType, resourceId, ORG_ID, mode, policyId, ownerUserId]
  );
}

async function insertFixtureScorecard(scorecardId: string, ownerUserId: string, name: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_scorecards
       (scorecard_id, organization_id, name, scope_type, owner_user_id, review_frequency, created_by)
     VALUES ($1, $2, $3, 'individual', $4, 'monthly', $4)`,
    [scorecardId, ORG_ID, name, ownerUserId]
  );
}

async function insertScorecardItem(itemId: string, scorecardId: string, kpiId: string, addedBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_scorecard_items
       (item_id, scorecard_id, kpi_id, organization_id, role, sort_order, added_by)
     VALUES ($1, $2, $3, $4, 'supporting', 0, $5)`,
    [itemId, scorecardId, kpiId, ORG_ID, addedBy]
  );
}

/** Verbatim copy of `kpiScorecard.routes.ts`'s own route-local
 * `listVisibleScorecardsForKpi` — see this file's header for why. */
async function listVisibleScorecardsForKpi(userId: string, organizationId: string, kpiId: string) {
  const kpiVisibility = await wrapWithVisibilityScope(
    `SELECT 1 FROM rvn_visible_resources vr
      WHERE vr.resource_type = 'kpi' AND vr.resource_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}`,
    { userId, organizationId, resourceType: 'kpi' }
  );
  const readClient = await acquirePgClient();
  try {
    const kpiVisibleResult = await readClient.query(kpiVisibility.sql, [...kpiVisibility.values, kpiId]);
    if (kpiVisibleResult.rows.length === 0) return [];

    const wrapped = await wrapWithVisibilityScope(
      `SELECT DISTINCT sc.* FROM rvn_kpi_scorecards sc
         INNER JOIN rvn_kpi_scorecard_items si ON si.scorecard_id = sc.scorecard_id
         INNER JOIN rvn_visible_resources vr
                 ON vr.resource_type = 'kpi_scorecard' AND vr.resource_id = sc.scorecard_id::text
        WHERE sc.organization_id = $1 AND si.organization_id = $1
          AND si.kpi_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
        ORDER BY sc.updated_at DESC`,
      { userId, organizationId, resourceType: 'kpi_scorecard' }
    );
    const values = [...wrapped.values, kpiId];
    const result = await readClient.query<{ scorecard_id: string }>(wrapped.sql, values);
    return result.rows;
  } finally {
    readClient.release();
  }
}

describe('RN-G6-SRV / B3 — reverse kpi -> scorecards lookup (real Postgres, two-step AC #4 visibility)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — RN-G6-SRV B3 for-kpi reverse-lookup tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1 FROM rvn_kpi_scorecard_items LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL,
           user_id TEXT NOT NULL,
           role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id)
         )`
      );
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the KPI-E004 scorecard schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const visibilityModule: VisibilityModule = await import(
      '../../../server/src/services/resultsVnext/platform/visibilityScopedQuery.js'
    );
    wrapWithVisibilityScope = visibilityModule.wrapWithVisibilityScope;
    VISIBILITY_CTE_PARAM_COUNT = visibilityModule.VISIBILITY_CTE_PARAM_COUNT;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    acquirePgClient = (pgModule as unknown as { acquirePgClient: () => Promise<import('pg').PoolClient> }).acquirePgClient;
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    // ONE 'kpi'-domain and ONE 'kpi_scorecard'-domain policy per org
    // (UNIQUE(organization_id, domain, policy_version)) — every scenario
    // below reuses these two ids and sets PRIVATE/OPEN_ORG on the
    // PER-RESOURCE `rvn_platform_resource_visibility` row instead (same
    // "policy_id is just an FK reference, mode lives on the resource row"
    // pattern `kpiScorecardRepositoryRoutesRealdb.test.ts` documents).
    kpiPolicyId = await insertVisibilityPolicy('kpi', 'OPEN_ORG', USER_A);
    scorecardPolicyId = await insertVisibilityPolicy('kpi_scorecard', 'OPEN_ORG', USER_A);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM rvn_kpi_scorecard_items WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_scorecards WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.end();
    if (closePgPool) await closePgPool();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB('owner sees the scorecard: both the KPI and the scorecard are PRIVATE to the same owner', async () => {
    const kpiId = randomUUID();
    const versionId = randomUUID();
    const scorecardId = randomUUID();
    await insertFixtureKpi(kpiId, versionId, USER_A);
    await insertResourceVisibility('kpi', kpiId, kpiPolicyId, 'PRIVATE', USER_A);
    await insertFixtureScorecard(scorecardId, USER_A, 'Owner-visible scorecard');
    await insertResourceVisibility('kpi_scorecard', scorecardId, scorecardPolicyId, 'PRIVATE', USER_A);
    await insertScorecardItem(randomUUID(), scorecardId, kpiId, USER_A);

    const result = await listVisibleScorecardsForKpi(USER_A, ORG_ID, kpiId);
    expect(result.map((r) => r.scorecard_id)).toEqual([scorecardId]);
  });

  itDB(
    'step 1 (KPI visibility): outsider cannot see the PRIVATE KPI at all -> [], even though the scorecard containing it is OPEN_ORG',
    async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      const scorecardId = randomUUID();
      await insertFixtureKpi(kpiId, versionId, USER_A);
      await insertResourceVisibility('kpi', kpiId, kpiPolicyId, 'PRIVATE', USER_A);
      await insertFixtureScorecard(scorecardId, USER_A, 'Open scorecard, private KPI');
      await insertResourceVisibility('kpi_scorecard', scorecardId, scorecardPolicyId, 'OPEN_ORG', USER_A);
      await insertScorecardItem(randomUUID(), scorecardId, kpiId, USER_A);

      const asOwner = await listVisibleScorecardsForKpi(USER_A, ORG_ID, kpiId);
      expect(asOwner.map((r) => r.scorecard_id)).toContain(scorecardId);

      const asOutsider = await listVisibleScorecardsForKpi(USER_B, ORG_ID, kpiId);
      expect(asOutsider).toEqual([]);
    }
  );

  itDB(
    'AC #4 — step 2 (scorecard visibility): a caller who CAN see the KPI (OPEN_ORG) but NOT the scorecard (PRIVATE to someone else) never learns the scorecard exists',
    async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      const scorecardId = randomUUID();
      await insertFixtureKpi(kpiId, versionId, USER_A);
      await insertResourceVisibility('kpi', kpiId, kpiPolicyId, 'OPEN_ORG', USER_A);
      await insertFixtureScorecard(scorecardId, USER_A, 'Private scorecard, open KPI');
      await insertResourceVisibility('kpi_scorecard', scorecardId, scorecardPolicyId, 'PRIVATE', USER_A);
      await insertScorecardItem(randomUUID(), scorecardId, kpiId, USER_A);

      // USER_B genuinely CAN see the KPI now (OPEN_ORG) — proves step 1
      // passes for USER_B here, unlike the previous scenario.
      const kpiVisibleToOutsider = await wrapWithVisibilityScope(
        `SELECT 1 FROM rvn_visible_resources vr WHERE vr.resource_type = 'kpi' AND vr.resource_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}`,
        { userId: USER_B, organizationId: ORG_ID, resourceType: 'kpi' }
      );
      const outsiderKpiCheck = await client.query(kpiVisibleToOutsider.sql, [...kpiVisibleToOutsider.values, kpiId]);
      expect(outsiderKpiCheck.rows.length).toBeGreaterThan(0);

      // ...yet the reverse lookup still returns [] for USER_B — the
      // scorecard's OWN (more restrictive) visibility is never bypassed by
      // the fact that one of its (visible) items is visible.
      const asOutsider = await listVisibleScorecardsForKpi(USER_B, ORG_ID, kpiId);
      expect(asOutsider).toEqual([]);

      const asOwner = await listVisibleScorecardsForKpi(USER_A, ORG_ID, kpiId);
      expect(asOwner.map((r) => r.scorecard_id)).toContain(scorecardId);
    }
  );
});
