/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';
const jwtSecret = process.env.JWT_SECRET ?? '';

describe.sequential(
  'Dyżur 288 — MODULE_ECONOMICS na realnym Gateway i Postgresie',
  NO_RETRY,
  () => {
    const organizationId = randomUUID();
    const userId = randomUUID();
    const ownerId = randomUUID();
    const pool = new Pool({ connectionString: databaseUrl });
    const app = express();

    const bearer = (id: string, role: 'USER' | 'OWNER') =>
      `Bearer ${jwt.sign(
        { id, userId: id, organizationId, organization_id: organizationId, role },
        jwtSecret,
        { algorithm: 'HS256', expiresIn: '10m', jwtid: randomUUID() }
      )}`;

    beforeAll(async () => {
      expect(process.env.RUN_DB_TESTS).toBe('1');
      expect(process.env.MOCK_DB).toBe('false');
      expect(process.env.DB_TYPE).toBe('postgres');
      expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
      expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
      await assertRealPostgresTestEnvironment();

      const { ApiGateway } = await import('../../../Gateway.js');
      app.use(express.json());
      ApiGateway.getInstance().initializeRoutes(app);

      await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [
        organizationId,
      ]);
      for (const [id, role] of [
        [userId, 'USER'],
        [ownerId, 'OWNER'],
      ] as const) {
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
         VALUES($1,$2,$3,'unused',$4,'active',1)`,
          [id, organizationId, `day288-${id}@test.invalid`, role]
        );
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,$4,'ACTIVE')`,
          [randomUUID(), organizationId, id, role]
        );
      }
    }, 120_000);

    afterAll(async () => {
      await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [
        organizationId,
      ]);
      await pool.query(`DELETE FROM users WHERE organization_id=$1`, [organizationId]);
      await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
      await pool.end();
      const pgModule = await import('../../../database/PostgresDatabase.js');
      await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
    });

    for (const path of ['/api/v8/finance/settings', '/api/v8/finance/models']) {
      it(`GET ${path}: USER 403 BETA_LOCKED, OWNER przechodzi do handlera`, async () => {
        const denied = await request(app).get(path).set('Authorization', bearer(userId, 'USER'));
        expect(denied.status).toBe(403);
        expect(denied.body).toMatchObject({ code: 'BETA_LOCKED' });

        const allowed = await request(app).get(path).set('Authorization', bearer(ownerId, 'OWNER'));
        expect(allowed.status).toBe(200);
        expect(allowed.body).toHaveProperty('data');
      });
    }

    it('POST /api/v8/finance/models: USER odbity przed walidacją, OWNER dochodzi do 400', async () => {
      const denied = await request(app)
        .post('/api/v8/finance/models')
        .set('Authorization', bearer(userId, 'USER'))
        .send({});
      expect(denied.status).toBe(403);
      expect(denied.body).toMatchObject({ code: 'BETA_LOCKED' });

      const allowed = await request(app)
        .post('/api/v8/finance/models')
        .set('Authorization', bearer(ownerId, 'OWNER'))
        .send({});
      expect(allowed.status).toBe(400);
      expect(allowed.body).toMatchObject({ error: 'name and startDate required' });
    });

    it('GET /api/v8/finance/statements: bramka obejmuje także mount przed v8FeatureGate', async () => {
      const denied = await request(app)
        .get('/api/v8/finance/statements')
        .set('Authorization', bearer(userId, 'USER'));
      expect(denied.status).toBe(403);
      expect(denied.body).toMatchObject({ code: 'BETA_LOCKED' });

      const allowed = await request(app)
        .get('/api/v8/finance/statements')
        .set('Authorization', bearer(ownerId, 'OWNER'));
      expect(allowed.status).toBe(200);
      expect(allowed.body).toHaveProperty('data');
    });
  }
);
