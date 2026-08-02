/**
 * FIN-06 (Phase 2, Valuation Recommendation adapter) acceptance: real
 * Express app mounting the actual production routers behind the real
 * `verifyToken` middleware, real local Postgres, zero business-logic mocks.
 *
 * Mirrors `tests/acceptance/fin-006-investment-case-candidate-handoff.e2e.test.ts`
 * (sibling FIN-06 Phase-2 adapter, same day) and
 * `tests/acceptance/int-008-candidate-handoff.e2e.test.ts` (canonical
 * source-adapter-over-shared-core style).
 *
 * A valuation "advisory recommendation" is not an independent DB row — it
 * lives inside `valuations.advisory` (a JSONB blob), addressed only by an
 * `id` string with no valuation-scoping in the route surface (see
 * `financeValuationRecommendationCandidateHandoff.ts`'s header comment for
 * the full eligibility-gate rationale). Fixtures below seed `valuations`
 * rows directly with a hand-built `advisory.recommendations` array.
 *
 * Covers:
 *   1) preview: unknown recommendation id -> ineligible; known id -> eligible
 *      with real DB data (title/rationale derived from the recommendation)
 *   2) confirm: golden create -> idempotent retry (same candidateId, one row)
 *   3) concurrency: N=5 concurrent confirms -> exactly one candidate row
 *   4) cross-tenant: org B can never preview/confirm/reopen org A's
 *      recommendation, and org A's recommendation content never leaks
 *   5) `convertAdvisoryRecommendationToInitiative`'s new behavior (exercised
 *      through the real, pre-existing
 *      `POST /valuations/:id/advisory/:recommendationId/convert-to-initiative`
 *      route) creates a Candidate, never a bare `initiatives` row
 *   6) the neutralized `POST /financial-analyses/:id/initiatives` never
 *      creates an `initiatives` row, regardless of INITIATIVE_FUNNEL_ENABLED
 */
import fs from 'node:fs/promises';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getJwtSecret, requireLocalDbUrl } from './harness.js';

const PREFIX = 'odbior--fin006vr--';

const ORG_A = `${PREFIX}org-a`;
const USER_A = `${PREFIX}user-a`;
const EMAIL_A = `${PREFIX}owner-a@acceptance.local`;

const ORG_B = `${PREFIX}org-b`;
const USER_B = `${PREFIX}user-b`;
const EMAIL_B = `${PREFIX}owner-b@acceptance.local`;

const VAL_GOLDEN = `${PREFIX}val-golden`;
const VAL_CONCURRENCY = `${PREFIX}val-concurrency`;
const VAL_CROSSTENANT = `${PREFIX}val-crosstenant`;
const VAL_CONVERT = `${PREFIX}val-convert`;

