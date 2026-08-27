/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const NO_RETRY = { retry: 0 } as const;

describe(
  'Day 55 A.4 — migration-owned Settings tables remain readable and writable',
  NO_RETRY,
  () => {
    const prefix = `day55-ddl-${randomUUID()}`;
    const organizationId = randomUUID();
    const userId = randomUUID();
    const pool = new Pool({ connectionString: databaseUrl });
    const app = express();
    let authorization = '';

    beforeAll(async () => {
      await assertRealPostgresTestEnvironment();
      const [{ ApiGateway }, { default: config }] = await Promise.all([
        import('../../../server/src/Gateway.js'),
        import('../../../server/src/config/Config.js'),
      ]);
      app.use(express.json());
      ApiGateway.getInstance().initializeRoutes(app);
      await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [
        organizationId,
      ]);
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'unused','OWNER','active')`,
        [userId, organizationId, `${prefix}@test.invalid`]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
        [randomUUID(), organizationId, userId]
      );
      authorization = `Bearer ${jwt.sign(
        { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
        config.JWT_SECRET,
        { expiresIn: '10m', jwtid: randomUUID() }
      )}`;
    });

    afterAll(async () => {
      for (const table of [
        'gdpr_requests',
        'settings_audit_log',
        'developer_settings',
        'user_webhooks',
        'user_api_keys',
        'settings_templates',
        'email_signatures',
        'user_preferences',
      ]) {
        await pool.query(`DELETE FROM ${table} WHERE user_id=$1`, [userId]);
      }
      await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [
        organizationId,
      ]);
      await pool.query(`DELETE FROM users WHERE id=$1`, [userId]);
      await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
      await pool.end();
      const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
      await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
    });

    const get = (path: string) => request(app).get(path).set('Authorization', authorization);
    const post = (path: string, body: unknown) =>
      request(app).post(path).set('Authorization', authorization).send(body);
    const put = (path: string, body: unknown) =>
      request(app).put(path).set('Authorization', authorization).send(body);
    const count = async (table: string) =>
      Number(
        (await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE user_id=$1`, [userId]))
          .rows[0]?.count ?? 0
      );

    it('user_preferences: regional PUT persists and GET remains 2xx', async () => {
      expect(
        (
          await put('/api/settings/preferences/regional', {
            preferences: { timezone: 'Europe/Warsaw' },
          })
        ).status
      ).toBe(200);
      expect(await count('user_preferences')).toBeGreaterThan(0);
      expect((await get('/api/settings/preferences/regional')).status).toBe(200);
    });

    it('email_signatures: POST then independent DB readback and GET', async () => {
      expect(
        (
          await post('/api/settings/signatures', {
            name: 'Day 55',
            content: 'Local only',
            isDefault: true,
          })
        ).status
      ).toBe(200);
      expect(await count('email_signatures')).toBe(1);
      expect((await get('/api/settings/signatures')).status).toBe(200);
    });

    it('settings_templates: POST then independent DB readback and GET', async () => {
      expect(
        (
          await post('/api/settings/templates', {
            name: 'Day 55',
            settingsData: { language: 'pl' },
          })
        ).status
      ).toBe(200);
      expect(await count('settings_templates')).toBe(1);
      expect((await get('/api/settings/templates')).status).toBe(200);
    });

    it('user_api_keys: POST then independent DB readback and GET', async () => {
      expect(
        (await post('/api/settings/api-keys', { name: 'Day 55', permissions: ['read'] })).status
      ).toBe(200);
      expect(await count('user_api_keys')).toBe(1);
      expect((await get('/api/settings/api-keys')).status).toBe(200);
    });

    it('user_webhooks: POST then independent DB readback and GET', async () => {
      expect(
        (
          await post('/api/settings/webhooks', {
            name: 'Day 55',
            url: 'https://example.invalid/hook',
            events: ['settings.updated'],
          })
        ).status
      ).toBe(200);
      expect(await count('user_webhooks')).toBe(1);
      expect((await get('/api/settings/webhooks')).status).toBe(200);
    });

    it('developer_settings: PUT then independent DB readback and GET', async () => {
      expect(
        (
          await put('/api/settings/developer', {
            developerMode: false,
            apiLogging: true,
            betaFeatures: [],
          })
        ).status
      ).toBe(200);
      expect(await count('developer_settings')).toBe(1);
      expect((await get('/api/settings/developer')).status).toBe(200);
      expect(await count('settings_audit_log')).toBeGreaterThan(0);
      expect((await get('/api/settings/history')).status).toBe(200);
    });

    it('gdpr_requests: export POST creates a row and status GET remains reachable', async () => {
      const write = await post('/api/settings/gdpr/export-request', {});
      expect(write.status, JSON.stringify(write.body)).toBe(200);
      expect(await count('gdpr_requests')).toBe(1);
      expect((await get('/api/settings/gdpr/export-status')).status).toBe(200);
    });
  }
);
