/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — RESULTS domain guard.
 *
 * Proves the kernel, composed with the REAL `/api/v8/results` router
 * (`server/src/routes/v8/results.routes.ts`) in an express app, does not
 * block RESULTS-W01 (`POST /kpis`), refuses retired RESULTS-W33
 * (`POST /scorecards`) before mutation, and records tenant-scoped,
 * idempotent telemetry for each — and that a plain
 * GET is recorded as `legacy_read`, not a writer access.
 *
 * RESULTS has never had a cutover guard before this lane: mounting it here
 * is the first observation this router has ever had, which is why every
 * registered writer is `protected` or `observed`, never `disabled` (see
 * `../registry/results.ts`).
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupLegacyCutoverTestIntents } from './legacyCutoverTestCleanup.js';

import { createLegacyCutoverGuard } from '../legacyCutoverKernel.js';
import { RESULTS_CUTOVER } from '../registry/results.js';
import { createRoiCase } from '../../resultsVnext/roi/roiCaseCommands.js';
import { addAssumption } from '../../resultsVnext/roi/roiAssumptionCommands.js';
import { addBenefitLine } from '../../resultsVnext/roi/roiBenefitLineCommands.js';
import { listAssumptions } from '../../resultsVnext/roi/roiEconomicModelRepository.js';
import { recordActualEntry } from '../../resultsVnext/roi/roiActualEntryCommands.js';
import { listActualEntries } from '../../resultsVnext/roi/roiActualEntryRepository.js';
import {
  publishRoiGovernedVisibilityPolicy,
  ROI_GOVERNED_VISIBILITY_POLICY,
} from '../../resultsVnext/platform/visibilityResolver.js';
import { createDefinition } from '../../results/kpiDefinitionService.js';
import {
  approveDefinitionVersion,
  archiveKpi,
  createKpiDraft,
  editDraft,
  submitDefinition,
} from '../../resultsVnext/kpi/kpiDefinitionCommands.js';
import { recordMeasurement } from '../../resultsVnext/kpi/kpiMeasurementCommands.js';
import { proposeInitiativeKpiImpact } from '../../resultsVnext/kpi/kpiInitiativeImpactCommands.js';
import { getKpi, listMeasurements } from '../../resultsVnext/kpi/kpiRepository.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';

