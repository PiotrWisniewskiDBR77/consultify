import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import { assertDay42Preconditions, restoreDay42FixtureColumns } from './day42SchemaResilience.js';

const DATABASE_URL = String(process.env.DATABASE_URL || '');
// Z31 detektor 2026-08-31: unpinned from a hardcoded '/cx_day42' database-name
// substring, which silently skipped this security suite (exit 0) on any other
// disposable database name. assertDay42Preconditions() below still refuses
// LOUD (throws DAY42_PRECONDITION_SCHEMA_DAMAGED) if a destructive sibling in
// this directory dropped the required fixture tables, so the directory-wide
// hazard this pin was guarding against is still caught -- just not silently.
const RUN =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const describeReal = RUN ? describe : describe.skip;
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-min-32-chars-long-for-validation';

/**
 * Day 42 FIX-1 — see the sibling isolation suite for the full rationale.
 * `vitest.config.ts` retries once locally and three times in CI; a gate/security
 * suite that retries can pass because of the side effect of its own first
 * attempt. Suite options beat the config value, so the pin stays local.
 */
const NO_RETRY = { retry: 0 } as const;

describeReal(
  'Day 42 Partner portal global-gate diagnosis through the real ApiGateway',
  NO_RETRY,
  () => {
    let sql: Client;
    let app: Express;

    /**
     * FIX-7: this file flips a PROCESS-WIDE env flag, and the original teardown
     * left `ENABLE_V8_GLOBAL='true'` behind for every file that ran afterwards in
     * the same worker. Capture the entry value and put it back exactly, including
     * the "was not set at all" case.
     */
    const originalEnableV8Global = process.env.ENABLE_V8_GLOBAL;
    const restoreEnableV8Global = () => {
      if (originalEnableV8Global === undefined) delete process.env.ENABLE_V8_GLOBAL;
      else process.env.ENABLE_V8_GLOBAL = originalEnableV8Global;
    };
    const prefix = `day42_${randomUUID().replaceAll('-', '')}`;
    const orgA = `${prefix}_org_a`;
    const orgB = `${prefix}_org_b`;
    const unboundUser = randomUUID();
    const boundUser = randomUUID();
    const partnerA = randomUUID();
    const partnerB = randomUUID();

    const token = (userId: string, organizationId: string) =>
      jwt.sign(
        { id: userId, email: `${userId}@day42.local`, organizationId, role: 'OWNER' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

    const auth = (userId: string, organizationId: string) => ({
      Authorization: `Bearer ${token(userId, organizationId)}`,
      'x-org-context': organizationId,
    });

    beforeAll(async () => {
      sql = new Client({ connectionString: DATABASE_URL });
      await sql.connect();
      // Z31 detektor 2026-08-31: redundant inner pin to the literal 'cx_day42'
      // name removed (duplicated the outer RUN gate). Only require a real name.
      const target = await sql.query<{ name: string }>('SELECT current_database() AS name');
      if (!target.rows[0]?.name) {
        throw new Error('DAY42_NO_REAL_DATABASE');
      }
      // FIX-7: survive destructive neighbours in a whole-directory run.
      await assertDay42Preconditions(sql);
      await restoreDay42FixtureColumns(sql);

      await sql.query(
        `INSERT INTO organizations (id, name, plan, status)
       VALUES ($1, 'Day42 A', 'enterprise', 'active'), ($2, 'Day42 B', 'enterprise', 'active')`,
        [orgA, orgB]
      );
      for (const [userId, organizationId] of [
        [unboundUser, orgA],
        [boundUser, orgA],
      ]) {
        await sql.query(
          `INSERT INTO users (id, organization_id, email, password, role, status)
         VALUES ($1, $2, $3, 'x', 'OWNER', 'active')`,
          [userId, organizationId, `${userId}@day42.local`]
        );
        await sql.query(
          `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
          [`${prefix}_${userId}`, organizationId, userId]
        );
      }
      await sql.query(
        `INSERT INTO partner_organizations
         (id, name, contact_email, status, owner_organization_id)
       VALUES ($1, 'Partner A', 'a@day42.local', 'active', $2),
              ($3, 'Partner B', 'b@day42.local', 'active', $4)`,
        [partnerA, orgA, partnerB, orgB]
      );
      await sql.query(
        `INSERT INTO partner_users (partner_org_id, user_id, role, status)
       VALUES ($1, $2, 'owner', 'active')`,
        [partnerA, boundUser]
      );

      app = express();
      app.use(express.json());
      ApiGateway.getInstance().initializeRoutes(app);
    });

    afterAll(async () => {
      restoreEnableV8Global();
      if (!sql) return;
      await sql.query(
        'DELETE FROM partner_campaign_links WHERE partner_org_id::text = ANY($1::text[])',
        [[partnerA, partnerB]]
      );
      await sql.query(
        'DELETE FROM partner_program_ledger WHERE partner_org_id::text = ANY($1::text[])',
        [[partnerA, partnerB]]
      );
      await sql.query(
        'DELETE FROM partner_program_runtime WHERE partner_org_id::text = ANY($1::text[])',
        [[partnerA, partnerB]]
      );
      await sql.query('DELETE FROM partner_users WHERE user_id::text = ANY($1::text[])', [
        [unboundUser, boundUser],
      ]);
      await sql.query('DELETE FROM partner_organizations WHERE id::text = ANY($1::text[])', [
        [partnerA, partnerB],
      ]);
      await sql.query('DELETE FROM organization_members WHERE id LIKE $1', [`${prefix}%`]);
      await sql.query('DELETE FROM users WHERE id::text = ANY($1::text[])', [
        [unboundUser, boundUser],
      ]);
      await sql.query('DELETE FROM organizations WHERE id::text = ANY($1::text[])', [[orgA, orgB]]);
      await sql.end();
    });

    it('D.3 returns the pre-authentication 404 V8_DISABLED on representative partner routes when the env flag is absent', async () => {
      delete process.env.ENABLE_V8_GLOBAL;
      const probes: Array<{ method: 'get' | 'post' | 'put'; path: string }> = [
        { method: 'get', path: '/api/v8/partner/connection' },
        { method: 'get', path: '/api/v8/partner/clients' },
        { method: 'get', path: '/api/v8/partner/earnings-summary' },
        { method: 'post', path: '/api/v8/partner/campaign-links' },
        { method: 'put', path: '/api/v8/partner/organization' },
      ];
      for (const probe of probes) {
        const response = await request(app)[probe.method](probe.path).send({});
        expect(response.status, `${probe.method.toUpperCase()} ${probe.path}`).toBe(404);
        expect(response.body.code).toBe('V8_DISABLED');
      }
    });

    it('opens the global gate but preserves connection=false and PARTNER_ORG_REQUIRED for an unbound member', async () => {
      process.env.ENABLE_V8_GLOBAL = 'true';
      const connection = await request(app)
        .get('/api/v8/partner/connection')
        .set(auth(unboundUser, orgA));
      expect(connection.status).toBe(200);
      expect(connection.body.data.connected).toBe(false);

      const clients = await request(app)
        .get('/api/v8/partner/clients')
        .set(auth(unboundUser, orgA));
      expect(clients.status).toBe(403);
      expect(clients.body.code).toBe('PARTNER_ORG_REQUIRED');
    });

    it('reaches the real clients handler for an exactly bound tenant and user', async () => {
      process.env.ENABLE_V8_GLOBAL = 'true';
      const clients = await request(app).get('/api/v8/partner/clients').set(auth(boundUser, orgA));
      expect(clients.status).toBe(200);
      expect(clients.body.meta.partnerOrgId).toBe(partnerA);
    });

    it('rejects a foreign tenant header and leaves both partner organizations unchanged', async () => {
      process.env.ENABLE_V8_GLOBAL = 'true';
      const before = await sql.query(
        'SELECT id, name, updated_at FROM partner_organizations WHERE id::text = ANY($1::text[]) ORDER BY id',
        [[partnerA, partnerB]]
      );
      const response = await request(app)
        .put('/api/v8/partner/organization')
        .set('Authorization', `Bearer ${token(boundUser, orgA)}`)
        .set('x-org-context', orgB)
        .send({ organizationId: orgB, name: 'FOREIGN-MUTATION' });
      // FIX-3: `not.toBe(200)` also accepted a 500 as proof of isolation. The
      // refusal is `requireExactPartnerTenantContext`
      // (server/src/routes/v8/partner.routes.ts:103-106), so pin it exactly.
      expect({ status: response.status, code: response.body?.code }).toEqual({
        status: 403,
        code: 'ORG_MEMBERSHIP_REVOKED',
      });
      expect(JSON.stringify(response.body)).not.toContain('Partner B');
      const after = await sql.query(
        'SELECT id, name, updated_at FROM partner_organizations WHERE id::text = ANY($1::text[]) ORDER BY id',
        [[partnerA, partnerB]]
      );
      expect(after.rows).toEqual(before.rows);
    });

    it('D.3 proves the partner mount bypasses the org-level V8 flag while remaining behind the global gate', async () => {
      process.env.ENABLE_V8_GLOBAL = 'true';
      const response = await request(app)
        .get('/api/v8/partner/connection')
        .set(auth(unboundUser, orgA));
      expect(response.status).toBe(200);
      expect(response.body.code).not.toBe('V8_ORG_DISABLED');
    });

    it('statically proves autorun excludes the historical migrations that create the Partner binding schema', () => {
      const migrationIdentity = readFileSync(
        'server/src/services/tablePlatform/migrationIdentity.ts',
        'utf8'
      );
      const bindingMigration = readFileSync(
        'server/migrations/955_partner_connection_receipts.sql',
        'utf8'
      );
      expect(migrationIdentity).toContain('/^(7\\d{2}|\\d{8})_.*\\.sql$/');
      expect(bindingMigration).toContain('ADD COLUMN IF NOT EXISTS owner_organization_id');
      expect('955_partner_connection_receipts.sql').not.toMatch(/^(7\d{2}|\d{8})_.*\.sql$/);
    });

    it('D.2 reaches the connection row through the real global gate and exact tenant binding', async () => {
      process.env.ENABLE_V8_GLOBAL = 'true';
      const response = await request(app)
        .get('/api/v8/partner/connection')
        .set(auth(boundUser, orgA));
      expect(response.status).toBe(200);
      expect(response.body.data.connected).toBe(true);
      expect(response.body.data.partnerOrganizationId).toBe(partnerA);
    });

    it('D.2 reaches the clients SQL reader without leaking another partner', async () => {
      process.env.ENABLE_V8_GLOBAL = 'true';
      const response = await request(app).get('/api/v8/partner/clients').set(auth(boundUser, orgA));
      expect(response.status).toBe(200);
      expect(response.body.meta.partnerOrgId).toBe(partnerA);
      expect(JSON.stringify(response.body)).not.toContain(partnerB);
    });

    it('D.2 provisions referral identity and cold-reads the exact persisted row', async () => {
      process.env.ENABLE_V8_GLOBAL = 'true';
      const response = await request(app)
        .get('/api/v8/partner/referral-tools')
        .set(auth(boundUser, orgA));
      expect(response.status).toBe(200);
      expect(response.body.data.tools.referralCode).toBeTruthy();
      const cold = new Client({ connectionString: DATABASE_URL });
      await cold.connect();
      try {
        const readback = await cold.query(
          'SELECT referral_code, referral_link_slug FROM partner_organizations WHERE id = $1',
          [partnerA]
        );
        expect(readback.rows[0].referral_code).toBe(response.body.data.tools.referralCode);
        expect(readback.rows[0].referral_link_slug).toBeTruthy();
      } finally {
        await cold.end();
      }
    });

    it('D.2 creates the program runtime through GET /program/status and cold-reads it', async () => {
      process.env.ENABLE_V8_GLOBAL = 'true';
      const response = await request(app)
        .get('/api/v8/partner/program/status')
        .set(auth(boundUser, orgA));
      expect(response.status).toBe(200);
      const cold = new Client({ connectionString: DATABASE_URL });
      await cold.connect();
      try {
        const readback = await cold.query(
          'SELECT lifecycle_phase FROM partner_program_runtime WHERE partner_org_id = $1',
          [partnerA]
        );
        expect(readback.rowCount).toBe(1);
        expect(readback.rows[0].lifecycle_phase).toBe(response.body.data.lifecyclePhase);
      } finally {
        await cold.end();
      }
    });

    it('D.2 refuses an invalid campaign write with a cold zero-residue readback', async () => {
      process.env.ENABLE_V8_GLOBAL = 'true';
      const before = await sql.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM partner_campaign_links WHERE partner_org_id = $1',
        [partnerA]
      );
      const response = await request(app)
        .post('/api/v8/partner/campaign-links')
        .set(auth(boundUser, orgA))
        .send({});
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('CAMPAIGN_NAME_REQUIRED');
      const cold = new Client({ connectionString: DATABASE_URL });
      await cold.connect();
      try {
        const after = await cold.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM partner_campaign_links WHERE partner_org_id = $1',
          [partnerA]
        );
        expect(after.rows).toEqual(before.rows);
      } finally {
        await cold.end();
      }
    });

    it('D.2 writes a campaign link, cold-reads it, and reads it back through referral-tools', async () => {
      process.env.ENABLE_V8_GLOBAL = 'true';
      const name = `${prefix} Campaign`;
      const created = await request(app)
        .post('/api/v8/partner/campaign-links')
        .set(auth(boundUser, orgA))
        .send({ name, utmSource: 'day42', destinationUrl: '/partner' });
      expect(created.status).toBe(201);
      const campaignId = created.body.data.campaignLink.id;

      const cold = new Client({ connectionString: DATABASE_URL });
      await cold.connect();
      try {
        const readback = await cold.query(
          'SELECT id, partner_org_id, name FROM partner_campaign_links WHERE id = $1',
          [campaignId]
        );
        expect(readback.rows[0]).toMatchObject({ partner_org_id: partnerA, name });
      } finally {
        await cold.end();
      }

      const tools = await request(app)
        .get('/api/v8/partner/referral-tools')
        .set(auth(boundUser, orgA));
      expect(tools.status).toBe(200);
      expect(tools.body.data.tools.campaignLinks).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: campaignId, name })])
      );
    });
  }
);
