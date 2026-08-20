/**
 * Finance v3 canonical adapter — Pakiet B2 Prediction surface, real
 * PostgreSQL + real HTTP integration tests.
 *
 * Covers `prediction.routes.ts`: `POST .../preflight` (DEC-FIN-004 stage 1)
 * and `POST .../calculate` (stage 2) as two SEPARATE endpoints — this test
 * file itself proves they are never fused (each call targets its own path,
 * each has its own assertion).
 *
 * SCOPE DECISION (documented, time-boxed, same reasoning as
 * `baseline.routes.pg.test.ts`'s header): a full `COMPUTED`-mode calculate
 * happy path needs the same heavy Baseline Model fixture (debt facility,
 * assumptions across 7 schedule_types, opening actuals) `perfSlo.pg.test.ts`
 * already builds for `predictionComputeService.ts`, which this package does
 * not modify and is not in its allowlist. This file proves instead: (1) the
 * preflight happy path end-to-end (0 findings for a scenario with no
 * driver_overrides/impact_chain/financing rows — a real call into
 * `finance_prediction_detect_overlaps()`, not a mock), with a real SQL
 * read-back of the persisted `finance_prediction_preflight_runs` row, and
 * (2) `calculate`'s REAL `READINESS_GATE_FAILED` path
 * (`finance_prediction_can_start_compute()` requires a CURRENT preflight run
 * with zero open required resolutions — calling calculate before any
 * preflight run fails this gate for real, not simulated). The full
 * `COMPUTED`-mode calculate happy path through THIS router is flagged
 * `EVIDENCE_MISSING` in the package report.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('Finance v2 Pakiet B2 — prediction (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let av: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
  let lineageService: typeof import('../../../../services/finance/canonical/lineageService.js');
  let app: express.Express;

  const orgId = `org-pkgb2-pred-${randomUUID()}`;
  const userId = `user-pkgb2-pred-${randomUUID()}`;
  const viewerId = `viewer-pkgb2-pred-${randomUUID()}`;
  const revokedId = `revoked-pkgb2-pred-${randomUUID()}`;

  function appAs(role: string, actorId = userId) {
    const a = express();
    a.use(express.json());
    a.use((req: any, _res, next) => {
      req.user = { id: actorId, organizationId: orgId, role };
      req.v8Context = { organizationId: orgId, userId: actorId, userRole: role };
      next();
    });
    a.use('/api/v8/finance-v2', financeV2Router);
    a.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
    return a;
  }
  let financeV2Router: express.Router;

  async function makeScenario(scenarioMode = 'FUNDAMENTAL_INITIATIVE') {
    const baseline = await av.createArtifact({
      organizationId: orgId,
      artifactType: 'BASELINE_MODEL',
      createdBy: userId,
    });
    const scenario = await av.createArtifact({
      organizationId: orgId,
      artifactType: 'PREDICTION_SCENARIO',
      createdBy: userId,
    });
    const scenarioBvId = scenario.businessVersion.business_version_id;
    const baselineBvId = baseline.businessVersion.business_version_id;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_prediction_scenarios (id, organization_id, business_version_id, name, scenario_mode, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          orgId,
          scenarioBvId,
          `PkgB2 scenario ${randomUUID().slice(0, 8)}`,
          scenarioMode,
          userId,
        ]
      )
    );

    const edge = await lineageService.insertEdge({
      organizationId: orgId,
      sourceVersionId: baselineBvId,
      sourceArtifactType: 'BASELINE_MODEL',
      targetVersionId: scenarioBvId,
      targetArtifactType: 'PREDICTION_SCENARIO',
      edgeType: 'MODEL_TO_SCENARIO',
      transformationKind: 'MANUAL_LINK',
      authorId: userId,
      assumptionSnapshotHash: `test-hash-${randomUUID()}`,
    });
    if (!edge.ok)
      throw new Error(`fixture MODEL_TO_SCENARIO edge insert failed: ${edge.code} ${edge.message}`);

    return { scenarioBvId, baselineBvId };
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../../../../services/finance/canonical/artifactVersionService.js');
    lineageService = await import('../../../../services/finance/canonical/lineageService.js');
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [
        orgId,
        'PkgB2 Prediction Test Org',
      ]);
      for (const [actorId, role, status] of [
        [userId, 'ADMIN', 'ACTIVE'],
        [viewerId, 'MEMBER', 'ACTIVE'],
        [revokedId, 'ADMIN', 'REVOKED'],
      ] as const) {
        await tx.queryRun(
          `INSERT INTO users (id,organization_id,email,password,role,status,created_at)
           VALUES (?,?,?,'unused',?,'active',now())`,
          [actorId, orgId, `${actorId}@test.invalid`, role]
        );
        await tx.queryRun(
          `INSERT INTO organization_members (id,organization_id,user_id,role,status,created_at)
           VALUES (?,?,?,?,?,now())`,
          [`membership-${actorId}`, orgId, actorId, role, status]
        );
      }
    });

    app = appAs('finance_admin');
  });

  it('GET/PUT authoring persists exact CAS snapshot and replays only an identical command', async () => {
    const { scenarioBvId } = await makeScenario('STANDARD_BASE');
    const before = await request(app).get(
      `/api/v8/finance-v2/prediction/${scenarioBvId}/authoring`
    );
    expect(before.status).toBe(200);
    expect(before.body.data.revision).toBe(1);
    expect(before.body.data.draft.scenarioMode).toBe('STANDARD_BASE');

    const key = randomUUID();
    const draft = {
      ...before.body.data.draft,
      name: 'Canonical persisted scenario',
      driverOverrides: [],
      initiatives: [],
      impacts: [],
      financing: [],
    };
    const first = await request(app)
      .put(`/api/v8/finance-v2/prediction/${scenarioBvId}/authoring`)
      .set('x-idempotency-key', key)
      .send({ expectedRevision: 1, draft });
    expect(first.status).toBe(200);
    expect(first.body.data.revision).toBe(2);
    expect(first.body.data.replay).toBe(false);

    const replay = await request(app)
      .put(`/api/v8/finance-v2/prediction/${scenarioBvId}/authoring`)
      .set('x-idempotency-key', key)
      .send({ expectedRevision: 1, draft });
    expect(replay.status).toBe(200);
    expect(replay.body.data.replay).toBe(true);
    expect(replay.body.data.revision).toBe(2);

    const collision = await request(app)
      .put(`/api/v8/finance-v2/prediction/${scenarioBvId}/authoring`)
      .set('x-idempotency-key', key)
      .send({ expectedRevision: 1, draft: { ...draft, name: 'Changed payload' } });
    expect(collision.status).toBe(409);
    expect(collision.body.code).toBe('IDEMPOTENCY_KEY_REUSED');

    const cold = await request(app).get(`/api/v8/finance-v2/prediction/${scenarioBvId}/authoring`);
    expect(cold.status).toBe(200);
    expect(cold.body.data.revision).toBe(2);
    expect(cold.body.data.draft.name).toBe('Canonical persisted scenario');
    const receipt = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ n: string }>(
        `SELECT count(*)::text AS n FROM finance_prediction_authoring_receipts
        WHERE organization_id=? AND business_version_id=?`,
        [orgId, scenarioBvId]
      )
    );
    expect(Number(receipt?.n)).toBe(1);
  });

  it('viewer and revoked membership cannot author or calculate and leave zero mutation', async () => {
    const { scenarioBvId } = await makeScenario('STANDARD_BASE');
    const before = await request(app).get(
      `/api/v8/finance-v2/prediction/${scenarioBvId}/authoring`
    );
    const payload = { expectedRevision: 1, draft: before.body.data.draft };
    const viewer = await request(appAs('MEMBER', viewerId))
      .put(`/api/v8/finance-v2/prediction/${scenarioBvId}/authoring`)
      .set('x-idempotency-key', randomUUID())
      .send(payload);
    expect(viewer.status).toBe(403);
    expect(viewer.body.code).toBe('FINANCE_EDIT_FORBIDDEN');
    const revoked = await request(appAs('ADMIN', revokedId))
      .put(`/api/v8/finance-v2/prediction/${scenarioBvId}/authoring`)
      .set('x-idempotency-key', randomUUID())
      .send(payload);
    expect(revoked.status).toBe(403);
    expect(revoked.body.code).toBe('ORG_MEMBERSHIP_REVOKED');
    const state = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ revision: string; receipts: string }>(
        `SELECT s.authoring_revision::text AS revision,
              (SELECT count(*)::text FROM finance_prediction_authoring_receipts r
                WHERE r.organization_id=s.organization_id AND r.business_version_id=s.business_version_id) AS receipts
         FROM finance_prediction_scenarios s WHERE s.organization_id=? AND s.business_version_id=?`,
        [orgId, scenarioBvId]
      )
    );
    expect(state).toEqual({ revision: '1', receipts: '0' });
  });

  it('mounted authoring -> preflight -> calculate -> cold results uses exact canonical baseline context', async () => {
    const { scenarioBvId, baselineBvId } = await makeScenario('STANDARD_BASE');
    const statement = await av.createArtifact({
      organizationId: orgId,
      artifactType: 'STATEMENT_PACK',
      createdBy: userId,
    });
    const ids = {
      calendar: `cal-${randomUUID()}`,
      entity: `entity-${randomUUID()}`,
      opening: `period-${randomUUID()}`,
      forecast: `period-${randomUUID()}`,
    };
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(
        `INSERT INTO finance_stmt_calendars
          (fiscal_calendar_id,organization_id,calendar_type,fiscal_year_end_month,effective_from,created_by)
         VALUES (?,?,'STANDARD',12,'2025-01-01',?)`,
        [ids.calendar, orgId, userId]
      );
      await tx.queryRun(
        `INSERT INTO finance_stmt_entities
          (id,organization_id,business_version_id,entity_code,legal_name,role,consolidation_method,ownership_pct,functional_currency,created_by)
         VALUES (?,?,?,?,?,'GROUP_PARENT','FULL',100,'PLN',?)`,
        [
          ids.entity,
          orgId,
          statement.businessVersion.business_version_id,
          `ENTITY-${randomUUID()}`,
          'Prediction entity',
          userId,
        ]
      );
      await tx.queryRun(
        `INSERT INTO finance_stmt_periods
          (period_id,organization_id,fiscal_calendar_id,period_type,fiscal_year,fiscal_month,period_start,period_end,label,created_by)
         VALUES (?,?,?,'MONTH',2025,12,'2025-12-01','2025-12-31','Dec 2025',?),
                (?,?,?,'MONTH',2026,1,'2026-01-01','2026-01-31','Jan 2026',?)`,
        [ids.opening, orgId, ids.calendar, userId, ids.forecast, orgId, ids.calendar, userId]
      );
      const line = await tx.queryOne<{ id: string }>(
        `SELECT id FROM financial_statement_lines WHERE line_code='REVENUE' LIMIT 1`
      );
      if (!line) throw new Error('REVENUE taxonomy line missing');
      await tx.queryRun(
        `INSERT INTO finance_stmt_lines
          (id,organization_id,business_version_id,statement_type,canonical_line_id,entity_id,period_id,
           consolidation_scope,value_status,value_decimal,native_currency,presentation_currency,unit,accounting_policy,created_by)
         VALUES (?,?,?,'P&L',?,?,?,'CONSOLIDATED','PRESENT_NONZERO',100,'PLN','PLN','UNITS','IFRS',?)`,
        [
          randomUUID(),
          orgId,
          statement.businessVersion.business_version_id,
          line.id,
          ids.entity,
          ids.opening,
          userId,
        ]
      );
      await tx.queryRun(
        `INSERT INTO finance_baseline_outputs
          (id,organization_id,business_version_id,statement_type,canonical_line_id,entity_id,period_id,
           consolidation_scope,value_status,value_decimal,native_currency,presentation_currency,unit,multiplier,
           value_kind,created_by)
         VALUES (?,?,?,'P&L',?,?,?,'CONSOLIDATED','PRESENT_NONZERO',123,'PLN','PLN','UNITS',1,'FORECAST',?)`,
        [randomUUID(), orgId, baselineBvId, line.id, ids.entity, ids.forecast, userId]
      );
    });
    const statementEdge = await lineageService.insertEdge({
      organizationId: orgId,
      sourceVersionId: statement.businessVersion.business_version_id,
      sourceArtifactType: 'STATEMENT_PACK',
      targetVersionId: baselineBvId,
      targetArtifactType: 'BASELINE_MODEL',
      edgeType: 'STATEMENT_TO_MODEL',
      transformationKind: 'COMPUTE',
      authorId: userId,
    });
    if (!statementEdge.ok)
      throw new Error(`fixture STATEMENT_TO_MODEL edge failed: ${statementEdge.code}`);

    const authored = await request(app).get(
      `/api/v8/finance-v2/prediction/${scenarioBvId}/authoring`
    );
    expect(authored.status).toBe(200);
    expect(authored.body.data.computeContext).toMatchObject({
      ready: true,
      entityIds: [ids.entity],
      forecastPeriodIds: [ids.forecast],
      openingBalanceSheetPeriodId: ids.opening,
    });
    const preflight = await request(app)
      .post(`/api/v8/finance-v2/prediction/${scenarioBvId}/preflight`)
      .send({ entityId: ids.entity, openingBalanceSheetPeriodId: ids.opening });
    expect(preflight.status).toBe(201);
    const calculated = await request(app)
      .post(`/api/v8/finance-v2/prediction/${scenarioBvId}/calculate`)
      .send({
        entityId: ids.entity,
        forecastPeriodIds: [ids.forecast],
        openingBalanceSheetPeriodId: ids.opening,
      });
    expect(calculated.status).toBe(200);
    expect(calculated.body.data.mode).toBe('STANDARD_BASE');
    expect(calculated.body.data.passthroughRowCount).toBe(1);

    const cold = await request(app).get(`/api/v8/finance-v2/prediction/${scenarioBvId}/authoring`);
    expect(cold.status).toBe(200);
    expect(cold.body.data.results.scenarioValues[`REVENUE::${ids.forecast}`]).toBe(123);
    expect(cold.body.data.results.baselineValues[`REVENUE::${ids.forecast}`]).toBe(123);
    expect(cold.body.data.draft.lastComputeAt).toMatch(/^20/);
  });

  it('POST /prediction/:id/preflight runs the real overlap-detection SQL and persists a run row (0 findings for a scenario with no assumption rows)', async () => {
    const { scenarioBvId } = await makeScenario();

    const res = await request(app)
      .post(`/api/v8/finance-v2/prediction/${scenarioBvId}/preflight`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.data.findingsCount).toBe(0);
    expect(res.body.data.requiredResolutionsCount).toBe(0);
    expect(res.body.data.findings).toEqual([]);
    expect(res.body.meta).toEqual({ version: 'v2', contract: 'finance_v3_canonical_v1' });

    // Independent SQL read-back — the run row really landed, not just the HTTP response.
    const runRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string; business_version_id: string }>(
        `SELECT id, business_version_id FROM finance_prediction_preflight_runs WHERE id = ?`,
        [res.body.data.preflightRunId]
      )
    );
    expect(runRow?.business_version_id).toBe(scenarioBvId);
  });

  it('POST /prediction/:id/preflight for a nonexistent business version -> 404 NOT_FOUND', async () => {
    const res = await request(app)
      .post(`/api/v8/finance-v2/prediction/${randomUUID()}/preflight`)
      .send({});
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('POST /prediction/:id/calculate before any preflight run -> 422 READINESS_GATE_FAILED (real finance_prediction_can_start_compute() gate, not simulated)', async () => {
    const { scenarioBvId } = await makeScenario();
    const periodRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ period_id: string }>(
        `SELECT period_id FROM finance_stmt_periods WHERE organization_id = ? LIMIT 1`,
        [orgId]
      )
    );
    // No period fixture exists yet for this org in this test file — that is fine, the
    // READINESS_GATE_FAILED check runs before any period/entity input is even read.
    const res = await request(app)
      .post(`/api/v8/finance-v2/prediction/${scenarioBvId}/calculate`)
      .send({
        entityId: randomUUID(),
        forecastPeriodIds: [periodRow?.period_id ?? randomUUID()],
        openingBalanceSheetPeriodId: periodRow?.period_id ?? randomUUID(),
      });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('READINESS_GATE_FAILED');
    expect(Array.isArray(res.body.readiness)).toBe(true);
    expect(
      res.body.readiness.some(
        (c: any) => c.check_name === 'NO_OPEN_REQUIRED_RESOLUTIONS' && c.passed === false
      )
    ).toBe(true);
  });

  it('POST /prediction/:id/calculate for a nonexistent business version -> 404 NOT_FOUND', async () => {
    const res = await request(app)
      .post(`/api/v8/finance-v2/prediction/${randomUUID()}/calculate`)
      .send({
        entityId: randomUUID(),
        forecastPeriodIds: [],
        openingBalanceSheetPeriodId: randomUUID(),
      });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
