/** @vitest-environment node */
/**
 * FIX-215 punkt 2 (niski priorytet) — dowod, ze `/api/report-builder` jest
 * naprawde osiagalna przez PELNA inicjalizacje produkcyjna
 * (`ApiGateway.initializeRoutes`), a nie tylko przez bezposrednie zamontowanie
 * routera na golym `express()` (co robia inne testy tego dyzuru — ten sam
 * wzorzec co `document-studio-knowledge-index.http.pg.test.ts`, uznany w tym
 * repo za dowod HTTP e2e, ale wciaz PARTIAL wobec Z22 dopoki nikt nie przejdzie
 * przez `Gateway.ts`).
 *
 * Odbior adwersaryjny (ODBIOR_215.md) potwierdzil niezaleznie, ze trasa JEST
 * zamontowana w `Gateway.ts:1173-1176` pod `/api/report-builder` — ten plik
 * dowodzi tego samego wlasnym testem zamiast czytania kodu.
 *
 * Wzor montowania przez `apiGateway.initializeRoutes(app)`:
 * `server/src/routes/audits/__tests__/day41.reportChainReachability.pg.test.ts`.
 *
 * Przy okazji: potwierdza, ze naprawa FIX-215 pkt 1 (transport
 * `confidentiality` HTTP -> kolumna) dziala TAKZE przez pelny stos middleware
 * gatewaya (`gatewayVerifyToken` + `highRiskSurfaceGuard`), nie tylko przez
 * router zamontowany w izolacji.
 */
import { randomUUID } from 'node:crypto';

import type { Express } from 'express';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)(
  'FIX-215 pkt 2: /api/report-builder osiagalna przez pelna ApiGateway.initializeRoutes (real PostgreSQL)',
  () => {
    const suffix = randomUUID().slice(0, 8);
    const organizationId = `fix215_gw_org_${suffix}`;
    const ownerId = `fix215_gw_owner_${suffix}`;
    let app: Express;
    let pool: import('pg').Pool;
    let ownerToken = '';
    const createdReportIds: string[] = [];

    beforeAll(async () => {
      await assertRealPostgresTestEnvironment();
      expect(process.env.DB_TYPE).toBe('postgres');
      const { Pool } = await import('pg');
      pool = new Pool({ connectionString: DATABASE_URL });

      await pool.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [
        organizationId,
        'FIX-215 pkt 2 gateway reachability proof',
      ]);
      await pool.query(
        'INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4)',
        [ownerId, organizationId, `${ownerId}@example.test`, 'user']
      );

      const { default: config } = await import('../../config/Config.js');
      ownerToken = jwt.sign({ id: ownerId, organizationId, role: 'user' }, config.JWT_SECRET, {
        expiresIn: '15m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      });

      // Pelna inicjalizacja produkcyjna — nie montujemy `report-builder.routes.ts`
      // recznie, tylko odpalamy dokladnie ten sam kod co `server.ts` na starcie
      // procesu. Jesli trasa kiedykolwiek zniknie z `Gateway.ts` albo middleware
      // przed nia zablokuje ruch, ten test to zlapie — czego test z bezposrednim
      // montowaniem routera z definicji nie moze.
      app = express();
      app.use(express.json());
      const { apiGateway } = await import('../../Gateway.js');
      apiGateway.initializeRoutes(app);
    });

    afterAll(async () => {
      if (!pool) return;
      if (createdReportIds.length > 0) {
        await pool.query('DELETE FROM report_builder_sections WHERE report_id = ANY($1)', [
          createdReportIds,
        ]);
        await pool.query('DELETE FROM report_builder_reports WHERE id = ANY($1)', [
          createdReportIds,
        ]);
      }
      await pool.query('DELETE FROM users WHERE organization_id = $1', [organizationId]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
      await pool.end();
    });

    it('reaches POST /api/report-builder through the real ApiGateway.initializeRoutes stack, and confidentiality still transports correctly through the full gateway middleware chain', async () => {
      const response = await request(app)
        .post('/api/report-builder')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          sourceType: 'FINANCE_SECTION',
          sourceId: `src_${randomUUID()}`,
          title: `Gateway reachability ${suffix}`,
          confidentiality: 'confidential',
        });

      // Not a 404 (route unmounted) and not blocked by highRiskSurfaceGuard —
      // proves the route is truly wired into the production app tree, not just
      // reachable in a test-only bare-router mount.
      expect(response.status).toBe(201);
      const reportId = response.body?.report?.id as string;
      expect(reportId).toBeTruthy();
      createdReportIds.push(reportId);

      const row = await pool.query(
        'SELECT confidentiality FROM report_builder_reports WHERE id = $1',
        [reportId]
      );
      expect(row.rows[0]?.confidentiality).toBe('confidential');
    });
  }
);
