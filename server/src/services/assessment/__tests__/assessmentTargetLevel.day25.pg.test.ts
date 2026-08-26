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

describe.skipIf(!REAL_DB)('Assessment day 25 — production TO-BE path', () => {
  let app: Express;
  let pool: import('pg').Pool;
  let token = '';
  const suffix = randomUUID().slice(0, 8);
  const org = `org-day25-target-${suffix}`;
  const otherOrg = `org-day25-target-other-${suffix}`;
  const user = `user-day25-target-${suffix}`;
  const otherUser = `user-day25-target-other-${suffix}`;

  async function seedSession(state: 'active' | 'in_review' = 'in_review', role = 'owner') {
    const id = `session-day25-target-${randomUUID()}`;
    await pool.query(
      `INSERT INTO method_sessions
       (id, organization_id, module, method_pack_id, method_pack_version, state, mode, owner_user_id)
       VALUES ($1,$2,'assessment','drd','v1',$3,'guided_manual',$4)`,
      [id, org, state, user]
    );
    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role)
       VALUES ($1,$2,$3,$4,$5)`,
      [randomUUID(), org, id, user, role]
    );
    return id;
  }

  const event = (sessionId: string, body: Record<string, unknown>, auth = token) =>
    request(app)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${auth}`)
      .set('Idempotency-Key', randomUUID())
      .send(body);

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1,$2),($3,$4)`, [
      org,
      'Day 25 target org',
      otherOrg,
      'Day 25 target other org',
    ]);
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role)
       VALUES ($1,$2,$3,'user'),($4,$5,$6,'user')`,
      [user, org, `${user}@example.test`, otherUser, otherOrg, `${otherUser}@example.test`]
    );
    const { default: config } = await import('../../../config/Config.js');
    token = jwt.sign({ id: user, organizationId: org, role: 'user' }, config.JWT_SECRET, {
      expiresIn: '15m',
      ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
      ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
    });
    const { default: routes } = await import('../../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', routes);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE id IN ($1,$2)`, [user, otherUser]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [org, otherOrg]);
    await pool.end();
  });

  it('persists target_level through events → freeze → HTTP output → independent readback', async () => {
    const sessionId = await seedSession();
    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role)
       VALUES ($1,$2,$3,$4,'approver')`,
      [randomUUID(), org, sessionId, user]
    );
    expect(
      (
        await event(sessionId, {
          type: 'ANSWER_CONFIRMED',
          unitId: '1A',
          level: 2,
          payload: { questionId: '1A-1', answerState: 'confirmed' },
        })
      ).status
    ).toBe(201);
    expect(
      (
        await event(sessionId, {
          type: 'EVIDENCE_ATTACHED',
          unitId: '1A',
          payload: { evidenceId: `evidence-${suffix}`, evidenceType: 'document', strength: 'E2' },
        })
      ).status
    ).toBe(201);
    expect(
      (
        await event(sessionId, {
          type: 'DECISION_APPROVED',
          unitId: '1A',
          level: 5,
          payload: { subject: 'target_level' },
        })
      ).status
    ).toBe(201);

    const frozen = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `freeze-${suffix}`)
      .send({});
    expect(frozen.status).toBe(200);
    const outputId = frozen.body.output.id as string;
    const read = await request(app)
      .get(`/api/method/outputs/${outputId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(200);
    const finding = read.body.output.findings[0] as Record<string, unknown>;
    expect(finding.unitId).toBe('1A');
    expect(Number(finding.currentLevel)).toBe(2);
    expect(Number(finding.targetLevel)).toBe(5);
    expect(Number(finding.gap)).toBe(3);

    const independent = new (await import('pg')).Pool({ connectionString: CONNECTION_STRING });
    const readback = await independent.query(
      `SELECT unit_id, current_level, target_level FROM method_findings
       WHERE output_id=$1 AND organization_id=$2 ORDER BY unit_id`,
      [outputId, org]
    );
    await independent.end();
    expect(
      readback.rows.map((row) => ({
        unit_id: row.unit_id,
        current_level: Number(row.current_level),
        target_level: Number(row.target_level),
      }))
    ).toEqual([{ unit_id: '1A', current_level: 2, target_level: 5 }]);
  });

  it('rejects actorKind system over the caller-authenticated route', async () => {
    const response = await event(await seedSession('active'), {
      type: 'DECISION_APPROVED',
      actorKind: 'system',
      unitId: '1A',
      level: 5,
      payload: { subject: 'target_level' },
    });
    expect(response.status).toBe(400);
  });

  it('rejects a role without write authority', async () => {
    const response = await event(await seedSession('active', 'viewer'), {
      type: 'DECISION_APPROVED',
      unitId: '1A',
      level: 5,
      payload: { subject: 'target_level' },
    });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('session_read_only');
  });

  it('characterises the open gap: the event route currently accepts an out-of-scale target', async () => {
    const response = await event(await seedSession('active'), {
      type: 'DECISION_APPROVED',
      unitId: '1A',
      level: 8,
      payload: { subject: 'target_level' },
    });
    expect(response.status).toBe(201);
  });

  it('does not reveal a session to another tenant', async () => {
    const { default: config } = await import('../../../config/Config.js');
    const otherToken = jwt.sign(
      { id: otherUser, organizationId: otherOrg, role: 'user' },
      config.JWT_SECRET,
      {
        expiresIn: '15m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      }
    );
    const response = await event(
      await seedSession('active'),
      { type: 'DECISION_APPROVED', unitId: '1A', level: 5, payload: { subject: 'target_level' } },
      otherToken
    );
    expect(response.status).toBe(403);
  });
});
