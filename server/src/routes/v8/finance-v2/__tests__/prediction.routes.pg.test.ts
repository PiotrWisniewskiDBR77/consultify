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
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres');
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

  function appAs(role: string) {
    const a = express();
    a.use(express.json());
    a.use((req: any, _res, next) => {
      req.user = { id: userId, organizationId: orgId, role };
      req.v8Context = { organizationId: orgId, userId, userRole: role };
      next();
    });
    a.use('/api/v8/finance-v2', financeV2Router);
    a.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: String(err?.message || err) }));
    return a;
  }
  let financeV2Router: express.Router;

  async function makeScenario(scenarioMode = 'FUNDAMENTAL_INITIATIVE') {
    const baseline = await av.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: userId });
    const scenario = await av.createArtifact({ organizationId: orgId, artifactType: 'PREDICTION_SCENARIO', createdBy: userId });
    const scenarioBvId = scenario.businessVersion.business_version_id;
    const baselineBvId = baseline.businessVersion.business_version_id;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_prediction_scenarios (id, organization_id, business_version_id, name, scenario_mode, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), orgId, scenarioBvId, `PkgB2 scenario ${randomUUID().slice(0, 8)}`, scenarioMode, userId]
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
    if (!edge.ok) throw new Error(`fixture MODEL_TO_SCENARIO edge insert failed: ${edge.code} ${edge.message}`);

    return { scenarioBvId, baselineBvId };
  }

  async function makeGovernedDraftScenario(scenarioMode = 'STANDARD_BASE') {
    const { scenarioBvId, baselineBvId } = await makeScenario(scenarioMode);
    const statement = await av.createArtifact({ organizationId: orgId, artifactType: 'STATEMENT_PACK', createdBy: userId });
    const analysis = await av.createArtifact({ organizationId: orgId, artifactType: 'HISTORICAL_ANALYSIS', createdBy: userId });
    const statementBvId = statement.businessVersion.business_version_id;
    const analysisBvId = analysis.businessVersion.business_version_id;
    const ids = await withPinnedPostgresTransaction(async (tx) => {
      const calendar = await tx.queryOne<{ fiscal_calendar_id: string }>(
        `INSERT INTO finance_stmt_calendars
          (organization_id, calendar_type, fiscal_year_end_month, fiscal_year_end_reference, effective_from, created_by)
         VALUES (?, 'STANDARD', 12, 'LAST_DAY_OF_MONTH', '2025-01-01', ?)
         RETURNING fiscal_calendar_id`, [orgId, userId]);
      const entity = await tx.queryOne<{ id: string }>(
        `INSERT INTO finance_stmt_entities
          (organization_id, business_version_id, entity_code, legal_name, role, consolidation_method,
           functional_currency, created_by)
         VALUES (?, ?, ?, 'Prediction Entity', 'GROUP_PARENT', 'NOT_CONSOLIDATED', 'PLN', ?)
         RETURNING id`, [orgId, statementBvId, `PRED-${randomUUID()}`, userId]);
      const opening = await tx.queryOne<{ period_id: string }>(
        `INSERT INTO finance_stmt_periods
          (organization_id, fiscal_calendar_id, period_type, fiscal_year, fiscal_month,
           period_start, period_end, label, created_by)
         VALUES (?, ?, 'MONTH', 2025, 12, '2025-12-01', '2025-12-31', '12/2025', ?)
         RETURNING period_id`, [orgId, calendar!.fiscal_calendar_id, userId]);
      const forecast = await tx.queryOne<{ period_id: string }>(
        `INSERT INTO finance_stmt_periods
          (organization_id, fiscal_calendar_id, period_type, fiscal_year, fiscal_month,
           period_start, period_end, label, previous_period_id, created_by)
         VALUES (?, ?, 'MONTH', 2026, 1, '2026-01-01', '2026-01-31', '1/2026', ?, ?)
         RETURNING period_id`, [orgId, calendar!.fiscal_calendar_id, opening!.period_id, userId]);
      const bsLine = await tx.queryOne<{ id: string }>(
        `SELECT id FROM financial_statement_lines WHERE statement_type = 'BS' ORDER BY id LIMIT 1`);
      await tx.queryRun(
        `INSERT INTO finance_stmt_lines
          (id, organization_id, business_version_id, statement_type, canonical_line_id,
           entity_id, period_id, value_status, value_decimal, native_currency,
           presentation_currency, unit, accounting_policy, created_by)
         VALUES (?, ?, ?, 'BS', ?, ?, ?, 'PRESENT_NONZERO', 1, 'PLN', 'PLN', 'UNITS', 'IFRS', ?)`,
        [randomUUID(), orgId, statementBvId, bsLine!.id, entity!.id, opening!.period_id, userId]);
      await tx.queryRun(
        `INSERT INTO finance_baseline_assumptions
          (id, organization_id, business_version_id, schedule_type, driver_code, entity_id,
           period_id, rule, value_status, value_decimal, unit, quality, created_by)
         VALUES (?, ?, ?, 'revenue_pvm', 'PRICE', ?, ?, 'HISTORICAL_AVERAGE',
                 'PRESENT_NONZERO', 1, 'PLN', 'ESTIMATED', ?)`,
        [randomUUID(), orgId, baselineBvId, entity!.id, forecast!.period_id, userId]);
      await tx.queryRun(`SET LOCAL session_replication_role = replica`);
      await tx.queryRun(
        `UPDATE finance_business_versions SET status = 'APPROVED'
          WHERE organization_id = ? AND business_version_id IN (?, ?, ?)`,
        [orgId, statementBvId, analysisBvId, baselineBvId]);
      await tx.queryRun(`SET LOCAL session_replication_role = origin`);
      await tx.queryRun(
        `INSERT INTO finance_lineage_edges
          (id, organization_id, source_version_id, source_artifact_type, target_version_id,
           target_artifact_type, edge_type, transformation_kind, assumption_snapshot_hash, author_id)
         VALUES
          (?, ?, ?, 'STATEMENT_PACK', ?, 'BASELINE_MODEL', 'STATEMENT_TO_MODEL', 'COMPUTE', NULL, ?),
          (?, ?, ?, 'STATEMENT_PACK', ?, 'HISTORICAL_ANALYSIS', 'STATEMENT_TO_ANALYSIS', 'COMPUTE', NULL, ?),
          (?, ?, ?, 'HISTORICAL_ANALYSIS', ?, 'BASELINE_MODEL', 'ANALYSIS_TO_MODEL', 'COMPUTE', ?, ?)`,
        [randomUUID(), orgId, statementBvId, baselineBvId, userId,
          randomUUID(), orgId, statementBvId, analysisBvId, userId,
          randomUUID(), orgId, analysisBvId, baselineBvId, 'c'.repeat(64), userId]);
      await tx.queryRun(
        `INSERT INTO finance_baseline_workspace_contexts
          (organization_id, business_version_id, source_statement_version_id,
           source_analysis_version_id, entity_id, opening_balance_sheet_period_id,
           forecast_period_ids, version, configured_by)
         VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, 1, ?)`,
        [orgId, baselineBvId, statementBvId, analysisBvId, entity!.id, opening!.period_id,
          JSON.stringify([forecast!.period_id]), userId]);
      return { entityId: entity!.id, openingPeriodId: opening!.period_id, forecastPeriodId: forecast!.period_id };
    });
    return { scenarioBvId, baselineBvId, ...ids };
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../../../../services/finance/canonical/artifactVersionService.js');
    lineageService = await import('../../../../services/finance/canonical/lineageService.js');
    financeV2Router = (await import('../index.js')).default;

    const database = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ name: string }>(`SELECT current_database() AS name`)
    );
    if (!database?.name.startsWith('fin_bvp_prediction')) {
      throw new Error(`Prediction RealPG requires a disposable fin_bvp_prediction* database, got ${database?.name ?? 'unknown'}`);
    }

    await withPinnedPostgresTransaction((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'PkgB2 Prediction Test Org']));
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(
        `INSERT INTO users (id, email, password, first_name, last_name, role, organization_id)
         VALUES (?, ?, 'test', 'Prediction', 'Admin', 'ADMIN', ?)`,
        [userId, `${userId}@example.test`, orgId]
      );
      await tx.queryRun(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES (?, ?, ?, 'ADMIN', 'ACTIVE')`,
        [randomUUID(), orgId, userId]
      );
    });

    app = appAs('finance_admin');
  });

  it('POST /prediction/:id/preflight runs the real overlap-detection SQL and persists a run row (0 findings for a scenario with no assumption rows)', async () => {
    const { scenarioBvId } = await makeScenario();

    const res = await request(app).post(`/api/v8/finance-v2/prediction/${scenarioBvId}/preflight`).send({});
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
    const res = await request(app).post(`/api/v8/finance-v2/prediction/${randomUUID()}/preflight`).send({});
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('POST /prediction/:id/calculate before any preflight run -> 422 READINESS_GATE_FAILED (real finance_prediction_can_start_compute() gate, not simulated)', async () => {
    const { scenarioBvId } = await makeScenario();
    const periodRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ period_id: string }>(`SELECT period_id FROM finance_stmt_periods WHERE organization_id = ? LIMIT 1`, [orgId])
    );
    // No period fixture exists yet for this org in this test file — that is fine, the
    // READINESS_GATE_FAILED check runs before any period/entity input is even read.
    const res = await request(app)
      .post(`/api/v8/finance-v2/prediction/${scenarioBvId}/calculate`)
      .send({ entityId: randomUUID(), forecastPeriodIds: [periodRow?.period_id ?? randomUUID()], openingBalanceSheetPeriodId: periodRow?.period_id ?? randomUUID() });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('READINESS_GATE_FAILED');
    expect(Array.isArray(res.body.readiness)).toBe(true);
    expect(res.body.readiness.some((c: any) => c.check_name === 'NO_OPEN_REQUIRED_RESOLUTIONS' && c.passed === false)).toBe(true);
  });

  it('POST /prediction/:id/calculate for a nonexistent business version -> 404 NOT_FOUND', async () => {
    const res = await request(app)
      .post(`/api/v8/finance-v2/prediction/${randomUUID()}/calculate`)
      .send({ entityId: randomUUID(), forecastPeriodIds: [], openingBalanceSheetPeriodId: randomUUID() });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('GET/PUT draft persists one governed aggregate with CAS, replay and collision', async () => {
    const fixture = await makeGovernedDraftScenario();
    const cold = await request(app).get(`/api/v8/finance-v2/prediction/${fixture.scenarioBvId}/draft`);
    expect(cold.status, JSON.stringify(cold.body)).toBe(200);
    expect(cold.body.data).toMatchObject({
      businessVersionId: fixture.scenarioBvId,
      sourceBaselineVersionId: fixture.baselineBvId,
      version: 1,
      computeContext: {
        entityId: fixture.entityId,
        openingBalanceSheetPeriodId: fixture.openingPeriodId,
      },
    });
    expect(cold.body.data.computeContext.forecastPeriods.map((p: any) => p.periodId)).toEqual([
      fixture.forecastPeriodId,
    ]);
    const key = `prediction-draft-${randomUUID()}`;
    const body = {
      expectedVersion: 1,
      draft: {
        name: 'Governed base scenario', description: 'cold persisted', scenarioMode: 'STANDARD_BASE',
        driverOverrides: [], initiatives: [], impacts: [], financing: [],
      },
    };
    const saved = await request(app).put(`/api/v8/finance-v2/prediction/${fixture.scenarioBvId}/draft`)
      .set('Idempotency-Key', key).send(body);
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({ version: 2, name: 'Governed base scenario', replay: false });
    const replay = await request(app).put(`/api/v8/finance-v2/prediction/${fixture.scenarioBvId}/draft`)
      .set('Idempotency-Key', key).send(body);
    expect(replay.status).toBe(200);
    expect(replay.body.data).toMatchObject({ version: 2, replay: true });
    await withPinnedPostgresTransaction((tx) => tx.queryRun(
      `UPDATE organization_members SET status = 'REVOKED' WHERE organization_id = ? AND user_id = ?`,
      [orgId, userId]
    ));
    const revokedReplay = await request(app).put(`/api/v8/finance-v2/prediction/${fixture.scenarioBvId}/draft`)
      .set('Idempotency-Key', key).send(body);
    expect(revokedReplay.status).toBe(403);
    expect(revokedReplay.body.code).toBe('ORG_MEMBERSHIP_REVOKED');
    await withPinnedPostgresTransaction((tx) => tx.queryRun(
      `UPDATE organization_members SET status = 'ACTIVE' WHERE organization_id = ? AND user_id = ?`,
      [orgId, userId]
    ));
    const collision = await request(app).put(`/api/v8/finance-v2/prediction/${fixture.scenarioBvId}/draft`)
      .set('Idempotency-Key', key).send({ ...body, draft: { ...body.draft, name: 'Changed' } });
    expect(collision.status).toBe(409);
    expect(collision.body.code).toBe('IDEMPOTENCY_PAYLOAD_COLLISION');
    const counts = await withPinnedPostgresTransaction((tx) => tx.queryOne<{ receipts: string }>(
      `SELECT count(*)::text AS receipts FROM finance_prediction_draft_command_receipts
        WHERE organization_id = ? AND business_version_id = ?`, [orgId, fixture.scenarioBvId]));
    expect(counts?.receipts).toBe('1');
  });

  it('draft fails closed for stale CAS, concurrent writers, revoked/member authority, stale source and immutable receipt', async () => {
    const fixture = await makeGovernedDraftScenario();
    const baseDraft = {
      name: 'Governed concurrent scenario',
      description: null,
      scenarioMode: 'STANDARD_BASE',
      driverOverrides: [],
      initiatives: [],
      impacts: [],
      financing: [],
    };
    const url = `/api/v8/finance-v2/prediction/${fixture.scenarioBvId}/draft`;

    const [first, second] = await Promise.all([
      request(app).put(url).set('Idempotency-Key', `concurrent-a-${randomUUID()}`).send({ expectedVersion: 1, draft: baseDraft }),
      request(app).put(url).set('Idempotency-Key', `concurrent-b-${randomUUID()}`).send({ expectedVersion: 1, draft: { ...baseDraft, name: 'Competing writer' } }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect([first.body.code, second.body.code]).toContain('PREDICTION_DRAFT_VERSION_CONFLICT');

    const stale = await request(app).put(url)
      .set('Idempotency-Key', `stale-${randomUUID()}`)
      .send({ expectedVersion: 1, draft: baseDraft });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('PREDICTION_DRAFT_VERSION_CONFLICT');

    await withPinnedPostgresTransaction((tx) => tx.queryRun(
      `UPDATE organization_members SET role = 'MEMBER' WHERE organization_id = ? AND user_id = ?`,
      [orgId, userId]
    ));
    const member = await request(app).put(url)
      .set('Idempotency-Key', `member-${randomUUID()}`)
      .send({ expectedVersion: 2, draft: baseDraft });
    expect(member.status).toBe(403);
    expect(member.body.code).toBe('FINANCE_EDIT_FORBIDDEN');

    await withPinnedPostgresTransaction((tx) => tx.queryRun(
      `UPDATE organization_members SET role = 'ADMIN', status = 'REVOKED' WHERE organization_id = ? AND user_id = ?`,
      [orgId, userId]
    ));
    const revoked = await request(app).put(url)
      .set('Idempotency-Key', `revoked-${randomUUID()}`)
      .send({ expectedVersion: 2, draft: baseDraft });
    expect(revoked.status).toBe(403);
    expect(revoked.body.code).toBe('ORG_MEMBERSHIP_REVOKED');
    await withPinnedPostgresTransaction((tx) => tx.queryRun(
      `UPDATE organization_members SET status = 'ACTIVE' WHERE organization_id = ? AND user_id = ?`,
      [orgId, userId]
    ));

    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(`SET LOCAL session_replication_role = replica`);
      await tx.queryRun(
        `UPDATE finance_business_versions SET status = 'DRAFT'
          WHERE organization_id = ? AND business_version_id = ?`,
        [orgId, fixture.baselineBvId]
      );
      await tx.queryRun(`SET LOCAL session_replication_role = origin`);
    });
    const staleSource = await request(app).get(url);
    expect(staleSource.status).toBe(409);
    expect(staleSource.body.code).toBe('PREDICTION_SOURCE_NOT_READY');
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(`SET LOCAL session_replication_role = replica`);
      await tx.queryRun(
        `UPDATE finance_business_versions SET status = 'APPROVED'
          WHERE organization_id = ? AND business_version_id = ?`,
        [orgId, fixture.baselineBvId]
      );
      await tx.queryRun(`SET LOCAL session_replication_role = origin`);
    });

    await expect(withPinnedPostgresTransaction((tx) => tx.queryRun(
      `UPDATE finance_prediction_draft_command_receipts SET applied_version = applied_version + 1
        WHERE organization_id = ? AND business_version_id = ?`,
      [orgId, fixture.scenarioBvId]
    ))).rejects.toThrow(/immutable/);
    await expect(withPinnedPostgresTransaction((tx) => tx.queryRun(
      `DELETE FROM finance_prediction_draft_command_receipts
        WHERE organization_id = ? AND business_version_id = ?`,
      [orgId, fixture.scenarioBvId]
    ))).rejects.toThrow(/immutable/);
  });

  it('cold round-trips all four child families without duplicating a driver override', async () => {
    const fixture = await makeGovernedDraftScenario('FUNDAMENTAL_INITIATIVE');
    const statementLine = await withPinnedPostgresTransaction((tx) => tx.queryOne<{ line_code: string }>(
      `SELECT line_code FROM financial_statement_lines WHERE statement_type = 'BS' ORDER BY id LIMIT 1`
    ));
    const initiativeId = randomUUID();
    const driverId = randomUUID();
    const impactId = randomUUID();
    const financingId = randomUUID();
    const draft = {
      name: 'Populated governed scenario',
      description: 'all child families',
      scenarioMode: 'FUNDAMENTAL_INITIATIVE',
      driverOverrides: [{
        id: driverId,
        scheduleType: 'revenue_pvm',
        driverCode: 'PRICE',
        canonicalLineCode: statementLine!.line_code,
        entityId: fixture.entityId,
        periodId: fixture.forecastPeriodId,
        overrideSource: 'MANUAL',
        valueStatus: 'PRESENT_NONZERO',
        valueDecimal: 2,
        unit: 'PLN',
        baselineValueDecimal: 1,
        rationale: 'test',
      }],
      initiatives: [{
        id: initiativeId,
        initiativeCode: 'INIT-1',
        name: 'Initiative one',
        description: null,
        source: 'TEST',
        owner: 'Owner',
        confidencePct: 80,
        defaultStartPeriodId: fixture.forecastPeriodId,
        defaultRampMonths: 1,
        defaultDurationMonths: 3,
        implementationCostDecimal: 10,
        status: 'DRAFT',
      }],
      impacts: [{
        id: impactId,
        initiativeId,
        assumptionLabel: 'Impact one',
        driverScheduleType: 'revenue_pvm',
        driverCode: 'PRICE',
        kpiCatalogId: null,
        statementLineCode: statementLine!.line_code,
        entityId: fixture.entityId,
        amountKind: 'ABSOLUTE_AMOUNT',
        amountDecimal: 5,
        amountUnit: 'PLN',
        sign: 'POSITIVE',
        startPeriodId: fixture.forecastPeriodId,
        rampMonths: 1,
        durationMonths: 3,
        decayPctPerPeriod: null,
        implementationCostDecimal: null,
        confidencePct: 80,
        probabilityPct: 75,
        cannibalizesImpactId: null,
      }],
      financing: [{
        id: financingId,
        financingKind: 'EQUITY_INJECTION',
        entityId: fixture.entityId,
        periodId: fixture.forecastPeriodId,
        payload: { amount: 100 },
        sourceRef: null,
        rationale: 'test',
      }],
    };
    const url = `/api/v8/finance-v2/prediction/${fixture.scenarioBvId}/draft`;
    const saved = await request(app).put(url)
      .set('Idempotency-Key', `populated-${randomUUID()}`)
      .send({ expectedVersion: 1, draft });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const cold = await request(app).get(url);
    expect(cold.status).toBe(200);
    expect(cold.body.data.driverOverrides).toHaveLength(1);
    expect(cold.body.data.driverOverrides[0]).toMatchObject({ id: driverId, canonicalLineCode: statementLine!.line_code });
    expect(cold.body.data.driverOverrides[0].valueDecimal).toBe('2');
    expect(cold.body.data.initiatives).toHaveLength(1);
    expect(cold.body.data.initiatives[0].confidencePct).toBe('80');
    expect(cold.body.data.impacts).toHaveLength(1);
    expect(cold.body.data.impacts[0].amountDecimal).toBe('5');
    expect(cold.body.data.financing).toHaveLength(1);

    const invalidAfterDelete = await request(app).put(url)
      .set('Idempotency-Key', `populated-invalid-${randomUUID()}`)
      .send({
        expectedVersion: 2,
        draft: {
          ...draft,
          impacts: [{ ...draft.impacts[0], statementLineCode: `UNKNOWN-${randomUUID()}` }],
        },
      });
    expect(invalidAfterDelete.status).toBe(400);
    expect(invalidAfterDelete.body.code).toBe('INVALID_DRAFT');
    const afterRollback = await request(app).get(url);
    expect(afterRollback.body.data.version).toBe(2);
    expect(afterRollback.body.data.driverOverrides).toHaveLength(1);
    expect(afterRollback.body.data.impacts[0].statementLineCode).toBe(statementLine!.line_code);

    const second = await request(app).put(url)
      .set('Idempotency-Key', `populated-second-${randomUUID()}`)
      .send({ expectedVersion: 2, draft });
    expect(second.status, JSON.stringify(second.body)).toBe(200);
    expect(second.body.data.driverOverrides).toHaveLength(1);
  });
});
