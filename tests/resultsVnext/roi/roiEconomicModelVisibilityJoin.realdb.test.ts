/**
 * ROI-E002 — visibility-join regression for every new economic-model table,
 * against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §6: every new
 * table's repository read joins `rvn_visible_resources` on
 * `resource_id = <table>.case_id::text` — the SAME cast class that was
 * missed 7 times across the KPI domain in an earlier epic (ROI-E001
 * §5/EXECUTION_LEDGER §24). Proves each of
 * `getCalculationPolicy`/`listAssumptions`/`listCostLines`/`listBenefitLines`/
 * `listScenarios`/`listCalculationRuns`/`getCalculationRun` actually
 * executes its join against real rows (a missing `::text` cast throws
 * Postgres 42883 "operator does not exist: text = uuid" on the first real
 * row) AND that RESTRICTED_ACL visibility is enforced: the ACL grantee sees
 * every row, a non-granted outsider sees none.
 *
 * Also proves Decision D14 (KPI evidence-link hydration): a viewer who CAN
 * see the ROI case (and therefore the link's own metadata) but has NO
 * visibility into the specific linked KPI gets `kpiDetails: null` for that
 * link, never the KPI's content.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
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
const ORG_ID = `roi-e002-vis-join-org-${tag}`;
const USER_GRANTEE = `roi-e002-vis-join-grantee-${tag}`;
const USER_OUTSIDER = `roi-e002-vis-join-outsider-${tag}`;
const USER_CASE_ONLY = `roi-e002-vis-join-case-only-${tag}`; // sees the case, not the KPI
const INITIATIVE_ID = `roi-e002-vis-join-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type CalcPolicyCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationPolicyCommands.js');
type AssumptionCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiAssumptionCommands.js');
type CostLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type EvidenceLinkCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.js');
type ScenarioCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiScenarioCommands.js');
type CalcRunCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type RepositoryModule = typeof import('../../../server/src/services/resultsVnext/roi/roiEconomicModelRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let startModeling: CaseCommandsModule['startModeling'];
let captureOrUpdateCalculationPolicy: CalcPolicyCommandsModule['captureOrUpdateCalculationPolicy'];
let addAssumption: AssumptionCommandsModule['addAssumption'];
let addCostLine: CostLineCommandsModule['addCostLine'];
let addBenefitLine: BenefitLineCommandsModule['addBenefitLine'];
let addBenefitEvidenceLink: EvidenceLinkCommandsModule['addBenefitEvidenceLink'];
let addScenario: ScenarioCommandsModule['addScenario'];
let createRoiCalculationRun: CalcRunCommandsModule['createRoiCalculationRun'];
let repo: RepositoryModule;
let closePgPool: (() => Promise<void>) | undefined;

let roiPolicyId: string;
let kpiPolicyId: string;

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

async function grantAcl(resourceType: string, resourceId: string, granteeUserId: string, grantedBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_acl
       (resource_type, resource_id, grantee_type, grantee_id, access_level, granted_by)
     VALUES ($1, $2, 'user', $3, 'contribute', $4)`,
    [resourceType, resourceId, granteeUserId, grantedBy]
  );
}

async function insertKpiFixture(kpiId: string, definitionVersionId: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, created_by) VALUES ($1, $2, $3, $4)`,
    [kpiId, ORG_ID, `KPI-${kpiId.slice(0, 8)}`, USER_GRANTEE]
  );
  await client.query(
    `INSERT INTO rvn_kpi_definition_versions
       (definition_version_id, kpi_id, organization_id, version_number, name, target_geometry, created_by)
     VALUES ($1, $2, $3, 1, 'Fixture KPI version', 'threshold_min', $4)`,
    [definitionVersionId, kpiId, ORG_ID, USER_GRANTEE]
  );
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility
       (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ('kpi', $1, $2, 'RESTRICTED_ACL', $3, $4)`,
    [kpiId, ORG_ID, kpiPolicyId, USER_GRANTEE]
  );
  // Only USER_GRANTEE is ACL-granted on the KPI itself — USER_CASE_ONLY can
  // see the ROI case but not this KPI's content.
  await grantAcl('kpi', kpiId, USER_GRANTEE, USER_GRANTEE);
}

describe('ROI-E002 economic-model visibility-join regression (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E002 visibility-join realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_calculation_policy LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL,
           user_id TEXT NOT NULL,
           role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id)
         )`
      );
      await client.query(
        `CREATE TABLE IF NOT EXISTS initiatives (
           id TEXT PRIMARY KEY,
           organization_id TEXT NOT NULL,
           name TEXT NOT NULL
         )`
      );
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the ROI-E002 schema); refusing to report a green run. ' + String(error)
      );
    }
    reachable = true;

    const caseCommands: CaseCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
    createRoiCase = caseCommands.createRoiCase;
    startModeling = caseCommands.startModeling;
    const calcPolicyCommands: CalcPolicyCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCalculationPolicyCommands.js'
    );
    captureOrUpdateCalculationPolicy = calcPolicyCommands.captureOrUpdateCalculationPolicy;
    const assumptionCommands: AssumptionCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiAssumptionCommands.js'
    );
    addAssumption = assumptionCommands.addAssumption;
    const costLineCommands: CostLineCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
    addCostLine = costLineCommands.addCostLine;
    const benefitLineCommands: BenefitLineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js'
    );
    addBenefitLine = benefitLineCommands.addBenefitLine;
    const evidenceLinkCommands: EvidenceLinkCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.js'
    );
    addBenefitEvidenceLink = evidenceLinkCommands.addBenefitEvidenceLink;
    const scenarioCommands: ScenarioCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiScenarioCommands.js');
    addScenario = scenarioCommands.addScenario;
    const calcRunCommands: CalcRunCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js'
    );
    createRoiCalculationRun = calcRunCommands.createRoiCalculationRun;

    repo = await import('../../../server/src/services/resultsVnext/roi/roiEconomicModelRepository.js');

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    roiPolicyId = await insertVisibilityPolicy('roi', 'RESTRICTED_ACL', USER_GRANTEE);
    kpiPolicyId = await insertVisibilityPolicy('kpi', 'RESTRICTED_ACL', USER_GRANTEE);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(
      `DELETE FROM rvn_platform_resource_acl
        WHERE resource_type IN ('roi_case', 'kpi')
          AND (resource_id IN (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id = $1)
               OR resource_id IN (SELECT kpi_id::text FROM rvn_kpi_definitions WHERE organization_id = $1))`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_calculation_runs WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_scenario_overrides WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_scenarios WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_benefit_evidence_links WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_benefit_lines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cost_lines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_assumptions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
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

  itDB(
    'every new table\'s repository read executes its `::text` join against real rows: grantee sees every row, ' +
      'an ACL-outsider sees none (no Postgres 42883, no false-positive leak)',
    async () => {
      const initiativeId = `${INITIATIVE_ID}-1`;
      await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
        initiativeId,
        ORG_ID,
        'Vis-join fixture initiative',
      ]);
      const createOutcome = await createRoiCase({
        organizationId: ORG_ID,
        initiativeId,
        title: 'Vis-join fixture case',
        ownerUserId: USER_GRANTEE,
        currency: 'USD',
        analysisStart: '2026-01-01',
        analysisEnd: '2026-12-31',
        createdBy: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `create-${randomUUID()}`,
      });
      const caseId = createOutcome.result.case.caseId;
      // createRoiCase already grants a 'contribute' ACL row to createdBy/ownerUserId
      // (here both USER_GRANTEE) per its own §4.1 logic — granting it again here would
      // be a redundant duplicate-key INSERT, not a real product bug.
      await grantAcl('roi_case', caseId, USER_CASE_ONLY, USER_GRANTEE);
      // createRoiCalculationRun requires status 'modeling'/'ready_for_review'
      // (RUNNABLE_STATUSES) — a fresh case defaults to 'draft'.
      await startModeling({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: createOutcome.result.case.rowVersion,
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `start-modeling-${randomUUID()}`,
      });

      await captureOrUpdateCalculationPolicy({
        organizationId: ORG_ID,
        caseId,
        expectedVersion: 1,
        discountRatePct: 8,
        actorId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `policy-${randomUUID()}`,
      });
      const assumptionOutcome = await addAssumption({
        caseId,
        organizationId: ORG_ID,
        category: 'adoption',
        label: 'Adoption rate',
        baseValue: 100,
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `assumption-${randomUUID()}`,
      });
      await addCostLine({
        caseId,
        organizationId: ORG_ID,
        category: 'implementation',
        label: 'Setup',
        amount: 1000,
        currency: 'USD',
        timingType: 'one_time',
        oneTimePeriodDate: '2026-01-01',
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `cost-${randomUUID()}`,
      });
      const benefitOutcome = await addBenefitLine({
        caseId,
        organizationId: ORG_ID,
        category: 'revenue',
        label: 'New revenue',
        amount: 2000,
        currency: 'USD',
        timingType: 'one_time',
        oneTimePeriodDate: '2026-02-01',
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `benefit-${randomUUID()}`,
      });
      const scenarioOutcome = await addScenario({
        caseId,
        organizationId: ORG_ID,
        scenarioType: 'custom',
        label: 'Custom scenario',
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `scenario-${randomUUID()}`,
      });
      const runOutcome = await createRoiCalculationRun({
        organizationId: ORG_ID,
        caseId,
        scenarioId: null,
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `run-${randomUUID()}`,
      });

      // Grantee sees everything.
      expect(await repo.getCalculationPolicy({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId })).not.toBeNull();
      expect(
        (await repo.listAssumptions({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId })).map((a) => a.assumptionId)
      ).toContain(assumptionOutcome.result.assumptionId);
      expect((await repo.listCostLines({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId })).length).toBe(1);
      expect(
        (await repo.listBenefitLines({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId })).map((b) => b.benefitLineId)
      ).toContain(benefitOutcome.result.benefitLineId);
      expect(
        (await repo.listScenarios({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId })).map((s) => s.scenarioId)
      ).toContain(scenarioOutcome.result.scenarioId);
      expect((await repo.getScenario({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId, scenarioId: scenarioOutcome.result.scenarioId }))).not.toBeNull();
      expect((await repo.listCalculationRuns({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId })).length).toBe(1);
      expect(
        await repo.getCalculationRun({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId, runId: runOutcome.result.runId })
      ).not.toBeNull();

      // Outsider (no ACL grant at all on this case) sees nothing — not a
      // thrown 42883, not a false-positive leak.
      expect(await repo.getCalculationPolicy({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId })).toBeNull();
      expect(await repo.listAssumptions({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId })).toEqual([]);
      expect(await repo.listCostLines({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId })).toEqual([]);
      expect(await repo.listBenefitLines({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId })).toEqual([]);
      expect(await repo.listScenarios({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId })).toEqual([]);
      expect(await repo.listCalculationRuns({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId })).toEqual([]);
      expect(
        await repo.getCalculationRun({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId, runId: runOutcome.result.runId })
      ).toBeNull();
    }
  );

  itDB(
    'Decision D14: listBenefitEvidenceLinks always returns link metadata to a viewer who can see the case, but ' +
      'kpiDetails is null for a viewer without visibility into the specific linked KPI',
    async () => {
      const initiativeId = `${INITIATIVE_ID}-2`;
      await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
        initiativeId,
        ORG_ID,
        'Vis-join fixture initiative 2',
      ]);
      const createOutcome = await createRoiCase({
        organizationId: ORG_ID,
        initiativeId,
        title: 'Evidence-link fixture case',
        ownerUserId: USER_GRANTEE,
        currency: 'USD',
        createdBy: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `create-${randomUUID()}`,
      });
      const caseId = createOutcome.result.case.caseId;
      // createRoiCase already grants a 'contribute' ACL row to createdBy/ownerUserId
      // (here both USER_GRANTEE) per its own §4.1 logic — granting it again here would
      // be a redundant duplicate-key INSERT, not a real product bug.
      await grantAcl('roi_case', caseId, USER_CASE_ONLY, USER_GRANTEE);

      const benefitOutcome = await addBenefitLine({
        caseId,
        organizationId: ORG_ID,
        category: 'revenue',
        label: 'KPI-linked revenue',
        amount: 500,
        currency: 'USD',
        timingType: 'one_time',
        oneTimePeriodDate: '2026-02-01',
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `benefit-${randomUUID()}`,
      });

      const kpiId = randomUUID();
      const definitionVersionId = randomUUID();
      await insertKpiFixture(kpiId, definitionVersionId);

      await addBenefitEvidenceLink({
        benefitLineId: benefitOutcome.result.benefitLineId,
        caseId,
        organizationId: ORG_ID,
        kpiId,
        pinnedKpiDefinitionVersionId: definitionVersionId,
        purpose: 'primary_evidence',
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `link-${randomUUID()}`,
      });

      // USER_GRANTEE has both case AND KPI visibility — full hydration.
      const granteeLinks = await repo.listBenefitEvidenceLinks({
        userId: USER_GRANTEE,
        organizationId: ORG_ID,
        caseId,
        benefitLineId: benefitOutcome.result.benefitLineId,
        hydrateKpiDetails: true,
      });
      expect(granteeLinks).toHaveLength(1);
      expect(granteeLinks[0]!.kpiId).toBe(kpiId);
      expect(granteeLinks[0]!.kpiDetails).not.toBeNull();
      expect(granteeLinks[0]!.kpiDetails?.kpiId).toBe(kpiId);

      // USER_CASE_ONLY can see the CASE (and therefore the link's own
      // metadata: pinned id/version/purpose) but has NO KPI visibility on
      // this specific KPI — kpiDetails must be null, not the KPI's content.
      const caseOnlyLinks = await repo.listBenefitEvidenceLinks({
        userId: USER_CASE_ONLY,
        organizationId: ORG_ID,
        caseId,
        benefitLineId: benefitOutcome.result.benefitLineId,
        hydrateKpiDetails: true,
      });
      expect(caseOnlyLinks).toHaveLength(1);
      expect(caseOnlyLinks[0]!.kpiId).toBe(kpiId); // the link's own pinned reference is always visible
      expect(caseOnlyLinks[0]!.purpose).toBe('primary_evidence');
      expect(caseOnlyLinks[0]!.kpiDetails).toBeNull(); // but the KPI's own content is not

      // A true outsider to the CASE itself sees no link at all.
      const outsiderLinks = await repo.listBenefitEvidenceLinks({
        userId: USER_OUTSIDER,
        organizationId: ORG_ID,
        caseId,
        benefitLineId: benefitOutcome.result.benefitLineId,
        hydrateKpiDetails: true,
      });
      expect(outsiderLinks).toEqual([]);
    }
  );
});
