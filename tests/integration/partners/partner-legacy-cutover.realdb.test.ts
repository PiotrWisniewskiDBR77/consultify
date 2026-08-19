/** PRT-MVP-LEGACY-CUTOVER-001 — real PostgreSQL cutover/rollback telemetry. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

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
import partnerReviewRoutes from '../../../server/src/routes/v8/admin/partner-review.routes.ts';
import legacyPartnerRoutes, {
  partnerConfigRouter,
} from '../../../server/src/routes/partners.routes.ts';

import {
  PARTNER_LEGACY_ROLLBACK_WRITERS_ENV,
  PARTNER_LEGACY_WRITER_ROLLBACK_ENV,
  PROTECTED_PARTNER_LEGACY_WRITERS,
  partnerLegacyCutoverGuard,
} from '../../../server/src/services/partnerLegacyCutover.ts';
import { PARTNERS_CUTOVER } from '../../../server/src/services/legacyCutover/registry.ts';

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
const operatorCertificationId = randomUUID();
const operatorApplicationId = `operator-application-${suffix}`;
const revokedOrgId = randomUUID();
const revokedUserId = randomUUID();
const revokedPartnerOrgId = randomUUID();
const revokedCertificationId = randomUUID();
const unboundOrgId = randomUUID();
const unboundUserId = randomUUID();
const unboundPartnerOrgId = randomUUID();
const jwtSecret = 'prt-cutover-realdb-secret-minimum-32-characters';
const configuredJwtSecret = process.env.JWT_SECRET || jwtSecret;
const receiptMigration = readFileSync(
  path.resolve('server/migrations/954_partner_certification_mutation_receipts.sql'),
  'utf8'
);
const connectionReceiptMigration = readFileSync(
  path.resolve('server/migrations/955_partner_connection_receipts.sql'),
  'utf8'
);
const operatorReviewMigration = readFileSync(
  path.resolve('server/migrations/956_partner_operator_review_receipts.sql'),
  'utf8'
);

function token(subject = userId, organizationId = orgId, role = 'ADMIN') {
  return jwt.sign(
    {
      id: subject,
      email: `${subject}@test.local`,
      role,
      organizationId,
      ...(role === 'SUPERADMIN' ? { isSuperAdmin: true } : {}),
    },
    configuredJwtSecret,
    { expiresIn: '5m' }
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/v8/partner', verifyToken, requireV8OrgContext, attachV8Context, partnerRoutes);
  instance.use(
    '/api/v8/admin/partners',
    verifyToken,
    requireV8OrgContext,
    partnerReviewRoutes
  );
  instance.use('/api/partners', legacyPartnerRoutes);
  instance.use('/api/superadmin/partner-config', partnerConfigRouter);
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
    user: { id: userId, organizationId: orgId },
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
    once() {
      return this;
    },
  } as any;
}

async function event(suffix: string) {
  const result = await sql.query(
    `SELECT method,route_path,access_kind,successor_path
     FROM legacy_cutover_usage_events WHERE domain='partners' AND request_id=$1`,
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
  await sql.query(receiptMigration);
  await sql.query(receiptMigration);
  await sql.query(connectionReceiptMigration);
  await sql.query(connectionReceiptMigration);
  await sql.query(operatorReviewMigration);
  await sql.query(operatorReviewMigration);
  await sql.query(`DELETE FROM legacy_cutover_usage_events WHERE domain='partners' AND request_id LIKE $1`, [
    `${REQUEST_PREFIX}%`,
  ]);
  await sql.query(`DELETE FROM legacy_cutover_signal_intents WHERE domain='partners' AND request_id LIKE $1`, [
    `${REQUEST_PREFIX}%`,
  ]);
  await sql.query(`INSERT INTO organizations(id,name) VALUES($1,$2),($3,$4),($5,$6),($7,$8)`, [
    orgId,
    `PRT ${suffix}`,
    foreignOrgId,
    `Foreign ${suffix}`,
    revokedOrgId,
    `Revoked ${suffix}`,
    unboundOrgId,
    `Unbound ${suffix}`,
  ]);
  await sql.query(
    `INSERT INTO users(id,organization_id,email,first_name,last_name,role)
     VALUES($1,$2,$3,'Partner','Owner','SUPERADMIN'),($4,$5,$6,'Foreign','User','ADMIN'),
           ($7,$8,$9,'Revoked','User','ADMIN'),($10,$11,$12,'Unbound','User','ADMIN')`,
    [
      userId,
      orgId,
      `${userId}@test.local`,
      foreignUserId,
      foreignOrgId,
      `${foreignUserId}@test.local`,
      revokedUserId,
      revokedOrgId,
      `${revokedUserId}@test.local`,
      unboundUserId,
      unboundOrgId,
      `${unboundUserId}@test.local`,
    ]
  );
  await sql.query(
    `INSERT INTO organization_members(id,organization_id,user_id,role,status)
     VALUES($1,$2,$3,'ADMIN','ACTIVE'),($4,$5,$6,'ADMIN','ACTIVE'),
           ($7,$8,$9,'ADMIN','REVOKED'),($10,$11,$12,'ADMIN','ACTIVE'),
           ($13,$14,$15,'ADMIN','ACTIVE')`,
    [
      randomUUID(),
      orgId,
      userId,
      randomUUID(),
      foreignOrgId,
      foreignUserId,
      randomUUID(),
      revokedOrgId,
      revokedUserId,
      randomUUID(),
      foreignOrgId,
      userId,
      randomUUID(),
      unboundOrgId,
      unboundUserId,
    ]
  );
  await sql.query(
    `INSERT INTO partner_organizations
      (id,name,contact_email,status,referral_code,referral_link_slug,owner_organization_id)
     VALUES($1,$2,$3,'active',$4,$5,$6)`,
    [
      partnerOrgId,
      `PRT partner ${suffix}`,
      `partner-${suffix}@test.local`,
      `PRT-${suffix}`,
      `prt-${suffix}`,
      orgId,
    ]
  );
  await sql.query(
    `INSERT INTO partner_organizations(id,name,contact_email,status,referral_code,referral_link_slug)
     VALUES($1,$2,$3,'active',$4,$5)`,
    [
      revokedPartnerOrgId,
      `Revoked partner ${suffix}`,
      `revoked-${suffix}@test.local`,
      `REVOKED-${suffix}`,
      `revoked-${suffix}`,
    ]
  );
  await sql.query(
    `INSERT INTO partner_users(id,partner_org_id,user_id,role,status) VALUES($1,$2,$3,'owner','active')`,
    [randomUUID(), revokedPartnerOrgId, revokedUserId]
  );
  await sql.query(
    `INSERT INTO partner_certifications
      (id,partner_org_id,user_id,certification_name,certification_type,status,progress_percent,exam_mode)
     VALUES($1,$2,$3,'Revoked proof','sales_foundation','in_progress',100,'exam')`,
    [revokedCertificationId, revokedPartnerOrgId, revokedUserId]
  );
  await sql.query(
    `INSERT INTO partner_users(id,partner_org_id,user_id,role,status) VALUES($1,$2,$3,'owner','active')`,
    [randomUUID(), partnerOrgId, userId]
  );
  await sql.query(
    `INSERT INTO partner_organizations(id,name,contact_email,status,referral_code,referral_link_slug)
     VALUES($1,$2,$3,'active',$4,$5)`,
    [
      unboundPartnerOrgId,
      `Unbound partner ${suffix}`,
      `unbound-${suffix}@test.local`,
      `UNBOUND-${suffix}`,
      `unbound-${suffix}`,
    ]
  );
  await sql.query(
    `INSERT INTO partner_users(id,partner_org_id,user_id,role,status) VALUES($1,$2,$3,'owner','active')`,
    [randomUUID(), unboundPartnerOrgId, unboundUserId]
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
  await sql.query(
    `INSERT INTO partner_certifications
      (id,partner_org_id,user_id,certification_name,certification_type,certification_track,
       certification_level,status,progress_percent,exam_mode,review_state,recertification_policy)
     VALUES($1,$2,$3,'Operator review proof','delivery_advanced','delivery','advanced',
            'in_progress',100,'review','pending','annual_refresh')`,
    [operatorCertificationId, partnerOrgId, userId]
  );
  await sql.query(
    `INSERT INTO public_partner_applications
      (id,full_name,email,company,status,created_at)
     VALUES($1,'Operator Applicant',$2,'Operator Company','pending',NOW())`,
    [operatorApplicationId, `operator-${suffix}@test.local`]
  );
});

afterAll(async () => {
  vi.unstubAllEnvs();
  delete process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV];
  delete process.env[PARTNER_LEGACY_ROLLBACK_WRITERS_ENV];
  if (sql) {
    await sql.query(`DELETE FROM legacy_cutover_usage_events WHERE domain='partners' AND request_id LIKE $1`, [
      `${REQUEST_PREFIX}%`,
    ]);
    await sql.query(`DELETE FROM legacy_cutover_signal_intents WHERE domain='partners' AND request_id LIKE $1`, [
      `${REQUEST_PREFIX}%`,
    ]);
    if (
      (
        await sql.query(
          `SELECT to_regclass('public.partner_certification_mutation_receipts') table_name`
        )
      ).rows[0].table_name
    ) {
      await sql.query(
        `DELETE FROM partner_certification_mutation_receipts WHERE partner_org_id IN ($1,$2)`,
        [partnerOrgId, revokedPartnerOrgId]
      );
    }
    await sql.query(
      `DELETE FROM partner_operator_review_receipts WHERE actor_user_id IN ($1,$2,$3,$4)`,
      [userId, foreignUserId, revokedUserId, unboundUserId]
    );
    await sql.query(`DELETE FROM public_partner_applications WHERE id=$1`, [operatorApplicationId]);
    await sql.query(`DELETE FROM partner_organizations WHERE id IN ($1,$2,$3)`, [
      partnerOrgId,
      revokedPartnerOrgId,
      unboundPartnerOrgId,
    ]);
    await sql.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2,$3,$4)`, [
      orgId,
      foreignOrgId,
      revokedOrgId,
      unboundOrgId,
    ]);
    await sql.query(`DELETE FROM users WHERE id IN ($1,$2,$3,$4)`, [
      userId,
      foreignUserId,
      revokedUserId,
      unboundUserId,
    ]);
    await sql.query(`DELETE FROM organizations WHERE id IN ($1,$2,$3,$4)`, [
      orgId,
      foreignOrgId,
      revokedOrgId,
      unboundOrgId,
    ]);
    await sql.end();
  }
});

describe.sequential('Partner legacy cutover guard (real PG)', () => {
  it('declares every V8-owned legacy writer in the zero-writer guard', () => {
    expect(PROTECTED_PARTNER_LEGACY_WRITERS).toHaveLength(16);
    expect(PROTECTED_PARTNER_LEGACY_WRITERS.map((entry) => entry.successor).sort()).toEqual(
      [
        '/api/v8/partner/campaign-links',
        '/api/v8/partner/campaign-links/:linkId',
        '/api/v8/partner/connect',
        '/api/v8/partner/clients',
        '/api/v8/partner/employees',
        '/api/v8/partner/access-links',
        '/api/v8/partner/licenses/order',
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
    expect(PARTNERS_CUTOVER.writers).toHaveLength(16);
    expect(PARTNERS_CUTOVER.writers.every((entry) => entry.state === 'disabled')).toBe(true);
    expect(PARTNERS_CUTOVER.writers.every((entry) => Boolean(entry.successor))).toBe(true);
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
    const replayResponse = response();
    await partnerLegacyCutoverGuard(
      request('PUT', '/organization/listing', 'blocked'),
      replayResponse,
      vi.fn()
    );
    expect(replayResponse.state.status).toBe(410);
    const durable = await sql.query(
      `SELECT
         (SELECT count(*)::int FROM legacy_cutover_usage_events
           WHERE domain='partners' AND request_id=$1) observations,
         (SELECT count(*)::int FROM legacy_cutover_signal_intents
           WHERE domain='partners' AND request_id=$1) intents,
         (SELECT status FROM legacy_cutover_signal_intents
           WHERE domain='partners' AND request_id=$1) status,
         (SELECT terminal_result FROM legacy_cutover_signal_intents
           WHERE domain='partners' AND request_id=$1) terminal_result`,
      [`${REQUEST_PREFIX}blocked`]
    );
    expect(durable.rows[0]).toEqual({
      observations: 1,
      intents: 1,
      status: 'COMPLETED',
      terminal_result: 'refused_gone',
    });
  });

  it('exercises the explicit rollback switch and records rollback usage', async () => {
    process.env[PARTNER_LEGACY_ROLLBACK_WRITERS_ENV] = 'PRT-W02';
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
    const sibling = response();
    await partnerLegacyCutoverGuard(
      request('PUT', '/organization/listing', 'selective-sibling'),
      sibling,
      vi.fn()
    );
    expect(sibling.state.status).toBe(410);
    delete process.env[PARTNER_LEGACY_ROLLBACK_WRITERS_ENV];

    process.env.VITE_PARTNER_LEGACY_ROLLBACK_ENABLED = 'true';
    const mismatch = response();
    await partnerLegacyCutoverGuard(
      request('POST', '/campaign-links', 'frontend-only-mismatch'),
      mismatch,
      vi.fn()
    );
    expect(mismatch.state.status).toBe(410);
    delete process.env.VITE_PARTNER_LEGACY_ROLLBACK_ENABLED;

    process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV] = 'true';
    const domainNext = vi.fn();
    await partnerLegacyCutoverGuard(
      request('PUT', '/organization/listing', 'domain-rollback'),
      response(),
      domainNext
    );
    expect(domainNext).toHaveBeenCalledOnce();
    delete process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV];
  });

  it('denies same-user foreign tenant and historical unbound Partner writers before writes', async () => {
    const snapshot = async () =>
      (
        await sql.query(
          `SELECT
             (SELECT row_to_json(x)::text FROM (
                SELECT id,name,contact_phone,website,public_listing_enabled,updated_at::text
                FROM partner_organizations WHERE id=$1
              ) x) partner,
             (SELECT count(*)::int FROM partner_campaign_links WHERE partner_org_id=$1) campaigns,
             (SELECT count(*)::int FROM partner_specializations WHERE partner_org_id=$1) specializations,
             (SELECT count(*)::int FROM partner_regions WHERE partner_org_id=$1) regions,
             (SELECT count(*)::int FROM partner_certification_mutation_receipts WHERE partner_org_id=$1) receipts,
             (SELECT count(*)::int FROM partner_certification_attempts WHERE partner_org_id=$1) attempts`,
          [partnerOrgId]
        )
      ).rows[0];
    const before = await snapshot();
    const foreignTenantToken = token(userId, foreignOrgId);
    const foreignCalls = [
      supertest(app())
        .post('/api/v8/partner/campaign-links')
        .set('Authorization', `Bearer ${foreignTenantToken}`)
        .send({ name: `forbidden-${suffix}` }),
      supertest(app())
        .put('/api/v8/partner/organization')
        .set('Authorization', `Bearer ${foreignTenantToken}`)
        .send({ website: 'https://forbidden.invalid' }),
      supertest(app())
        .post(`/api/v8/partner/certifications/${certificationId}/modules/foreign/progress`)
        .set('Authorization', `Bearer ${foreignTenantToken}`)
        .set('Idempotency-Key', `foreign-${suffix}`)
        .send({ progress: 100 }),
    ];
    for (const result of await Promise.all(foreignCalls)) {
      expect(result.status).toBe(403);
      expect(result.body.code).toBe('PARTNER_ORG_REQUIRED');
    }
    expect(await snapshot()).toEqual(before);

    const unbound = await supertest(app())
      .post('/api/v8/partner/campaign-links')
      .set('Authorization', `Bearer ${token(unboundUserId, unboundOrgId)}`)
      .send({ name: `unbound-${suffix}` });
    expect(unbound.status).toBe(403);
    expect(unbound.body.code).toBe('PARTNER_ORG_REQUIRED');
    expect(
      (
        await sql.query(
          `SELECT owner_organization_id,
                  (SELECT count(*)::int FROM partner_campaign_links WHERE partner_org_id=$1) campaigns
             FROM partner_organizations WHERE id=$1`,
          [unboundPartnerOrgId]
        )
      ).rows[0]
    ).toEqual({ owner_organization_id: null, campaigns: 0 });
  });

  it('fails closed on a hostile pre-existing operator review receipt shape', async () => {
    await sql.query(
      `ALTER TABLE partner_operator_review_receipts RENAME TO partner_operator_review_receipts_good`
    );
    try {
      await sql.query(`CREATE TABLE partner_operator_review_receipts(actor_user_id integer)`);
      await expect(sql.query(operatorReviewMigration)).rejects.toThrow(
        /partner_operator_review_receipts has incompatible columns/
      );
      await sql.query(`DROP TABLE partner_operator_review_receipts`);
    } finally {
      await sql.query(
        `ALTER TABLE partner_operator_review_receipts_good RENAME TO partner_operator_review_receipts`
      );
    }
  });

  it('fails closed without mutating a hostile pre-existing public application shape', async () => {
    await sql.query(`ALTER TABLE public_partner_applications RENAME TO public_partner_applications_good`);
    try {
      await sql.query(`CREATE TABLE public_partner_applications(id integer PRIMARY KEY, payload text)`);
      await sql.query(`INSERT INTO public_partner_applications(id,payload) VALUES(7,'hostile-shape-proof')`);
      const snapshot = async () =>
        (
          await sql.query(
            `SELECT
               (SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' ORDER BY ordinal_position)
                  FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='public_partner_applications') columns,
               (SELECT string_agg(row_to_json(x)::text, '|' ORDER BY id) FROM (
                  SELECT id,payload FROM public_partner_applications ORDER BY id
                ) x) data,
               (SELECT COALESCE(string_agg(filename || ':' || checksum, '|' ORDER BY filename), '')
                  FROM schema_migrations WHERE filename='956_partner_operator_review_receipts.sql') ledger`
          )
        ).rows[0];
      const before = await snapshot();
      await expect(sql.query(operatorReviewMigration)).rejects.toThrow(
        /public_partner_applications has incompatible columns/
      );
      expect(await snapshot()).toEqual(before);
    } finally {
      await sql.query(`DROP TABLE IF EXISTS public_partner_applications`);
      await sql.query(
        `ALTER TABLE public_partner_applications_good RENAME TO public_partner_applications`
      );
    }
  });

  it('mounts global-superadmin operator reviews with exact replay, collision and rollback', async () => {
    const superToken = token(userId, orgId, 'SUPERADMIN');
    const postCertification = (key: string, reviewState = 'approved') =>
      supertest(app())
        .post(`/api/v8/admin/partners/certifications/${operatorCertificationId}/review`)
        .set('Authorization', `Bearer ${superToken}`)
        .set('Idempotency-Key', key)
        .send({ reviewState, notes: 'operator proof' });
    const state = async (client: Client = sql) =>
      (
        await client.query(
          `SELECT
             (SELECT row_to_json(x)::text FROM (
                SELECT id,status,review_state,review_notes,certificate_id,certificate_url,
                       completed_at::text,valid_until::text,updated_at::text
                  FROM partner_certifications WHERE id=$1
              ) x) certification,
             (SELECT COALESCE(string_agg(row_to_json(x)::text,'|' ORDER BY id),'') FROM (
                SELECT id,partner_org_id,user_id,certification_id,certificate_type,share_token,
                       certification_track,certification_level,review_state,valid_until::text,
                       earned_at::text,created_at::text
                  FROM partner_certificates WHERE certification_id=$1 ORDER BY id
              ) x) certificates,
             (SELECT count(*)::int FROM partner_operator_review_receipts
               WHERE actor_user_id=$2) receipts`,
          [operatorCertificationId, userId]
        )
      ).rows[0];

    const before = await state();
    const ordinary = await supertest(app())
      .post(`/api/v8/admin/partners/certifications/${operatorCertificationId}/review`)
      .set('Authorization', `Bearer ${token(foreignUserId, foreignOrgId)}`)
      .set('Idempotency-Key', `ordinary-${suffix}`)
      .send({ reviewState: 'approved' });
    expect(ordinary.status).toBe(403);
    const revoked = await supertest(app())
      .post(`/api/v8/admin/partners/certifications/${operatorCertificationId}/review`)
      .set('Authorization', `Bearer ${token(revokedUserId, revokedOrgId, 'SUPERADMIN')}`)
      .set('Idempotency-Key', `revoked-${suffix}`)
      .send({ reviewState: 'approved' });
    expect(revoked.status).toBe(403);
    expect(await state()).toEqual(before);

    const missing = await supertest(app())
      .post(`/api/v8/admin/partners/certifications/${randomUUID()}/review`)
      .set('Authorization', `Bearer ${superToken}`)
      .set('Idempotency-Key', `missing-${suffix}`)
      .send({ reviewState: 'approved' });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('PARTNER_CERTIFICATION_NOT_FOUND');
    expect(await state()).toEqual(before);

    const key = `cert-review-${suffix}`;
    const concurrent = await Promise.all(Array.from({ length: 6 }, () => postCertification(key)));
    expect(concurrent.every((result) => result.status === 200)).toBe(true);
    for (const result of concurrent) expect(result.body).toEqual(concurrent[0].body);
    const approved = await state();
    expect(approved.receipts).toBe(1);
    expect(approved.certificates.split('|')).toHaveLength(1);
    const replay = await postCertification(key);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(concurrent[0].body);
    expect(await state()).toEqual(approved);
    const collision = await postCertification(key, 'changes_requested');
    expect(collision.status).toBe(409);
    expect(collision.body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    expect(await state()).toEqual(approved);

    const applicationKey = `application-review-${suffix}`;
    const applicationState = async () =>
      (
        await sql.query(
          `SELECT
             (SELECT row_to_json(x)::text FROM (
                SELECT id,status,review_note,reviewed_by,reviewed_at::text
                  FROM public_partner_applications WHERE id=$1
              ) x) application,
             (SELECT count(*)::int FROM partner_operator_review_receipts
               WHERE actor_user_id=$2) receipts`,
          [operatorApplicationId, userId]
        )
      ).rows[0];
    const applicationBeforeMissing = await applicationState();
    const missingApplication = await supertest(app())
      .post(`/api/v8/admin/partners/applications/missing-${suffix}/review`)
      .set('Authorization', `Bearer ${superToken}`)
      .set('Idempotency-Key', `missing-application-${suffix}`)
      .send({ status: 'approved', reviewNote: 'must not write' });
    expect(missingApplication.status).toBe(404);
    expect(missingApplication.body.code).toBe('PARTNER_APPLICATION_NOT_FOUND');
    expect(await applicationState()).toEqual(applicationBeforeMissing);

    const application = await supertest(app())
      .post(`/api/v8/admin/partners/applications/${operatorApplicationId}/review`)
      .set('Authorization', `Bearer ${superToken}`)
      .set('Idempotency-Key', applicationKey)
      .send({ status: 'approved', reviewNote: 'approved by proof' });
    expect(application.status).toBe(200);
    const applicationReplay = await supertest(app())
      .post(`/api/v8/admin/partners/applications/${operatorApplicationId}/review`)
      .set('Authorization', `Bearer ${superToken}`)
      .set('Idempotency-Key', applicationKey)
      .send({ status: 'approved', reviewNote: 'approved by proof' });
    expect(applicationReplay.body).toEqual(application.body);
    const applicationCollision = await supertest(app())
      .post(`/api/v8/admin/partners/applications/${operatorApplicationId}/review`)
      .set('Authorization', `Bearer ${superToken}`)
      .set('Idempotency-Key', applicationKey)
      .send({ status: 'rejected', reviewNote: 'changed' });
    expect(applicationCollision.status).toBe(409);

    const cold = new Client({ connectionString: DATABASE_URL });
    await cold.connect();
    try {
      expect(await state(cold)).toEqual({ ...approved, receipts: 2 });
      const applicationRow = (
        await cold.query(
          `SELECT status,review_note,reviewed_by FROM public_partner_applications WHERE id=$1`,
          [operatorApplicationId]
        )
      ).rows[0];
      expect(applicationRow).toEqual({
        status: 'approved',
        review_note: 'approved by proof',
        reviewed_by: userId,
      });
    } finally {
      await cold.end();
    }

    const legacyCert = await supertest(app())
      .post(`/api/superadmin/partner-config/review-queue/${operatorCertificationId}`)
      .set('Authorization', `Bearer ${superToken}`)
      .set('X-Request-Id', `${REQUEST_PREFIX}w28-default`)
      .send({ reviewState: 'pending' });
    expect(legacyCert.status).toBe(410);
    const legacyApplication = await supertest(app())
      .post(`/api/superadmin/partner-config/applications/${operatorApplicationId}/review`)
      .set('Authorization', `Bearer ${superToken}`)
      .set('X-Request-Id', `${REQUEST_PREFIX}w29-default`)
      .send({ status: 'pending' });
    expect(legacyApplication.status).toBe(410);

    process.env.PARTNER_LEGACY_ROLLBACK_WRITERS = 'PRT-W28';
    const selectiveCert = await supertest(app())
      .post(`/api/superadmin/partner-config/review-queue/${operatorCertificationId}`)
      .set('Authorization', `Bearer ${superToken}`)
      .set('X-Request-Id', `${REQUEST_PREFIX}w28-rollback`)
      .send({ reviewState: 'pending', notes: 'rollback path' });
    expect(selectiveCert.status).toBe(200);
    const selectiveApplication = await supertest(app())
      .post(`/api/superadmin/partner-config/applications/${operatorApplicationId}/review`)
      .set('Authorization', `Bearer ${superToken}`)
      .set('X-Request-Id', `${REQUEST_PREFIX}w29-still-blocked`)
      .send({ status: 'pending' });
    expect(selectiveApplication.status).toBe(410);
    delete process.env.PARTNER_LEGACY_ROLLBACK_WRITERS;
  });

  it('blocks legacy connect by default and permits only the explicit rollback path', async () => {
    delete process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV];
    const blocked = response();
    const blockedNext = vi.fn();
    await partnerLegacyCutoverGuard(
      request('POST', '/connect', 'connect-blocked'),
      blocked,
      blockedNext
    );
    expect(blocked.state.status).toBe(410);
    expect(blocked.state.body.successor).toBe('/api/v8/partner/connect');
    expect(blockedNext).not.toHaveBeenCalled();

    process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV] = 'true';
    const rollbackNext = vi.fn();
    await partnerLegacyCutoverGuard(
      request('POST', '/connect', 'connect-rollback'),
      response(),
      rollbackNext
    );
    expect(rollbackNext).toHaveBeenCalledOnce();
    expect((await event('connect-rollback')).access_kind).toBe('rollback_writer');
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

  it('mounts four authorized no-write successors and retires their legacy stubs', async () => {
    const writers = [
      { path: '/clients', capability: 'partner_client_creation' },
      { path: '/employees', capability: 'partner_employee_creation' },
      { path: '/access-links', capability: 'partner_access_link_creation' },
      { path: '/licenses/order', capability: 'partner_license_order' },
    ];
    const sensitiveSnapshot = async (client: Client = sql) =>
      (
        await client.query(
          `SELECT
            (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb)
               FROM partner_organizations x WHERE x.id IN ($1,$2)) partner_orgs,
            (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb)
               FROM partner_users x WHERE x.partner_org_id IN ($1,$2)) partner_users,
            (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb)
               FROM partner_client_organizations x WHERE x.partner_org_id IN ($1,$2)) clients,
            (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb)
               FROM partner_licenses x WHERE x.partner_org_id IN ($1,$2)) licenses,
            (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]'::jsonb)
               FROM partner_campaign_links x WHERE x.partner_org_id IN ($1,$2)) access_links,
            (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.idempotency_key),'[]'::jsonb)
               FROM partner_connection_receipts x WHERE x.organization_id IN ($3,$4)) receipts`,
          [partnerOrgId, revokedPartnerOrgId, orgId, revokedOrgId]
        )
      ).rows[0];
    const postV8 = (path: string, subject = userId, tenant = orgId, role = 'ADMIN') =>
      supertest(app())
        .post(`/api/v8/partner${path}`)
        .set('Authorization', `Bearer ${token(subject, tenant, role)}`)
        .send({ name: `ignored-${suffix}`, quantity: 7 });

    // Qualify the two existing reads first. They retain their historical demo
    // seeding behavior; the baseline below then isolates the four new writers
    // and proves those refusals themselves never invoke the seeder.
    expect(
      (
        await supertest(app())
          .get('/api/v8/partner/clients')
          .set('Authorization', `Bearer ${token()}`)
      ).status
    ).toBe(200);
    const employees = await supertest(app())
      .get('/api/v8/partner/employees')
      .set('Authorization', `Bearer ${token()}`);
    expect(employees.status).toBe(200);
    expect(employees.body.data.employees).toContainEqual(
      expect.objectContaining({
        id: userId,
        employeeName: 'Partner Owner',
        email: `${userId}@test.local`,
        accessType: 'Owner',
        permissionSet: 'Owner',
        status: 'ACTIVE',
      })
    );

    await sql.query(`ALTER TABLE user_sessions RENAME TO user_sessions_prt_w4_hidden`);
    try {
      const failedEmployees = await supertest(app())
        .get('/api/v8/partner/employees')
        .set('Authorization', `Bearer ${token()}`);
      expect(failedEmployees.status).toBe(500);
      expect(failedEmployees.body?.data?.employees).toBeUndefined();
    } finally {
      await sql.query(`ALTER TABLE user_sessions_prt_w4_hidden RENAME TO user_sessions`);
    }
    const recoveredEmployees = await supertest(app())
      .get('/api/v8/partner/employees')
      .set('Authorization', `Bearer ${token()}`);
    expect(recoveredEmployees.status).toBe(200);
    expect(recoveredEmployees.body.data.employees).toHaveLength(1);
    const baseline = await sensitiveSnapshot();
    for (const writer of writers) {
      const responses = await Promise.all(Array.from({ length: 4 }, () => postV8(writer.path)));
      for (const result of responses) {
        expect(result.status).toBe(503);
        expect(result.body).toEqual({
          success: false,
          code: 'FEATURE_NOT_AVAILABLE',
          capability: writer.capability,
          message: 'This Partner capability is not available yet.',
        });
      }
      expect(await sensitiveSnapshot()).toEqual(baseline);

      expect((await postV8(writer.path, userId, orgId, 'MEMBER')).status).toBe(403);
      expect((await postV8(writer.path, revokedUserId, revokedOrgId)).status).toBe(403);
      expect((await postV8(writer.path, foreignUserId, foreignOrgId)).status).toBe(403);
      expect(await sensitiveSnapshot()).toEqual(baseline);
    }

    for (const [index, writer] of writers.entries()) {
      const requestId = `${REQUEST_PREFIX}stub-${index}`;
      const blocked = await supertest(app())
        .post(`/api/partners${writer.path}`)
        .set('Authorization', `Bearer ${token()}`)
        .set('x-request-id', requestId)
        .send({ name: `ignored-${suffix}` });
      expect(blocked.status).toBe(410);
      expect(blocked.body.successor).toBe(`/api/v8/partner${writer.path}`);
      expect((await event(`stub-${index}`)).access_kind).toBe('legacy_writer_blocked');

      process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV] = 'true';
      const rollback = await supertest(app())
        .post(`/api/partners${writer.path}`)
        .set('Authorization', `Bearer ${token()}`)
        .set('x-request-id', `${REQUEST_PREFIX}stub-rollback-${index}`)
        .send({ name: `ignored-${suffix}` });
      delete process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV];
      expect(rollback.status).toBe(503);
      expect((await event(`stub-rollback-${index}`)).access_kind).toBe('rollback_writer');
      expect(await sensitiveSnapshot()).toEqual(baseline);
    }

    const cold = new Client({ connectionString: DATABASE_URL });
    await cold.connect();
    try {
      expect(await sensitiveSnapshot(cold)).toEqual(baseline);
    } finally {
      await cold.end();
    }
  });

  it('proves the identity backfill left no connected partner without a V8 referral identity', async () => {
    const missing = await sql.query(
      `SELECT count(*)::int AS count FROM partner_organizations
       WHERE referral_code IS NULL OR referral_link_slug IS NULL`
    );
    expect(missing.rows[0].count).toBe(0);
  });

  it('mounts signed V8 certification successors with tenant denial, replay and cold readback', async () => {
    const revokedBefore = await sql.query(
      `SELECT referral_code,referral_link_slug,
        (SELECT count(*)::int FROM partner_campaign_links WHERE partner_org_id=$1) campaigns,
        (SELECT count(*)::int FROM partner_referral_clicks WHERE partner_org_id=$1) clicks,
        (SELECT count(*)::int FROM partner_attributions WHERE partner_org_id=$1) attributions,
        (SELECT count(*)::int FROM partner_commission_transactions WHERE partner_org_id=$1) commissions,
        (SELECT count(*)::int FROM partner_payouts WHERE partner_org_id=$1) payouts
       FROM partner_organizations WHERE id=$1`,
      [revokedPartnerOrgId]
    );
    const freshRevoked = await supertest(app())
      .post(`/api/v8/partner/certifications/${revokedCertificationId}/exam/start`)
      .set('Authorization', `Bearer ${token(revokedUserId, revokedOrgId)}`)
      .set('Idempotency-Key', `revoked-fresh-${suffix}`)
      .send({ language: 'en' });
    expect(freshRevoked.status).toBe(403);
    const revokedAfter = await sql.query(
      `SELECT referral_code,referral_link_slug,
        (SELECT count(*)::int FROM partner_campaign_links WHERE partner_org_id=$1) campaigns,
        (SELECT count(*)::int FROM partner_referral_clicks WHERE partner_org_id=$1) clicks,
        (SELECT count(*)::int FROM partner_attributions WHERE partner_org_id=$1) attributions,
        (SELECT count(*)::int FROM partner_commission_transactions WHERE partner_org_id=$1) commissions,
        (SELECT count(*)::int FROM partner_payouts WHERE partner_org_id=$1) payouts
       FROM partner_organizations WHERE id=$1`,
      [revokedPartnerOrgId]
    );
    expect(revokedAfter.rows[0]).toEqual(revokedBefore.rows[0]);

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
    const progressReplay = await supertest(app())
      .post(
        `/api/v8/partner/certifications/${certificationId}/modules/${moduleRow.rows[0].id}/progress`
      )
      .set('Authorization', `Bearer ${token()}`)
      .set('Idempotency-Key', `progress-${suffix}`)
      .send({ status: 'completed', progress: 100 });
    expect(progressReplay.status).toBe(200);
    expect(progressReplay.body.data).toEqual(progress.body.data);
    const progressCollision = await supertest(app())
      .post(
        `/api/v8/partner/certifications/${certificationId}/modules/${moduleRow.rows[0].id}/progress`
      )
      .set('Authorization', `Bearer ${token()}`)
      .set('Idempotency-Key', `progress-${suffix}`)
      .send({ status: 'in_progress', progress: 50 });
    expect(progressCollision.status).toBe(409);

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
    const startCollision = await supertest(app())
      .post(`/api/v8/partner/certifications/${certificationId}/exam/start`)
      .set('Authorization', `Bearer ${token()}`)
      .set('Idempotency-Key', `start-${suffix}`)
      .send({ language: 'pl' });
    expect(startCollision.status).toBe(409);
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
    const submitState = () =>
      sql.query(
        `SELECT
          (SELECT row_to_json(a)::text FROM (
             SELECT submitted_at::text,answers_json::text,score_percent,passed
             FROM partner_certification_attempts WHERE id=$1
           ) a) attempt_snapshot,
          (SELECT row_to_json(c)::text FROM (
             SELECT certificate_id,certificate_url,passed_exam_at::text,completed_at::text,
                    status,review_state,valid_until::text
             FROM partner_certifications WHERE id=$2
          ) c) certification_snapshot,
          (SELECT count(*)::int FROM partner_certificates WHERE certification_id=$2) certificate_count,
          (SELECT string_agg(row_to_json(cert)::text,'|' ORDER BY id) FROM (
             SELECT id,partner_org_id,user_id,certification_id,certificate_type,
                    earned_at::text,expires_at::text,revoked_at::text,revoked_by,revoke_reason,
                    share_token,created_at::text,certification_track,certification_level,
                    review_state,valid_until::text
             FROM partner_certificates WHERE certification_id=$2 ORDER BY id
           ) cert) certificate_snapshot,
          (SELECT string_agg(row_to_json(r)::text,'|' ORDER BY operation,idempotency_key)
             FROM partner_certification_mutation_receipts r
            WHERE partner_org_id=$3 AND user_id=$4) receipt_snapshot,
          (SELECT count(*)::int FROM partner_certification_mutation_receipts
            WHERE partner_org_id=$3 AND user_id=$4) receipt_count`,
        [first.body.data.attemptId, certificationId, partnerOrgId, userId]
      );
    const beforeSubmitCollision = (await submitState()).rows[0];
    const changedAnswers = { ...answers };
    const changedQuestion = first.body.data.questions[0];
    changedAnswers[changedQuestion.id] = changedQuestion.options.find(
      (option: { id: string }) => option.id !== answers[changedQuestion.id]
    ).id;
    const submitCollision = await supertest(app())
      .post(`/api/v8/partner/certifications/${certificationId}/exam/submit`)
      .set('Authorization', `Bearer ${token()}`)
      .set('Idempotency-Key', `submit-${suffix}`)
      .send({ attemptId: first.body.data.attemptId, answers: changedAnswers });
    expect(submitCollision.status).toBe(409);
    expect(submitCollision.body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    expect((await submitState()).rows[0]).toEqual(beforeSubmitCollision);
    const cold = await sql.query(
      `SELECT a.submitted_at,a.passed,c.certificate_id FROM partner_certification_attempts a
       JOIN partner_certifications c ON c.id=a.certification_id WHERE a.id=$1`,
      [first.body.data.attemptId]
    );
    expect(cold.rows[0].submitted_at).toBeTruthy();
    expect(cold.rows[0].passed).toBe(true);
    expect(cold.rows[0].certificate_id).toBeTruthy();

    const beforeRevoked = await sql.query(
      `SELECT
        (SELECT count(*)::int FROM partner_client_organizations WHERE partner_org_id=$1) clients,
        (SELECT count(*)::int FROM partner_projects WHERE partner_org_id=$1) projects,
        (SELECT count(*)::int FROM partner_commissions WHERE partner_org_id=$1) commissions`,
      [partnerOrgId]
    );
    await sql.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );
    const revoked = await start();
    expect(revoked.status).toBe(403);
    const afterRevoked = await sql.query(
      `SELECT
        (SELECT count(*)::int FROM partner_client_organizations WHERE partner_org_id=$1) clients,
        (SELECT count(*)::int FROM partner_projects WHERE partner_org_id=$1) projects,
        (SELECT count(*)::int FROM partner_commissions WHERE partner_org_id=$1) commissions`,
      [partnerOrgId]
    );
    expect(afterRevoked.rows[0]).toEqual(beforeRevoked.rows[0]);
  });

  it('fails closed on a hostile pre-existing receipt shape', async () => {
    await sql.query('BEGIN');
    try {
      await sql.query(
        `ALTER TABLE partner_certification_mutation_receipts RENAME TO partner_cert_receipts_good`
      );
      await sql.query(`CREATE TABLE partner_certification_mutation_receipts(id text)`);
      await expect(sql.query(receiptMigration)).rejects.toThrow(/incompatible columns/);
    } finally {
      await sql.query('ROLLBACK');
    }
  });

  it('fails closed on a hostile pre-existing connection receipt shape', async () => {
    await sql.query('BEGIN');
    try {
      await sql.query(
        `ALTER TABLE partner_connection_receipts RENAME TO partner_connection_receipts_good`
      );
      await sql.query(`CREATE TABLE partner_connection_receipts(id text)`);
      await expect(sql.query(connectionReceiptMigration)).rejects.toThrow(/incompatible columns/);
    } finally {
      await sql.query('ROLLBACK');
    }
    await sql.query('BEGIN');
    try {
      await sql.query(
        `ALTER TABLE partner_organizations RENAME COLUMN owner_organization_id TO owner_organization_id_good`
      );
      await sql.query(`ALTER TABLE partner_organizations ADD COLUMN owner_organization_id integer`);
      await expect(sql.query(connectionReceiptMigration)).rejects.toThrow(/incompatible shape/);
    } finally {
      await sql.query('ROLLBACK');
    }
  });

  it('self-connects once with durable replay, collision, concurrency and zero-write denials', async () => {
    const connectOrgId = randomUUID();
    const connectUserId = randomUUID();
    const foreignPartnerForConnectId = randomUUID();
    const connectEmail = `connect-${suffix}@test.local`;
    const previousFlag = process.env.PARTNER_SELF_CONNECT_ENABLED;
    const postConnect = (key?: string, body: Record<string, unknown> = {}, role = 'ADMIN') => {
      const call = supertest(app())
        .post('/api/v8/partner/connect')
        .set('Authorization', `Bearer ${token(connectUserId, connectOrgId, role)}`);
      if (key) call.set('Idempotency-Key', key);
      return call.send(body);
    };
    const state = () =>
      sql.query(
        `SELECT
          (SELECT count(*)::int FROM partner_users WHERE user_id::text=$1) links,
          (SELECT count(*)::int FROM partner_connection_receipts WHERE organization_id=$2 AND user_id=$1) receipts`,
        [connectUserId, connectOrgId]
      );
    try {
      await sql.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
        connectOrgId,
        `Connect ${suffix}`,
      ]);
      await sql.query(
        `INSERT INTO users(id,organization_id,email,first_name,last_name,role)
         VALUES($1,$2,$3,'Connect','Owner','ADMIN')`,
        [connectUserId, connectOrgId, connectEmail]
      );
      await sql.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,'ADMIN','ACTIVE')`,
        [randomUUID(), connectOrgId, connectUserId]
      );
      await sql.query(
        `INSERT INTO partner_organizations
         (id,name,contact_email,status,referral_code,referral_link_slug,owner_organization_id)
         VALUES($1,$2,$3,'active',$4,$5,$6)`,
        [
          foreignPartnerForConnectId,
          `Foreign connect partner ${suffix}`,
          `foreign-connect-${suffix}@test.local`,
          `FOREIGN-${suffix}`,
          `foreign-${suffix}`,
          foreignOrgId,
        ]
      );
      await sql.query(
        `INSERT INTO partner_users(id,partner_org_id,user_id,role,status)
         VALUES($1,$2,$3,'owner','active')`,
        [randomUUID(), foreignPartnerForConnectId, connectUserId]
      );

      delete process.env.PARTNER_SELF_CONNECT_ENABLED;
      const beforeDisabled = (await state()).rows[0];
      const crossTenantSnapshot = async () =>
        (
          await sql.query(
            `SELECT
              (SELECT row_to_json(po)::text FROM (
                 SELECT id,owner_organization_id,name,contact_email,status,referral_code,referral_link_slug
                 FROM partner_organizations WHERE id=$1
               ) po) org_snapshot,
              (SELECT string_agg(row_to_json(pu)::text,'|' ORDER BY id) FROM (
                 SELECT id,partner_org_id,user_id,role,status FROM partner_users
                 WHERE partner_org_id=$1 ORDER BY id
               ) pu) link_snapshot,
              (SELECT count(*)::int FROM partner_connection_receipts WHERE organization_id=$2) receipts`,
            [foreignPartnerForConnectId, connectOrgId]
          )
        ).rows[0];
      const beforeCrossTenantDenied = await crossTenantSnapshot();
      const disabled = await postConnect(`disabled-${suffix}`, {
        name: `Connect Partner ${suffix}`,
        contactEmail: connectEmail,
      });
      expect(disabled.status).toBe(403);
      expect(disabled.body?.data?.organization).toBeUndefined();
      expect((await state()).rows[0]).toEqual(beforeDisabled);
      expect(await crossTenantSnapshot()).toEqual(beforeCrossTenantDenied);

      process.env.PARTNER_SELF_CONNECT_ENABLED = 'true';
      const missingKey = await postConnect(undefined, {
        name: `Connect Partner ${suffix}`,
        contactEmail: connectEmail,
      });
      expect(missingKey.status).toBe(400);
      expect((await state()).rows[0]).toEqual(beforeDisabled);

      const payload = { name: `Connect Partner ${suffix}`, contactEmail: connectEmail };
      await sql.query(
        `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
        [connectOrgId, connectUserId]
      );
      const freshRevoked = await postConnect(`fresh-revoked-${suffix}`, payload);
      expect(freshRevoked.status).toBe(403);
      expect((await state()).rows[0]).toEqual(beforeDisabled);
      await sql.query(
        `UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`,
        [connectOrgId, connectUserId]
      );

      await sql.query(
        `UPDATE organization_members SET role='MEMBER' WHERE organization_id=$1 AND user_id=$2`,
        [connectOrgId, connectUserId]
      );
      const memberDenied = await postConnect(`member-${suffix}`, payload, 'MEMBER');
      expect(memberDenied.status).toBe(403);
      expect((await state()).rows[0]).toEqual(beforeDisabled);
      await sql.query(
        `UPDATE organization_members SET role='ADMIN' WHERE organization_id=$1 AND user_id=$2`,
        [connectOrgId, connectUserId]
      );

      const concurrent = await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          postConnect(`concurrent-${suffix}-${index}`, payload)
        )
      );
      expect(concurrent.filter((item) => item.status === 201)).toHaveLength(1);
      expect(concurrent.filter((item) => item.status === 200)).toHaveLength(7);
      const partnerIds = new Set(concurrent.map((item) => item.body.data.organization.id));
      expect(partnerIds.size).toBe(1);
      expect([...partnerIds][0]).not.toBe(foreignPartnerForConnectId);
      expect((await state()).rows[0]).toEqual({ links: 2, receipts: 8 });

      const replay = await postConnect(`concurrent-${suffix}-0`, payload);
      expect(replay.status).toBe(concurrent[0].status);
      expect(replay.body.data).toEqual(concurrent[0].body.data);
      expect((await state()).rows[0]).toEqual({ links: 2, receipts: 8 });
      const collision = await postConnect(`concurrent-${suffix}-0`, {
        ...payload,
        name: `${payload.name} changed`,
      });
      expect(collision.status).toBe(409);
      expect(collision.body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
      expect((await state()).rows[0]).toEqual({ links: 2, receipts: 8 });

      const connectionSnapshot = () =>
        sql.query(
          `SELECT
            (SELECT row_to_json(po)::text FROM (
               SELECT id,name,contact_email,tier,status,partner_since::text,
                      public_listing_enabled,created_by,updated_by,referral_code,referral_link_slug
               FROM partner_organizations WHERE id=$1
             ) po) org_snapshot,
            (SELECT string_agg(row_to_json(pu)::text,'|' ORDER BY id) FROM (
               SELECT id,partner_org_id,user_id,role,status,joined_at::text,created_at::text,updated_at::text
               FROM partner_users WHERE partner_org_id=$1 ORDER BY id
             ) pu) link_snapshot,
            (SELECT string_agg(row_to_json(r)::text,'|' ORDER BY idempotency_key)
               FROM partner_connection_receipts r WHERE organization_id=$2 AND user_id=$3) receipt_snapshot`,
          [[...partnerIds][0], connectOrgId, connectUserId]
        );
      const beforeFlagOffRead = (await connectionSnapshot()).rows[0];
      delete process.env.PARTNER_SELF_CONNECT_ENABLED;
      const existingWithoutKey = await postConnect(undefined, payload);
      expect(existingWithoutKey.status).toBe(200);
      expect(existingWithoutKey.body.data.organization.id).toBe([...partnerIds][0]);
      expect((await connectionSnapshot()).rows[0]).toEqual(beforeFlagOffRead);
      process.env.PARTNER_SELF_CONNECT_ENABLED = 'true';

      process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV] = 'true';
      const legacyRollback = await supertest(app())
        .post('/api/partners/connect')
        .set('Authorization', `Bearer ${token(connectUserId, connectOrgId)}`)
        .send(payload);
      expect(legacyRollback.status).toBe(200);
      expect(legacyRollback.body.data.organization.id).toBe([...partnerIds][0]);
      expect((await state()).rows[0]).toEqual({ links: 2, receipts: 8 });
      delete process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV];

      const cold = new Client({ connectionString: DATABASE_URL });
      await cold.connect();
      try {
        const coldRows = await cold.query(
          `SELECT po.id,po.referral_code,po.referral_link_slug,
                  (SELECT count(*)::int FROM partner_connection_receipts
                    WHERE organization_id=$1 AND user_id=$2) receipts
           FROM partner_organizations po JOIN partner_users pu ON pu.partner_org_id=po.id
           WHERE pu.user_id::text=$2 AND po.owner_organization_id=$1`,
          [connectOrgId, connectUserId]
        );
        expect(coldRows.rows).toHaveLength(1);
        expect(coldRows.rows[0].receipts).toBe(8);
        expect(coldRows.rows[0].referral_code).toBeTruthy();
        expect(coldRows.rows[0].referral_link_slug).toBeTruthy();
      } finally {
        await cold.end();
      }

      await sql.query(
        `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
        [connectOrgId, connectUserId]
      );
      const beforeRevokedConnect = (await state()).rows[0];
      const revokedConnect = await postConnect(`revoked-connect-${suffix}`, payload);
      expect(revokedConnect.status).toBe(403);
      expect((await state()).rows[0]).toEqual(beforeRevokedConnect);
    } finally {
      if (previousFlag === undefined) delete process.env.PARTNER_SELF_CONNECT_ENABLED;
      else process.env.PARTNER_SELF_CONNECT_ENABLED = previousFlag;
      delete process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV];
      await sql.query(`DELETE FROM partner_connection_receipts WHERE organization_id=$1`, [
        connectOrgId,
      ]);
      const linked = await sql.query(
        `SELECT DISTINCT partner_org_id FROM partner_users WHERE user_id::text=$1`,
        [connectUserId]
      );
      for (const row of linked.rows) {
        await sql.query(`DELETE FROM partner_organizations WHERE id=$1`, [row.partner_org_id]);
      }
      await sql.query(`DELETE FROM partner_organizations WHERE id=$1`, [
        foreignPartnerForConnectId,
      ]);
      await sql.query(`DELETE FROM organization_members WHERE organization_id=$1`, [connectOrgId]);
      await sql.query(`DELETE FROM users WHERE id=$1`, [connectUserId]);
      await sql.query(`DELETE FROM organizations WHERE id=$1`, [connectOrgId]);
    }
  });
});
