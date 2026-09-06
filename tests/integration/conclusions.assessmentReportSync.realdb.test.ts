/**
 * 1.1-Z3 pozycja 2 — `ConclusionService.syncAssessmentReports()` był martwy
 * na Postgresie: SELECT-ował kolumny `title`/`report_type`, których
 * `assessment_reports` NIE MA (realny schemat: `name`, brak jakiejkolwiek
 * kolumny report-type — zweryfikowane `\d assessment_reports` na żywej
 * bazie). Zapytanie rzucało błąd na Postgresie, a
 * `.catch(() => [])` połykał go w ciszy — `syncAssessmentReports()` zawsze
 * zwracał 0, więc zatwierdzone raporty oceny nigdy nie trafiały do
 * `conclusions`.
 *
 * Naprawa: `server/src/services/conclusions/ConclusionService.ts` —
 * SELECT używa `name` zamiast `title`, `report_type` usunięty (nieużywany —
 * "typ raportu" niesie stała `sourceRefs[].type = 'assessment_report'`),
 * błąd zapytania jest teraz logowany (`logger.warn`) zamiast połykany w
 * ciszy.
 *
 * Ten test woła prawdziwy router (`POST /api/conclusions/sync`) na REALNEJ
 * bazie Postgres (bez mocków): zakłada organizację z jednym zatwierdzonym
 * raportem oceny (assessment_reports.status='APPROVED'), po czym dowodzi:
 *   1. Przed sync — 0 wniosków `assessment` w `conclusions`.
 *   2. POST /sync zwraca synced.assessment >= 1 i count(*) rośnie o 1.
 *   3. GET po sync widzi wniosek `assessment` wskazujący na ten raport.
 *
 * MUTACJA (dowód): przywrócenie `title`/`report_type` w SELECT (usunięty
 * realny `name`) odtwarza oryginalny defekt — zapytanie na Postgresie znów
 * rzuca, `.catch` zwraca [], `synced.assessment === 0` i test 2 jest RED.
 *
 * HOW TO RUN LOCALLY (Docker available):
 *   DATABASE_URL=postgres://postgres:noc@127.0.0.1:54400/consultify_noc \
 *     DB_TYPE=postgres NODE_ENV=test MOCK_DB=false \
 *     npx vitest run tests/integration/conclusions.assessmentReportSync.realdb.test.ts
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

import conclusionsRoutes from '../../server/src/routes/conclusions.routes.js';

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

// `conclusions` deliberately excluded — ConclusionService creates it lazily
// (CREATE TABLE IF NOT EXISTS via ensureTables()) on first use.
const REQUIRED_TABLES = ['organizations', 'users', 'assessments', 'assessment_reports'] as const;

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
    name: 'Conclusions RealDB Test User',
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
  app.use('/api/conclusions', conclusionsRoutes);
  return app;
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

interface Harness {
  client: Client;
  organizationId: string;
  userId: string;
  assessmentId: string;
  reportId: string;
  countAssessmentConclusions: () => Promise<number>;
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
  const organizationId = `org_carsync_${tag}`;
  const userId = `user_carsync_${tag}`;
  const assessmentId = `assess_carsync_${tag}`;
  const reportId = `report_carsync_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'Assessment Report Sync RealDB Org', 'enterprise', 'active')`,
    [organizationId]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'Owner', 'CARSync')`,
    [userId, organizationId, `${userId}@local.test`]
  );
  await client.query(
    `INSERT INTO assessments (id, organization_id, status, name)
     VALUES ($1, $2, 'APPROVED', 'Sync assessment fixture')`,
    [assessmentId, organizationId]
  );
  // Dokładnie ten kształt danych (assessment_reports.name + brak report_type),
  // który na Postgresie wywalał SELECT w syncAssessmentReports().
  await client.query(
    `INSERT INTO assessment_reports
       (id, assessment_id, organization_id, name, status, executive_summary, recommendations, created_by)
     VALUES ($1, $2, $3, 'Sync report fixture — assessment_reports.name', 'APPROVED',
             'Executive summary z realnego schematu.', $4, $5)`,
    [
      reportId,
      assessmentId,
      organizationId,
      JSON.stringify(['Rekomendacja z raportu oceny — dowod syncAssessmentReports().']),
      userId,
    ]
  );

  const countAssessmentConclusions = async (): Promise<number> => {
    const exists = await tablesExist(client, ['conclusions']);
    if (!exists) return 0;
    const result = await client.query<{ count: string }>(
      `SELECT count(*)::int AS count FROM conclusions
        WHERE organization_id = $1 AND source_module = 'assessment'`,
      [organizationId]
    );
    return Number(result.rows[0]?.count ?? 0);
  };

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM conclusions WHERE organization_id = $1`, [organizationId]);
      await client.query(`DELETE FROM assessment_reports WHERE id = $1`, [reportId]);
      await client.query(`DELETE FROM assessments WHERE id = $1`, [assessmentId]);
      await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
    } finally {
      await client.end().catch(() => {});
    }
  };

  return { client, organizationId, userId, assessmentId, reportId, countAssessmentConclusions, cleanup };
}

describe('1.1-Z3 #2 — syncAssessmentReports() na realnym schemacie Postgresa (real Postgres)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — assessment report sync realdb test skipped.'
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
    'POST /sync zamienia zatwierdzony raport oceny w Conclusion (assessment); GET po sync go widzi',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.organizationId);

      const before = await h.countAssessmentConclusions();
      expect(before).toBe(0);

      const sync = await request(app)
        .post('/api/conclusions/sync')
        .set('Authorization', `Bearer ${token}`);
      expect(sync.status).toBe(200);
      expect(sync.body.synced.assessment).toBeGreaterThanOrEqual(1);

      const afterSync = await h.countAssessmentConclusions();
      expect(afterSync).toBe(before + 1);

      const get = await request(app).get('/api/conclusions').set('Authorization', `Bearer ${token}`);
      expect(get.status).toBe(200);
      const assessmentConclusion = get.body.conclusions.find(
        (c: { sourceModule: string; sourceArtifactRefs: Array<{ id: string }> }) =>
          c.sourceModule === 'assessment' &&
          c.sourceArtifactRefs.some((ref) => ref.id === h.reportId)
      );
      expect(assessmentConclusion).toBeTruthy();
      expect(assessmentConclusion.title).toContain('Sync report fixture');

      // 1.1-Z4 #1: `assessment_reports.status` na żywej bazie jest UPPERCASE
      // (`APPROVED`, nie `approved`). `row.status === 'approved'` w
      // syncAssessmentReports() nigdy nie było prawdziwe, więc zatwierdzony
      // raport zawsze produkował wniosek `low`/`needs_review` zamiast
      // `medium`/`published`. Fikstura wyżej wstawia `status = 'APPROVED'`
      // (uppercase, realny kształt) — dowód celuje właśnie w porównanie
      // wielkości liter, nie w sam fakt powstania wniosku.
      expect(assessmentConclusion.confidenceLevel).toBe('medium');
      expect(assessmentConclusion.status).toBe('published');
    }
  );
});
