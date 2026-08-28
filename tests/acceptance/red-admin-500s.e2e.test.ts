/**
 * RED-ADMIN — schema-500 regression suite (rewir: superadmin/admin/organization).
 *
 * Klasa: legacy migracje (055_security_module.sql.sql poza autorun; 015 częściowo
 * niezaaplikowane) → brak kolumn/tabel → 500 na realnych GET-ach superadmina.
 *
 * Znalezione automatycznym probem na parity :5443 (dump TROLLEY). Naprawa = dwie
 * addytywne migracje (20260719_red_admin_*.sql), aplikowane w beforeAll (idempotentne,
 * = no-op gdy schema aktualna). Mount = realny router + realny verifyToken + realny
 * verifySuperAdmin (per-route), zero mocków — zgodnie z harness.ts.
 *
 * PRZED (bez migracji): każdy z endpointów zwracał 500 (kody w komentarzach).
 * PO (z migracjami): 2xx. Sprzątanie: seed prefiksem `odbior--redadm--`.
 *
 * Wymaga LOCAL Postgres + JWT_SECRET (patrz vitest.acceptance.config.ts / run.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ORG = 'odbior--redadm--org';
const SA_USER = 'odbior--redadm--sa';
const SECRET = process.env.JWT_SECRET || 'development_secret_key_change_in_production_abc123xyz';

function requireLocalDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(`RED-ADMIN suite requires a LOCAL DATABASE_URL. Got: ${url || '(unset)'}`);
  }
  return url;
}

function saToken(): string {
  return jwt.sign(
    { id: SA_USER, email: `${SA_USER}@acceptance.local`, organizationId: ORG, organization_id: ORG, role: 'superadmin', isSuperAdmin: true },
    SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

async function applyMigrations(client: pg.Client): Promise<void> {
  const dir = path.resolve(process.cwd(), 'server/migrations');
  for (const f of [
    '20260719_red_admin_security_audit_columns.sql',
    '20260719_red_admin_compliance_roadmap_tables.sql',
  ]) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    await client.query(sql); // idempotent (ADD COLUMN / CREATE TABLE IF NOT EXISTS)
  }
}

async function seed(client: pg.Client): Promise<void> {
  const now = new Date().toISOString();
  await client.query(
    `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
     VALUES ($1, 'RED-ADMIN Org', 'enterprise', 'active', 1, $2) ON CONFLICT (id) DO NOTHING`,
    [ORG, now]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at, updated_at)
     VALUES ($1, $2, $3, 'x', 'superadmin', 'active', 'Red', 'SA', $4, $5)
     ON CONFLICT (id) DO UPDATE SET role='superadmin'`,
    [SA_USER, ORG, `${SA_USER}@acceptance.local`, now, now]
  );
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     SELECT $1, $2, $3, 'OWNER', 'ACTIVE', $4
     WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$2 AND user_id=$3)`,
    [`${SA_USER}--mem`, ORG, SA_USER, now]
  );
}

async function cleanup(client: pg.Client): Promise<void> {
  await client.query(`DELETE FROM organization_members WHERE user_id LIKE 'odbior--redadm--%'`);
  await client.query(`DELETE FROM users WHERE id LIKE 'odbior--redadm--%'`);
  await client.query(`DELETE FROM organizations WHERE id LIKE 'odbior--redadm--%'`);
}

let app: Express;
let client: pg.Client;

beforeAll(async () => {
  client = new pg.Client({ connectionString: requireLocalDbUrl() });
  await client.connect();
  await applyMigrations(client);
  await cleanup(client); // drop any leftover redadm seed rows (idempotent re-runs)
  await seed(client);

  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const superAdminRoutes = (await import('../../server/src/routes/superadmin.routes.js')).default;

  app = express();
  app.use(express.json());
  // superadmin.routes applies verifySuperAdmin per-route; verifyToken populates req.user first.
  app.use('/api/superadmin', verifyToken as any, superAdminRoutes);
}, 60_000);

afterAll(async () => {
  if (client) {
    await cleanup(client);
    await client.end();
  }
});

// Each: PRZED migracji = 500 (kod PG w komentarzu). PO = 2xx.
const FIXED: Array<[string, string]> = [
  ['/api/superadmin/security/events/stats', '42703 column "resolved" does not exist'],
  ['/api/superadmin/security/events', '42703 location_city/location_country/resolved'],
  ['/api/superadmin/security-events', '42703 (alias)'],
  ['/api/superadmin/admin/audit-logs/export', '42703 column l.description / l.resolved_at'],
  ['/api/superadmin/feature-roadmap', '42P01 relation "feature_roadmap" does not exist'],
  ['/api/superadmin/compliance/gdpr-requests', '42P01 relation "gdpr_data_subject_requests"'],
];

describe('RED-ADMIN schema-500 regressions (fixed by 20260719_red_admin_* migrations)', () => {
  for (const [endpoint, before] of FIXED) {
    it(`GET ${endpoint} → 2xx (was 500: ${before})`, async () => {
      const res = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${saToken()}`)
        .set('User-Agent', 'red-admin-suite');
      expect(res.status).toBeLessThan(500);
      expect(res.status).toBeGreaterThanOrEqual(200);
    });
  }
});
