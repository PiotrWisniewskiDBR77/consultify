import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(process.env.DATABASE_URL || '');
let actor = { id: 'day15-admin-a', role: 'admin', organizationId: 'day15-org-a' };

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = actor;
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: () => void) =>
      roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Forbidden' }),
}));
vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
  validateParams: () => (_req: any, _res: any, next: () => void) => next(),
  validateQuery: () => (_req: any, _res: any, next: () => void) => next(),
}));

describe.skipIf(!enabled)('Day 15 Q.3 real PostgreSQL cross-tenant effects', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let securityApp: express.Express;
  let adminDataApp: express.Express;

  beforeAll(async () => {
    for (const [id, name] of [
      ['day15-org-a', 'Day15 Alpha'],
      ['day15-org-b', 'Day15 Beta'],
    ]) {
      await pool.query(
        'INSERT INTO organizations (id,name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING',
        [id, name]
      );
    }
    for (const [id, org] of [
      ['day15-admin-a', 'day15-org-a'],
      ['day15-user-b', 'day15-org-b'],
    ]) {
      await pool.query(
        'INSERT INTO users (id,organization_id) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING',
        [id, org]
      );
    }
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ('day15-member-a','day15-org-a','day15-admin-a','ADMIN','ACTIVE')
       ON CONFLICT (organization_id,user_id) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO user_sessions (id,user_id,organization_id)
       VALUES ('day15-session-b','day15-user-b','day15-org-b') ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO security_events (id,organization_id,event_type,resolved)
       VALUES ('day15-event-b','day15-org-b','LOGIN',0) ON CONFLICT (id) DO NOTHING`
    );

    const { default: security } = await import('../security.routes.js');
    securityApp = express();
    securityApp.use(express.json());
    securityApp.use('/api/security', security);
    const { default: adminData } = await import('../admin-data.routes.js');
    adminDataApp = express();
    adminDataApp.use(express.json());
    adminDataApp.use('/api/admin-data', adminData);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM security_events WHERE id='day15-event-b'");
    await pool.query("DELETE FROM user_sessions WHERE id='day15-session-b'");
    await pool.query("DELETE FROM organization_members WHERE id='day15-member-a'");
    await pool.query("DELETE FROM users WHERE id IN ('day15-admin-a','day15-user-b')");
    await pool.query("DELETE FROM organizations WHERE id IN ('day15-org-a','day15-org-b')");
    await pool.end();
  });

  it('returns 404 for a foreign security session and SELECT confirms preservation', async () => {
    const response = await request(securityApp).delete('/api/security/sessions/day15-session-b');
    expect(response.status).toBe(404);
    expect(
      (await pool.query("SELECT id FROM user_sessions WHERE id='day15-session-b'")).rowCount
    ).toBe(1);
  });

  it('returns 404 for a foreign admin-data session and SELECT confirms preservation', async () => {
    const response = await request(adminDataApp).delete('/api/admin-data/sessions/day15-session-b');
    expect(response.status).toBe(404);
    expect(
      (await pool.query("SELECT id FROM user_sessions WHERE id='day15-session-b'")).rowCount
    ).toBe(1);
  });

  it('returns 404 for a foreign security event and SELECT confirms it is unchanged', async () => {
    const response = await request(adminDataApp)
      .put('/api/admin-data/security-events/day15-event-b/resolve')
      .send({ resolved: true });
    expect(response.status).toBe(404);
    expect(
      (await pool.query("SELECT resolved FROM security_events WHERE id='day15-event-b'")).rows[0]
        .resolved
    ).toBe(0);
  });
});
