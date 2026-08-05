/**
 * M02-004 — reproduction harness for "Open full card" on a Decision.
 *
 * Mounts the REAL pmo/decisions router (the same module Gateway.ts mounts at
 * /api/decisions) against a REAL Postgres. Only auth/rbac/capability
 * middleware is stubbed — the DB, controller and service layers are the
 * production ones, so a green result here means the owner path genuinely
 * works, not that a mock agreed with itself.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const RUN_DB = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const itDB = RUN_DB ? it : it.skip;

let mockUser: { id: string; role: string; organizationId: string } | null = null;

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));

vi.mock('../../server/src/middleware/admin.middleware.js', () => ({
  verifyAdmin: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrgRole: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../server/src/middleware/effectiveCapability.middleware.js', () => ({
  requireDecisionCapability: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

describe('M02-004 — GET /api/decisions/:id/detail against real Postgres', () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const suffix = randomUUID();
  const orgId = `org-m02b-${suffix}`;
  const otherOrgId = `org-m02b-other-${suffix}`;
  const userId = `user-m02b-${suffix}`;
  const decisionId = `dec-m02b-${suffix}`;
  const foreignDecisionId = `dec-m02b-foreign-${suffix}`;
  let app: Express;

  beforeAll(async () => {
    if (!RUN_DB) return;
    await client.connect();

    for (const [id, name] of [
      [orgId, 'M02-B acceptance'],
      [otherOrgId, 'M02-B foreign tenant'],
    ]) {
      await client.query(
        `INSERT INTO organizations (id, name, plan, status) VALUES ($1, $2, 'enterprise', 'active')`,
        [id, name]
      );
    }
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES ($1, $2, $3, 'not-used', 'ADMIN', 'active', 'Maja', 'Testowa')`,
      [userId, orgId, `${userId}@local.test`]
    );
    await client.query(
      `INSERT INTO decisions (id, organization_id, title, status, priority, impact, created_by, decision_maker_id, description, type)
       VALUES ($1, $2, 'Uzyskanie niemieckich licencji', 'PENDING', 'HIGH', 'HIGH', $3, $3, 'Repro decision', 'APPROVAL')`,
      [decisionId, orgId, userId]
    );
    await client.query(
      `INSERT INTO decisions (id, organization_id, title, status, created_by, decision_maker_id, type)
       VALUES ($1, $2, 'Foreign tenant decision', 'PENDING', $3, $3, 'APPROVAL')`,
      [foreignDecisionId, otherOrgId, userId]
    );

    const mod = await import('../../server/src/routes/pmo/decisions.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/decisions', mod.default);
    const { errorHandler } = await import('../../server/src/middleware/errorHandler.js');
    app.use(errorHandler);

    mockUser = { id: userId, role: 'ADMIN', organizationId: orgId };
  });

  afterAll(async () => {
    if (!RUN_DB) return;
    // Probes clean up after themselves — demo data is the product's face.
    await client.query(`DELETE FROM decision_comments WHERE organization_id = $1`, [orgId]).catch(() => {});
    await client.query(`DELETE FROM decision_alternatives WHERE organization_id = $1`, [orgId]).catch(() => {});
    await client.query(`DELETE FROM decision_risks WHERE organization_id = $1`, [orgId]).catch(() => {});
    await client.query(`DELETE FROM decision_history WHERE decision_id IN ($1, $2)`, [decisionId, foreignDecisionId]).catch(() => {});
    await client.query(`DELETE FROM decisions WHERE organization_id IN ($1, $2)`, [orgId, otherOrgId]);
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await client.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgId, otherOrgId]);
    await client.end();
  });

  itDB('loads the decision the list linked to, with the SAME id', async () => {
    const res = await request(app).get(`/api/decisions/${decisionId}/detail`);
    // eslint-disable-next-line no-console
    console.log('[M02-004] status =', res.status, '\nbody =', JSON.stringify(res.body, null, 2).slice(0, 1500));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(decisionId);
    expect(res.body.title).toBe('Uzyskanie niemieckich licencji');
  });

  itDB('returns a string-valued error (never an object) for a missing decision', async () => {
    const res = await request(app).get(`/api/decisions/does-not-exist-${suffix}/detail`);
    // eslint-disable-next-line no-console
    console.log('[M02-004] 404 probe status =', res.status, 'body =', JSON.stringify(res.body));
    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe('string');
  });

  itDB('denies a foreign-tenant decision without leaking existence', async () => {
    const res = await request(app).get(`/api/decisions/${foreignDecisionId}/detail`);
    // eslint-disable-next-line no-console
    console.log('[M02-004] foreign tenant status =', res.status, 'body =', JSON.stringify(res.body));
    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe('string');
  });
});
