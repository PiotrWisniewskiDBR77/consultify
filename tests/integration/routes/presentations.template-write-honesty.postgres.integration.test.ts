/** @vitest-environment node */

/**
 * M09-H02 — `presentation_templates` writes must never answer a false success.
 *
 * Before this packet, `POST /templates/plan` ran an unchecked `dbRun` and then:
 *
 *   const row = await getTemplateForOrgOrSystem(id, orgId);
 *   const normalized = row ? normalizeTemplatePayload(row) : { id, ...template };
 *   res.json({ success: true, data: { template: normalized, llmRefined } });
 *
 * `DbPromise.run` defaults to `fallback: true`, so a rejected INSERT RESOLVES
 * `{ success: false }` instead of throwing. The read-back existed but, when it
 * came back empty, the route rebuilt the envelope from the in-memory draft and
 * still answered `success: true`. `/templates/:id/clone` and `PUT /templates/:id`
 * had the same shape.
 *
 * Every assertion that matters is made against REAL Postgres state read back
 * through a separate `pg.Pool`, never against the HTTP status alone.
 *
 * Failures are forced with REAL Postgres triggers, not by stubbing the driver:
 *   - `RAISE EXCEPTION` in a BEFORE INSERT trigger  → genuine statement failure;
 *   - `RETURN NULL`     in a BEFORE INSERT trigger  → statement reports success
 *     while silently persisting nothing. That is the read-back failure case and
 *     it is exactly the shape that made the old code lie.
 *
 * REQUIRES `NODE_ENV=test RUN_DB_TESTS=1` with `DATABASE_URL` pointed at a real
 * Postgres carrying migrations 568 + 767. `NODE_ENV=test` WITHOUT
 * `RUN_DB_TESTS=1` silently swaps in a mock DB and this suite would pass
 * against nothing. Run:
 *
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:55609/consultinity_test \
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
 *   npx vitest run --retry=0 \
 *     tests/integration/routes/presentations.template-write-honesty.postgres.integration.test.ts
 *
 * `--retry=0` is deliberate (institutional memory: retries hide fixture races).
 */
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const SUFFIX = uuidv4().slice(0, 8);
const ORG_A = `org-m09h02-a-${SUFFIX}`;
const ORG_B = `org-m09h02-b-${SUFFIX}`;
const USER_A = `user-m09h02-a-${SUFFIX}`;
const USER_B = `user-m09h02-b-${SUFFIX}`;

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const orgId = req.headers['x-test-org-id'];
    const userId = req.headers['x-test-user-id'];
    if (!orgId || !userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.userId = userId;
    req.organizationId = orgId;
    req.userRole = 'OWNER';
    req.user = { id: userId, organizationId: orgId, role: 'OWNER' };
    next();
  },
}));

vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (req: any, _res: unknown, next: () => void) => {
    req.emitAuditEvent = async () => undefined;
    next();
  },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/services/notificationService.js', () => ({
  send: vi.fn().mockResolvedValue(null),
  default: { send: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../../server/src/services/OrgPoliciesService.js', () => ({
  requireNoLegalHold: vi.fn().mockResolvedValue(undefined),
  OrgPoliciesError: class OrgPoliciesError extends Error {},
}));

vi.mock('../../../server/src/services/presentationGeneratorService.js', () => ({
  generateDeck: vi.fn(),
  generateOutline: vi.fn(),
}));

function authHeaders(orgId: string, userId: string) {
  return { 'x-test-org-id': orgId, 'x-test-user-id': userId };
}

const PLAN_BODY = {
  useLlm: false,
  input: { purpose: 'M09-H02 durability probe — quarterly steering update' },
};

