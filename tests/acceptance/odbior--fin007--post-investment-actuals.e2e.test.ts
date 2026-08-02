/**
 * FIN-007 — post-investment actuals round-trip — real router + real local
 * PostgreSQL acceptance.
 *
 * Covers: approved Finance baseline (financial_models + financial_model_versions,
 * driven directly through financialModelingService, the same engine FIN-03/04
 * expose over HTTP) → keyed Execution actual write into the CANONICAL
 * `roi_realized_values` ledger (recordExecutionRealizationForBaseline) →
 * Results reads that exact row (the pre-existing, unmodified
 * GET /api/execution/roi/:initiativeId/realized) → Finance reconciliation +
 * durable post-investment review receipt (finance_post_investment_reviews) →
 * fresh reopen.
 *
 * CTO decision (see FIN-007 discovery report): NO second actuals ledger.
 * Every "actual" in this file is a real roi_realized_values row; the review
 * table only ever references those rows by id.
 *
 * Run with a LOCAL-only DATABASE_URL pointed at `consultinity_test`, mirroring
 * the guard pattern already established for this repo's acceptance suites.
 */
import express, { type Express } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken } from './harness.js';
import { SEED, seed } from './seed.mjs';

const MARK = 'odbior--fin007--';

function guardedDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('[FIN-007] DATABASE_URL is unset');
  const url = new URL(raw);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || dbName !== 'consultinity_test') {
    throw new Error(`[FIN-007] REFUSING database target host=${url.hostname} db=${dbName}`);
  }
  return raw;
}

function client(): pg.Client {
  return new pg.Client({ connectionString: guardedDatabaseUrl() });
}

async function buildExecutionControlApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { requireV8OrgContext, attachV8Context } = await import(
    '../../server/src/middleware/v8Auth.middleware.js'
  );
  const router = (await import('../../server/src/routes/v8/execution-control.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(
    '/api/v8/execution-control',
    verifyToken as any,
    requireV8OrgContext as any,
    attachV8Context as any,
    router as unknown as express.Router
  );
  return app;
}

async function buildFinanceValueApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { requireV8OrgContext, attachV8Context } = await import(
    '../../server/src/middleware/v8Auth.middleware.js'
  );
  const router = (await import('../../server/src/routes/v8/finance-value.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(
    '/api/v8/finance/value-tracking',
    verifyToken as any,
    requireV8OrgContext as any,
    attachV8Context as any,
    router as unknown as express.Router
  );
  return app;
}

/** Results reads roi_realized_values through this PRE-EXISTING, UNMODIFIED
 * route — proof the round-trip lands on the same read surface Results
 * already uses, not a new bespoke reader. */
async function buildResultsReadApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const router = (await import('../../server/src/routes/benefits.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/execution', verifyToken as any, router as unknown as express.Router);
  return app;
}

async function cleanup(): Promise<void> {
  const db = client();
  await db.connect();
  try {
    await db.query(
      `DELETE FROM finance_post_investment_reviews WHERE organization_id LIKE $1`,
      [`${MARK}%`]
    );
    await db.query(`DELETE FROM roi_realized_values WHERE organization_id LIKE $1`, [`${MARK}%`]);
    await db.query(`DELETE FROM roi_realized_values WHERE organization_id = $1`, [SEED.ORG_ID]);
    await db.query(
      `DELETE FROM finance_post_investment_reviews WHERE organization_id = $1`,
      [SEED.ORG_ID]
    );
    await db.query(
      `DELETE FROM financial_model_versions WHERE model_id IN (SELECT id FROM financial_models WHERE name LIKE $1)`,
      [`${MARK}%`]
    );
    await db.query(`DELETE FROM financial_model_events WHERE model_id IN (SELECT id FROM financial_models WHERE name LIKE $1)`, [
      `${MARK}%`,
    ]);
    await db.query(`DELETE FROM financial_models WHERE name LIKE $1`, [`${MARK}%`]);
    await db.query(`DELETE FROM initiatives WHERE id LIKE $1`, [`${MARK}%`]);
  } finally {
    await db.end();
  }
}

