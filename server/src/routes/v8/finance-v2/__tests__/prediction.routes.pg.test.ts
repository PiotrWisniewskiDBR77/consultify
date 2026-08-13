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

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../../../../services/finance/canonical/artifactVersionService.js');
    lineageService = await import('../../../../services/finance/canonical/lineageService.js');
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'PkgB2 Prediction Test Org']));

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
});
