/**
 * 1.1-Z2 pozycja 1 — `POST /api/management-reports/generate` z
 * `reportType: 'PORTFOLIO_HEALTH'` zwracał 500 DATABASE_ERROR na REALNEJ
 * bazie Postgres (zmierzone na stanowisku lokalnym curl-em, correlationId
 * potwierdzony w logu serwera):
 *
 *   error: invalid input syntax for type integer: ""
 *   Failed SQL: SELECT ... AVG(CAST(NULLIF(progress, '') AS NUMERIC)) ...
 *               FROM tasks WHERE project_id = $1
 *
 * Przyczyna (server/src/repositories/ManagementReportRepository.ts,
 * getBasicTaskMetrics): komentarz przy tej metodzie twierdził, że
 * `tasks.progress` jest TEXT na realnym Postgresie — nieprawda. Migracje
 * `000_z_core_baseline.sql:364` i `20260801_exe002004_idempotency_keys.sql:84`
 * deklarują `progress INTEGER DEFAULT 0`, potwierdzone `\d tasks` na żywej
 * bazie (typ: integer). `NULLIF(progress, '')` porównuje kolumnę INTEGER z
 * literałem tekstowym '' — Postgres usiłuje rzutować '' na integer i pada
 * (22P02), zanim w ogóle dojdzie do zewnętrznego CAST(...AS NUMERIC).
 *
 * Naprawa: rzutuj najpierw na TEXT (`CAST(progress AS TEXT)`) — to jest
 * przenośne między silnikami (działa i na Postgresie, i na SQLite, w
 * odróżnieniu od `progress::text`, które jest składnią wyłącznie Postgresa,
 * a to repozytorium przez `getDatabase()` obsługuje oba), dopiero wtedy
 * NULLIF('') i CAST AS NUMERIC — więc puste/NULL progress nadal jest
 * wykluczane z AVG (zachowuje pierwotny zamiar komentarza), a prawdziwe
 * wartości integer przechodzą bez błędu typu.
 *
 * Ten test tworzy realny projekt + zadania (z liczbowym `progress`) w
 * REALNEJ bazie Postgres i woła prawdziwy router — bez mocków — dokładnie
 * tak samo jak `managementReports.orgScope.realdb.test.ts` (ten sam probe,
 * ten sam E2E-token bypass). Na maszynie bez Postgresa `itDB` przechodzi
 * pusto (nie psuje `npm run test:integration`).
 *
 * HOW TO RUN LOCALLY (Docker available):
 *   DATABASE_URL=postgres://postgres:noc@127.0.0.1:54400/consultify_noc \
 *     DB_TYPE=postgres NODE_ENV=test MOCK_DB=false \
 *     npx vitest run tests/integration/managementReports.portfolioHealth.progress.realdb.test.ts
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

import managementReportsRoutes from '../../server/src/routes/managementReports.routes.js';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

const PROBE_TIMEOUT_MS = 2_000;

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 5_000,
    };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 5_000,
  };
}

async function pgReachable(): Promise<boolean> {
  const config = buildClientConfig();
  if (!config) return false;
  const probe = new Client(config);
  try {
    await probe.connect();
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    try {
      await probe.end();
    } catch {
      // best-effort
    }
  }
}

async function tablesExist(client: Client, names: readonly string[]): Promise<boolean> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [names as unknown as string[]]
  );
  const found = new Set(result.rows.map((r) => r.table_name));
  return names.every((n) => found.has(n));
}

const REQUIRED_TABLES = ['management_reports', 'organizations', 'users', 'projects', 'tasks'] as const;

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'PortfolioHealth RealDB Test User',
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/management-reports', managementReportsRoutes);
  return app;
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

interface Harness {
  client: Client;
  organizationId: string;
  userId: string;
  projectId: string;
  cleanup: () => Promise<void>;
}

async function setupHarness(): Promise<Harness | null> {
  if (!(await pgReachable())) return null;
  const config = buildClientConfig();
  if (!config) return null;

  const client = new Client(config);
  try {
    await client.connect();
  } catch {
    return null;
  }

  try {
    if (!(await tablesExist(client, REQUIRED_TABLES))) {
      await client.end().catch(() => {});
      return null;
    }
  } catch {
    await client.end().catch(() => {});
    return null;
  }

  const tag = suffix();
  const organizationId = `org_ph_${tag}`;
  const userId = `user_ph_${tag}`;
  const projectId = `proj_ph_${tag}`;
  const taskIdA = `task_ph_a_${tag}`;
  const taskIdB = `task_ph_b_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'PortfolioHealth RealDB Org', 'enterprise', 'active')`,
    [organizationId]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'Owner', 'PH')`,
    [userId, organizationId, `${userId}@local.test`]
  );
  await client.query(
    `INSERT INTO projects (id, organization_id, name, status, is_closed)
     VALUES ($1, $2, 'PortfolioHealth RealDB Project', 'active', 0)`,
    [projectId, organizationId]
  );
  // Zadanie z liczbowym progress (INTEGER na realnym Postgresie — DEC skróconej
  // migracji 000_z_core_baseline.sql:364) — to właśnie ta kolumna wywalała
  // AVG(CAST(NULLIF(progress, '') AS NUMERIC)) błędem 22P02 przed naprawą.
  await client.query(
    `INSERT INTO tasks (id, project_id, organization_id, title, status, progress, due_date)
     VALUES ($1, $2, $3, 'Task with numeric progress', 'todo', 45, NULL)`,
    [taskIdA, projectId, organizationId]
  );
  // Zadanie bez progress (NULL) — musi zostać pominięte przez AVG tak jak
  // dotychczas (semantyka NULL-skipping AVG), a nie wywalić zapytania.
  await client.query(
    `INSERT INTO tasks (id, project_id, organization_id, title, status, progress, due_date)
     VALUES ($1, $2, $3, 'Task without progress', 'DONE', NULL, NULL)`,
    [taskIdB, projectId, organizationId]
  );

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM management_reports WHERE organization_id = $1`, [
        organizationId,
      ]);
      await client.query(`DELETE FROM tasks WHERE project_id = $1`, [projectId]);
      await client.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
      await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
    } finally {
      await client.end().catch(() => {});
    }
  };

  return { client, organizationId, userId, projectId, cleanup };
}

describe('1.1-Z2 #1 — PORTFOLIO_HEALTH generate nie 500-uje na integer tasks.progress (real Postgres)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — portfolio-health realdb test skipped.'
    );
  }

  beforeAll(async () => {
    harness = await setupHarness();
    if (!harness) emitSkipOnce();
  }, 30_000);

  afterAll(async () => {
    if (harness) {
      await harness.cleanup();
      harness = null;
    }
  });

  const itDB = (name: string, fn: (h: Harness) => Promise<void>, timeoutMs = 20_000) =>
    it(
      name,
      async () => {
        if (!harness) {
          expect(true).toBe(true);
          return;
        }
        await fn(harness);
      },
      timeoutMs
    );

  itDB(
    'POST /generate PORTFOLIO_HEALTH — 200 z raportem, projekt z zadaniami (progress integer + NULL) policzony',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.organizationId);

      const res = await request(app)
        .post('/api/management-reports/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ reportType: 'PORTFOLIO_HEALTH', scope: 'ORGANIZATION' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.report).toBeTruthy();
      expect(res.body.report.content.portfolioOverview.totalProjects).toBeGreaterThanOrEqual(1);
      const project = res.body.report.content.projectHealth.find(
        (p: { projectId: string }) => p.projectId === h.projectId
      );
      expect(project).toBeTruthy();
    }
  );
});