describe('M09-H02 — presentation_templates write honesty (real Postgres)', () => {
  let app: express.Express;
  let pool: Pool;

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_DB_TESTS !== '1') {
      throw new Error(
        'This suite requires NODE_ENV=test RUN_DB_TESTS=1 with DATABASE_URL pointed at a real Postgres.'
      );
    }
    const { default: presentationRoutes } = await import(
      '../../../server/src/routes/presentations.routes.js'
    );
    app = express();
    app.use(express.json());
    app.use('/api/presentations', presentationRoutes);

    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterEach(async () => {
    // Drop any failure trigger a test installed, so one test can never leak
    // its forced failure into the next.
    await pool.query('DROP TRIGGER IF EXISTS m09h02_fail ON presentation_templates');
    await pool.query('DROP FUNCTION IF EXISTS m09h02_raise()');
    await pool.query('DROP FUNCTION IF EXISTS m09h02_swallow()');
  });

  afterAll(async () => {
    await pool.query('DELETE FROM presentation_templates WHERE organization_id = ANY($1::text[])', [
      [ORG_A, ORG_B],
    ]);
    await pool.end();
  });

  async function countFor(orgId: string): Promise<number> {
    const r = await pool.query(
      'SELECT COUNT(*)::int AS n FROM presentation_templates WHERE organization_id = $1',
      [orgId]
    );
    return r.rows[0].n;
  }

  async function installRaisingTrigger() {
    await pool.query(`CREATE FUNCTION m09h02_raise() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'M09H02 forced insert failure'; END; $$ LANGUAGE plpgsql;`);
    await pool.query(`CREATE TRIGGER m09h02_fail BEFORE INSERT ON presentation_templates
      FOR EACH ROW EXECUTE FUNCTION m09h02_raise();`);
  }

  async function installSwallowingTrigger() {
    await pool.query(`CREATE FUNCTION m09h02_swallow() RETURNS trigger AS $$
      BEGIN RETURN NULL; END; $$ LANGUAGE plpgsql;`);
    await pool.query(`CREATE TRIGGER m09h02_fail BEFORE INSERT ON presentation_templates
      FOR EACH ROW EXECUTE FUNCTION m09h02_swallow();`);
  }

  // ---------------------------------------------------------------- SUCCESS

  it('SUCCESS — plan persists a durable, org-owned row and reports it', async () => {
    const before = await countFor(ORG_A);

    const res = await request(app)
      .post('/api/presentations/templates/plan')
      .set(authHeaders(ORG_A, USER_A))
      .send(PLAN_BODY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const id = res.body?.data?.template?.id;
    expect(typeof id).toBe('string');

    // The claim is settled against the DB, not against the response body.
    const row = await pool.query(
      'SELECT id, organization_id, name FROM presentation_templates WHERE id = $1',
      [id]
    );
    expect(row.rowCount).toBe(1);
    expect(row.rows[0].organization_id).toBe(ORG_A);
    expect(await countFor(ORG_A)).toBe(before + 1);
  });

  // -------------------------------------------------- FORCED INSERT FAILURE

  it('INSERT FAILURE — no success:true, no envelope rebuilt from memory, no row', async () => {
    const before = await countFor(ORG_A);
    await installRaisingTrigger();

    const res = await request(app)
      .post('/api/presentations/templates/plan')
      .set(authHeaders(ORG_A, USER_A))
      .send(PLAN_BODY);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('template_persist_failed');

    // The regression being locked down: the old code answered 200 with a
    // template envelope assembled from the in-memory draft.
    expect(res.body.data).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('outline');

    expect(await countFor(ORG_A)).toBe(before);
  });

  // ------------------------------------------------- FORCED READ-BACK MISS

  it('READ-BACK FAILURE — statement reports success but persists nothing → fail closed', async () => {
    const before = await countFor(ORG_A);
    await installSwallowingTrigger();

    const res = await request(app)
      .post('/api/presentations/templates/plan')
      .set(authHeaders(ORG_A, USER_A))
      .send(PLAN_BODY);

    // Driver acked the statement; only the read-back can catch this.
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('template_persist_failed');
    expect(res.body.data).toBeUndefined();

    expect(await countFor(ORG_A)).toBe(before);
  });

  it('CLONE — read-back miss fails closed instead of reporting a created id', async () => {
    // A real, durable source template owned by ORG_A.
    const created = await request(app)
      .post('/api/presentations/templates/plan')
      .set(authHeaders(ORG_A, USER_A))
      .send(PLAN_BODY);
    const sourceId = created.body.data.template.id;

    const before = await countFor(ORG_A);
    await installSwallowingTrigger();

    const res = await request(app)
      .post(`/api/presentations/templates/${sourceId}/clone`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ name: 'M09-H02 clone attempt' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('template_clone_failed');
    expect(res.body?.data?.id).toBeUndefined();

    expect(await countFor(ORG_A)).toBe(before);
  });

  // ------------------------------------------------------- TENANT / OWNER

  it('TENANT — a foreign org cannot edit and is never told the edit succeeded', async () => {
    const created = await request(app)
      .post('/api/presentations/templates/plan')
      .set(authHeaders(ORG_A, USER_A))
      .send(PLAN_BODY);
    const templateId = created.body.data.template.id;

    const nameBefore = (
      await pool.query('SELECT name FROM presentation_templates WHERE id = $1', [templateId])
    ).rows[0].name;

    const res = await request(app)
      .put(`/api/presentations/templates/${templateId}`)
      .set(authHeaders(ORG_B, USER_B))
      .send({ name: 'HIJACKED BY ORG_B' });

    // The write was already tenant-scoped; what was broken is that the route
    // reported `{ success: true }` for zero rows changed.
    expect(res.status).not.toBe(200);
    expect(res.body.success).not.toBe(true);
    expect(res.body.error).toBe('template_not_found_for_org');

    const nameAfter = (
      await pool.query('SELECT name FROM presentation_templates WHERE id = $1', [templateId])
    ).rows[0].name;
    expect(nameAfter).toBe(nameBefore);
    expect(nameAfter).not.toBe('HIJACKED BY ORG_B');
  });

  it('UPDATE — the owning org still gets a real success, settled against the DB', async () => {
    const created = await request(app)
      .post('/api/presentations/templates/plan')
      .set(authHeaders(ORG_A, USER_A))
      .send(PLAN_BODY);
    const templateId = created.body.data.template.id;

    const res = await request(app)
      .put(`/api/presentations/templates/${templateId}`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ name: 'M09-H02 renamed by owner' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const row = await pool.query('SELECT name FROM presentation_templates WHERE id = $1', [
      templateId,
    ]);
    expect(row.rows[0].name).toBe('M09-H02 renamed by owner');
  });

  // ------------------------------------------------ RETRY / IDEMPOTENCY

  it('IDEMPOTENCY — a failed ack over a row that DID commit resolves as success', async () => {
    // Scope-limited retry case: a statement can commit and still report a
    // failure (timeout fires after COMMIT). Failing closed there would orphan
    // a row that genuinely exists, so durable state must win over the ack.
    const created = await request(app)
      .post('/api/presentations/templates/plan')
      .set(authHeaders(ORG_A, USER_A))
      .send(PLAN_BODY);
    const templateId = created.body.data.template.id;

    const routesModule: any = await import('../../../server/src/routes/presentations.routes.js');
    const settle = routesModule.__testables?.settleTemplateWrite;
    expect(typeof settle).toBe('function');

    const settled = await settle('template plan', templateId, ORG_A, {
      success: false,
      error: 'timeout',
    });
    expect(settled.ok).toBe(true);
    expect(settled.row.id).toBe(templateId);

    // ...and the same failed ack over a row that does NOT exist still fails.
    const missing = await settle('template plan', `never-written-${SUFFIX}`, ORG_A, {
      success: false,
      error: 'timeout',
    });
    expect(missing.ok).toBe(false);
  });
});
