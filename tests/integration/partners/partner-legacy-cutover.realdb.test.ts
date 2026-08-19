/** PRT-MVP-LEGACY-CUTOVER-001 — real PostgreSQL cutover/rollback telemetry. */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import verifyToken from '../../../server/src/middleware/auth.middleware.ts';
import {
  attachV8Context,
  requireV8OrgContext,
} from '../../../server/src/middleware/v8Auth.middleware.ts';
import partnerRoutes from '../../../server/src/routes/v8/partner.routes.ts';

import {
  PARTNER_LEGACY_WRITER_ROLLBACK_ENV,
  PROTECTED_PARTNER_LEGACY_WRITERS,
  partnerLegacyCutoverGuard,
} from '../../../server/src/services/partnerLegacyCutover.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const REQUEST_PREFIX = 'prt-cutover-proof-';
let sql: Client;
const suffix = randomUUID();
const orgId = randomUUID();
const foreignOrgId = randomUUID();
const userId = randomUUID();
const foreignUserId = randomUUID();
const partnerOrgId = randomUUID();
const certificationId = randomUUID();
const jwtSecret = 'prt-cutover-realdb-secret-minimum-32-characters';
const configuredJwtSecret = process.env.JWT_SECRET || jwtSecret;

function token(subject = userId, organizationId = orgId) {
  return jwt.sign(
    { id: subject, email: `${subject}@test.local`, role: 'ADMIN', organizationId },
    configuredJwtSecret,
    { expiresIn: '5m' }
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/v8/partner', verifyToken, requireV8OrgContext, attachV8Context, partnerRoutes);
  instance.use((error: Error, _req: any, res: any, _next: any) =>
    res.status(500).json({ error: error.message })
  );
  return instance;
}

function request(method: string, path: string, suffix: string): any {
  return {
    method,
    path,
    headers: { 'x-request-id': `${REQUEST_PREFIX}${suffix}` },
    user: { id: 'f1000000-0000-4000-8000-000000000099' },
  };
}

function response() {
  const state: { status?: number; body?: any } = {};
  return {
    state,
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: any) {
      state.body = body;
      return this;
    },
  } as any;
}

async function event(suffix: string) {
  const result = await sql.query(
    `SELECT method,route_path,access_kind,successor_path
     FROM partner_legacy_usage_events WHERE request_id=$1`,
    [`${REQUEST_PREFIX}${suffix}`]
  );
  return result.rows[0];
}

beforeAll(async () => {
  if (!DATABASE_URL) throw new Error('DATABASE_URL is required for Partner cutover realDB proof');
  sql = new Client({ connectionString: DATABASE_URL });
  await sql.connect();
  process.env.NODE_ENV = 'test';
  process.env.MOCK_DB = 'false';
  process.env.DB_TYPE = 'postgres';
  process.env.JWT_SECRET = configuredJwtSecret;
  expect((await sql.query(`SELECT version() AS version`)).rows[0].version).toMatch(/PostgreSQL/);
  await sql.query(`DELETE FROM partner_legacy_usage_events WHERE request_id LIKE $1`, [
    `${REQUEST_PREFIX}%`,
  ]);
  await sql.query(`INSERT INTO organizations(id,name) VALUES($1,$2),($3,$4)`, [
    orgId,
    `PRT ${suffix}`,
    foreignOrgId,
    `Foreign ${suffix}`,
  ]);
  await sql.query(
    `INSERT INTO users(id,organization_id,email,first_name,last_name,role)
     VALUES($1,$2,$3,'Partner','Owner','ADMIN'),($4,$5,$6,'Foreign','User','ADMIN')`,
    [
      userId,
      orgId,
      `${userId}@test.local`,
      foreignUserId,
      foreignOrgId,
      `${foreignUserId}@test.local`,
    ]
  );
  await sql.query(
    `INSERT INTO organization_members(id,organization_id,user_id,role,status)
     VALUES($1,$2,$3,'ADMIN','ACTIVE'),($4,$5,$6,'ADMIN','ACTIVE')`,
    [randomUUID(), orgId, userId, randomUUID(), foreignOrgId, foreignUserId]
  );
  await sql.query(
    `INSERT INTO partner_organizations(id,name,contact_email,status,referral_code,referral_link_slug)
     VALUES($1,$2,$3,'active',$4,$5)`,
    [
      partnerOrgId,
      `PRT partner ${suffix}`,
      `partner-${suffix}@test.local`,
      `PRT-${suffix}`,
      `prt-${suffix}`,
    ]
  );
  await sql.query(
    `INSERT INTO partner_users(id,partner_org_id,user_id,role,status) VALUES($1,$2,$3,'owner','active')`,
    [randomUUID(), partnerOrgId, userId]
  );
  await sql.query(
    `INSERT INTO partner_certifications
      (id,partner_org_id,user_id,certification_name,certification_type,certification_track,
       certification_level,status,progress_percent,exam_mode,review_state,recertification_policy,tier_target)
     VALUES($1,$2,$3,'Cutover proof','sales_foundation','sales','foundation','in_progress',100,'exam','ready','annual_refresh','BRONZE')`,
    [certificationId, partnerOrgId, userId]
  );
  await sql.query(
    `INSERT INTO partner_learning_progress(id,certification_id,module_id,status,progress_percent,started_at,completed_at)
     SELECT gen_random_uuid(),$1,id,'completed',100,NOW(),NOW()
     FROM partner_learning_modules WHERE certification_type='sales_foundation' AND COALESCE(language,'en')='en'`,
    [certificationId]
  );
});

