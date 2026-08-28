/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';

describe(
  'Day 55 B.2 — OAuth callback state is bound to the initiating browser session',
  NO_RETRY,
  () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const orgA = randomUUID();
    const orgB = randomUUID();
    const userA = randomUUID();
    const userB = randomUUID();
    const app = express();
    let tokenA = '';
    let tokenB = '';

    beforeAll(async () => {
      await assertRealPostgresTestEnvironment();
      process.env.GOOGLE_CLIENT_ID = 'day55-local-client';
      process.env.GOOGLE_CLIENT_SECRET = 'day55-local-secret';
      const oauth = await import('../../../server/src/services/integrationOAuthEngine.js');
      const scopes = oauth.getConnectorConfig('gmail')?.scopes ?? [];
      process.env.OAUTH_APPROVED_PROVIDER_REGISTRY = JSON.stringify({
        gmail: { approved: true, scopes, residency: 'EU' },
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                access_token: 'day55-local-access-token',
                refresh_token: 'day55-local-refresh-token',
                expires_in: 3600,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        )
      );
      const [{ ApiGateway }, { default: config }] = await Promise.all([
        import('../../../server/src/Gateway.js'),
        import('../../../server/src/config/Config.js'),
      ]);
      app.use(express.json());
      ApiGateway.getInstance().initializeRoutes(app);
      await pool.query(
        `INSERT INTO organizations(id,name,status) VALUES($1,$1,'active'),($2,$2,'active')`,
        [orgA, orgB]
      );
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'unused','OWNER','active'),($4,$5,$6,'unused','OWNER','active')`,
        [userA, orgA, `${userA}@test.invalid`, userB, orgB, `${userB}@test.invalid`]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE'),($4,$5,$6,'OWNER','ACTIVE')`,
        [randomUUID(), orgA, userA, randomUUID(), orgB, userB]
      );
      const sign = (userId: string, organizationId: string) =>
        jwt.sign(
          { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
          config.JWT_SECRET,
          { expiresIn: '10m', jwtid: randomUUID() }
        );
      tokenA = sign(userA, orgA);
      tokenB = sign(userB, orgB);
    }, 60_000);

    afterAll(async () => {
      vi.unstubAllGlobals();
      await pool
        .query(`DELETE FROM integration_connection_events WHERE user_id=ANY($1::text[])`, [
          [userA, userB],
        ])
        .catch(() => undefined);
      await pool
        .query(`DELETE FROM integration_ownership WHERE owner_user_id=ANY($1::text[])`, [
          [userA, userB],
        ])
        .catch(() => undefined);
      await pool.query(`DELETE FROM integration_oauth_tokens WHERE user_id=ANY($1::text[])`, [
        [userA, userB],
      ]);
      await pool.query(`DELETE FROM user_preferences WHERE user_id=ANY($1::text[])`, [
        [userA, userB],
      ]);
      await pool.query(`DELETE FROM organization_members WHERE organization_id=ANY($1::text[])`, [
        [orgA, orgB],
      ]);
      await pool.query(`DELETE FROM users WHERE id=ANY($1::text[])`, [[userA, userB]]);
      await pool.query(`DELETE FROM organizations WHERE id=ANY($1::text[])`, [[orgA, orgB]]);
      await pool.end();
      const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
      await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
    });

    const integrationRows = async (userId: string) =>
      Number(
        (
          await pool.query(
            `SELECT count(*)::int AS n FROM user_preferences WHERE user_id=$1 AND key='settings:integrations'`,
            [userId]
          )
        ).rows[0]?.n ?? 0
      );

    it('rejects missing and random state with zero integration writes', async () => {
      for (const suffix of ['', '?state=day55-random&code=unused']) {
        const before = await integrationRows(userA);
        const response = await request(app).get(
          `/api/settings/integrations/oauth/callback${suffix}`
        );
        expect(response.status).toBe(302);
        expect(response.headers.location).toMatch(
          /oauth_error=(missing_state|state_session_mismatch)/
        );
        expect(await integrationRows(userA)).toBe(before);
      }
    });

    it('rejects another tenant browser state and accepts the matching browser state', async () => {
      const browserA = request.agent(app);
      const browserB = request.agent(app);
      const startA = await browserA
        .get('/api/settings/integrations/oauth/start/gmail')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-org-context', orgA);
      const startB = await browserB
        .get('/api/settings/integrations/oauth/start/gmail')
        .set('Authorization', `Bearer ${tokenB}`)
        .set('x-org-context', orgB);
      expect(startA.status, JSON.stringify(startA.body)).toBe(200);
      expect(startB.status, JSON.stringify(startB.body)).toBe(200);

      const beforeB = await integrationRows(userB);
      const foreign = await browserA.get('/api/settings/integrations/oauth/callback').query({
        state: startB.body.state,
        code: 'local-code',
      });
      expect(foreign.status).toBe(302);
      expect(foreign.headers.location).toContain('oauth_error=state_session_mismatch');
      expect(await integrationRows(userB)).toBe(beforeB);

      const valid = await browserB.get('/api/settings/integrations/oauth/callback').query({
        state: startB.body.state,
        code: 'local-code',
      });
      expect(valid.status).toBe(302);
      expect(valid.headers.location).toContain('oauth_success=gmail');
      expect(await integrationRows(userB)).toBe(beforeB + 1);
    });
  }
);
