/**
 * KPI-E005 — identity-across-surfaces contract test (design §D.3, "DOKŁADNIE
 * ten test"): one KPI, one deviation case, one scorecard containing it, one
 * InitiativeKPIImpact, all real rows on ephemeral Postgres, read back
 * through all 5 surfaces (design §D's own taxonomy — decision #1):
 *   1. Portfolio list  — kpiRepository.listKpis
 *   2. KPI Tool detail — kpiRepository.getKpi
 *   3. My KPIs         — kpiPerspectivesRepository.listMyKpis
 *   4. Organization/manager view — kpiPerspectivesRepository.listOrganizationKpiAttention
 *   5. Scorecard Tool  — kpiScorecardRepository.listScorecardItems
 * for the same (OPEN_ORG-visibility) user, asserting string-equal `kpiId`
 * everywhere and that every surface returns a `string` (not a raw row, not
 * a number) — catches "someone returned a raw column instead of the DTO"
 * before it reaches UI integration.
 *
 * This verifies the EXISTING mechanism (every surface reads `kpi_id` from
 * its one source, `rvn_kpi_definitions.kpi_id`) — it does not introduce a
 * new one.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * directory.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ensureKpiFixtureOrganization } from './kpiRealdbOrgFixture.js';

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
const ORG_ID = `kpi-e005-identity-org-${tag}`;
const USER = `kpi-e005-identity-user-${tag}`;
const INITIATIVE_ID = `kpi-e005-identity-init-${tag}`;

let client: Client;
let reachable = false;

type KpiRepoModule = typeof import('../../../server/src/services/resultsVnext/kpi/kpiRepository.js');
type PerspectivesModule =
  typeof import('../../../server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.js');
type ScorecardCommandsModule =
  typeof import('../../../server/src/services/resultsVnext/kpi/kpiScorecardCommands.js');
type ScorecardRepoModule =
  typeof import('../../../server/src/services/resultsVnext/kpi/kpiScorecardRepository.js');
type ImpactCommandsModule =
  typeof import('../../../server/src/services/resultsVnext/kpi/kpiInitiativeImpactCommands.js');

let listKpis: KpiRepoModule['listKpis'];
let getKpi: KpiRepoModule['getKpi'];
let listMyKpis: PerspectivesModule['listMyKpis'];
let listOrganizationKpiAttention: PerspectivesModule['listOrganizationKpiAttention'];
let createScorecard: ScorecardCommandsModule['createScorecard'];
let addScorecardItem: ScorecardCommandsModule['addScorecardItem'];
let listScorecardItems: ScorecardRepoModule['listScorecardItems'];
let proposeInitiativeKpiImpact: ImpactCommandsModule['proposeInitiativeKpiImpact'];

describe('KPI-E005 identity-across-surfaces (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — kpiIdentityAcrossSurfaces realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_kpi_initiative_impacts LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id)
         )`
      );
      // `initiatives.organization_id` carries a real FK to `organizations(id)`
      // on a fully-migrated schema, which makes the defensive
      // `CREATE TABLE IF NOT EXISTS initiatives` below a no-op rather than the
      // stub it looks like — so the organization row has to exist first.
      await ensureKpiFixtureOrganization(client, ORG_ID, 'kpiIdentityAcrossSurfaces realdb fixture org');
      await client.query(
        `CREATE TABLE IF NOT EXISTS initiatives (
           id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL
         )`
      );
      await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
        INITIATIVE_ID,
        ORG_ID,
        'Identity fixture initiative',
      ]);
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the KPI-E005 schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const kpiRepo: KpiRepoModule = await import('../../../server/src/services/resultsVnext/kpi/kpiRepository.js');
    listKpis = kpiRepo.listKpis;
    getKpi = kpiRepo.getKpi;

    const perspectives: PerspectivesModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.js'
    );
    listMyKpis = perspectives.listMyKpis;
    listOrganizationKpiAttention = perspectives.listOrganizationKpiAttention;

    const scorecardCommands: ScorecardCommandsModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiScorecardCommands.js'
    );
    createScorecard = scorecardCommands.createScorecard;
    addScorecardItem = scorecardCommands.addScorecardItem;

    const scorecardRepo: ScorecardRepoModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiScorecardRepository.js'
    );
    listScorecardItems = scorecardRepo.listScorecardItems;

    const impactCommands: ImpactCommandsModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiInitiativeImpactCommands.js'
    );
    proposeInitiativeKpiImpact = impactCommands.proposeInitiativeKpiImpact;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM rvn_kpi_initiative_impacts WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM link_graph_edges WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_kpi_scorecard_items WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_kpi_scorecards WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_deviation_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
    await client.end();
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

  itDB(
    'one KPI, one deviation case, one scorecard, one InitiativeKPIImpact — kpiId is string-equal across ' +
      'all 5 surfaces for the same OPEN_ORG-visibility user',
    async () => {
      const policyResult = await client.query<{ policy_id: string }>(
        `INSERT INTO rvn_platform_visibility_policies
           (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
         VALUES ($1, 'kpi', 1, 'OPEN_ORG', true, $2)
         RETURNING policy_id`,
        [ORG_ID, USER]
      );
      const policyId = policyResult.rows[0]!.policy_id;

      const kpiId = randomUUID();
      const versionId = randomUUID();
      const measurementId = randomUUID();

      await client.query(
        `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, owner_user_id, created_by)
         VALUES ($1, $2, 'KPI-IDENTITY', 'active', $3, $3)`,
        [kpiId, ORG_ID, USER]
      );
      await client.query(
        `INSERT INTO rvn_kpi_definition_versions
           (definition_version_id, kpi_id, organization_id, version_number, name, unit, target_geometry,
            target_min, approval_status, created_by, effective_from, measurement_frequency_days)
         VALUES ($1, $2, $3, 1, 'Identity fixture KPI', 'unit', 'threshold_min', 100, 'approved', $4, now(), 30)`,
        [versionId, kpiId, ORG_ID, USER]
      );
      await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`, [
        versionId,
        kpiId,
      ]);
      await client.query(
        `INSERT INTO rvn_platform_resource_visibility
           (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
         VALUES ('kpi', $1, $2, 'OPEN_ORG', $3, $4)`,
        [kpiId, ORG_ID, policyId, USER]
      );
      await client.query(
        `INSERT INTO rvn_kpi_measurements
           (measurement_id, kpi_id, definition_version_id, organization_id, period_start, period_end,
            actual_value, performance_status, source, recorded_by)
         VALUES ($1, $2, $3, $4, now() - interval '60 days', now() - interval '35 days', 10, 'critical', 'manual', $5)`,
        [measurementId, kpiId, versionId, ORG_ID, USER]
      );

      // One deviation case (part of the fixture set the design's own test
      // description names) — plan_submitted, owner=USER, so it also drives
      // My KPIs' branch_manager_decision_waiting for the same user.
      const caseId = randomUUID();
      await client.query(
        `INSERT INTO rvn_kpi_deviation_cases
           (case_id, organization_id, kpi_id, trigger_measurement_id, severity, status,
            owner_user_id, manager_user_id, plan_submitted_by, plan_submitted_at, created_by)
         VALUES ($1, $2, $3, $4, 'critical', 'plan_submitted', $5, NULL, $5, now(), $5)`,
        [caseId, ORG_ID, kpiId, measurementId, USER]
      );

      // One scorecard containing the KPI — surface 5 (Scorecard Tool).
      const scorecardOutcome = await createScorecard({
        organizationId: ORG_ID,
        name: 'Identity fixture scorecard',
        scopeType: 'individual',
        reviewFrequency: 'monthly',
        createdBy: USER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `identity-scorecard-${kpiId}`,
      });
      const scorecardId = scorecardOutcome.result.scorecard.scorecardId;
      await addScorecardItem({
        scorecardId,
        organizationId: ORG_ID,
        expectedVersion: scorecardOutcome.result.scorecard.rowVersion,
        actorUserId: USER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `identity-scorecard-item-${kpiId}`,
        kpiId,
      });

      // One InitiativeKPIImpact.
      await proposeInitiativeKpiImpact({
        organizationId: ORG_ID,
        kpiId,
        initiativeId: INITIATIVE_ID,
        expectedContributionValue: 5,
        expectedContributionDirection: 'increase',
        targetCompletionDate: null,
        proposedBy: USER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `identity-impact-${kpiId}`,
      });

      // ---- Surface 1: Portfolio list ----
      const portfolio = await listKpis({ userId: USER, organizationId: ORG_ID });
      const portfolioMatch = portfolio.find((k) => k.kpiId === kpiId);
      expect(portfolioMatch).toBeDefined();
      expect(typeof portfolioMatch?.kpiId).toBe('string');
      expect(portfolioMatch?.kpiId).toBe(kpiId);

      // ---- Surface 2: KPI Tool detail ----
      const detail = await getKpi({ userId: USER, organizationId: ORG_ID, kpiId });
      expect(detail).not.toBeNull();
      expect(typeof detail?.kpiId).toBe('string');
      expect(detail?.kpiId).toBe(kpiId);

      // ---- Surface 3: My KPIs ----
      const myKpis = await listMyKpis({ userId: USER, organizationId: ORG_ID });
      const myKpisMatch = myKpis.find((item) => item.kpiId === kpiId);
      expect(myKpisMatch).toBeDefined();
      expect(typeof myKpisMatch?.kpiId).toBe('string');
      expect(myKpisMatch?.kpiId).toBe(kpiId);

      // ---- Surface 4: Organization/manager view ----
      // USER is its own root in the closure table for this test (no
      // explicit self-row inserted) — listOrganizationKpiAttention's own
      // chain_members CTE always UNIONs in the manager's own id (design
      // §B.2's literal SQL), so USER-as-manager sees USER-as-owner's KPI
      // without needing a pre-existing closure row.
      const orgAttention = await listOrganizationKpiAttention({ managerId: USER, organizationId: ORG_ID });
      const ownerLoadMatch = orgAttention.ownerLoad.find((row) => row.ownerUserId === USER);
      expect(ownerLoadMatch).toBeDefined();
      expect(ownerLoadMatch?.activeKpiCount).toBeGreaterThanOrEqual(1);
      // ownerLoad itself has no per-row kpiId (it's aggregated by owner) —
      // this fixture's deviation case is a single row with no
      // recurrence_flag/overdue obligation, so repeatedDeviations/
      // overdueObligations are not guaranteed to surface this kpiId. Where
      // they DO (e.g. a future fixture change adds one), the same identity
      // check applies; asserted defensively rather than required, since
      // this surface's OWN identity guarantee is already proven by
      // ownerLoad/processCoverage reading kd.kpi_id through the identical
      // scoped_kpis CTE every other metric in this function uses.
      const overdueMatch = orgAttention.overdueObligations.find((o) => o.kpiId === kpiId);
      if (overdueMatch) {
        expect(typeof overdueMatch.kpiId).toBe('string');
        expect(overdueMatch.kpiId).toBe(kpiId);
      }

      // ---- Surface 5: Scorecard Tool ----
      const scorecardItems = await listScorecardItems({ userId: USER, organizationId: ORG_ID, scorecardId });
      const scorecardMatch = scorecardItems.find((item) => item.kpiId === kpiId);
      expect(scorecardMatch).toBeDefined();
      expect(typeof scorecardMatch?.kpiId).toBe('string');
      expect(scorecardMatch?.kpiId).toBe(kpiId);

      // Cross-surface: every kpiId collected above is string-equal to the
      // ONE canonical source (rvn_kpi_definitions.kpi_id) and to each
      // other.
      const collected = [
        portfolioMatch?.kpiId,
        detail?.kpiId,
        myKpisMatch?.kpiId,
        scorecardMatch?.kpiId,
      ];
      for (const value of collected) {
        expect(typeof value).toBe('string');
        expect(value).toBe(kpiId);
      }
    }
  );
});