const prefix = `results-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const actor = `${prefix}-actor`;
const checker = `${prefix}-checker`;

describe.skipIf(!REAL_PG)('RESULTS legacy-cutover guard (fresh real PostgreSQL)', () => {
  let pool: Pool;
  let app: express.Express;

  // results.routes.ts has no router-level auth middleware of its own (unlike
  // meeting.routes.ts) — it reads context via getV8Context(req), which reads
  // req.v8Context directly. So, exactly like financeSecondDoor.pg.test.ts,
  // this sets v8Context (and req.user for the P04-B role gate inside the
  // router) without needing any token bypass.
  function authenticate(req: any, _res: any, next: any): void {
    const organizationId = String(req.headers['x-test-org'] || orgA);
    req.user = { id: actor, organizationId, role: 'admin' };
    req.userId = actor;
    req.organizationId = organizationId;
    req.v8Context = { organizationId, userId: actor, userRole: 'admin' };
    next();
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: CONNECTION_STRING });
    const now = new Date().toISOString();
    for (const org of [orgA, orgB]) {
      await pool.query(
        `INSERT INTO organizations(id,name,plan,status,is_active,created_at)
         VALUES($1,$2,'enterprise','active',1,$3) ON CONFLICT (id) DO NOTHING`,
        [org, org, now]
      );
    }
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,created_at)
       VALUES($1,$2,$3,'unused','ADMIN','active',$4) ON CONFLICT(id) DO NOTHING`,
      [actor, orgA, `${actor}@test.invalid`, now]
    );
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,created_at)
       VALUES($1,$2,$3,'unused','ADMIN','active',$4) ON CONFLICT(id) DO NOTHING`,
      [checker, orgA, `${checker}@test.invalid`, now]
    );
    for (const org of [orgA, orgB])
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
         VALUES($1,$2,$3,'ADMIN','ACTIVE',$4) ON CONFLICT(organization_id,user_id) DO NOTHING`,
        [`${prefix}-${org}-membership`, org, actor, now]
      );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES($1,$2,$3,'ADMIN','ACTIVE',$4) ON CONFLICT(organization_id,user_id) DO NOTHING`,
      [`${prefix}-checker-membership`, orgA, checker, now]
    );

    const resultsRouter = (await import('../../../routes/v8/results.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use(
      '/api/v8/results',
      authenticate,
      createLegacyCutoverGuard(RESULTS_CUTOVER),
      resultsRouter
    );
    app.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
    await createDefinition({ organizationId: orgA, name: `${prefix}-kpi`, actorUserId: actor });
  }, 90_000);

  afterAll(async () => {
    if (!pool) return;
    await cleanupLegacyCutoverTestIntents(pool, {
      organizationIds: [orgA, orgB],
      requestIdPrefix: prefix,
    });
    await pool.query(`DELETE FROM kpi_metric_audit_log WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    // initiative_kpis.current_definition_version FKs into
    // kpi_definition_versions (fk_initiative_kpis_current_version) — the
    // referencing row must go first.
    await pool.query(`DELETE FROM initiative_kpis WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM kpi_definition_versions WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM kpi_scorecards WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM legacy_cutover_signal_intents WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM rvn_roi_actual_entries WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM rvn_roi_benefit_lines WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM rvn_roi_assumptions WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM rvn_kpi_deviation_cases WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN
         (SELECT event_id FROM rvn_platform_events WHERE organization_id = ANY($1))`,
      [[orgA, orgB]]
    );
    await pool.query(`DELETE FROM rvn_platform_events WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(
      `DELETE FROM rvn_platform_resource_visibility WHERE organization_id = ANY($1)`,
      [[orgA, orgB]]
    );
    await pool.query(`DELETE FROM rvn_roi_cases WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM rvn_kpi_initiative_impacts WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id=NULL WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(
      `DELETE FROM rvn_platform_visibility_policies WHERE organization_id = ANY($1)`,
      [[orgA, orgB]]
    );
    await pool.query(`DELETE FROM initiatives WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[actor, checker]]);
    // rvn_roi_visibility_governance is deliberately append-only. The fresh
    // disposable consultify_b1_* database is dropped by the calling gate;
    // do not disable its trigger merely to erase the published policy.
    await pool.end();
  });

  it.each([
    { writerId: 'RESULTS-W01', method: 'post' as const, path: '/api/v8/results/kpis', successor: '/api/vnext/results/kpi', body: { name: `${prefix}-kpi` } },
    { writerId: 'RESULTS-W02', method: 'put' as const, path: '/api/v8/results/kpis/legacy-kpi', successor: '/api/vnext/results/kpi/:kpiId/draft', body: { name: 'forbidden direct edit' } },
    { writerId: 'RESULTS-W03', method: 'delete' as const, path: '/api/v8/results/kpis/legacy-kpi', successor: '/api/vnext/results/kpi/:kpiId/archive', body: {} },
    { writerId: 'RESULTS-W04', method: 'post' as const, path: '/api/v8/results/kpis/legacy-kpi/time-series', successor: '/api/vnext/results/kpi/:kpiId/measurements', body: { value: 99, periodStart: '2026-08-19' } },
    { writerId: 'RESULTS-W17', method: 'post' as const, path: '/api/v8/results/kpi-mappings', successor: '/api/vnext/results/initiatives/initiative-impacts', body: { initiativeId: 'legacy-initiative', kpiId: 'legacy-kpi' } },
  ])('refuses Wave 4 writer $writerId before mutation', async (entry) => {
    const requestId = `${prefix}-${entry.writerId.toLowerCase()}`;
    const before = await pool.query(`SELECT
      (SELECT count(*)::int FROM initiative_kpis WHERE organization_id=$1) kpis,
      (SELECT count(*)::int FROM initiative_kpi_mappings m JOIN initiatives i ON i.id=m.initiative_id WHERE i.organization_id=$1) mappings,
      (SELECT count(*)::int FROM kpi_time_series ts JOIN initiative_kpis k ON k.id=ts.kpi_id WHERE k.organization_id=$1) measurements`, [orgA]);
    const response = await request(app)[entry.method](entry.path).set('x-request-id', requestId).send(entry.body);
    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({ code: 'RESULTS_LEGACY_WRITER_DISABLED', writerId: entry.writerId, successor: entry.successor });
    const after = await pool.query(`SELECT
      (SELECT count(*)::int FROM initiative_kpis WHERE organization_id=$1) kpis,
      (SELECT count(*)::int FROM initiative_kpi_mappings m JOIN initiatives i ON i.id=m.initiative_id WHERE i.organization_id=$1) mappings,
      (SELECT count(*)::int FROM kpi_time_series ts JOIN initiative_kpis k ON k.id=ts.kpi_id WHERE k.organization_id=$1) measurements`, [orgA]);
    expect(after.rows).toEqual(before.rows);
  });

  it('writes and cold-reads the exact canonical KPI create, impact and archive successors', async () => {
    await pool.query(`INSERT INTO rvn_platform_visibility_policies
      (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
      VALUES ($1,'kpi',1,'OPEN_ORG',true,$2) ON CONFLICT DO NOTHING`, [orgA, actor]);
    const initiativeId = `${prefix}-canonical-initiative`;
    await pool.query(`INSERT INTO initiatives(id,organization_id,name,status) VALUES($1,$2,$3,'DRAFT')`, [initiativeId, orgA, 'Wave 4 canonical initiative']);
    const access = { capabilities: ['*'], platformRole: 'ADMIN' as const };
    const created = await createKpiDraft({
      organizationId: orgA, kpiCode: `${prefix}-canonical`, name: 'Wave 4 canonical KPI',
      targetGeometry: 'exact', targetValue: 1, createdBy: actor, actorEffectiveRole: 'ADMIN',
      idempotencyKey: `${prefix}-canonical-create`, access,
    });
    const kpiId = created.result.kpi.kpiId;
    const impact = await proposeInitiativeKpiImpact({
      organizationId: orgA, kpiId, initiativeId, expectedContributionValue: 1,
      expectedContributionDirection: 'increase', targetCompletionDate: null, proposedBy: actor,
      actorEffectiveRole: 'ADMIN', idempotencyKey: `${prefix}-canonical-impact`, access,
    });
    expect(impact.result.impact).toMatchObject({ kpiId, initiativeId, status: 'proposed' });
    const archived = await archiveKpi({
      organizationId: orgA, kpiId, expectedVersion: created.result.kpi.rowVersion,
      actorUserId: actor, actorEffectiveRole: 'ADMIN', idempotencyKey: `${prefix}-canonical-archive`, access,
    });
    expect(archived.result.status).toBe('archived');
    const cold = await getKpi({ userId: actor, organizationId: orgA, kpiId });
    expect(cold).toMatchObject({ kpiId, status: 'archived' });
  });

  it('runs governed definition lifecycle and atomically records threshold status plus deviation', async () => {
    await pool.query(
      `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
       VALUES ($1,'kpi',2,'OPEN_ORG',true,$2) ON CONFLICT DO NOTHING`,
      [orgA, actor]
    );
    const access = { capabilities: ['*'], platformRole: 'ADMIN' as const };
    const created = await createKpiDraft({
      organizationId: orgA,
      kpiCode: `${prefix}-wave5`,
      name: 'Wave 5 governed KPI',
      targetGeometry: 'threshold_min',
      targetValue: 100,
      warningLow: 80,
      createdBy: actor,
      actorEffectiveRole: 'ADMIN',
      idempotencyKey: `${prefix}-w5-create`,
      access,
    });
    const { kpi, definitionVersion } = created.result;
    const edited = await editDraft({
      definitionVersionId: definitionVersion.definitionVersionId,
      organizationId: orgA,
      expectedVersion: definitionVersion.rowVersion,
      name: 'Wave 5 governed KPI edited',
      targetValue: 110,
      warningLow: 90,
      actorUserId: actor,
      actorEffectiveRole: 'ADMIN',
      idempotencyKey: `${prefix}-w5-edit`,
      access,
    });
    const submitted = await submitDefinition({
      definitionVersionId: definitionVersion.definitionVersionId,
      organizationId: orgA,
      expectedVersion: edited.result.rowVersion,
      actorUserId: actor,
      actorEffectiveRole: 'ADMIN',
      idempotencyKey: `${prefix}-w5-submit`,
      access,
    });
    const approved = await approveDefinitionVersion({
      definitionVersionId: definitionVersion.definitionVersionId,
      organizationId: orgA,
      expectedVersion: submitted.result.rowVersion,
      approverId: checker,
      actorEffectiveRole: 'ADMIN',
      idempotencyKey: `${prefix}-w5-approve`,
      access,
    });
    expect(approved.result).toMatchObject({ approvalStatus: 'approved', targetValue: 110 });

    const measurementInput = {
      kpiId: kpi.kpiId,
      definitionVersionId: definitionVersion.definitionVersionId,
      organizationId: orgA,
      periodStart: '2026-08-01T00:00:00.000Z',
      periodEnd: '2026-08-31T23:59:59.999Z',
      actualValue: 50,
      // Deliberately forged: the command must recompute from immutable bounds.
      performanceStatus: 'on_target' as const,
      source: 'results-wave5-realpg',
      recordedBy: actor,
      actorEffectiveRole: 'ADMIN',
      idempotencyKey: `${prefix}-w5-measure`,
      reason: 'W04 canonical successor proof',
    };
    const first = await recordMeasurement(measurementInput);
    const retry = await recordMeasurement(measurementInput);
    expect(retry.result.measurementId).toBe(first.result.measurementId);
    expect(first.result.performanceStatus).toBe('critical');
    await expect(
      recordMeasurement({ ...measurementInput, actualValue: 51 })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_FINGERPRINT_CONFLICT' });
    const sameKeyRows = await pool.query(
      `SELECT count(*)::int count FROM rvn_kpi_measurements
        WHERE organization_id=$1 AND kpi_id=$2 AND period_start=$3`,
      [orgA, kpi.kpiId, measurementInput.periodStart]
    );
    expect(sameKeyRows.rows).toEqual([{ count: 1 }]);

    const concurrentInput = {
      ...measurementInput,
      periodStart: '2026-09-01T00:00:00.000Z',
      periodEnd: '2026-09-30T23:59:59.999Z',
      idempotencyKey: `${prefix}-w5-measure-concurrent`,
    };
    const concurrent = await Promise.all([
      recordMeasurement(concurrentInput),
      recordMeasurement(concurrentInput),
    ]);
    expect(new Set(concurrent.map((result) => result.result.measurementId)).size).toBe(1);
    await expect(
      recordMeasurement({ ...concurrentInput, idempotencyKey: `${prefix}-w5-period-collision` })
    ).rejects.toMatchObject({ code: '23505' });

    const cold = await listMeasurements({
      userId: actor,
      organizationId: orgA,
      kpiId: kpi.kpiId,
      includeSuperseded: true,
    });
    expect(cold).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
        measurementId: first.result.measurementId,
        definitionVersionId: definitionVersion.definitionVersionId,
        performanceStatus: 'critical',
        }),
      ])
    );
    const deviations = await pool.query(
      `SELECT case_id, kpi_id, trigger_measurement_id, severity, status
         FROM rvn_kpi_deviation_cases
        WHERE organization_id=$1 AND kpi_id=$2`,
      [orgA, kpi.kpiId]
    );
    expect(deviations.rows).toEqual([
      expect.objectContaining({
        kpi_id: kpi.kpiId,
        trigger_measurement_id: first.result.measurementId,
        severity: 'critical',
      }),
    ]);

    await expect(
      recordMeasurement({ ...measurementInput, organizationId: orgB, idempotencyKey: `${prefix}-foreign` })
    ).rejects.toMatchObject({ code: 'MEASUREMENT_NOT_FOUND' });
  });

  it('refuses retired scorecard create (RESULTS-W33) with its canonical successor', async () => {
    const response = await request(app)
      .post('/api/v8/results/scorecards')
      .set('x-request-id', `${prefix}-scorecard-create-1`)
      .send({ name: `${prefix}-scorecard` });
    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({
      code: 'RESULTS_LEGACY_WRITER_DISABLED',
      writerId: 'RESULTS-W33',
      successor: '/api/vnext/results/kpi/scorecards',
    });

    const legacyRows = await pool.query(
      `SELECT id FROM kpi_scorecards WHERE organization_id = $1 AND name = $2`,
      [orgA, `${prefix}-scorecard`]
    );
    expect(legacyRows.rows).toHaveLength(0);
  });

  it.each([
    {
      writerId: 'RESULTS-W35',
      method: 'post' as const,
      path: '/api/v8/results/scorecards/legacy-card/kpis',
      successor: '/api/vnext/results/kpi/scorecards/:scorecardId/items',
      body: { kpiId: 'legacy-kpi' },
    },
    {
      writerId: 'RESULTS-W36',
      method: 'delete' as const,
      path: '/api/v8/results/scorecards/legacy-card/kpis/legacy-kpi',
      successor: '/api/vnext/results/kpi/scorecards/:scorecardId/items/:itemId',
      body: {},
    },
  ])(
    'refuses retired scorecard item mutation $writerId before handler execution',
    async (entry) => {
      const requestId = `${prefix}-${entry.writerId.toLowerCase()}`;
      const response = await request(app)
        [entry.method](entry.path)
        .set('x-request-id', requestId)
        .send(entry.body);

      expect(response.status).toBe(410);
      expect(response.body).toMatchObject({
        code: 'RESULTS_LEGACY_WRITER_DISABLED',
        writerId: entry.writerId,
        successor: entry.successor,
      });

      const mutationRows = await pool.query(
        `SELECT id FROM kpi_scorecard_items
        WHERE organization_id = $1 AND (scorecard_id = $2 OR kpi_id = $3)`,
        [orgA, 'legacy-card', 'legacy-kpi']
      );
      expect(mutationRows.rows).toHaveLength(0);
    }
  );

  it.each([
    {
      writerId: 'RESULTS-W19',
      method: 'post' as const,
      path: '/api/v8/results/deviation-cases/legacy-case/acknowledge',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/acknowledge',
      body: {},
    },
    {
      writerId: 'RESULTS-W20',
      method: 'put' as const,
      path: '/api/v8/results/deviation-cases/legacy-case/rca',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/root-cause',
      body: { rcaText: 'legacy' },
    },
    {
      writerId: 'RESULTS-W21',
      method: 'post' as const,
      path: '/api/v8/results/deviation-cases/legacy-case/actions',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/corrective-actions',
      body: { title: 'legacy' },
    },
    {
      writerId: 'RESULTS-W22',
      method: 'put' as const,
      path: '/api/v8/results/deviation-cases/legacy-case/actions/legacy-action',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/corrective-actions/:actionId',
      body: { status: 'DONE' },
    },
    {
      writerId: 'RESULTS-W24',
      method: 'post' as const,
      path: '/api/v8/results/deviation-cases/legacy-case/close',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/close',
      body: { evidenceText: 'legacy' },
    },
  ])('refuses retired deviation mutation $writerId before handler execution', async (entry) => {
    const response = await request(app)
      [entry.method](entry.path)
      .set('x-request-id', `${prefix}-${entry.writerId.toLowerCase()}`)
      .send(entry.body);

    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({
      code: 'RESULTS_LEGACY_WRITER_DISABLED',
      writerId: entry.writerId,
      successor: entry.successor,
    });

    const legacyCases = await pool.query(
      `SELECT id FROM kpi_deviation_cases WHERE organization_id = $1 AND id = $2`,
      [orgA, 'legacy-case']
    );
    const legacyActions = await pool.query(`SELECT id FROM kpi_deviation_actions WHERE id = $1`, [
      'legacy-action',
    ]);
    expect(legacyCases.rows).toHaveLength(0);
    expect(legacyActions.rows).toHaveLength(0);
  });

  it.each([
    {
      writerId: 'RESULTS-W48',
      method: 'put' as const,
      path: '/api/v8/results/roi/initiative/legacy-initiative/assumptions',
      successor: '/api/vnext/results/roi/cases/:caseId/assumptions',
      body: { expectedRevenueDelta: 123 },
      table: 'roi_assumptions',
    },
    {
      writerId: 'RESULTS-W49',
      method: 'post' as const,
      path: '/api/v8/results/roi/initiative/legacy-initiative/realized',
      successor: '/api/vnext/results/roi/cases/:caseId/actuals',
      body: { periodMonth: '2026-08-01', realizedSavings: 123 },
      table: 'roi_realized_values',
    },
  ])('refuses retired ROI mutation $writerId before any legacy row is written', async (entry) => {
    const requestId = `${prefix}-${entry.writerId.toLowerCase()}`;
    const response = await request(app)
      [entry.method](entry.path)
      .set('x-request-id', requestId)
      .send(entry.body);

    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({
      code: 'RESULTS_LEGACY_WRITER_DISABLED',
      writerId: entry.writerId,
      successor: entry.successor,
    });
    const legacyRows = await pool.query(
      `SELECT id FROM ${entry.table} WHERE organization_id = $1 AND initiative_id = $2`,
      [orgA, 'legacy-initiative']
    );
    expect(legacyRows.rows).toHaveLength(0);

    const telemetry = await pool.query(
      `SELECT access_kind, writer_id, organization_id
         FROM legacy_cutover_usage_events
        WHERE domain = 'results' AND organization_id = $1 AND request_id = $2`,
      [orgA, requestId]
    );
    expect(telemetry.rows).toEqual([
      { access_kind: 'legacy_writer_blocked', writer_id: entry.writerId, organization_id: orgA },
    ]);
  });

  it('writes and cold-reads assumptions and actuals through canonical ROI case identity only', async () => {
    const initiativeId = `${prefix}-canonical-roi-initiative`;
    await pool.query(
      `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, 'EXECUTING')`,
      [initiativeId, orgA, `${prefix} canonical ROI`]
    );
    await publishRoiGovernedVisibilityPolicy({
      organizationId: orgA,
      actorUserId: actor,
      policyKey: ROI_GOVERNED_VISIBILITY_POLICY.key,
      policyDigest: ROI_GOVERNED_VISIBILITY_POLICY.digest,
      idempotencyKey: `${prefix}-roi-policy`,
    });

    const created = await createRoiCase({
      organizationId: orgA,
      initiativeId,
      title: `${prefix} canonical case`,
      ownerUserId: actor,
      currency: 'EUR',
      createdBy: actor,
      actorEffectiveRole: 'admin',
      idempotencyKey: `${prefix}-roi-case`,
    });
    const caseId = created.result.case.caseId;
    const access = { capabilities: ['*'], platformRole: null };

    const assumption = await addAssumption({
      caseId,
      organizationId: orgA,
      category: 'benefit',
      label: 'Canonical revenue assumption',
      unit: 'EUR',
      baseValue: 123,
      confidence: 'high',
      source: 'results-cutover-wave3',
      actorUserId: actor,
      actorEffectiveRole: 'admin',
      idempotencyKey: `${prefix}-roi-assumption`,
      reason: 'RESULTS-W48 canonical successor proof',
      access,
    });
    const benefit = await addBenefitLine({
      caseId,
      organizationId: orgA,
      category: 'revenue',
      label: 'Canonical realized benefit',
      isFinancial: true,
      amount: 123,
      currency: 'EUR',
      timingType: 'one_time',
      oneTimePeriodDate: '2026-08-01',
      actorUserId: actor,
      actorEffectiveRole: 'admin',
      idempotencyKey: `${prefix}-roi-benefit`,
      reason: 'RESULTS-W49 canonical successor fixture',
      access,
    });
    // The lifecycle is independently covered by ROI lifecycle realDB suites;
    // this fixture transition isolates the two successor writers/readbacks.
    await pool.query(
      `UPDATE rvn_roi_cases SET status='tracking' WHERE case_id=$1 AND organization_id=$2`,
      [caseId, orgA]
    );
    const actual = await recordActualEntry({
      caseId,
      organizationId: orgA,
      entryType: 'benefit',
      benefitLineId: benefit.result.benefitLineId,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      amount: 123,
      currency: 'EUR',
      source: 'results-cutover-wave3',
      evidenceRefs: ['receipt:results-w49'],
      notes: 'canonical actual',
      recordedBy: actor,
      actorEffectiveRole: 'admin',
      idempotencyKey: `${prefix}-roi-actual`,
      reason: 'RESULTS-W49 canonical successor proof',
    });

    const coldAssumptions = await listAssumptions({ userId: actor, organizationId: orgA, caseId });
    const coldActuals = await listActualEntries({ userId: actor, organizationId: orgA, caseId });
    expect(coldAssumptions).toEqual([
      expect.objectContaining({
        assumptionId: assumption.result.assumptionId,
        caseId,
        baseValue: 123,
        source: 'results-cutover-wave3',
      }),
    ]);
    expect(coldActuals).toEqual([
      expect.objectContaining({
        actualEntryId: actual.result.actualEntryId,
        caseId,
        benefitLineId: benefit.result.benefitLineId,
        amount: 123,
        source: 'results-cutover-wave3',
      }),
    ]);
    const legacyRows = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM roi_assumptions WHERE organization_id=$1 AND initiative_id=$2) assumptions,
         (SELECT count(*)::int FROM roi_realized_values WHERE organization_id=$1 AND initiative_id=$2) actuals`,
      [orgA, initiativeId]
    );
    expect(legacyRows.rows).toEqual([{ assumptions: 0, actuals: 0 }]);
  });

  it('records one durable, tenant-scoped observation row per writer', async () => {
    const rows = await pool.query(
      `SELECT writer_id, access_kind, organization_id, tenant_resolution, route_path
         FROM legacy_cutover_usage_events
        WHERE domain = 'results' AND organization_id = $1
          AND request_id IN ($2, $3)
        ORDER BY writer_id`,
      [orgA, `${prefix}-results-w01`, `${prefix}-scorecard-create-1`]
    );
    expect(rows.rows).toEqual([
      {
        writer_id: 'RESULTS-W01',
        access_kind: 'legacy_writer_blocked',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/v8/results/kpis',
      },
      {
        writer_id: 'RESULTS-W33',
        access_kind: 'legacy_writer_blocked',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/v8/results/scorecards',
      },
    ]);
  });

  it('records a GET as legacy_read, not a writer access', async () => {
    const response = await request(app)
      .get('/api/v8/results/kpis')
      .set('x-request-id', `${prefix}-kpi-list-1`);
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);

    const rows = await pool.query(
      `SELECT access_kind, route_path FROM legacy_cutover_usage_events
        WHERE domain = 'results' AND organization_id = $1 AND request_id = $2`,
      [orgA, `${prefix}-kpi-list-1`]
    );
    expect(rows.rows).toEqual([{ access_kind: 'legacy_read', route_path: '/api/v8/results/kpis' }]);
  });

  it('keeps the signed legacy scorecard list as an explicit read-only archive', async () => {
    const response = await request(app)
      .get('/api/v8/results/scorecards')
      .set('x-request-id', `${prefix}-scorecard-archive`);

    expect(response.status).toBe(200);
    expect(response.headers['x-consultify-archive-mode']).toBe('read-only');
    expect(response.body.meta).toMatchObject({ archiveMode: 'read_only' });
  });

  it('marks the signed legacy KPI drawer and deviation history as read-only archive', async () => {
    const row = await pool.query(
      `SELECT id FROM initiative_kpis WHERE organization_id = $1 AND name = $2 LIMIT 1`,
      [orgA, `${prefix}-kpi`]
    );
    const kpiId = String(row.rows[0]?.id || '');
    expect(kpiId).not.toBe('');

    const response = await request(app)
      .get(`/api/v8/results/kpis/${encodeURIComponent(kpiId)}/drawer-detail`)
      .set('x-request-id', `${prefix}-drawer-archive`);

    expect(response.status).toBe(200);
    expect(response.headers['x-consultify-archive-mode']).toBe('read-only');
    expect(response.body.meta).toMatchObject({ archiveMode: 'read_only' });
  });

  it('is idempotent under a retried x-request-id', async () => {
    const requestId = `${prefix}-idempotent`;
    await request(app)
      .post('/api/v8/results/scorecards')
      .set('x-request-id', requestId)
      .send({ name: `${prefix}-idempotent-scorecard` });
    await request(app)
      .post('/api/v8/results/scorecards')
      .set('x-request-id', requestId)
      .send({ name: `${prefix}-idempotent-scorecard` });

    const rows = await pool.query(
      `SELECT id FROM legacy_cutover_usage_events
        WHERE domain = 'results' AND organization_id = $1 AND request_id = $2`,
      [orgA, requestId]
    );
    expect(rows.rows).toHaveLength(1);
  });

  it('attributes two tenants making the same call with the same x-request-id to one row each', async () => {
    const requestId = `${prefix}-tenant-isolation`;
    await request(app)
      .post('/api/v8/results/scorecards')
      .set('x-request-id', requestId)
      .set('x-test-org', orgA)
      .send({ name: `${prefix}-tenant-a-scorecard` });
    await request(app)
      .post('/api/v8/results/scorecards')
      .set('x-request-id', requestId)
      .set('x-test-org', orgB)
      .send({ name: `${prefix}-tenant-b-scorecard` });

    const rows = await pool.query(
      `SELECT organization_id FROM legacy_cutover_usage_events
        WHERE domain = 'results' AND request_id = $1 AND organization_id = ANY($2)
        ORDER BY organization_id`,
      [requestId, [orgA, orgB]]
    );
    expect(rows.rows).toEqual([{ organization_id: orgA }, { organization_id: orgB }]);
  });
});
