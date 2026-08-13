/**
 * ROI-E003 — `roiApprovalSnapshotRepository.ts` visibility join + D11
 * read-time KPI redaction, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E003_DESIGN.md §5 (Decision D11).
 *
 * Proves: the `::text` cast on the new `rvn_roi_approval_snapshots.case_id`
 * join executes correctly against real rows (no Postgres 42883); two
 * readers with different KPI-visibility scopes reading the SAME approval
 * snapshot get DIFFERENT `kpiDetails` hydration for the same evidence link
 * (grantee sees the KPI's code/status, a case-only reader gets `null`), while
 * both see the IDENTICAL `contentHash` — the redaction is response-only and
 * never touches the stored/hashed payload.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ensureRoiFixtureOrganization } from './roiRealdbOrgFixture.js';

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
const ORG_ID = `roi-e003-vis-join-org-${tag}`;
const USER_GRANTEE = `roi-e003-vis-join-grantee-${tag}`; // sees the case AND the KPI
const USER_CASE_ONLY = `roi-e003-vis-join-case-only-${tag}`; // sees the case, not the KPI
const USER_OUTSIDER = `roi-e003-vis-join-outsider-${tag}`; // sees neither
const INITIATIVE_ID = `roi-e003-vis-join-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type BaselineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type CostLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type EvidenceLinkCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.js');
type CalcRunCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js');
type ApprovalCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js');
type RepositoryModule = typeof import('../../../server/src/services/resultsVnext/roi/roiApprovalSnapshotRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let startModeling: CaseCommandsModule['startModeling'];
let markReadyForReview: CaseCommandsModule['markReadyForReview'];
let captureOrUpdateBaseline: BaselineCommandsModule['captureOrUpdateBaseline'];
let addCostLine: CostLineCommandsModule['addCostLine'];
let addBenefitLine: BenefitLineCommandsModule['addBenefitLine'];
let addBenefitEvidenceLink: EvidenceLinkCommandsModule['addBenefitEvidenceLink'];
let createRoiCalculationRun: CalcRunCommandsModule['createRoiCalculationRun'];
let submitRoiCaseForApproval: ApprovalCommandsModule['submitRoiCaseForApproval'];
let approveRoiCase: ApprovalCommandsModule['approveRoiCase'];
let repo: RepositoryModule;
let closePgPool: (() => Promise<void>) | undefined;

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
    `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, created_by) VALUES ($1, $2, $3, 'active', $4)`,
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
  // Only USER_GRANTEE is ACL-granted on the KPI itself.
  await grantAcl('kpi', kpiId, USER_GRANTEE, USER_GRANTEE);
}

describe('ROI-E003 approval-snapshot visibility join + D11 read-time KPI redaction — real Postgres', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E003 visibility-join realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_approval_snapshots LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL,
           user_id TEXT NOT NULL,
           role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id)
         )`
      );
      // `initiatives.organization_id` carries a real FK to `organizations(id)`
      // on a fully-migrated schema, which makes the defensive
      // `CREATE TABLE IF NOT EXISTS initiatives` below a no-op rather than the
      // stub it looks like — so the organization row has to exist first.
      await ensureRoiFixtureOrganization(client, ORG_ID, 'roiApprovalSnapshotVisibilityJoin realdb fixture org');
      await client.query(
        `CREATE TABLE IF NOT EXISTS initiatives (
           id TEXT PRIMARY KEY,
           organization_id TEXT NOT NULL,
           name TEXT NOT NULL
         )`
      );
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the ROI-E003 schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const caseCommands: CaseCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
    createRoiCase = caseCommands.createRoiCase;
    startModeling = caseCommands.startModeling;
    markReadyForReview = caseCommands.markReadyForReview;
    const baselineCommands: BaselineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js'
    );
    captureOrUpdateBaseline = baselineCommands.captureOrUpdateBaseline;
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
    const calcRunCommands: CalcRunCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCalculationRunCommands.js'
    );
    createRoiCalculationRun = calcRunCommands.createRoiCalculationRun;
    const approvalCommands: ApprovalCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js'
    );
    submitRoiCaseForApproval = approvalCommands.submitRoiCaseForApproval;
    approveRoiCase = approvalCommands.approveRoiCase;
    repo = await import('../../../server/src/services/resultsVnext/roi/roiApprovalSnapshotRepository.js');

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    await insertVisibilityPolicy('roi', 'RESTRICTED_ACL', USER_GRANTEE);
    kpiPolicyId = await insertVisibilityPolicy('kpi', 'RESTRICTED_ACL', USER_GRANTEE);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(
      `UPDATE rvn_roi_cases SET original_approved_snapshot_id = NULL, latest_approved_snapshot_id = NULL,
              decision_calculation_run_id = NULL
        WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_roi_approval_snapshots WHERE organization_id = $1`, [ORG_ID]);
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
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
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
    '::text join correctness + D11: two readers with different KPI visibility get different kpiDetails for the ' +
      'same evidence link, but identical contentHash both times; a true outsider sees nothing',
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
      // createRoiCase already ACL-grants createdBy/ownerUserId (both
      // USER_GRANTEE here) — grant USER_CASE_ONLY explicitly, USER_OUTSIDER
      // gets none.
      await grantAcl('roi_case', caseId, USER_CASE_ONLY, USER_GRANTEE);

      const startOutcome = await startModeling({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: createOutcome.result.case.rowVersion,
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `start-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      await captureOrUpdateBaseline({
        organizationId: ORG_ID,
        caseId,
        expectedVersion: createOutcome.result.baseline.rowVersion,
        currentMeasuredValue: 100,
        baselinePeriodStart: '2026-01-01',
        baselinePeriodEnd: '2026-01-31',
        actorId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `baseline-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      await addCostLine({
        caseId,
        organizationId: ORG_ID,
        category: 'implementation',
        label: 'Setup',
        amount: 1000,
        currency: 'USD',
        timingType: 'one_time',
        oneTimePeriodDate: '2026-01-15',
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `cost-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const benefitLineOutcome = await addBenefitLine({
        caseId,
        organizationId: ORG_ID,
        category: 'revenue',
        label: 'KPI-linked revenue',
        amount: 2000,
        currency: 'USD',
        timingType: 'one_time',
        oneTimePeriodDate: '2026-02-15',
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `benefit-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      const kpiId = randomUUID();
      const definitionVersionId = randomUUID();
      await insertKpiFixture(kpiId, definitionVersionId);

      await addBenefitEvidenceLink({
        benefitLineId: benefitLineOutcome.result.benefitLineId,
        caseId,
        organizationId: ORG_ID,
        kpiId,
        pinnedKpiDefinitionVersionId: definitionVersionId,
        purpose: 'primary_evidence',
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `link-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      await createRoiCalculationRun({
        organizationId: ORG_ID,
        caseId,
        scenarioId: null,
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `run-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      const readyOutcome = await markReadyForReview({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: startOutcome.resultingVersion,
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `ready-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const submitOutcome = await submitRoiCaseForApproval({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: readyOutcome.resultingVersion,
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `submit-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const approveOutcome = await approveRoiCase({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: submitOutcome.resultingVersion,
        approverId: USER_CASE_ONLY, // distinct from created_by/submitted_by (both USER_GRANTEE)
        actorEffectiveRole: 'admin',
        idempotencyKey: `approve-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
      const snapshotId = approveOutcome.result.snapshot.snapshotId;

      // listRoiApprovalSnapshots — case-level visibility only (no payload/
      // kpiDetails at this layer).
      const granteeList = await repo.listRoiApprovalSnapshots({ userId: USER_GRANTEE, organizationId: ORG_ID, caseId });
      expect(granteeList.map((s) => s.snapshotId)).toContain(snapshotId);
      const caseOnlyList = await repo.listRoiApprovalSnapshots({ userId: USER_CASE_ONLY, organizationId: ORG_ID, caseId });
      expect(caseOnlyList.map((s) => s.snapshotId)).toContain(snapshotId);
      const outsiderList = await repo.listRoiApprovalSnapshots({ userId: USER_OUTSIDER, organizationId: ORG_ID, caseId });
      expect(outsiderList).toEqual([]);

      // getRoiApprovalSnapshot — the D11 read-time redaction layer.
      const granteeDetail = await repo.getRoiApprovalSnapshot({
        userId: USER_GRANTEE,
        organizationId: ORG_ID,
        caseId,
        snapshotId,
      });
      expect(granteeDetail).not.toBeNull();
      expect(granteeDetail!.payload.benefitEvidenceLinks).toHaveLength(1);
      expect(granteeDetail!.payload.benefitEvidenceLinks[0]!.kpiId).toBe(kpiId);
      expect(granteeDetail!.payload.benefitEvidenceLinks[0]!.kpiDetails).not.toBeNull();
      expect(granteeDetail!.payload.benefitEvidenceLinks[0]!.kpiDetails?.kpiId).toBe(kpiId);

      const caseOnlyDetail = await repo.getRoiApprovalSnapshot({
        userId: USER_CASE_ONLY,
        organizationId: ORG_ID,
        caseId,
        snapshotId,
      });
      expect(caseOnlyDetail).not.toBeNull();
      expect(caseOnlyDetail!.payload.benefitEvidenceLinks).toHaveLength(1);
      // The link's own pinned metadata is always visible once the reader
      // can see the case at all.
      expect(caseOnlyDetail!.payload.benefitEvidenceLinks[0]!.kpiId).toBe(kpiId);
      expect(caseOnlyDetail!.payload.benefitEvidenceLinks[0]!.purpose).toBe('primary_evidence');
      // But the KPI's own content is redacted — no visibility into this
      // specific KPI.
      expect(caseOnlyDetail!.payload.benefitEvidenceLinks[0]!.kpiDetails).toBeNull();

      // Both readers see the IDENTICAL contentHash — the redaction is
      // response-only and never touches the stored/hashed payload.
      expect(caseOnlyDetail!.contentHash).toBe(granteeDetail!.contentHash);
      expect(caseOnlyDetail!.contentHash).toBe(approveOutcome.result.snapshot.contentHash);

      // A true outsider (no visibility into the CASE at all) gets null —
      // non-distinguishing between "doesn't exist" and "can't see it".
      const outsiderDetail = await repo.getRoiApprovalSnapshot({
        userId: USER_OUTSIDER,
        organizationId: ORG_ID,
        caseId,
        snapshotId,
      });
      expect(outsiderDetail).toBeNull();

      // Reading the same snapshot TWICE by the SAME reader also returns the
      // identical contentHash — proves getRoiApprovalSnapshot never
      // recomputes it.
      const granteeDetailAgain = await repo.getRoiApprovalSnapshot({
        userId: USER_GRANTEE,
        organizationId: ORG_ID,
        caseId,
        snapshotId,
      });
      expect(granteeDetailAgain!.contentHash).toBe(granteeDetail!.contentHash);
    }
  );
});
