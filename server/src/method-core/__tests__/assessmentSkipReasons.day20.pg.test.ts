/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

describe.skipIf(!REAL_DB)('Assessment day 20 skip reasons — real router and PostgreSQL', () => {
  let app: Express;
  let pool: import('pg').Pool;
  const suffix = randomUUID().slice(0, 8);
  const org = `org-day20-skip-${suffix}`;
  const otherOrg = `org-day20-skip-other-${suffix}`;
  const owner = `user-day20-skip-${suffix}`;
  const otherUser = `user-day20-skip-other-${suffix}`;
  const session = `session-day20-skip-${suffix}`;
  let token = '';
  let otherToken = '';

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2), ($3, $4)`, [
      org,
      'Day 20 skip org',
      otherOrg,
      'Day 20 skip other org',
    ]);
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role) VALUES ($1,$2,$3,'user'),($4,$5,$6,'user')`,
      [owner, org, `${owner}@example.test`, otherUser, otherOrg, `${otherUser}@example.test`]
    );
    await pool.query(
      `INSERT INTO method_sessions
       (id, organization_id, module, method_pack_id, method_pack_version, state, mode, owner_user_id)
       VALUES ($1,$2,'assessment','drd','v1','active','guided_manual',$3)`,
      [session, org, owner]
    );
    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role)
       VALUES ($1,$2,$3,$4,'owner')`,
      [`role-${suffix}`, org, session, owner]
    );

    const { default: config } = await import('../../config/Config.js');
    const sign = (id: string, organizationId: string) =>
      jwt.sign({ id, organizationId, role: 'user' }, config.JWT_SECRET, {
        expiresIn: '15m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      });
    token = sign(owner, org);
    otherToken = sign(otherUser, otherOrg);

    const { default: routes } = await import('../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', routes);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM assessment_skip_reasons WHERE organization_id IN ($1,$2)`, [
      org,
      otherOrg,
    ]);
    await pool.query(`DELETE FROM users WHERE id IN ($1,$2)`, [owner, otherUser]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [org, otherOrg]);
    await pool.end();
  });

  const post = (idempotencyKey: string, body: Record<string, unknown>) =>
    request(app)
      .post(`/api/method/sessions/${session}/assessment-skip-reasons`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body);

  it('persists a canonical code and an independent connection reads it back', async () => {
    const response = await post(`happy-${suffix}`, {
      unitId: '5A',
      questionId: '5A-1',
      level: 2,
      skipCode: 'poza_modelem_operacyjnym',
    });
    expect(response.status).toBe(201);
    const readback = await pool.query(
      `SELECT skip_code FROM assessment_skip_reasons WHERE organization_id=$1 AND idempotency_key=$2`,
      [org, `happy-${suffix}`]
    );
    expect(readback.rows).toEqual([{ skip_code: 'poza_modelem_operacyjnym' }]);
  });

  it('rejects a code outside the dictionary and writes nothing', async () => {
    const response = await post(`bad-${suffix}`, {
      unitId: '5A',
      questionId: '5A-2',
      level: 2,
      skipCode: 'inne',
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('SKIP_CODE_NOT_IN_DICTIONARY');
    const count = await pool.query(
      `SELECT count(*)::int AS count FROM assessment_skip_reasons WHERE organization_id=$1 AND idempotency_key=$2`,
      [org, `bad-${suffix}`]
    );
    expect(count.rows[0].count).toBe(0);
  });

  it('returns an honest empty list for a unit with no skip decision', async () => {
    const response = await request(app)
      .get(`/api/method/sessions/${session}/assessment-skip-reasons?unitId=7E`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.skipReasons).toEqual([]);
  });

  it('rejects an unknown unit or a level above its canonical axis scale', async () => {
    const response = await post(`range-${suffix}`, {
      unitId: '5A',
      questionId: '5A-7',
      level: 7,
      skipCode: 'odroczone_do_kolejnej_rewizji',
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_UNIT_OR_LEVEL');
  });

  it('replays one idempotency key without creating a second row', async () => {
    const key = `replay-${suffix}`;
    const body = {
      unitId: '6A',
      questionId: '6A-1',
      level: 3,
      skipCode: 'poza_zakresem_zlecenia',
    };
    expect((await post(key, body)).status).toBe(201);
    expect((await post(key, body)).status).toBe(201);
    const count = await pool.query(
      `SELECT count(*)::int AS count FROM assessment_skip_reasons WHERE organization_id=$1 AND idempotency_key=$2`,
      [org, key]
    );
    expect(count.rows[0].count).toBe(1);
  });

  it('does not reveal another tenant session', async () => {
    const response = await request(app)
      .get(`/api/method/sessions/${session}/assessment-skip-reasons`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('SESSION_NOT_FOUND');
  });
});
