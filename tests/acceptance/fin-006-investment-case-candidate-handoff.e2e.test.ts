/**
 * FIN-06 (Phase 2, Investment Case adapter) acceptance: real Express app
 * mounting the actual production routers behind the real `verifyToken`
 * middleware, real local Postgres, zero business-logic mocks.
 *
 * Mirrors `tests/acceptance/int-008-candidate-handoff.e2e.test.ts` (this
 * repo's canonical style for a source-adapter over a shared candidate-
 * handoff core) and `tests/acceptance/h65-rbac.e2e.test.ts` (two-org
 * cross-tenant fixture pattern).
 *
 * Covers:
 *   1) preview: ineligible (draft) vs eligible (approved) model
 *   2) confirm: golden create -> idempotent retry (same candidateId, one row)
 *   3) concurrency: N=5 concurrent confirms -> exactly one candidate row
 *   4) cross-tenant: org B can never preview/confirm/reopen org A's model
 *   5) TOCTOU: approved at preview time, archived before confirm -> confirm
 *      re-checks eligibility INSIDE the lock and fails, no candidate created
 *   6) the neutralized `POST /api/v8/finance/analyses/:id/initiatives` never
 *      creates an `initiatives` row, regardless of INITIATIVE_FUNNEL_ENABLED
 *
 * `finance_candidate_handoffs` (FIN-06 foundation migration,
 * `server/migrations/20260802_fin006_candidate_handoff.sql`) is applied
 * defensively in beforeAll since this shared acceptance Postgres instance
 * may not have it yet (mirrors the `tls-007` integration test's own
 * beforeAll migration-apply pattern).
 */
import fs from 'node:fs/promises';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getJwtSecret, requireLocalDbUrl } from './harness.js';

const PREFIX = 'odbior--fin006--';

const ORG_A = `${PREFIX}org-a`;
const USER_A = `${PREFIX}user-a`;
const EMAIL_A = `${PREFIX}owner-a@acceptance.local`;

const ORG_B = `${PREFIX}org-b`;
const USER_B = `${PREFIX}user-b`;
const EMAIL_B = `${PREFIX}owner-b@acceptance.local`;

const MODEL_DRAFT = `${PREFIX}model-draft`;
const MODEL_GOLDEN = `${PREFIX}model-golden`;
const MODEL_CONCURRENCY = `${PREFIX}model-concurrency`;
const MODEL_TOCTOU = `${PREFIX}model-toctou`;
const MODEL_CROSSTENANT = `${PREFIX}model-crosstenant`;

function mintTokenFor(userId: string, orgId: string, email: string): string {
  return jwt.sign(
    { id: userId, email, organizationId: orgId, organization_id: orgId, role: 'OWNER' },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

async function seedTenant(c: pg.Client, orgId: string, userId: string, email: string): Promise<void> {
  const now = new Date().toISOString();
  await c.query(
    `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
     VALUES ($1,$2,'enterprise','active',1,$3) ON CONFLICT (id) DO NOTHING`,
    [orgId, `FIN-06 ${orgId}`, now]
  );
  await c.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1,$2,$3,'x','ADMIN','active','FIN006','Test',$4) ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, email, now]
  );
  await c.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     SELECT $4,$1,$2,'OWNER','ACTIVE',$3
     WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2)`,
    [orgId, userId, now, `${PREFIX}mem-${userId}`]
  );
}

async function insertModel(
  c: pg.Client,
  params: {
    id: string;
    orgId: string;
    status: 'draft' | 'approved' | 'archived';
    createdBy: string;
    approvedSnapshotPeriods?: number;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const isApproved = params.status === 'approved';
  const snapshot = isApproved
    ? JSON.stringify({
        periods: Array.from({ length: params.approvedSnapshotPeriods ?? 3 }, (_, i) => ({ index: i })),
        validations: [],
        computedAt: now,
      })
    : null;
  await c.query(
    `INSERT INTO financial_models
       (id, organization_id, name, currency, scenario, horizon_months, start_date, status,
        version, approved_by, approved_at, approved_snapshot, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,'EUR','base',24,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
    [
      params.id,
      params.orgId,
      `${PREFIX}Investment Case ${params.id}`,
      '2026-01-01',
      params.status,
      isApproved ? 2 : 1,
      isApproved ? params.createdBy : null,
      isApproved ? now : null,
      snapshot,
      params.createdBy,
      now,
    ]
  );
}

