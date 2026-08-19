/** PRT-MVP-LEDGER-001 — non-economic participant/referral ledger on disposable PostgreSQL. */
import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import verifyToken from '../../../server/src/middleware/auth.middleware.js';
import { mutationAbortCanary } from '../../../server/src/middleware/mutationGuard.middleware.js';
import {
  attachV8Context,
  requireV8OrgContext,
} from '../../../server/src/middleware/v8Auth.middleware.js';
import { v8MetricsMiddleware } from '../../../server/src/middleware/v8Metrics.middleware.js';
import v8PartnerRoutes from '../../../server/src/routes/v8/partner.routes.js';
import { superAdminPartnerRouter } from '../../../server/src/routes/partners.routes.js';

const url = process.env.DATABASE_URL;
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && Boolean(url);
const describeReal = enabled ? describe : describe.skip;
const OWNER = 'a9100000-0000-4000-8000-000000000001';
const OTHER_OWNER = 'a9100000-0000-4000-8000-000000000002';
const PARTICIPANT = 'a9100000-0000-4000-8000-000000000003';
const PARTNER = 'a9200000-0000-4000-8000-000000000001';
const ACTOR = 'a9300000-0000-4000-8000-000000000001';
const FOREIGN_ACTOR = 'a9300000-0000-4000-8000-000000000002';
const ATTRIBUTION = 'a9400000-0000-4000-8000-000000000001';
let sql: Client;
let service: typeof import('../../../server/src/services/partnerParticipantLedgerService.ts');
const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret-key-min-32-chars-long-for-validation';

function token(organizationId = OWNER, userId = ACTOR) {
  return jwt.sign(
    { id: userId, email: `${userId}@example.test`, organizationId, role: 'SUPERADMIN' },
    jwtSecret,
    { expiresIn: '1h' }
  );
}

function apps() {
  const v8 = express();
  v8.use(express.json());
  v8.use(
    '/api/v8/partner',
    verifyToken,
    requireV8OrgContext,
    attachV8Context,
    v8MetricsMiddleware,
    mutationAbortCanary,
    v8PartnerRoutes
  );
  const operator = express();
  operator.use(express.json());
  operator.use('/api/superadmin/partner-settlements', superAdminPartnerRouter);
  return { v8, operator };
}

async function cleanup() {
  await sql.query('BEGIN');
  await sql.query(`SET LOCAL session_replication_role='replica'`);
  await sql.query(`DELETE FROM partner_participant_ledger WHERE partner_org_id=$1`, [PARTNER]);
  await sql.query(`DELETE FROM partner_attributions WHERE id=$1`, [ATTRIBUTION]);
  await sql.query(`DELETE FROM partner_users WHERE user_id=$1`, [ACTOR]);
  await sql.query(`DELETE FROM organization_members WHERE user_id IN ($1,$2)`, [
    ACTOR,
    FOREIGN_ACTOR,
  ]);
  await sql.query(`DELETE FROM partner_organizations WHERE id=$1`, [PARTNER]);
  await sql.query(`DELETE FROM users WHERE id IN ($1,$2)`, [ACTOR, FOREIGN_ACTOR]);
  await sql.query(`DELETE FROM organizations WHERE id IN ($1,$2,$3)`, [
    OWNER,
    OTHER_OWNER,
    PARTICIPANT,
  ]);
  await sql.query('COMMIT');
}

