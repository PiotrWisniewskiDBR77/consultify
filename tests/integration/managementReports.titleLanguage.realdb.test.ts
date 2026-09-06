/**
 * 1.1-Z2 pozycja 2 — tytuły raportów zarządczych (`Portfolio Health Report`,
 * `Portfolio RAID Report` itd.) były zawsze po angielsku, niezależnie od
 * języka użytkownika/organizacji — `managementReportsService.ts` nigdy nie
 * sięgał do SSOT językowego serwera (`services/ai/languagePolicy.ts`), z
 * którego korzysta reszta tras w `ai.routes.ts`.
 *
 * Naprawa:
 *   - `server/src/routes/managementReports.routes.ts` — `POST /generate`
 *     rozstrzyga teraz `language` przez `resolveAiLanguageFromRequest(req,
 *     body.language)` (ten sam wzorzec co np. `/refine-text` w
 *     `ai.routes.ts`) i przekazuje wynik do `generateReport({ ...,
 *     language })`.
 *   - `server/src/services/managementReportsService.ts` — cztery miejsca
 *     budujące `title` (TEAM_MEETING/TEAM_WEEKLY, STEERING_COMMITTEE,
 *     PORTFOLIO_HEALTH, RAID) czytają teraz `options.language` przez nowe
 *     helpery `teamMeetingReportTitle`/`steeringCommitteeReportTitle`/
 *     `portfolioHealthReportTitle`/`raidReportTitle`. `RAID` i `Steering
 *     Committee` zostają nieprzetłumaczone celowo — tak samo jak w reszcie
 *     polskiego UI (public/locales/pl/translation.json).
 *
 * Ten test woła prawdziwy router na REALNEJ bazie Postgres (bez mocków) —
 * ten sam harness/probe co `managementReports.orgScope.realdb.test.ts` — i
 * sprawdza tytuł dla PORTFOLIO_HEALTH i RAID w `pl` oraz `en`. Kształt
 * odpowiedzi API (`{ success, report }`) pozostaje niezmieniony — sprawdzane
 * tu tylko `report.title`.
 *
 * HOW TO RUN LOCALLY (Docker available):
 *   DATABASE_URL=postgres://postgres:noc@127.0.0.1:54400/consultify_noc \
 *     DB_TYPE=postgres NODE_ENV=test MOCK_DB=false \
 *     npx vitest run tests/integration/managementReports.titleLanguage.realdb.test.ts
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

const REQUIRED_TABLES = ['management_reports', 'organizations', 'users', 'projects'] as const;

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
    name: 'TitleLanguage RealDB Test User',
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
  const organizationId = `org_tl_${tag}`;
  const userId = `user_tl_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'TitleLanguage RealDB Org', 'enterprise', 'active')`,
    [organizationId]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'Owner', 'TL')`,
    [userId, organizationId, `${userId}@local.test`]
  );

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM management_reports WHERE organization_id = $1`, [
        organizationId,
      ]);
      await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
    } finally {
      await client.end().catch(() => {});
    }
  };

  return { client, organizationId, userId, cleanup };
}

describe('1.1-Z2 #2 — tytuł raportu podąża za językiem żądania (real Postgres)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — title-language realdb test skipped.'
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

  itDB('PORTFOLIO_HEALTH — language: pl → "Raport kondycji portfela"', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.userId, h.organizationId);
    const res = await request(app)
      .post('/api/management-reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ reportType: 'PORTFOLIO_HEALTH', scope: 'ORGANIZATION', language: 'pl' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.report.title).toBe('Raport kondycji portfela');
  });

  itDB('PORTFOLIO_HEALTH — language: en → "Portfolio Health Report"', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.userId, h.organizationId);
    const res = await request(app)
      .post('/api/management-reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ reportType: 'PORTFOLIO_HEALTH', scope: 'ORGANIZATION', language: 'en' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.report.title).toBe('Portfolio Health Report');
  });

  itDB('RAID — language: pl, brak projectId (portfel) → "Raport RAID — portfel"', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.userId, h.organizationId);
    const res = await request(app)
      .post('/api/management-reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ reportType: 'RAID', scope: 'PORTFOLIO', language: 'pl' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.report.title).toBe('Raport RAID — portfel');
  });

  itDB('RAID — language: en, brak projectId (portfolio) → "Portfolio RAID Report"', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.userId, h.organizationId);
    const res = await request(app)
      .post('/api/management-reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ reportType: 'RAID', scope: 'PORTFOLIO', language: 'en' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.report.title).toBe('Portfolio RAID Report');
  });

  itDB(
    'PORTFOLIO_HEALTH — brak language w body/nagłówkach → domyślnie polski (SSOT: DEFAULT_AI_LANGUAGE = pl)',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.organizationId);
      const res = await request(app)
        .post('/api/management-reports/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ reportType: 'PORTFOLIO_HEALTH', scope: 'ORGANIZATION' });

      expect(res.status).toBe(200);
      expect(res.body.report.title).toBe('Raport kondycji portfela');
    }
  );
});