/** Create an APPROVED baseline with a deterministic REVENUE figure for a
 * known period, via the real financialModelingService engine (the same one
 * FIN-03/04 expose over HTTP) — never a guessed/fabricated snapshot. Returns
 * the model id, the version stamped by THIS approval, and the exact
 * projected REVENUE value computeModel produced. */
async function createApprovedBaseline(params: {
  organizationId: string;
  initiativeId: string;
  createdBy: string;
  periodDate: string;
  revenueAmount: number;
  namePrefix?: string;
}): Promise<{ modelId: string; version: number; projectedRevenue: number }> {
  const { createModel, approveModel, getModel } = await import(
    '../../server/src/services/financialModelingService.js'
  );
  const { run: dbRun } = await import('../../server/src/utils/DbPromise.js');

  const modelId = await createModel({
    organizationId: params.organizationId,
    initiativeId: params.initiativeId,
    name: `${params.namePrefix || MARK}model-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startDate: params.periodDate,
    horizonMonths: 1,
    granularity: 'monthly',
    createdBy: params.createdBy,
  });

  await dbRun(
    `INSERT INTO financial_model_events (
       id, model_id, event_type, name, amount, period_start, recurrence, cf_classification, is_active, created_by
     ) VALUES (gen_random_uuid()::text, ?, 'revenue', 'Test Revenue', ?, ?, 'one_time', 'operating', TRUE, ?)`,
    [modelId, params.revenueAmount, params.periodDate, params.createdBy]
  );

  const approveResult = await approveModel(modelId, params.createdBy);
  if (!approveResult.success) {
    throw new Error(`[FIN-007 test] approveModel failed: ${approveResult.error}`);
  }
  const model = await getModel(modelId, params.organizationId);
  return {
    modelId,
    version: Number(model.version),
    projectedRevenue: params.revenueAmount,
  };
}

async function seedInitiative(id: string, organizationId: string): Promise<void> {
  const db = client();
  await db.connect();
  try {
    await db.query(
      `INSERT INTO initiatives (id, organization_id, name, status, created_at)
       VALUES ($1, $2, $3, 'EXECUTING', CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [id, organizationId, `${MARK}Initiative`]
    );
  } finally {
    await db.end();
  }
}

describe('FIN-007 post-investment actuals round trip — real routes and PostgreSQL', () => {
  let execApp: Express;
  let financeApp: Express;
  let resultsApp: Express;
  let token: string;
  let foreignOrgId: string;
  let foreignUserId: string;
  let foreignToken: string;
  const initiativeId = `${MARK}initiative-0001`;

  beforeAll(async () => {
    guardedDatabaseUrl();
    await seed();
    await cleanup();
    await seedInitiative(initiativeId, SEED.ORG_ID);
    execApp = await buildExecutionControlApp();
    financeApp = await buildFinanceValueApp();
    resultsApp = await buildResultsReadApp();
    token = mintToken();

    foreignOrgId = `${MARK}foreign-org`;
    foreignUserId = `${MARK}foreign-user`;
    const db = client();
    await db.connect();
    try {
      await db.query(
        `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
         VALUES ($1, $2, 'enterprise', 'active', 1, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [foreignOrgId, `${MARK}Foreign Org`]
      );
      await db.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
         VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'Foreign', 'User', CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [foreignUserId, foreignOrgId, `${MARK}foreign@acceptance.local`]
      );
      await db.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
         SELECT $3, $1, $2, 'OWNER', 'ACTIVE', CURRENT_TIMESTAMP
         WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2)`,
        [foreignOrgId, foreignUserId, `${MARK}foreign-mem`]
      );
    } finally {
      await db.end();
    }
    foreignToken = mintToken({ id: foreignUserId, organizationId: foreignOrgId, organization_id: foreignOrgId });
  });

  afterAll(async () => {
    await cleanup();
    const db = client();
    await db.connect();
    try {
      await db.query(`DELETE FROM organization_members WHERE organization_id = $1`, [foreignOrgId]);
      await db.query(`DELETE FROM users WHERE id = $1`, [foreignUserId]);
      await db.query(`DELETE FROM organizations WHERE id = $1`, [foreignOrgId]);
    } finally {
      await db.end();
    }
  });

  it('golden flow: approved baseline → keyed Execution actual → Results read-back → Finance reconciliation → durable review → fresh reopen', async () => {
    const periodDate = '2026-01-01';
    const baseline = await createApprovedBaseline({
      organizationId: SEED.ORG_ID,
      initiativeId,
      createdBy: SEED.USER_ID,
      periodDate,
      revenueAmount: 100_000,
      namePrefix: `${MARK}golden-`,
    });

    // ── Execution writes the actual ──
    const idemKey1 = `${MARK}golden-actual`;
    const writeRes = await request(execApp)
      .post('/api/v8/execution-control/realizations/baseline')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idemKey1)
      .send({
        initiativeId,
        periodMonth: periodDate,
        realizedRevenueDelta: 97_000,
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
        evidenceRef: 'exe-009-closure:test',
      })
      .expect(201);
    const actualId = writeRes.body.data.entry.id;
    expect(actualId).toBeTruthy();
    expect(writeRes.body.data.entry.baselineModelId).toBe(baseline.modelId);
    expect(writeRes.body.data.entry.baselineVersion).toBe(baseline.version);

    // ── Results reads EXACTLY this actual, through the pre-existing,
    // unmodified read route ──
    const resultsRes = await request(resultsApp)
      .get(`/api/execution/roi/${initiativeId}/realized`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const realizedRows = resultsRes.body.data as any[];
    const readBack = realizedRows.find((r) => r.id === actualId);
    expect(readBack).toBeTruthy();
    expect(Number(readBack.realized_revenue_delta)).toBe(97_000);
    expect(readBack.baseline_model_id).toBe(baseline.modelId);

    // ── Finance reconciliation: create the durable post-investment review ──
    const idemKey2 = `${MARK}golden-review`;
    const reviewRes = await request(financeApp)
      .post('/api/v8/finance/value-tracking/post-investment-reviews')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idemKey2)
      .send({
        initiativeId,
        actualIds: [actualId],
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
        baselineStatementType: 'P&L',
        baselineLineCode: 'REVENUE',
        baselinePeriodDate: periodDate,
      })
      .expect(201);
    const review = reviewRes.body.data;
    expect(review.status).toBe('completed');
    expect(review.projectedValue).toBe(100_000);
    expect(review.realizedValue).toBe(97_000);
    expect(review.variance).toBeCloseTo(-3_000, 5);
    expect(review.reconciliationStatus).toBe('matched'); // 3% within default 5% tolerance
    expect(review.actualIds).toEqual([actualId]);
    expect(review.baselineModelId).toBe(baseline.modelId);
    expect(review.baselineVersion).toBe(baseline.version);

    // ── Fresh reopen: a NEW request, same review id, same source ids ──
    const reopenRes = await request(financeApp)
      .get(`/api/v8/finance/value-tracking/post-investment-reviews/${review.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(reopenRes.body.data).toEqual(review);

    // ── Direct DB counts ──
    const db = client();
    await db.connect();
    try {
      const actualCount = await db.query(
        `SELECT count(*)::int AS n FROM roi_realized_values WHERE id = $1`,
        [actualId]
      );
      expect(actualCount.rows[0].n).toBe(1);
      const reviewCount = await db.query(
        `SELECT count(*)::int AS n FROM finance_post_investment_reviews WHERE id = $1`,
        [review.id]
      );
      expect(reviewCount.rows[0].n).toBe(1);
    } finally {
      await db.end();
    }
  }, 60_000);

  it('actual without a baseline reference fails closed (schema requires it; a nonexistent model id is rejected, zero writes)', async () => {
    const writeRes = await request(execApp)
      .post('/api/v8/execution-control/realizations/baseline')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `${MARK}no-baseline`)
      .send({
        initiativeId,
        periodMonth: '2026-02-01',
        realizedRevenueDelta: 1000,
        baselineModelId: `${MARK}nonexistent-model`,
        baselineExpectedVersion: 1,
      });
    expect(writeRes.status).toBe(400);
    expect(writeRes.body.code).toBe('BASELINE_NOT_APPROVED');

    const db = client();
    await db.connect();
    try {
      const rows = await db.query(
        `SELECT count(*)::int AS n FROM roi_realized_values WHERE operation_key = $1`,
        [`${MARK}no-baseline`]
      );
      expect(rows.rows[0].n).toBe(0);
    } finally {
      await db.end();
    }
  });

  it('a DRAFT baseline is rejected — an actual is never bound to an unapproved model', async () => {
    const { createModel } = await import('../../server/src/services/financialModelingService.js');
    const draftModelId = await createModel({
      organizationId: SEED.ORG_ID,
      initiativeId,
      name: `${MARK}draft-model-${Date.now()}`,
      startDate: '2026-03-01',
      horizonMonths: 1,
      granularity: 'monthly',
      createdBy: SEED.USER_ID,
    });

    const writeRes = await request(execApp)
      .post('/api/v8/execution-control/realizations/baseline')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `${MARK}draft-baseline`)
      .send({
        initiativeId,
        periodMonth: '2026-03-01',
        realizedRevenueDelta: 1000,
        baselineModelId: draftModelId,
        baselineExpectedVersion: 1,
      });
    expect(writeRes.status).toBe(400);
    expect(writeRes.body.code).toBe('BASELINE_NOT_APPROVED');
  });

  it('TOCTOU: baseline re-approved (version moved) between preview and confirm is rejected, never silently bound to the new version', async () => {
    const periodDate = '2026-04-01';
    const baseline = await createApprovedBaseline({
      organizationId: SEED.ORG_ID,
      initiativeId,
      createdBy: SEED.USER_ID,
      periodDate,
      revenueAmount: 50_000,
      namePrefix: `${MARK}toctou-`,
    });
    const previewedVersion = baseline.version;

    // The baseline moves AFTER the client "previewed" it (re-approve again).
    const { approveModel } = await import('../../server/src/services/financialModelingService.js');
    const reapprove = await approveModel(baseline.modelId, SEED.USER_ID);
    expect(reapprove.success).toBe(true);

    const writeRes = await request(execApp)
      .post('/api/v8/execution-control/realizations/baseline')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `${MARK}toctou-actual`)
      .send({
        initiativeId,
        periodMonth: periodDate,
        realizedRevenueDelta: 48_000,
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: previewedVersion,
      });
    expect(writeRes.status).toBe(409);
    expect(writeRes.body.code).toBe('BASELINE_VERSION_CONFLICT');
    expect(writeRes.body.serverVersion).toBe(previewedVersion + 1);

    const db = client();
    await db.connect();
    try {
      const rows = await db.query(
        `SELECT count(*)::int AS n FROM roi_realized_values WHERE operation_key = $1`,
        [`${MARK}toctou-actual`]
      );
      expect(rows.rows[0].n).toBe(0);
    } finally {
      await db.end();
    }
  });

  it('explicit baseline locator (statementType/lineCode/periodDate) is validated fail-closed at review creation — a real approved baseline, but the wrong line or the wrong period, is rejected 422, never a fabricated projected value', async () => {
    // Closes a documented coverage gap (FIN-07 controlled handoff): the
    // version/approved/tenant predicates already had tests above, but the
    // locator predicates resolveApprovedBaselineLine() also enforces
    // (statementType/lineCode/periodDate not present in the frozen
    // snapshot) had none. All three funnel through the SAME
    // BaselineLineNotFoundError -> 422 path, so one baseline exercises all
    // three failure shapes without inventing a new one.
    const periodDate = '2027-01-01';
    const baseline = await createApprovedBaseline({
      organizationId: SEED.ORG_ID,
      initiativeId,
      createdBy: SEED.USER_ID,
      periodDate,
      revenueAmount: 70_000,
      namePrefix: `${MARK}locator-`,
    });
    const write = await request(execApp)
      .post('/api/v8/execution-control/realizations/baseline')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `${MARK}locator-actual`)
      .send({
        initiativeId,
        periodMonth: periodDate,
        realizedRevenueDelta: 69_000,
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
      })
      .expect(201);
    const actualId = write.body.data.entry.id;

    // (a) A lineCode that does not exist in this period's P&L.
    const wrongLine = await request(financeApp)
      .post('/api/v8/finance/value-tracking/post-investment-reviews')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `${MARK}locator-wrong-line`)
      .send({
        initiativeId,
        actualIds: [actualId],
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
        baselineStatementType: 'P&L',
        baselineLineCode: 'NOT_A_REAL_LINE_CODE',
        baselinePeriodDate: periodDate,
      });
    expect(wrongLine.status).toBe(422);
    expect(wrongLine.body.code).toBe('BASELINE_LINE_NOT_FOUND');

    // (b) A periodDate that does not exist in the snapshot at all.
    const wrongPeriod = await request(financeApp)
      .post('/api/v8/finance/value-tracking/post-investment-reviews')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `${MARK}locator-wrong-period`)
      .send({
        initiativeId,
        actualIds: [actualId],
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
        baselineStatementType: 'P&L',
        baselineLineCode: 'REVENUE',
        baselinePeriodDate: '2099-01-01',
      });
    expect(wrongPeriod.status).toBe(422);
    expect(wrongPeriod.body.code).toBe('BASELINE_LINE_NOT_FOUND');

    // (c) A statementType this model genuinely has no matching line for —
    // still funnels through the identical guard (missing-line, not a
    // separate code path per statement type).
    const wrongStatement = await request(financeApp)
      .post('/api/v8/finance/value-tracking/post-investment-reviews')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `${MARK}locator-wrong-statement`)
      .send({
        initiativeId,
        actualIds: [actualId],
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
        baselineStatementType: 'CF',
        baselineLineCode: 'NOT_A_REAL_LINE_CODE',
        baselinePeriodDate: periodDate,
      });
    expect(wrongStatement.status).toBe(422);
    expect(wrongStatement.body.code).toBe('BASELINE_LINE_NOT_FOUND');

    // None of the three rejected attempts left a review claiming success —
    // the reservation row from each (RESERVE-before-validate, same pattern
    // as the finalize-failure test above) exists but is 'failed', never
    // 'completed'. A fresh retry with the same key would reclaim it.
    const dbLocator = client();
    await dbLocator.connect();
    try {
      const rows = await dbLocator.query(
        `SELECT idempotency_key, status FROM finance_post_investment_reviews
          WHERE organization_id = $1 AND idempotency_key IN ($2, $3, $4)`,
        [
          SEED.ORG_ID,
          `${MARK}locator-wrong-line`,
          `${MARK}locator-wrong-period`,
          `${MARK}locator-wrong-statement`,
        ]
      );
      expect(rows.rows.length).toBe(3);
      for (const row of rows.rows) {
        expect(row.status).not.toBe('completed');
      }
    } finally {
      await dbLocator.end();
    }
  });

  it('retry of the same Idempotency-Key + same payload returns the SAME actual, no duplicate', async () => {
    const periodDate = '2026-05-01';
    const baseline = await createApprovedBaseline({
      organizationId: SEED.ORG_ID,
      initiativeId,
      createdBy: SEED.USER_ID,
      periodDate,
      revenueAmount: 10_000,
      namePrefix: `${MARK}retry-`,
    });
    const key = `${MARK}retry-actual`;
    const payload = {
      initiativeId,
      periodMonth: periodDate,
      realizedRevenueDelta: 9_500,
      baselineModelId: baseline.modelId,
      baselineExpectedVersion: baseline.version,
    };

    const first = await request(execApp)
      .post('/api/v8/execution-control/realizations/baseline')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    const second = await request(execApp)
      .post('/api/v8/execution-control/realizations/baseline')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    expect(second.body.data.entry.id).toBe(first.body.data.entry.id);

    const db = client();
    await db.connect();
    try {
      const rows = await db.query(
        `SELECT count(*)::int AS n FROM roi_realized_values WHERE operation_key = $1`,
        [key]
      );
      expect(rows.rows[0].n).toBe(1);
    } finally {
      await db.end();
    }
  });

  it('same Idempotency-Key with a DIFFERENT payload is rejected 409, never a silent replay', async () => {
    const periodDate = '2026-06-01';
    const baseline = await createApprovedBaseline({
      organizationId: SEED.ORG_ID,
      initiativeId,
      createdBy: SEED.USER_ID,
      periodDate,
      revenueAmount: 20_000,
      namePrefix: `${MARK}mismatch-`,
    });
    const key = `${MARK}mismatch-actual`;

    await request(execApp)
      .post('/api/v8/execution-control/realizations/baseline')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({
        initiativeId,
        periodMonth: periodDate,
        realizedRevenueDelta: 18_000,
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
      })
      .expect(201);

    const mismatch = await request(execApp)
      .post('/api/v8/execution-control/realizations/baseline')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({
        initiativeId,
        periodMonth: periodDate,
        realizedRevenueDelta: 999_999, // different payload, same key
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
      });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.code).toBe('IDEMPOTENCY_KEY_REUSED');

    const db = client();
    await db.connect();
    try {
      const rows = await db.query(
        `SELECT realized_revenue_delta FROM roi_realized_values WHERE operation_key = $1`,
        [key]
      );
      expect(rows.rows.length).toBe(1);
      expect(Number(rows.rows[0].realized_revenue_delta)).toBe(18_000);
    } finally {
      await db.end();
    }
  });

  it('5-way concurrency: five identical-key+identical-payload requests create exactly ONE actual', async () => {
    const periodDate = '2026-07-01';
    const baseline = await createApprovedBaseline({
      organizationId: SEED.ORG_ID,
      initiativeId,
      createdBy: SEED.USER_ID,
      periodDate,
      revenueAmount: 30_000,
      namePrefix: `${MARK}concurrent-`,
    });
    const key = `${MARK}concurrent-actual`;
    const payload = {
      initiativeId,
      periodMonth: periodDate,
      realizedRevenueDelta: 29_000,
      baselineModelId: baseline.modelId,
      baselineExpectedVersion: baseline.version,
    };

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(execApp)
          .post('/api/v8/execution-control/realizations/baseline')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', key)
          .send(payload)
      )
    );
    for (const res of responses) {
      expect(res.status).toBe(201);
    }
    const ids = new Set(responses.map((r) => r.body.data.entry.id));
    expect(ids.size).toBe(1);

    const db = client();
    await db.connect();
    try {
      const rows = await db.query(
        `SELECT count(*)::int AS n FROM roi_realized_values WHERE operation_key = $1`,
        [key]
      );
      expect(rows.rows[0].n).toBe(1);
    } finally {
      await db.end();
    }
  });

  it('cross-tenant: a foreign org cannot write, read, or reconcile against this initiative/baseline/actual', async () => {
    const periodDate = '2026-08-01';
    const baseline = await createApprovedBaseline({
      organizationId: SEED.ORG_ID,
      initiativeId,
      createdBy: SEED.USER_ID,
      periodDate,
      revenueAmount: 40_000,
      namePrefix: `${MARK}tenant-`,
    });

    // Foreign write attempt against org A's initiative → 404, not a silent
    // cross-org write.
    const foreignWrite = await request(execApp)
      .post('/api/v8/execution-control/realizations/baseline')
      .set('Authorization', `Bearer ${foreignToken}`)
      .set('Idempotency-Key', `${MARK}tenant-foreign-write`)
      .send({
        initiativeId,
        periodMonth: periodDate,
        realizedRevenueDelta: 1,
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
      });
    expect(foreignWrite.status).toBe(404);

    // Legit org-A actual, to attempt foreign reconciliation against.
    const ownWrite = await request(execApp)
      .post('/api/v8/execution-control/realizations/baseline')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `${MARK}tenant-own-write`)
      .send({
        initiativeId,
        periodMonth: periodDate,
        realizedRevenueDelta: 38_000,
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
      })
      .expect(201);
    const actualId = ownWrite.body.data.entry.id;

    // Foreign org cannot create a review referencing org A's initiative,
    // actualId, or baseline — 404 on the initiative check.
    const foreignReview = await request(financeApp)
      .post('/api/v8/finance/value-tracking/post-investment-reviews')
      .set('Authorization', `Bearer ${foreignToken}`)
      .set('Idempotency-Key', `${MARK}tenant-foreign-review`)
      .send({
        initiativeId,
        actualIds: [actualId],
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
        baselineStatementType: 'P&L',
        baselineLineCode: 'REVENUE',
        baselinePeriodDate: periodDate,
      });
    expect(foreignReview.status).toBe(404);

    // A real org-A review, then foreign GET must 404 — never leak existence
    // or content.
    const ownReview = await request(financeApp)
      .post('/api/v8/finance/value-tracking/post-investment-reviews')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `${MARK}tenant-own-review`)
      .send({
        initiativeId,
        actualIds: [actualId],
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
        baselineStatementType: 'P&L',
        baselineLineCode: 'REVENUE',
        baselinePeriodDate: periodDate,
      })
      .expect(201);

    const foreignRead = await request(financeApp)
      .get(`/api/v8/finance/value-tracking/post-investment-reviews/${ownReview.body.data.id}`)
      .set('Authorization', `Bearer ${foreignToken}`);
    expect(foreignRead.status).toBe(404);

    // Foreign org's own Results read never sees org A's actual.
    const foreignResultsRead = await request(resultsApp)
      .get(`/api/execution/roi/${initiativeId}/realized`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .expect(200);
    const foreignRows = foreignResultsRead.body.data as any[];
    expect(foreignRows.find((r) => r.id === actualId)).toBeUndefined();
  });

  it('failure after the actual write, before the review receipt finalizes: an honest recoverable state — the actual is untouched, the review is retryable, no false completed', async () => {
    const periodDate = '2026-09-01';
    const baseline = await createApprovedBaseline({
      organizationId: SEED.ORG_ID,
      initiativeId,
      createdBy: SEED.USER_ID,
      periodDate,
      revenueAmount: 60_000,
      namePrefix: `${MARK}fault-`,
    });

    const write = await request(execApp)
      .post('/api/v8/execution-control/realizations/baseline')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `${MARK}fault-actual`)
      .send({
        initiativeId,
        periodMonth: periodDate,
        realizedRevenueDelta: 61_000,
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
      })
      .expect(201);
    const actualId = write.body.data.entry.id;

    const key = `${MARK}fault-review`;
    const escapedKey = key.replace(/'/g, "''");
    const db = client();
    await db.connect();
    try {
      // Force ONLY this key's finalize UPDATE to fail — mirrors FIN-05's
      // proven fault-injection technique.
      await db.query(
        `ALTER TABLE finance_post_investment_reviews
           ADD CONSTRAINT chk_test_fin007_finalize_fault
           CHECK (idempotency_key <> '${escapedKey}' OR status <> 'completed') NOT VALID`
      );

      const failed = await request(financeApp)
        .post('/api/v8/finance/value-tracking/post-investment-reviews')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send({
          initiativeId,
          actualIds: [actualId],
          baselineModelId: baseline.modelId,
          baselineExpectedVersion: baseline.version,
          baselineStatementType: 'P&L',
          baselineLineCode: 'REVENUE',
          baselinePeriodDate: periodDate,
        });
      expect(failed.status).toBe(500);

      // The actual write from step 1 is completely untouched.
      const actualStillThere = await db.query(
        `SELECT realized_revenue_delta FROM roi_realized_values WHERE id = $1`,
        [actualId]
      );
      expect(Number(actualStillThere.rows[0].realized_revenue_delta)).toBe(61_000);

      // The review row exists but honestly reflects failure, never a false
      // 'completed'.
      const midRow = await db.query(
        `SELECT status FROM finance_post_investment_reviews WHERE organization_id = $1 AND idempotency_key = $2`,
        [SEED.ORG_ID, key]
      );
      expect(midRow.rows.length).toBe(1);
      expect(midRow.rows[0].status).not.toBe('completed');

      // Remove the fault — retry with the SAME key reclaims the SAME row.
      await db.query(
        `ALTER TABLE finance_post_investment_reviews DROP CONSTRAINT chk_test_fin007_finalize_fault`
      );

      const retry = await request(financeApp)
        .post('/api/v8/finance/value-tracking/post-investment-reviews')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send({
          initiativeId,
          actualIds: [actualId],
          baselineModelId: baseline.modelId,
          baselineExpectedVersion: baseline.version,
          baselineStatementType: 'P&L',
          baselineLineCode: 'REVENUE',
          baselinePeriodDate: periodDate,
        })
        .expect(201);
      expect(retry.body.data.status).toBe('completed');
      expect(retry.body.data.actualIds).toEqual([actualId]);

      const finalCount = await db.query(
        `SELECT count(*)::int AS n FROM finance_post_investment_reviews WHERE organization_id = $1 AND idempotency_key = $2`,
        [SEED.ORG_ID, key]
      );
      expect(finalCount.rows[0].n).toBe(1); // same row, never a second one
    } finally {
      await db.query(
        `ALTER TABLE finance_post_investment_reviews DROP CONSTRAINT IF EXISTS chk_test_fin007_finalize_fault`
      );
      await db.end();
    }
  }, 60_000);

  it('review creation Idempotency-Key with a DIFFERENT payload is rejected 409', async () => {
    const periodDate = '2026-10-01';
    const baseline = await createApprovedBaseline({
      organizationId: SEED.ORG_ID,
      initiativeId,
      createdBy: SEED.USER_ID,
      periodDate,
      revenueAmount: 15_000,
      namePrefix: `${MARK}review-mismatch-`,
    });
    const write = await request(execApp)
      .post('/api/v8/execution-control/realizations/baseline')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `${MARK}review-mismatch-actual`)
      .send({
        initiativeId,
        periodMonth: periodDate,
        realizedRevenueDelta: 14_000,
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
      })
      .expect(201);
    const actualId = write.body.data.entry.id;

    const key = `${MARK}review-mismatch`;
    await request(financeApp)
      .post('/api/v8/finance/value-tracking/post-investment-reviews')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({
        initiativeId,
        actualIds: [actualId],
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
        baselineStatementType: 'P&L',
        baselineLineCode: 'REVENUE',
        baselinePeriodDate: periodDate,
      })
      .expect(201);

    const mismatch = await request(financeApp)
      .post('/api/v8/finance/value-tracking/post-investment-reviews')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({
        initiativeId,
        actualIds: [actualId],
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
        baselineStatementType: 'P&L',
        baselineLineCode: 'REVENUE',
        baselinePeriodDate: '2026-11-01', // different — same key
      });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('5-way concurrency on review creation: five identical-key+identical-payload requests create exactly ONE review', async () => {
    const periodDate = '2026-12-01';
    const baseline = await createApprovedBaseline({
      organizationId: SEED.ORG_ID,
      initiativeId,
      createdBy: SEED.USER_ID,
      periodDate,
      revenueAmount: 25_000,
      namePrefix: `${MARK}review-concurrent-`,
    });
    const write = await request(execApp)
      .post('/api/v8/execution-control/realizations/baseline')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `${MARK}review-concurrent-actual`)
      .send({
        initiativeId,
        periodMonth: periodDate,
        realizedRevenueDelta: 24_000,
        baselineModelId: baseline.modelId,
        baselineExpectedVersion: baseline.version,
      })
      .expect(201);
    const actualId = write.body.data.entry.id;

    const key = `${MARK}review-concurrent`;
    const payload = {
      initiativeId,
      actualIds: [actualId],
      baselineModelId: baseline.modelId,
      baselineExpectedVersion: baseline.version,
      baselineStatementType: 'P&L',
      baselineLineCode: 'REVENUE',
      baselinePeriodDate: periodDate,
    };

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(financeApp)
          .post('/api/v8/finance/value-tracking/post-investment-reviews')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', key)
          .send(payload)
      )
    );
    for (const res of responses) {
      expect(res.status).toBe(201);
    }
    const ids = new Set(responses.map((r) => r.body.data.id));
    expect(ids.size).toBe(1);

    const db = client();
    await db.connect();
    try {
      const rows = await db.query(
        `SELECT count(*)::int AS n FROM finance_post_investment_reviews WHERE organization_id = $1 AND idempotency_key = $2`,
        [SEED.ORG_ID, key]
      );
      expect(rows.rows[0].n).toBe(1);
    } finally {
      await db.end();
    }
  });
});