let app: Express;
let v8App: Express;
let client: pg.Client;
let tokenA: string;
let tokenB: string;

beforeAll(async () => {
  requireLocalDbUrl();
  client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Defensive: apply the FIN-06 foundation migration if this shared
  // acceptance Postgres doesn't have `finance_candidate_handoffs` yet.
  const migration = await fs.readFile(
    'server/migrations/20260802_fin006_candidate_handoff.sql',
    'utf8'
  );
  await client.query(migration);

  await seedTenant(client, ORG_A, USER_A, EMAIL_A);
  await seedTenant(client, ORG_B, USER_B, EMAIL_B);

  await insertModel(client, { id: MODEL_DRAFT, orgId: ORG_A, status: 'draft', createdBy: USER_A });
  await insertModel(client, { id: MODEL_GOLDEN, orgId: ORG_A, status: 'approved', createdBy: USER_A });
  await insertModel(client, {
    id: MODEL_CONCURRENCY,
    orgId: ORG_A,
    status: 'approved',
    createdBy: USER_A,
  });
  await insertModel(client, { id: MODEL_TOCTOU, orgId: ORG_A, status: 'approved', createdBy: USER_A });
  await insertModel(client, {
    id: MODEL_CROSSTENANT,
    orgId: ORG_A,
    status: 'approved',
    createdBy: USER_A,
  });

  tokenA = mintTokenFor(USER_A, ORG_A, EMAIL_A);
  tokenB = mintTokenFor(USER_B, ORG_B, EMAIL_B);

  const { default: verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const candidateHandoffRouter = (
    await import('../../server/src/routes/financeCandidateHandoffInvestmentCase.routes.js')
  ).default;

  app = express();
  app.use(express.json());
  app.use(
    '/api/finance/candidate-handoff/investment-case',
    verifyToken as any,
    candidateHandoffRouter
  );

  // Separate app for the neutralized v8 Finance endpoint — real router,
  // real verifyToken + attachV8Context (same middleware chain the real
  // Gateway.ts's v8Router applies), so the "never creates an Initiative"
  // proof runs through the actual production auth path.
  const { attachV8Context } = await import('../../server/src/middleware/v8Auth.middleware.js');
  const financeV8Router = (await import('../../server/src/routes/v8/finance.routes.js')).default;
  v8App = express();
  v8App.use(express.json());
  v8App.use('/api/v8/finance', verifyToken as any, attachV8Context as any, financeV8Router);
}, 60_000);

afterAll(async () => {
  await client.query(`DELETE FROM finance_candidate_handoffs WHERE source_id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM initiative_candidates WHERE source_id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM initiatives WHERE source_id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM financial_models WHERE id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM organization_members WHERE id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM users WHERE id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM organizations WHERE id LIKE $1`, [`${PREFIX}%`]);
  await client.end();
});

describe('FIN-06 — investment case (financial_models) candidate handoff', () => {
  it('preview: draft model is ineligible, approved model is eligible with real DB data', async () => {
    const draft = await request(app)
      .get(`/api/finance/candidate-handoff/investment-case/${MODEL_DRAFT}/preview`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(draft.status, JSON.stringify(draft.body)).toBe(200);
    expect(draft.body.data.eligible).toBe(false);
    expect(draft.body.data.reason).toBe('NOT_APPROVED');

    const approved = await request(app)
      .get(`/api/finance/candidate-handoff/investment-case/${MODEL_GOLDEN}/preview`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    expect(approved.body.data.eligible).toBe(true);
    expect(approved.body.data.preview.sourceType).toBe('finance_investment_case');
    expect(approved.body.data.preview.sourceId).toBe(MODEL_GOLDEN);
    expect(approved.body.data.preview.title).toBe(`${PREFIX}Investment Case ${MODEL_GOLDEN}`);
    expect(approved.body.data.preview.rationale).toContain(MODEL_GOLDEN);
    expect(approved.body.data.preview.rationale).toContain('EUR');
    // No fabricated NPV/IRR/payback/fitScore — financial_models has no such column.
    expect(approved.body.data.preview.fitScore).toBeUndefined();
  });

  it('confirm: creates candidate + receipt, retry is idempotent (same candidateId, one row)', async () => {
    const confirm1 = await request(app)
      .post(`/api/finance/candidate-handoff/investment-case/${MODEL_GOLDEN}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(confirm1.status, JSON.stringify(confirm1.body)).toBe(201);
    expect(confirm1.body.data.created).toBe(true);
    const candidateId = confirm1.body.data.candidateId;
    expect(candidateId).toBeTruthy();

    const candidateRow = await client.query(
      `SELECT source_type, source_id, organization_id, status FROM initiative_candidates WHERE id = $1`,
      [candidateId]
    );
    expect(candidateRow.rows).toHaveLength(1);
    expect(candidateRow.rows[0].source_type).toBe('finance_investment_case');
    expect(candidateRow.rows[0].source_id).toBe(MODEL_GOLDEN);
    expect(candidateRow.rows[0].organization_id).toBe(ORG_A);
    expect(candidateRow.rows[0].status).toBe('pending');

    const handoffRow = await client.query(
      `SELECT source_type, source_id, candidate_id FROM finance_candidate_handoffs WHERE organization_id = $1 AND source_id = $2`,
      [ORG_A, MODEL_GOLDEN]
    );
    expect(handoffRow.rows).toHaveLength(1);
    expect(handoffRow.rows[0].source_type).toBe('finance_investment_case');
    expect(handoffRow.rows[0].candidate_id).toBe(candidateId);

    const confirm2 = await request(app)
      .post(`/api/finance/candidate-handoff/investment-case/${MODEL_GOLDEN}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(confirm2.status, JSON.stringify(confirm2.body)).toBe(200);
    expect(confirm2.body.data.created).toBe(false);
    expect(confirm2.body.data.candidateId).toBe(candidateId);

    const candidateCount = await client.query(
      `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
      [MODEL_GOLDEN]
    );
    expect(candidateCount.rows[0].n).toBe(1);
    const handoffCount = await client.query(
      `SELECT count(*)::int AS n FROM finance_candidate_handoffs WHERE source_id = $1`,
      [MODEL_GOLDEN]
    );
    expect(handoffCount.rows[0].n).toBe(1);

    const lineage = await request(app)
      .get(`/api/finance/candidate-handoff/investment-case/${MODEL_GOLDEN}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(lineage.status, JSON.stringify(lineage.body)).toBe(200);
    expect(lineage.body.data.sourceId).toBe(MODEL_GOLDEN);
    expect(lineage.body.data.candidateId).toBe(candidateId);
  });

  it('lineage read-back 404s before any handoff exists', async () => {
    const res = await request(app)
      .get(`/api/finance/candidate-handoff/investment-case/${MODEL_CONCURRENCY}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status, JSON.stringify(res.body)).toBe(404);
    expect(res.body.code).toBe('NO_CANDIDATE_HANDOFF');
  });

  it('concurrency: 5 concurrent confirms for the same model create exactly one candidate', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post(`/api/finance/candidate-handoff/investment-case/${MODEL_CONCURRENCY}/confirm`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({})
      )
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    const candidateIds = new Set(results.map((r) => r.body.data.candidateId));
    expect(candidateIds.size).toBe(1);

    const candidateCount = await client.query(
      `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
      [MODEL_CONCURRENCY]
    );
    expect(candidateCount.rows[0].n).toBe(1);
    const handoffCount = await client.query(
      `SELECT count(*)::int AS n FROM finance_candidate_handoffs WHERE source_id = $1`,
      [MODEL_CONCURRENCY]
    );
    expect(handoffCount.rows[0].n).toBe(1);
  });

  it('TOCTOU: model approved at preview time, archived before confirm -> confirm fails, no candidate', async () => {
    const preview = await request(app)
      .get(`/api/finance/candidate-handoff/investment-case/${MODEL_TOCTOU}/preview`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(preview.body.data.eligible).toBe(true);

    await client.query(`UPDATE financial_models SET status = 'archived' WHERE id = $1`, [MODEL_TOCTOU]);

    const confirm = await request(app)
      .post(`/api/finance/candidate-handoff/investment-case/${MODEL_TOCTOU}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(confirm.status, JSON.stringify(confirm.body)).toBe(409);
    expect(confirm.body.code).toBe('SOURCE_NOT_ELIGIBLE');
    expect(confirm.body.details.reason).toBe('NOT_APPROVED');

    const candidateCount = await client.query(
      `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
      [MODEL_TOCTOU]
    );
    expect(candidateCount.rows[0].n).toBe(0);
    const handoffCount = await client.query(
      `SELECT count(*)::int AS n FROM finance_candidate_handoffs WHERE source_id = $1`,
      [MODEL_TOCTOU]
    );
    expect(handoffCount.rows[0].n).toBe(0);
  });

  it('cross-tenant: org B can never preview, confirm, or reopen org A model, no data leak', async () => {
    const preview = await request(app)
      .get(`/api/finance/candidate-handoff/investment-case/${MODEL_CROSSTENANT}/preview`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(preview.status, JSON.stringify(preview.body)).toBe(200);
    expect(preview.body.data.eligible).toBe(false);
    expect(preview.body.data.reason).toBe('NOT_FOUND');
    // The whole response body must never mention org A's real model title.
    expect(JSON.stringify(preview.body)).not.toContain('Investment Case');

    const confirm = await request(app)
      .post(`/api/finance/candidate-handoff/investment-case/${MODEL_CROSSTENANT}/confirm`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({});
    expect(confirm.status, JSON.stringify(confirm.body)).toBe(409);
    expect(confirm.body.code).toBe('SOURCE_NOT_ELIGIBLE');
    expect(confirm.body.details.reason).toBe('NOT_FOUND');
    expect(JSON.stringify(confirm.body)).not.toContain('Investment Case');

    const lineage = await request(app)
      .get(`/api/finance/candidate-handoff/investment-case/${MODEL_CROSSTENANT}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(lineage.status, JSON.stringify(lineage.body)).toBe(404);
    expect(lineage.body.code).toBe('NO_CANDIDATE_HANDOFF');

    // Org B never wrote through to org A's model.
    const candidateCount = await client.query(
      `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
      [MODEL_CROSSTENANT]
    );
    expect(candidateCount.rows[0].n).toBe(0);

    // Positive control: org A CAN preview/confirm its own model.
    const ownPreview = await request(app)
      .get(`/api/finance/candidate-handoff/investment-case/${MODEL_CROSSTENANT}/preview`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(ownPreview.body.data.eligible).toBe(true);
  });

  it('neutralized POST /analyses/:analysisId/initiatives never creates an Initiative, regardless of the funnel flag', async () => {
    const before = process.env.INITIATIVE_FUNNEL_ENABLED;
    try {
      for (const flag of ['true', 'false', undefined]) {
        if (flag === undefined) delete process.env.INITIATIVE_FUNNEL_ENABLED;
        else process.env.INITIATIVE_FUNNEL_ENABLED = flag;

        const analysisId = `${PREFIX}analysis-${flag ?? 'unset'}`;
        const res = await request(v8App)
          .post(`/api/v8/finance/analyses/${analysisId}/initiatives`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ acceptedProposalIds: ['whatever'] });

        expect(res.status, JSON.stringify(res.body)).toBe(410);
        expect(res.body.code).toBe('DIRECT_INITIATIVE_CREATION_DISABLED');

        const initiativeCount = await client.query(
          `SELECT count(*)::int AS n FROM initiatives WHERE source_id = $1 AND source_type = 'financial_analysis'`,
          [analysisId]
        );
        expect(initiativeCount.rows[0].n).toBe(0);
      }
    } finally {
      if (before === undefined) delete process.env.INITIATIVE_FUNNEL_ENABLED;
      else process.env.INITIATIVE_FUNNEL_ENABLED = before;
    }
  });
});
