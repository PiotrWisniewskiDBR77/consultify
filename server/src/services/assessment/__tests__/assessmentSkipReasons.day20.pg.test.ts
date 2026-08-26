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

    const { default: config } = await import('../../../config/Config.js');
    const sign = (id: string, organizationId: string) =>
      jwt.sign({ id, organizationId, role: 'user' }, config.JWT_SECRET, {
        expiresIn: '15m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      });
    token = sign(owner, org);
    otherToken = sign(otherUser, otherOrg);

    const { default: routes } = await import('../../../routes/method-core.routes.js');
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
    const replay = await post(key, body);
    expect(replay.status).toBe(200);
    const count = await pool.query(
      `SELECT count(*)::int AS count FROM assessment_skip_reasons WHERE organization_id=$1 AND idempotency_key=$2`,
      [org, key]
    );
    expect(count.rows[0].count).toBe(1);
  });

  it('rejects an idempotency-key payload collision and writes no second row', async () => {
    const key = `collision-${suffix}`;
    const original = {
      unitId: '6A',
      questionId: '6A-2',
      level: 2,
      skipCode: 'poza_zakresem_zlecenia',
    };
    const first = await post(key, original);
    const collision = await post(key, { ...original, questionId: '6A-3' });
    expect(first.status).toBe(201);
    expect(collision.status).toBe(409);
    expect(collision.body.code).toBe('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH');
    const rows = await pool.query(
      `SELECT question_id FROM assessment_skip_reasons WHERE organization_id=$1 AND idempotency_key=$2`,
      [org, key]
    );
    expect(rows.rows).toEqual([{ question_id: '6A-2' }]);
  });

  it('derives the forward supersession link without updating the physical column', async () => {
    const first = await post(`chain-first-${suffix}`, {
      unitId: '7A',
      questionId: '7A-1',
      level: 1,
      skipCode: 'poza_modelem_operacyjnym',
    });
    const second = await post(`chain-second-${suffix}`, {
      unitId: '7A',
      questionId: '7A-1',
      level: 2,
      skipCode: 'odroczone_do_kolejnej_rewizji',
    });
    const history = await request(app)
      .get(`/api/method/sessions/${session}/assessment-skip-reasons?includeSuperseded=true`)
      .set('Authorization', `Bearer ${token}`);
    const firstRead = history.body.skipReasons.find(
      (reason: { id: string }) => reason.id === first.body.skipReason.id
    );
    const secondRead = history.body.skipReasons.find(
      (reason: { id: string }) => reason.id === second.body.skipReason.id
    );
    expect(firstRead.supersededBy).toBe(secondRead.id);
    expect(secondRead.supersededBy).toBeNull();
    expect(secondRead.supersedesId).toBe(firstRead.id);

    const physical = await pool.query(
      `SELECT id, supersedes_id, superseded_by FROM assessment_skip_reasons
       WHERE organization_id=$1 AND id = ANY($2::text[]) ORDER BY recorded_at, id`,
      [org, [firstRead.id, secondRead.id]]
    );
    expect(physical.rows).toEqual([
      { id: firstRead.id, supersedes_id: null, superseded_by: null },
      { id: secondRead.id, supersedes_id: firstRead.id, superseded_by: null },
    ]);
  });

  it('does not expose another tenant supersession history', async () => {
    const response = await request(app)
      .get(`/api/method/sessions/${session}/assessment-skip-reasons?includeSuperseded=true`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('SESSION_NOT_FOUND');
  });

  it('does not reveal another tenant session', async () => {
    const response = await request(app)
      .get(`/api/method/sessions/${session}/assessment-skip-reasons`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('SESSION_NOT_FOUND');
  });

  it('returns seven deterministic empty chapters in canonical axis order', async () => {
    const first = await request(app)
      .get(`/api/method/sessions/${session}/assessment-report-contract`)
      .set('Authorization', `Bearer ${token}`);
    const second = await request(app)
      .get(`/api/method/sessions/${session}/assessment-report-contract`)
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(
      first.body.reportContract.chapters.map((chapter: { axisId: number }) => chapter.axisId)
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(
      first.body.reportContract.chapters.every(
        (chapter: { introduction: { content: unknown } }) => chapter.introduction.content === null
      )
    ).toBe(true);
  });

  it('keeps every applicable area comment and reads skipCode from the Assessment table', async () => {
    const response = await request(app)
      .get(`/api/method/sessions/${session}/assessment-report-contract`)
      .set('Authorization', `Bearer ${token}`);
    const culture = response.body.reportContract.chapters.find(
      (chapter: { axisId: number }) => chapter.axisId === 5
    );
    expect(culture.areaComments).toHaveLength(5);
    // FIX-2 (P1-2): a single skipped question out of area 5A's six canonical
    // levels must NOT collapse the whole area to `skipped: true` — the area
    // stays partially assessed, and the per-question list carries the detail.
    expect(
      culture.areaComments.find((comment: { unitId: string }) => comment.unitId === '5A')
    ).toMatchObject({
      skipped: false,
      skipCode: 'poza_modelem_operacyjnym',
      skips: [{ questionId: '5A-1', skipCode: 'poza_modelem_operacyjnym' }],
    });
  });

  it('lists two differently-coded partial skips without collapsing the area (FIX-2)', async () => {
    await post(`partial-a-${suffix}`, {
      unitId: '7A',
      questionId: '7A-1',
      level: 1,
      skipCode: 'poza_modelem_operacyjnym',
    });
    await post(`partial-b-${suffix}`, {
      unitId: '7A',
      questionId: '7A-2',
      level: 2,
      skipCode: 'odroczone_do_kolejnej_rewizji',
    });

    const response = await request(app)
      .get(`/api/method/sessions/${session}/assessment-report-contract`)
      .set('Authorization', `Bearer ${token}`);
    const aiMaturity = response.body.reportContract.chapters.find(
      (chapter: { axisId: number }) => chapter.axisId === 7
    );
    const area = aiMaturity.areaComments.find(
      (comment: { unitId: string }) => comment.unitId === '7A'
    );
    expect(area.skipped).toBe(false);
    expect(area.skipCode).toBeNull();
    expect(area.skips).toEqual(
      expect.arrayContaining([
        { questionId: '7A-1', skipCode: 'poza_modelem_operacyjnym' },
        { questionId: '7A-2', skipCode: 'odroczone_do_kolejnej_rewizji' },
      ])
    );
    expect(area.skips).toHaveLength(2);

    const matrixArea = aiMaturity.matrix.areas.find(
      (entry: { unitId: string }) => entry.unitId === '7A'
    );
    expect(matrixArea.skipped).toBe(false);
    expect(matrixArea.skips).toHaveLength(2);
  });

  it('marks the area fully skipped only once every one of its five levels is skipped (FIX-2)', async () => {
    const codes = [
      'poza_modelem_operacyjnym',
      'poza_zakresem_zlecenia',
      'odroczone_do_kolejnej_rewizji',
      'zastapione_innym_rozwiazaniem',
      'poza_modelem_operacyjnym',
    ];
    for (let level = 1; level <= 5; level++) {
      const response = await post(`full-${level}-${suffix}`, {
        unitId: '7B',
        questionId: `7B-${level}`,
        level,
        skipCode: codes[level - 1],
      });
      expect(response.status).toBe(201);
    }

    const response = await request(app)
      .get(`/api/method/sessions/${session}/assessment-report-contract`)
      .set('Authorization', `Bearer ${token}`);
    const aiMaturity = response.body.reportContract.chapters.find(
      (chapter: { axisId: number }) => chapter.axisId === 7
    );
    const area = aiMaturity.areaComments.find(
      (comment: { unitId: string }) => comment.unitId === '7B'
    );
    expect(area.skipped).toBe(true);
    expect(area.skips).toHaveLength(5);
  });

  it('returns 404 for an unknown report session and across tenants', async () => {
    const unknown = await request(app)
      .get(`/api/method/sessions/missing-${suffix}/assessment-report-contract`)
      .set('Authorization', `Bearer ${token}`);
    const crossTenant = await request(app)
      .get(`/api/method/sessions/${session}/assessment-report-contract`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(unknown.status).toBe(404);
    expect(crossTenant.status).toBe(404);
  });
});
