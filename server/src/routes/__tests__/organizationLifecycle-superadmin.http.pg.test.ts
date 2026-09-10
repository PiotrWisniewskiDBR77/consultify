/**
 * @vitest-environment node
 *
 * P5 (kryterium 12, S2.7) — dowod HTTP end-to-end: eksport i usuniecie danych
 * organizacji dzialaja przez REALNA trase `/api/superadmin/organizations/:id`,
 * nie tylko przez bezposrednie wywolanie serwisu (to pokrywa
 * `organizationLifecycleService.realpg.test.ts`).
 *
 * Wzor: `server/src/routes/__tests__/document-studio-knowledge-index.http.pg.test.ts`
 * — montuje REALNY router bezposrednio, podpisuje REALNY JWT `config.JWT_SECRET`,
 * seeduje `users`/`organizations` na realnym Postgresie.
 *
 * Run:
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54533/consultify_p5" \
 *   npx vitest run server/src/routes/__tests__/organizationLifecycle-superadmin.http.pg.test.ts
 */
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

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)(
  'P5 — /api/superadmin/organizations/:id export+delete, real HTTP (real PostgreSQL)',
  () => {
    let app: Express;
    let pool: import('pg').Pool;

    const SUFFIX = randomUUID().slice(0, 8);
    const TARGET_ORG = `org-p5-http-target-${SUFFIX}`;
    const SUPERADMIN_ID = `user-p5-http-superadmin-${SUFFIX}`;
    const TARGET_USER_ID = `user-p5-http-target-${SUFFIX}`;
    const SUPERADMIN_ORG = `org-p5-http-superadmin-home-${SUFFIX}`;
    let superadminToken = '';

    beforeAll(async () => {
      // describe.skipIf(!REAL_DB) above already prevents this suite from
      // running without a real Postgres target; this is defense in depth
      // against a future refactor accidentally dropping that guard.
      if (!REAL_DB) throw new Error('REAL_DB_REQUIRED');

      const { Pool } = await import('pg');
      pool = new Pool({ connectionString: CONNECTION_STRING });

      await pool.query(
        `INSERT INTO organizations (id, name, organization_type, is_active) VALUES ($1, $2, 'PAID', 1)`,
        [SUPERADMIN_ORG, 'P5 HTTP superadmin home org']
      );
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role, status) VALUES ($1, $2, $3, 'SUPERADMIN', 'active')`,
        [SUPERADMIN_ID, SUPERADMIN_ORG, `${SUPERADMIN_ID}@example.test`]
      );

      await pool.query(
        `INSERT INTO organizations (id, name, organization_type, is_active) VALUES ($1, $2, 'PAID', 1)`,
        [TARGET_ORG, 'P5 HTTP target organization']
      );
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role, status) VALUES ($1, $2, $3, 'admin', 'active')`,
        [TARGET_USER_ID, TARGET_ORG, `${TARGET_USER_ID}@example.test`]
      );

      const { default: config } = await import('../../config/Config.js');
      superadminToken = jwt.sign(
        { id: SUPERADMIN_ID, organizationId: SUPERADMIN_ORG, role: 'SUPERADMIN' },
        config.JWT_SECRET,
        {
          expiresIn: '15m',
          ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
          ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
        }
      );

      const { default: superadminRoutes } = await import('../superadmin.routes.js');
      app = express();
      app.use(express.json());
      app.use('/api/superadmin', superadminRoutes);
    });

    afterAll(async () => {
      if (!pool) return;
      // requireConfirmation (superadmin_confirmed_actions.admin_id -> users.id)
      // logged the superadmin's confirmed delete action — clear that audit row
      // before removing the user, or the FK blocks cleanup.
      await pool
        .query('DELETE FROM superadmin_confirmed_actions WHERE admin_id = $1', [SUPERADMIN_ID])
        .catch(() => undefined);
      await pool.query('DELETE FROM users WHERE organization_id = ANY($1::text[])', [
        [TARGET_ORG, SUPERADMIN_ORG],
      ]);
      await pool.query('DELETE FROM organizations WHERE id = ANY($1::text[])', [
        [TARGET_ORG, SUPERADMIN_ORG],
      ]);
      await pool.end();
    });

    it('GET .../export zwraca realny plik JSON z danymi organizacji (nie pustą kopertę)', async () => {
      const res = await request(app)
        .get(`/api/superadmin/organizations/${TARGET_ORG}/export`)
        .set('Authorization', `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('organization-export-');
      const body = JSON.parse(res.text);
      expect(body.organization.id).toBe(TARGET_ORG);
      expect(body.tables.users?.some((u: any) => u.id === TARGET_USER_ID)).toBe(true);
    });

    it('GET .../export?format=csv zwraca CSV', async () => {
      const res = await request(app)
        .get(`/api/superadmin/organizations/${TARGET_ORG}/export?format=csv`)
        .set('Authorization', `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('table,row_index,data_json');
      expect(res.text).toContain(TARGET_USER_ID);
    });

    it('DELETE .../organizations/:id BEZ nazwy organizacji w body jest odrzucany (428)', async () => {
      const res = await request(app)
        .delete(`/api/superadmin/organizations/${TARGET_ORG}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ confirmation: true, reason: 'GDPR deletion request test' });

      expect(res.status).toBe(428);
      expect(res.body.code).toBe('ORG_NAME_CONFIRMATION_REQUIRED');

      // Organizacja MUSI wciąż istnieć — odrzucenie na potwierdzeniu nazwy nie
      // może dopuścić żadnego skutku ubocznego.
      const stillThere = await pool.query('SELECT 1 FROM organizations WHERE id = $1', [
        TARGET_ORG,
      ]);
      expect(stillThere.rowCount).toBe(1);
    });

    it('DELETE .../organizations/:id z poprawną nazwą organizacji faktycznie usuwa dane', async () => {
      const orgRow = await pool.query('SELECT name FROM organizations WHERE id = $1', [
        TARGET_ORG,
      ]);
      const realName = orgRow.rows[0]!.name as string;

      const res = await request(app)
        .delete(`/api/superadmin/organizations/${TARGET_ORG}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          confirmation: true,
          reason: 'GDPR deletion request — pilot org (P5 HTTP proof)',
          organizationName: realName,
        });

      expect(res.status).toBe(200);
      expect(res.body.deletedCounts.organizations).toBe(1);

      const org = await pool.query('SELECT 1 FROM organizations WHERE id = $1', [TARGET_ORG]);
      expect(org.rowCount).toBe(0);
      const users = await pool.query('SELECT 1 FROM users WHERE id = $1', [TARGET_USER_ID]);
      expect(users.rowCount).toBe(0);
    });

    it('bez tokenu superadmina obie trasy sa odrzucane', async () => {
      const exportRes = await request(app).get(
        `/api/superadmin/organizations/${SUPERADMIN_ORG}/export`
      );
      expect(exportRes.status).toBeGreaterThanOrEqual(401);

      const deleteRes = await request(app)
        .delete(`/api/superadmin/organizations/${SUPERADMIN_ORG}`)
        .send({ confirmation: true, reason: 'no auth' });
      expect(deleteRes.status).toBeGreaterThanOrEqual(401);
    });
  }
);
