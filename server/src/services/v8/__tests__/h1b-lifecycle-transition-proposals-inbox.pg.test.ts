/**
 * H1b — SKRZYNKA RECENZENTA: dowód na REALNYM Postgresie, przez REALNY router
 * produkcyjny (`server/src/routes/pmo/initiatives.routes.ts`).
 *
 * CO DOKŁADNIE DOWODZI (i dlaczego tego brakowało):
 * Etap H1 (14.09) odmroził ZAPIS `lifecycle-transition-proposals` /
 * `-executions`, ale odczytu nie było żadnego. `proposalVersionId` powstaje
 * w `registerGovernedProposal` i wraca WYŁĄCZNIE w odpowiedzi 201 na POST
 * propozycji — a POST wymusza `initiative_lifecycle_self_review_denied`, więc
 * proponuje z definicji KTOŚ INNY niż zatwierdza. Recenzent nie miał zatem
 * żadnej drogi, by poznać identyfikator, którego wymaga i
 * `POST /api/v8/agent-proposals/:id/scopes/:scopeKey/review`, i
 * `POST /:id/lifecycle-transition-executions`. Ekran „skrzynka" był
 * niemożliwy do napisania, a nie tylko nienapisany.
 *
 * ŚRODOWISKO: suita dotyka WYŁĄCZNIE jednorazowej bazy lokalnej (kontener
 * h1b-pg), a i tak sprząta po sobie po prefiksie `h1b_` — dane demo to twarz
 * produktu. Bez `RUN_DB_TESTS=1` + `MOCK_DB=false` + postgresowego
 * `DATABASE_URL` suita SKIP-uje (nigdy nie „przechodzi po cichu").
 *
 * DLACZEGO `queryAll` JEST PODMIENIONY, a reszta nie: `server/vitest.config.ts`
 * przybija `DB_TYPE: 'sqlite'` przez `test.env` i wygrywa z powłoką (pamięć
 * „Pułapki uruchamiania testów"), więc appowa warstwa `getDatabase()` i tak nie
 * poszłaby do Postgresa. Podmiana kieruje ten JEDEN punkt wyjścia do realnego
 * `pg`, PRZEPUSZCZAJĄC tekst zapytania przez produkcyjny `adaptQuery` — czyli
 * badany jest dosłownie ten SQL, który pojedzie na produkcji (łącznie z
 * zamianą `?`→`$n`, która przy `jsonb` potrafi wysadzić zapytanie). Router,
 * handlery i serwis czytający są w 100% produkcyjne.
 *
 * URUCHOMIENIE (z katalogu server/):
 *   DATABASE_URL="postgresql://postgres:pg@127.0.0.1:6499/postgres" \
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   npx vitest run src/services/v8/__tests__/h1b-lifecycle-transition-proposals-inbox.pg.test.ts \
 *     --retry=0 --no-file-parallelism --maxWorkers=1
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const ORG = 'h1b_org_1';
const OTHER_ORG = 'h1b_org_2';
const PROPOSER = 'h1b_user_proposer';
const REVIEWER = 'h1b_user_reviewer';
const STRANGER = 'h1b_user_stranger';
const INITIATIVE_A = 'h1b_initiative_a';
const INITIATIVE_B = 'h1b_initiative_b';

const pool = new pg.Pool({ connectionString: CONNECTION_STRING, max: 4 });

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn(async () => ({ rows: [] })) }),
}));
vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: () => void) => next(),
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
  requireSuperAdmin: (_req: any, _res: any, next: () => void) => next(),
  requireRole: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrganization: (_req: any, _res: any, next: () => void) => next(),
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrgRole: () => (req: any, res: any, next: () => void) =>
    req.user?.organizationId ? next() : res.status(403).json({ code: 'FORBIDDEN' }),
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../utils/queryHelpers.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/queryHelpers.js')>();
  const { adaptQuery } = await import('../../../database/PostgresDatabase.js');
  return {
    ...actual,
    queryAll: async (sql: string, params: unknown[] = []) =>
      (await pool.query(adaptQuery(sql), params as any[])).rows,
  };
});

let app: Express;
let currentUser: { id: string; organizationId: string; role: string } = {
  id: REVIEWER,
  organizationId: ORG,
  role: 'admin',
};

async function seedProposal(opts: {
  proposalVersionId: string;
  organizationId: string;
  initiativeId: string;
  proposerUserId: string;
  reviewerUserId: string;
  from: string;
  to: string;
  pmoDomain: string;
  status: string;
  reason: string;
}) {
  const scopeKey = `initiative_lifecycle:${opts.pmoDomain.toLowerCase()}`;
  await pool.query(
    `INSERT INTO v8_agent_proposal_versions
       (proposal_version_id,proposal_id,organization_id,canonical_run_id,proposal_version,plan_version,
        context_digest,before_json,after_json,approval_scopes_json,reviewer_authority_json,
        expires_at,status,change_reason,created_by_user_id,created_at)
     VALUES ($1,$2,$3,$4,1,1,$5,$6,$7,$8,$9,NOW() + INTERVAL '7 days',$10,$11,$12,NOW())`,
    [
      opts.proposalVersionId,
      `t01-lifecycle:h1b_case:${opts.pmoDomain}:${opts.proposalVersionId}`,
      opts.organizationId,
      'h1b_run',
      'h1b_ctx_digest',
      JSON.stringify({ status: opts.from }),
      JSON.stringify({
        transformationCaseId: 'h1b_case',
        initiativeId: opts.initiativeId,
        expectedStatus: opts.from,
        targetStatus: opts.to,
        pmoDomain: opts.pmoDomain,
        sourceCaseVersion: 2,
        baselineRefs: [`initiative:${opts.initiativeId}:${opts.from}`],
      }),
      JSON.stringify([scopeKey]),
      JSON.stringify({ [scopeKey]: [opts.reviewerUserId] }),
      opts.status,
      opts.reason,
      opts.proposerUserId,
    ]
  );
}

describe.skipIf(!REAL_PG)('H1b — skrzynka propozycji przejść (realny Postgres)', () => {
  beforeAll(async () => {
    const routes = (await import('../../../routes/pmo/initiatives.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as any).user = { ...currentUser };
      next();
    });
    app.use('/api/initiatives', routes);
    app.use('/api/pmo/initiatives', routes);

    await pool.query(
      `INSERT INTO organizations (id,name) VALUES ($1,'H1b Fixture Org'),($2,'H1b Other Org')
       ON CONFLICT (id) DO NOTHING`,
      [ORG, OTHER_ORG]
    );
    await pool.query(
      `INSERT INTO users (id,organization_id,email,first_name,last_name,role)
       VALUES ($1,$2,'h1b.proposer@example.test','Nina','Kowalska','USER'),
              ($3,$2,'h1b.reviewer@example.test','Marek','Zielinski','ADMIN'),
              ($4,$2,'h1b.stranger@example.test','Ola','Nowak','USER')
       ON CONFLICT (id) DO NOTHING`,
      [PROPOSER, ORG, REVIEWER, STRANGER]
    );
    await pool.query(
      `INSERT INTO initiatives (id,organization_id,name,status)
       VALUES ($1,$2,'Shorten onboarding lead time','APPROVED'),
              ($3,$2,'Unify supplier master data','IN_EXECUTION')
       ON CONFLICT (id) DO NOTHING`,
      [INITIATIVE_A, ORG, INITIATIVE_B]
    );
    await seedProposal({
      proposalVersionId: 'h1b_pv_pending_a',
      organizationId: ORG,
      initiativeId: INITIATIVE_A,
      proposerUserId: PROPOSER,
      reviewerUserId: REVIEWER,
      from: 'APPROVED',
      to: 'SCHEDULED',
      pmoDomain: 'SCHEDULE_MILESTONES',
      status: 'pending_review',
      reason: 'Baseline locked with the sponsor.',
    });
    await seedProposal({
      proposalVersionId: 'h1b_pv_pending_b',
      organizationId: ORG,
      initiativeId: INITIATIVE_B,
      proposerUserId: PROPOSER,
      reviewerUserId: REVIEWER,
      from: 'SCHEDULED',
      to: 'EXECUTING',
      pmoDomain: 'GOVERNANCE_DECISION_MAKING',
      status: 'pending_review',
      reason: 'Team and funding confirmed.',
    });
    await seedProposal({
      proposalVersionId: 'h1b_pv_approved',
      organizationId: ORG,
      initiativeId: INITIATIVE_A,
      proposerUserId: PROPOSER,
      reviewerUserId: REVIEWER,
      from: 'PROMOTED',
      to: 'PLANNING',
      pmoDomain: 'RESOURCE_RESPONSIBILITY',
      status: 'approved',
      reason: 'Owner assigned.',
    });
    await pool.query(
      `INSERT INTO v8_agent_proposal_scope_reviews
         (review_id,proposal_version_id,scope_key,decision,reason,reviewed_by_user_id,reviewed_at)
       VALUES ('h1b_review_1','h1b_pv_approved','initiative_lifecycle:resource_responsibility',
               'approved','Owner assigned.',$1,NOW())
       ON CONFLICT (proposal_version_id,scope_key) DO NOTHING`,
      [REVIEWER]
    );
    // Propozycja innej organizacji — nie może przeciec do skrzynki ORG.
    await seedProposal({
      proposalVersionId: 'h1b_pv_other_org',
      organizationId: OTHER_ORG,
      initiativeId: 'h1b_initiative_other',
      proposerUserId: PROPOSER,
      reviewerUserId: REVIEWER,
      from: 'APPROVED',
      to: 'SCHEDULED',
      pmoDomain: 'SCHEDULE_MILESTONES',
      status: 'pending_review',
      reason: 'Obcy najemca.',
    });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM v8_agent_proposal_scope_reviews WHERE review_id LIKE 'h1b_%'`);
    await pool.query(`DELETE FROM v8_agent_proposal_versions WHERE proposal_version_id LIKE 'h1b_%'`);
    await pool.query(`DELETE FROM initiatives WHERE id LIKE 'h1b_%'`);
    await pool.query(`DELETE FROM users WHERE id LIKE 'h1b_%'`);
    await pool.query(`DELETE FROM organizations WHERE id LIKE 'h1b_%'`);
    await pool.end();
  });

  it('skrzynka organizacji oddaje oczekujące propozycje recenzentowi (z przejściem, autorem i powodem)', async () => {
    currentUser = { id: REVIEWER, organizationId: ORG, role: 'admin' };
    const res = await request(app).get('/api/initiatives/lifecycle-transition-proposals?status=pending');
    expect(res.status).toBe(200);
    const ids = res.body.proposals.map((p: any) => p.proposalVersionId).sort();
    expect(ids).toEqual(['h1b_pv_pending_a', 'h1b_pv_pending_b']);
    const first = res.body.proposals.find((p: any) => p.proposalVersionId === 'h1b_pv_pending_a');
    expect(first.initiativeName).toBe('Shorten onboarding lead time');
    expect(first.fromStatus).toBe('APPROVED');
    expect(first.toStatus).toBe('SCHEDULED');
    expect(first.proposerName).toBe('Nina Kowalska');
    expect(first.reason).toBe('Baseline locked with the sponsor.');
    expect(first.scopeKey).toBe('initiative_lifecycle:schedule_milestones');
    expect(first.viewerIsReviewer).toBe(true);
    expect(first.executable).toBe(false);
  });

  it('nie przecieka między organizacjami', async () => {
    currentUser = { id: REVIEWER, organizationId: ORG, role: 'admin' };
    const res = await request(app).get('/api/initiatives/lifecycle-transition-proposals?status=all');
    expect(res.status).toBe(200);
    expect(res.body.proposals.map((p: any) => p.proposalVersionId)).not.toContain('h1b_pv_other_org');
  });

  it('fail-closed: kto nie jest ani autorem, ani recenzentem, nie widzi nic', async () => {
    currentUser = { id: STRANGER, organizationId: ORG, role: 'admin' };
    const res = await request(app).get('/api/initiatives/lifecycle-transition-proposals?status=all');
    expect(res.status).toBe(200);
    expect(res.body.proposals).toEqual([]);
  });

  it('autor widzi własną propozycję, ale nie jako recenzent', async () => {
    currentUser = { id: PROPOSER, organizationId: ORG, role: 'user' };
    const res = await request(app).get('/api/initiatives/lifecycle-transition-proposals?status=pending');
    expect(res.status).toBe(200);
    expect(res.body.proposals.length).toBe(2);
    expect(res.body.proposals.every((p: any) => p.viewerIsReviewer === false)).toBe(true);
  });

  it('zatwierdzona propozycja wraca jako `executable` (gotowa do POST executions)', async () => {
    currentUser = { id: REVIEWER, organizationId: ORG, role: 'admin' };
    const res = await request(app).get('/api/initiatives/lifecycle-transition-proposals?status=approved');
    expect(res.status).toBe(200);
    expect(res.body.proposals).toHaveLength(1);
    expect(res.body.proposals[0].proposalVersionId).toBe('h1b_pv_approved');
    expect(res.body.proposals[0].executable).toBe(true);
    expect(res.body.proposals[0].reviewedByUserId).toBe(REVIEWER);
  });

  it('trasa per-inicjatywa zawęża do jednej inicjatywy i nie jest przechwytywana przez `/:id`', async () => {
    currentUser = { id: REVIEWER, organizationId: ORG, role: 'admin' };
    const res = await request(app).get(
      `/api/pmo/initiatives/${INITIATIVE_B}/lifecycle-transition-proposals`
    );
    expect(res.status).toBe(200);
    expect(res.body.proposals).toHaveLength(1);
    expect(res.body.proposals[0].initiativeId).toBe(INITIATIVE_B);
  });

  it('zły filtr statusu = 400, nie cicha pełna lista', async () => {
    currentUser = { id: REVIEWER, organizationId: ORG, role: 'admin' };
    const res = await request(app).get('/api/initiatives/lifecycle-transition-proposals?status=wszystko');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PROPOSAL_STATUS_FILTER');
  });
});