describeReal.sequential('PRT-MVP-LEDGER-001 participant/referral ledger', () => {
  beforeAll(async () => {
    sql = new Client({ connectionString: url });
    await sql.connect();
    const db = (await sql.query('SELECT current_database() AS name')).rows[0].name;
    if (!db.startsWith('consultify_partner_ledger_'))
      throw new Error(`Refusing non-disposable DB ${db}`);
    await cleanup();
    await sql.query(
      `INSERT INTO organizations(id,name) VALUES ($1,'Owner'),($2,'Other owner'),($3,'Participant')`,
      [OWNER, OTHER_OWNER, PARTICIPANT]
    );
    await sql.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role,status)
       VALUES ($1,$2,'partner-ledger-operator@example.test','Partner','Operator','SUPERADMIN','active')`,
      [ACTOR, OWNER]
    );
    await sql.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role,status)
       VALUES ($1,$2,'partner-ledger-foreign@example.test','Foreign','Actor','ADMIN','active')`,
      [FOREIGN_ACTOR, OTHER_OWNER]
    );
    await sql.query(
      `INSERT INTO partner_organizations
       (id,name,contact_email,tier,status,partner_since,public_listing_enabled,created_by,updated_by,owner_organization_id)
       VALUES ($1,'Ledger Partner','partner-ledger@example.test','registered','active',now(),false,$2,$2,$3)`,
      [PARTNER, ACTOR, OWNER]
    );
    await sql.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), OWNER, ACTOR]
    );
    await sql.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'ADMIN','ACTIVE')`,
      [randomUUID(), OTHER_OWNER, FOREIGN_ACTOR]
    );
    await sql.query(
      `INSERT INTO partner_users(id,partner_org_id,user_id,role,status,joined_at)
       VALUES ($1,$2,$3,'owner','active',now())`,
      [randomUUID(), PARTNER, ACTOR]
    );
    await sql.query(
      `INSERT INTO partner_attributions
       (id,partner_org_id,organization_id,attribution_type,commission_rate_percent,status,attributed_at)
       VALUES ($1,$2,$3,'MANUAL',0,'PENDING',now())`,
      [ATTRIBUTION, PARTNER, PARTICIPANT]
    );
    service = await import('../../../server/src/services/partnerParticipantLedgerService.ts');
  }, 60_000);

  afterAll(async () => {
    if (sql) {
      await cleanup();
      await sql.end();
    }
  });

  it('appends once, cold-reads exact source lineage, isolates tenants and rejects changed replay', async () => {
    const first = await service.appendReferralAttributionFact({
      partnerOrgId: PARTNER,
      attributionId: ATTRIBUTION,
      actorId: ACTOR,
      idempotencyKey: 'referral-fact-1',
    });
    expect(first.duplicate).toBe(false);
    expect(first.entry).toMatchObject({
      tenantOrganizationId: OWNER,
      partnerOrgId: PARTNER,
      participantOrganizationId: PARTICIPANT,
      eventType: 'referral.attributed',
      sourceId: ATTRIBUTION,
      sourceVersion: 'partner-participant-referral-v1',
    });
    expect(first.entry.sourceDigest).toMatch(/^[a-f0-9]{64}$/);

    const retry = await service.appendReferralAttributionFact({
      partnerOrgId: PARTNER,
      attributionId: ATTRIBUTION,
      actorId: ACTOR,
      idempotencyKey: 'referral-fact-1',
    });
    expect(retry).toMatchObject({ duplicate: true, entry: { id: first.entry.id } });
    await expect(
      service.appendReferralAttributionFact({
        partnerOrgId: PARTNER,
        attributionId: ATTRIBUTION,
        actorId: randomUUID(),
        idempotencyKey: 'referral-fact-1',
      })
    ).rejects.toMatchObject({ code: 'PARTNER_PARTICIPANT_LEDGER_IDEMPOTENCY_CONFLICT' });

    await expect(
      service.listPartnerParticipantLedger({ tenantOrganizationId: OWNER, partnerOrgId: PARTNER })
    ).resolves.toHaveLength(1);
    await expect(
      service.listPartnerParticipantLedger({
        tenantOrganizationId: OTHER_OWNER,
        partnerOrgId: PARTNER,
      })
    ).resolves.toEqual([]);

    await expect(
      sql.query(`UPDATE partner_participant_ledger SET actor_id=$1 WHERE id=$2`, [
        randomUUID(),
        first.entry.id,
      ])
    ).rejects.toThrow(/append-only/);
  });

  it('accepts an authorized operator append and partner self-read through mounted signed-JWT routes', async () => {
    const mounted = apps();
    const created = await request(mounted.operator)
      .post(
        `/api/superadmin/partner-settlements/program/${PARTNER}/participant-ledger/referral-attribution`
      )
      .set('Authorization', `Bearer ${token()}`)
      .send({ attributionId: ATTRIBUTION, idempotencyKey: 'mounted-referral-fact-1' });
    expect(created.status).toBe(201);
    expect(created.body.data.entry).toMatchObject({ partnerOrgId: PARTNER, sourceId: ATTRIBUTION });

    const own = await request(mounted.v8)
      .get('/api/v8/partner/program/participant-ledger')
      .set('Authorization', `Bearer ${token()}`)
      .set('x-organization-id', OWNER);
    expect(own.status).toBe(200);
    expect(own.body.data.entries).toHaveLength(2);
    expect(own.body.meta).toMatchObject({ monetaryAccrual: false, payoutAvailable: false });

    const foreign = await request(mounted.v8)
      .get('/api/v8/partner/program/participant-ledger')
      .set('Authorization', `Bearer ${token(OTHER_OWNER, FOREIGN_ACTOR)}`)
      .set('x-organization-id', OTHER_OWNER);
    expect(foreign.status).toBe(403);
  });
});
