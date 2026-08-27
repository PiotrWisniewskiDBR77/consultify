/** @vitest-environment node */
/**
 * Day 44 security proof. Always run with --retry=0: a retry after a mutating
 * authorization failure can turn a real tenant leak into a false green 404.
 */
import { randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL || '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres(?:ql)?:/.test(databaseUrl);
const secret = 'day44-candidate-handoff-auth-chain-secret';
process.env.JWT_SECRET = secret;
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
process.env.MOCK_DB = 'false';
process.env.SKIP_STARTUP_VALIDATOR = 'true';
process.env.DISABLE_SCHEDULER = 'true';

describe.skipIf(!enabled)('Day 44 candidate handoff auth chain through real Gateway', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const organizationId = randomUUID();
  const userId = randomUUID();
  let app: any;
  let token: string;

  beforeAll(async () => {
    await pool.query('INSERT INTO organizations (id,name) VALUES ($1,$2)', [
      organizationId,
      'Day 44 auth chain',
    ]);
    await pool.query(
      `INSERT INTO users (id,organization_id,email,role,status)
       VALUES ($1,$2,$3,'OWNER','active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    token = jwt.sign({ id: userId, userId, organizationId, role: 'OWNER' }, secret, {
      algorithm: 'HS256',
      expiresIn: '10m',
    });
    app = (await import('../../index.js')).default;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM organization_members WHERE organization_id=$1', [organizationId]);
    await pool.query('DELETE FROM users WHERE id=$1', [userId]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
    await pool.end();
  });

  const paths = [
    '/api/interview/candidate-handoff/submission/missing/preview',
    '/api/interview/candidate-handoff/submission/missing/approve',
    '/api/interview/candidate-handoff/submission/missing',
    '/api/interview/candidate-handoff/insight-finding/missing/preview',
    '/api/interview/candidate-handoff/insight-finding/missing/approve',
    '/api/interview/candidate-handoff/insight-finding/missing',
  ];

  for (const path of paths) {
    it(`rejects an anonymous request before handler: ${path}`, async () => {
      const before = await pool.query(
        `SELECT count(*)::int AS count FROM initiative_candidates
         WHERE organization_id=$1`,
        [organizationId]
      );
      const response = path.endsWith('/approve')
        ? await request(app).post(path).send({ organizationId })
        : await request(app).get(path);
      expect(response.status).toBe(401);
      const after = await pool.query(
        `SELECT count(*)::int AS count FROM initiative_candidates
         WHERE organization_id=$1`,
        [organizationId]
      );
      expect(after.rows[0].count).toBe(before.rows[0].count);
    });
  }

  it('accepts real authentication and reaches the submission preview handler', async () => {
    const response = await request(app).get(paths[0]).set('Authorization', `Bearer ${token}`);
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });
});