const REC_GOLDEN = `${PREFIX}rec-golden`;
const REC_CONCURRENCY = `${PREFIX}rec-concurrency`;
const REC_CROSSTENANT = `${PREFIX}rec-crosstenant`;
const REC_CONVERT = `${PREFIX}rec-convert`;
const REC_UNKNOWN = `${PREFIX}rec-does-not-exist`;

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
    [orgId, `FIN-06-VR ${orgId}`, now]
  );
  await c.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1,$2,$3,'x','ADMIN','active','FIN006VR','Test',$4) ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, email, now]
  );
  await c.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     SELECT $4,$1,$2,'OWNER','ACTIVE',$3
     WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2)`,
    [orgId, userId, now, `${PREFIX}mem-${userId}`]
  );
}

function advisoryFor(recommendationId: string, titleSuffix: string): string {
  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    recommendations: [
      {
        id: recommendationId,
        category: 'risk_reduction',
        title: `${PREFIX}Reduce risk ${titleSuffix}`,
        hypothesis: `De-risk execution ${titleSuffix}`,
        mechanism: `Lower perceived risk ${titleSuffix}`,
      },
    ],
  });
}

async function insertValuation(
  c: pg.Client,
  params: { id: string; orgId: string; createdBy: string; recommendationId: string; titleSuffix: string }
): Promise<void> {
  await c.query(
    `INSERT INTO valuations
       (id, organization_id, project_id, title, status, source_type, source_id,
        horizon_years, currency, assumptions, peers, results, advisory, created_by)
     VALUES ($1,$2,NULL,$3,'APPROVED','manual',NULL,5,'PLN','{}','[]','{}',$4,$5)`,
    [
      params.id,
      params.orgId,
      `${PREFIX}Valuation ${params.id}`,
      advisoryFor(params.recommendationId, params.titleSuffix),
      params.createdBy,
    ]
  );
}

let app: Express;
let economicsApp: Express;
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

  await insertValuation(client, {
    id: VAL_GOLDEN,
    orgId: ORG_A,
    createdBy: USER_A,
    recommendationId: REC_GOLDEN,
    titleSuffix: 'golden',
  });
  await insertValuation(client, {
    id: VAL_CONCURRENCY,
    orgId: ORG_A,
    createdBy: USER_A,
    recommendationId: REC_CONCURRENCY,
    titleSuffix: 'concurrency',
  });
  await insertValuation(client, {
    id: VAL_CROSSTENANT,
    orgId: ORG_A,
    createdBy: USER_A,
    recommendationId: REC_CROSSTENANT,
    titleSuffix: 'crosstenant',
  });
  await insertValuation(client, {
    id: VAL_CONVERT,
    orgId: ORG_A,
    createdBy: USER_A,
    recommendationId: REC_CONVERT,
    titleSuffix: 'convert',
  });

  tokenA = mintTokenFor(USER_A, ORG_A, EMAIL_A);
  tokenB = mintTokenFor(USER_B, ORG_B, EMAIL_B);

  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const candidateHandoffRouter = (
    await import('../../server/src/routes/financeCandidateHandoffValuationRecommendation.routes.js')
  ).default;

  app = express();
  app.use(express.json());
  app.use(
    '/api/finance/candidate-handoff/valuation-recommendation',
    verifyToken as any,
    candidateHandoffRouter
  );

  // Separate app mounting the REAL economics.routes.ts router (unmodified
  // mount surface) to exercise the two neutralized/rewired routes
  // (`convert-to-initiative` and `financial-analyses/:id/initiatives`)
  // exactly as production does, behind real auth.
  const economicsRouter = (await import('../../server/src/routes/economics.routes.js')).default;
  economicsApp = express();
  economicsApp.use(express.json());
  economicsApp.use('/api/economics', verifyToken as any, economicsRouter);
}, 60_000);

afterAll(async () => {
  await client.query(`DELETE FROM finance_candidate_handoffs WHERE source_id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM initiative_candidates WHERE source_id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM initiatives WHERE source_id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM valuations WHERE id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM organization_members WHERE id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM users WHERE id LIKE $1`, [`${PREFIX}%`]);
  await client.query(`DELETE FROM organizations WHERE id LIKE $1`, [`${PREFIX}%`]);
  await client.end();
});

describe('FIN-06 — valuation recommendation candidate handoff', () => {
  it('preview: unknown recommendation is ineligible, known recommendation is eligible with real DB data', async () => {
    const unknown = await request(app)
      .get(`/api/finance/candidate-handoff/valuation-recommendation/${REC_UNKNOWN}/preview`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(unknown.status, JSON.stringify(unknown.body)).toBe(200);
    expect(unknown.body.data.eligible).toBe(false);
    expect(unknown.body.data.reason).toBe('NOT_FOUND');

    const known = await request(app)
      .get(`/api/finance/candidate-handoff/valuation-recommendation/${REC_GOLDEN}/preview`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(known.status, JSON.stringify(known.body)).toBe(200);
    expect(known.body.data.eligible).toBe(true);
    expect(known.body.data.preview.sourceType).toBe('finance_valuation_recommendation');
    expect(known.body.data.preview.sourceId).toBe(REC_GOLDEN);
    expect(known.body.data.preview.title).toBe(`${PREFIX}Reduce risk golden`);
    expect(known.body.data.preview.rationale).toContain('golden');
  });

  it('confirm: creates candidate + receipt, retry is idempotent (same candidateId, one row)', async () => {
    const confirm1 = await request(app)
      .post(`/api/finance/candidate-handoff/valuation-recommendation/${REC_GOLDEN}/confirm`)
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
    expect(candidateRow.rows[0].source_type).toBe('finance_valuation_recommendation');
    expect(candidateRow.rows[0].source_id).toBe(REC_GOLDEN);
    expect(candidateRow.rows[0].organization_id).toBe(ORG_A);
    expect(candidateRow.rows[0].status).toBe('pending');

    const handoffRow = await client.query(
      `SELECT source_type, source_id, candidate_id FROM finance_candidate_handoffs WHERE organization_id = $1 AND source_id = $2`,
      [ORG_A, REC_GOLDEN]
    );
    expect(handoffRow.rows).toHaveLength(1);
    expect(handoffRow.rows[0].source_type).toBe('finance_valuation_recommendation');
    expect(handoffRow.rows[0].candidate_id).toBe(candidateId);

    const confirm2 = await request(app)
      .post(`/api/finance/candidate-handoff/valuation-recommendation/${REC_GOLDEN}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(confirm2.status, JSON.stringify(confirm2.body)).toBe(200);
    expect(confirm2.body.data.created).toBe(false);
    expect(confirm2.body.data.candidateId).toBe(candidateId);

    const candidateCount = await client.query(
      `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
      [REC_GOLDEN]
    );
    expect(candidateCount.rows[0].n).toBe(1);
    const handoffCount = await client.query(
      `SELECT count(*)::int AS n FROM finance_candidate_handoffs WHERE source_id = $1`,
      [REC_GOLDEN]
    );
    expect(handoffCount.rows[0].n).toBe(1);

    const lineage = await request(app)
      .get(`/api/finance/candidate-handoff/valuation-recommendation/${REC_GOLDEN}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(lineage.status, JSON.stringify(lineage.body)).toBe(200);
    expect(lineage.body.data.sourceId).toBe(REC_GOLDEN);
    expect(lineage.body.data.candidateId).toBe(candidateId);
  });

  it('lineage read-back 404s before any handoff exists', async () => {
    const res = await request(app)
      .get(`/api/finance/candidate-handoff/valuation-recommendation/${REC_CONCURRENCY}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status, JSON.stringify(res.body)).toBe(404);
    expect(res.body.code).toBe('NO_CANDIDATE_HANDOFF');
  });

  it('concurrency: 5 concurrent confirms for the same recommendation create exactly one candidate', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post(`/api/finance/candidate-handoff/valuation-recommendation/${REC_CONCURRENCY}/confirm`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({})
      )
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    const candidateIds = new Set(results.map((r) => r.body.data.candidateId));
    expect(candidateIds.size).toBe(1);

    const candidateCount = await client.query(
      `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
      [REC_CONCURRENCY]
    );
    expect(candidateCount.rows[0].n).toBe(1);
    const handoffCount = await client.query(
      `SELECT count(*)::int AS n FROM finance_candidate_handoffs WHERE source_id = $1`,
      [REC_CONCURRENCY]
    );
    expect(handoffCount.rows[0].n).toBe(1);
  });

  it('cross-tenant: org B can never preview, confirm, or reopen org A recommendation, no data leak', async () => {
    const preview = await request(app)
      .get(`/api/finance/candidate-handoff/valuation-recommendation/${REC_CROSSTENANT}/preview`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(preview.status, JSON.stringify(preview.body)).toBe(200);
    expect(preview.body.data.eligible).toBe(false);
    expect(preview.body.data.reason).toBe('NOT_FOUND');
    // The whole response body must never mention org A's real recommendation title.
    expect(JSON.stringify(preview.body)).not.toContain('Reduce risk');

    const confirm = await request(app)
      .post(`/api/finance/candidate-handoff/valuation-recommendation/${REC_CROSSTENANT}/confirm`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({});
    expect(confirm.status, JSON.stringify(confirm.body)).toBe(409);
    expect(confirm.body.code).toBe('SOURCE_NOT_ELIGIBLE');
    expect(confirm.body.details.reason).toBe('NOT_FOUND');
    expect(JSON.stringify(confirm.body)).not.toContain('Reduce risk');

    const lineage = await request(app)
      .get(`/api/finance/candidate-handoff/valuation-recommendation/${REC_CROSSTENANT}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(lineage.status, JSON.stringify(lineage.body)).toBe(404);
    expect(lineage.body.code).toBe('NO_CANDIDATE_HANDOFF');

    // Org B never wrote through to org A's recommendation.
    const candidateCount = await client.query(
      `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
      [REC_CROSSTENANT]
    );
    expect(candidateCount.rows[0].n).toBe(0);

    // Positive control: org A CAN preview its own recommendation.
    const ownPreview = await request(app)
      .get(`/api/finance/candidate-handoff/valuation-recommendation/${REC_CROSSTENANT}/preview`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(ownPreview.body.data.eligible).toBe(true);
  });

  it('convert-to-initiative route creates a Candidate through the real HTTP path, never a bare Initiative', async () => {
    const res = await request(economicsApp)
      .post(`/api/economics/valuations/${VAL_CONVERT}/advisory/${REC_CONVERT}/convert-to-initiative`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.created).toBe(true);
    const candidateId = res.body.candidateId;
    expect(candidateId).toBeTruthy();

    const candidateRow = await client.query(
      `SELECT source_type, source_id FROM initiative_candidates WHERE id = $1`,
      [candidateId]
    );
    expect(candidateRow.rows).toHaveLength(1);
    expect(candidateRow.rows[0].source_type).toBe('finance_valuation_recommendation');
    expect(candidateRow.rows[0].source_id).toBe(REC_CONVERT);

    // The old direct-insert path is gone: zero `initiatives` rows sourced
    // from this valuation/recommendation, from either the old 'valuation'
    // source_type or any other.
    const initiativeCount = await client.query(
      `SELECT count(*)::int AS n FROM initiatives WHERE source_id IN ($1, $2)`,
      [VAL_CONVERT, REC_CONVERT]
    );
    expect(initiativeCount.rows[0].n).toBe(0);

    // Retry via the same route is idempotent too (shared core behind it).
    const retry = await request(economicsApp)
      .post(`/api/economics/valuations/${VAL_CONVERT}/advisory/${REC_CONVERT}/convert-to-initiative`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(retry.status, JSON.stringify(retry.body)).toBe(200);
    expect(retry.body.created).toBe(false);
    expect(retry.body.candidateId).toBe(candidateId);
  });

  it('neutralized POST /financial-analyses/:id/initiatives never creates an Initiative, regardless of the funnel flag', async () => {
    const before = process.env.INITIATIVE_FUNNEL_ENABLED;
    try {
      for (const flag of ['true', 'false', undefined]) {
        if (flag === undefined) delete process.env.INITIATIVE_FUNNEL_ENABLED;
        else process.env.INITIATIVE_FUNNEL_ENABLED = flag;

        const analysisId = `${PREFIX}analysis-${flag ?? 'unset'}`;
        const res = await request(economicsApp)
          .post(`/api/economics/financial-analyses/${analysisId}/initiatives`)
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