afterAll(async () => {
  vi.unstubAllEnvs();
  delete process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV];
  if (sql) {
    await sql.query(`DELETE FROM partner_legacy_usage_events WHERE request_id LIKE $1`, [
      `${REQUEST_PREFIX}%`,
    ]);
    await sql.query(`DELETE FROM partner_organizations WHERE id=$1`, [partnerOrgId]);
    await sql.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [
      orgId,
      foreignOrgId,
    ]);
    await sql.query(`DELETE FROM users WHERE id IN ($1,$2)`, [userId, foreignUserId]);
    await sql.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgId, foreignOrgId]);
    await sql.end();
  }
});

describe.sequential('Partner legacy cutover guard (real PG)', () => {
  it('declares every V8-owned legacy writer in the zero-writer guard', () => {
    expect(PROTECTED_PARTNER_LEGACY_WRITERS).toHaveLength(11);
    expect(PROTECTED_PARTNER_LEGACY_WRITERS.map((entry) => entry.successor).sort()).toEqual(
      [
        '/api/v8/partner/campaign-links',
        '/api/v8/partner/campaign-links/:linkId',
        '/api/v8/partner/certifications/:certId/exam/start',
        '/api/v8/partner/certifications/:certId/exam/submit',
        '/api/v8/partner/certifications/:certId/modules/:moduleId/progress',
        '/api/v8/partner/organization',
        '/api/v8/partner/organization/listing',
        '/api/v8/partner/organization/regions',
        '/api/v8/partner/organization/specializations',
        '/api/v8/partner/payout-settings',
        '/api/v8/partner/payouts/request',
      ].sort()
    );
  });

  it('blocks a V8-owned legacy writer by default and persists telemetry', async () => {
    delete process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV];
    const res = response();
    const next = vi.fn();
    await partnerLegacyCutoverGuard(request('PUT', '/organization/listing', 'blocked'), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.state.status).toBe(410);
    expect(res.state.body).toEqual(
      expect.objectContaining({
        code: 'PARTNER_LEGACY_WRITER_DISABLED',
        successor: '/api/v8/partner/organization/listing',
      })
    );
    expect(await event('blocked')).toEqual({
      method: 'PUT',
      route_path: '/organization/listing',
      access_kind: 'legacy_writer_blocked',
      successor_path: '/api/v8/partner/organization/listing',
    });
  });

  it('exercises the explicit rollback switch and records rollback usage', async () => {
    process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV] = 'true';
    const res = response();
    const next = vi.fn();
    await partnerLegacyCutoverGuard(request('POST', '/campaign-links', 'rollback'), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.state.status).toBeUndefined();
    expect(await event('rollback')).toEqual({
      method: 'POST',
      route_path: '/campaign-links',
      access_kind: 'rollback_writer',
      successor_path: '/api/v8/partner/campaign-links',
    });
    delete process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV];
  });

  it('keeps reads visible and blocks the newly cut-over certification writer', async () => {
    const readNext = vi.fn();
    await partnerLegacyCutoverGuard(
      request('GET', '/certifications', 'read'),
      response(),
      readNext
    );
    expect(readNext).toHaveBeenCalledOnce();
    expect((await event('read')).access_kind).toBe('legacy_read');

    const writeNext = vi.fn();
    const writeResponse = response();
    await partnerLegacyCutoverGuard(
      request('POST', '/certifications/cert/modules/module/progress', 'uncovered'),
      writeResponse,
      writeNext
    );
    expect(writeNext).not.toHaveBeenCalled();
    expect(writeResponse.state.status).toBe(410);
    expect((await event('uncovered')).access_kind).toBe('legacy_writer_blocked');
  });

  it('proves the identity backfill left no connected partner without a V8 referral identity', async () => {
    const missing = await sql.query(
      `SELECT count(*)::int AS count FROM partner_organizations
       WHERE referral_code IS NULL OR referral_link_slug IS NULL`
    );
    expect(missing.rows[0].count).toBe(0);
  });

  it('mounts signed V8 certification successors with tenant denial, replay and cold readback', async () => {
    const foreign = await supertest(app())
      .post(`/api/v8/partner/certifications/${certificationId}/exam/start`)
      .set('Authorization', `Bearer ${token(foreignUserId, foreignOrgId)}`)
      .set('Idempotency-Key', `foreign-${suffix}`)
      .send({ language: 'en' });
    expect(foreign.status).toBe(403);

    const moduleRow = await sql.query(
      `SELECT id FROM partner_learning_modules WHERE certification_type='sales_foundation' AND COALESCE(language,'en')='en' ORDER BY module_order LIMIT 1`
    );
    const progress = await supertest(app())
      .post(
        `/api/v8/partner/certifications/${certificationId}/modules/${moduleRow.rows[0].id}/progress`
      )
      .set('Authorization', `Bearer ${token()}`)
      .set('Idempotency-Key', `progress-${suffix}`)
      .send({ status: 'completed', progress: 100 });
    expect(progress.status, JSON.stringify(progress.body)).toBe(200);

    const start = () =>
      supertest(app())
        .post(`/api/v8/partner/certifications/${certificationId}/exam/start`)
        .set('Authorization', `Bearer ${token()}`)
        .set('Idempotency-Key', `start-${suffix}`)
        .send({ language: 'en' });
    const first = await start();
    const replay = await start();
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.body.data.attemptId).toBe(first.body.data.attemptId);
    expect(
      (
        await sql.query(
          `SELECT count(*)::int n FROM partner_certification_attempts WHERE certification_id=$1`,
          [certificationId]
        )
      ).rows[0].n
    ).toBe(1);

    const questionIds = first.body.data.questions.map((question: any) => question.id);
    const correct = await sql.query(
      `SELECT id,correct_option_id FROM partner_exam_questions WHERE id=ANY($1::text[])`,
      [questionIds]
    );
    const answers = Object.fromEntries(correct.rows.map((row) => [row.id, row.correct_option_id]));
    const submit = () =>
      supertest(app())
        .post(`/api/v8/partner/certifications/${certificationId}/exam/submit`)
        .set('Authorization', `Bearer ${token()}`)
        .set('Idempotency-Key', `submit-${suffix}`)
        .send({ attemptId: first.body.data.attemptId, answers });
    const submitted = await submit();
    const submittedReplay = await submit();
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(200);
    expect(submitted.body.data.passed).toBe(true);
    expect(submittedReplay.status, JSON.stringify(submittedReplay.body)).toBe(200);
    expect(submittedReplay.body.data).toEqual(submitted.body.data);
    const cold = await sql.query(
      `SELECT a.submitted_at,a.passed,c.certificate_id FROM partner_certification_attempts a
       JOIN partner_certifications c ON c.id=a.certification_id WHERE a.id=$1`,
      [first.body.data.attemptId]
    );
    expect(cold.rows[0].submitted_at).toBeTruthy();
    expect(cold.rows[0].passed).toBe(true);
    expect(cold.rows[0].certificate_id).toBeTruthy();

    await sql.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );
    const revoked = await start();
    expect(revoked.status).toBe(403);
  });
});
