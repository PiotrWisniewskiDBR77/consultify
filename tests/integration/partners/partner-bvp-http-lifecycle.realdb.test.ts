/**
 * PRT-BVP-001 literal HTTP proof on real PostgreSQL.
 *
 * auth register -> partner connect -> certification -> referral code ->
 * referral-code customer registration -> policy-disabled economics read ->
 * separate-process HTTP cold reopen. Commercial attribution, payout and
 * accrual writes are intentionally disabled by the approved owner policy.
 */
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { type Express } from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import verifyToken from '../../../server/src/middleware/auth.middleware.js';
import { mutationAbortCanary } from '../../../server/src/middleware/mutationGuard.middleware.js';
import {
  attachV8Context,
  requireV8OrgContext,
} from '../../../server/src/middleware/v8Auth.middleware.js';
import { v8MetricsMiddleware } from '../../../server/src/middleware/v8Metrics.middleware.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLD_READER = path.join(HERE, 'partner-bvp-cold-http-reader.ts');

describe.skipIf(!REAL_PG)('PRT-BVP-001 literal HTTP lifecycle on real PostgreSQL', () => {
  const suffix = randomUUID().slice(0, 8);
  const partnerEmail = `prt-http-partner-${suffix}@example.test`;
  const customerEmail = `prt-http-customer-${suffix}@example.test`;
  const foreignEmail = `prt-http-foreign-${suffix}@example.test`;
  const password = `Prt-${suffix}!Pass9`;
  let app: Express;
  let pool: Pool;

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    process.env.PARTNER_SELF_CONNECT_ENABLED = 'true';
    pool = new Pool({ connectionString: DATABASE_URL });
    const [{ default: authRoutes }, { default: partnerRoutes }, { default: v8PartnerRoutes }] =
      await Promise.all([
        import('../../../server/src/routes/auth.routes.js'),
        import('../../../server/src/routes/partners.routes.js'),
        import('../../../server/src/routes/v8/partner.routes.js'),
      ]);
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/partners', partnerRoutes);
    app.use(
      '/api/v8/partner',
      verifyToken,
      requireV8OrgContext,
      attachV8Context,
      v8MetricsMiddleware,
      mutationAbortCanary,
      v8PartnerRoutes
    );
    app.use(
      (error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(500).json({ success: false, error: error.message });
      }
    );
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  const register = (email: string, companyName: string, partnerCode?: string) =>
    request(app)
      .post('/api/auth/register')
      .send({
        email,
        password,
        firstName: 'Partner',
        lastName: 'Proof',
        companyName,
        partner_code: partnerCode,
        acceptedLegalDocs: ['TOS', 'PRIVACY'],
      });

  it('crosses every boundary and cold-reopens the durable result over HTTP in a new process', async () => {
    const registration = await register(partnerEmail, `PRT HTTP Partner ${suffix}`);
    expect(registration.status).toBe(200);
    const token = String(registration.body.token || '');
    expect(token).toBeTruthy();

    const connected = await request(app)
      .post('/api/v8/partner/connect')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `prt-http-connect-${suffix}`)
      .send({ name: `PRT HTTP Partner ${suffix}`, contactEmail: partnerEmail });
    expect(connected.status).toBe(201);
    expect(connected.body.data.connected).toBe(true);
    const partnerOrgId = connected.body.data.organization.id;

    const tools = await request(app)
      .get('/api/partners/referral-tools')
      .set('Authorization', `Bearer ${token}`);
    expect(tools.status).toBe(200);
    const referralCode = String(tools.body.data.referralCode || '');
    expect(referralCode).toBeTruthy();

    const certifications = await request(app)
      .get('/api/partners/certifications')
      .set('Authorization', `Bearer ${token}`);
    expect(certifications.status).toBe(200);
    const foundation = certifications.body.data.find(
      (item: { type: string }) => item.type === 'sales_foundation'
    );
    expect(foundation).toBeTruthy();

    const modules = await request(app)
      .get(`/api/partners/certifications/${foundation.id}/modules`)
      .set('Authorization', `Bearer ${token}`);
    expect(modules.status).toBe(200);
    for (const module of modules.body.data) {
      const progress = await request(app)
        .post(`/api/v8/partner/certifications/${foundation.id}/modules/${module.id}/progress`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `prt-http-progress-${suffix}-${module.id}`)
        .send({ status: 'completed', progress: 100 });
      expect(progress.status).toBe(200);
    }

    const started = await request(app)
      .post(`/api/v8/partner/certifications/${foundation.id}/exam/start`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `prt-http-exam-start-${suffix}`)
      .send({ language: 'en' });
    expect(started.status).toBe(200);
    const questions = started.body.data.questions;
    const correct = await pool.query(
      `SELECT id, correct_option_id FROM partner_exam_questions WHERE id=ANY($1::text[])`,
      [questions.map((question: { id: string }) => question.id)]
    );
    const answers = Object.fromEntries(
      correct.rows.map((row) => [String(row.id), String(row.correct_option_id)])
    );
    const submitted = await request(app)
      .post(`/api/v8/partner/certifications/${foundation.id}/exam/submit`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `prt-http-exam-submit-${suffix}`)
      .send({ attemptId: started.body.data.attemptId, answers });
    expect(submitted.status).toBe(200);
    expect(submitted.body.data).toMatchObject({ passed: true, scorePercent: 100 });
    const certificateId = submitted.body.data.certificateId;

    const customer = await register(customerEmail, `PRT HTTP Customer ${suffix}`, referralCode);
    expect(customer.status).toBe(200);

    const attributionRead = await request(app)
      .get('/api/partners/attributions')
      .set('Authorization', `Bearer ${token}`);
    expect(attributionRead.status).toBe(200);
    const ownAttributions = attributionRead.body.data.items || attributionRead.body.data;
    expect(ownAttributions).toEqual([]);
    const economicsResidue = await pool.query(
      `SELECT count(*)::int AS count FROM partner_attributions WHERE partner_org_id=$1`,
      [partnerOrgId]
    );
    expect(economicsResidue.rows[0]?.count).toBe(0);

    const foreignRegistration = await register(foreignEmail, `PRT HTTP Foreign ${suffix}`);
    expect(foreignRegistration.status).toBe(200);
    const foreignToken = foreignRegistration.body.token;
    const foreignConnect = await request(app)
      .post('/api/v8/partner/connect')
      .set('Authorization', `Bearer ${foreignToken}`)
      .set('Idempotency-Key', `prt-http-foreign-connect-${suffix}`)
      .send({ name: `PRT HTTP Foreign ${suffix}`, contactEmail: foreignEmail });
    expect(foreignConnect.status).toBe(201);
    const foreignRead = await request(app)
      .get('/api/partners/attributions')
      .set('Authorization', `Bearer ${foreignToken}`);
    const foreignAttributions = foreignRead.body.data.items || foreignRead.body.data;
    expect(foreignAttributions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ referralCodeUsed: referralCode })])
    );

    const child = spawnSync('npx', ['tsx', COLD_READER], {
      cwd: path.resolve(HERE, '../../..'),
      env: { ...process.env, PRT_BVP_COLD_TOKEN: token },
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(child.status, child.stderr || child.stdout).toBe(0);
    const marker = child.stdout.split('\n').find((line) => line.startsWith('PRT_BVP_COLD_RESULT='));
    expect(marker, child.stdout).toBeTruthy();
    const cold = JSON.parse(marker!.slice('PRT_BVP_COLD_RESULT='.length));
    expect(cold.connection.data).toMatchObject({ connected: true });
    expect(cold.referralTools.data.referralCode).toBe(referralCode);
    expect(cold.certifications.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: foundation.id, certificateId, status: 'completed' }),
      ])
    );
    const coldAttributions = cold.attributions.data.items || cold.attributions.data;
    expect(coldAttributions).toEqual([]);
  }, 120_000);
});
