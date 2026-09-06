/**
 * 1.1-Z2 pozycja 3 — `GET /api/conclusions` synchronizował CAŁĄ organizację
 * (interview findings + assessment reports + tool outputs) na KAŻDY odczyt.
 * Zmierzone na żywo (stanowisko lokalne, konto audyt@dbr77.local): samo
 * otwarcie zakładki Conclusions dopisało 4 wnioski `tools` do bazy — odczyt
 * pisał dane innego modułu.
 *
 * DECYZJA CTO: odczyt nie może pisać. Naprawa:
 *   - `server/src/services/conclusions/ConclusionService.ts` —
 *     `listConclusions()` i `getConclusion()` już nie wołają
 *     `syncAllSources()`, tylko `ensureTables()` (idempotentny DDL, nie
 *     zapis danych organizacji).
 *   - `server/src/routes/conclusions.routes.ts` — nowy
 *     `POST /api/conclusions/sync` (ten sam strażnik uprawnień co
 *     dotychczasowy zapis, `getAuthContext`) niesie synchronizację, którą
 *     dawniej robił GET po cichu.
 *
 * Ten test woła prawdziwy router na REALNEJ bazie Postgres (bez mocków):
 * zakłada organizację z jedną zatwierdzoną sesją narzędzia (dokładnie ten
 * kształt danych, który w realnym incydencie zmaterializował się jako
 * wniosek `tools` przy zwykłym GET), po czym dowodzi:
 *   1. GET nie zmienia count(*) w `conclusions` (może być wywołany
 *      wielokrotnie — zero przyrostu).
 *   2. POST /sync faktycznie synchronizuje (count(*) rośnie o 1).
 *   3. GET po synchronizacji widzi zsynchronizowany wniosek, ale go nie
 *      duplikuje przy kolejnych wywołaniach.
 *
 * HOW TO RUN LOCALLY (Docker available):
 *   DATABASE_URL=postgres://postgres:noc@127.0.0.1:54400/consultify_noc \
 *     DB_TYPE=postgres NODE_ENV=test MOCK_DB=false \
 *     npx vitest run tests/integration/conclusions.getDoesNotWrite.realdb.test.ts
 */

import { randomBytes, randomUUID } from 'node:crypto';

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
// (CREATE TABLE IF NOT EXISTS via ensureTables()) on first use, so it need
// not pre-exist for this test to be meaningful.
const REQUIRED_TABLES = ['organizations', 'users', 'tool_sessions'] as const;

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
  toolSessionId: string;
  countConclusions: () => Promise<number>;
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
  const organizationId = `org_cl_${tag}`;
  const userId = `user_cl_${tag}`;
  const toolSessionId = `tool_cl_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'Conclusions RealDB Org', 'enterprise', 'active')`,
    [organizationId]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'Owner', 'CL')`,
    [userId, organizationId, `${userId}@local.test`]
  );
  // Dokładnie ten kształt danych, który w realnym incydencie
  // zmaterializował się jako wniosek `tools` przy zwykłym GET.
  await client.query(
    `INSERT INTO tool_sessions
       (id, organization_id, tool_type, name, status, answers_json, context_snapshot, created_by)
     VALUES ($1, $2, 'raid', 'GET nie moze pisac — narzedzie', 'APPROVED', $3, $4, $5)`,
    [
      toolSessionId,
      organizationId,
      JSON.stringify({ summary: { executiveSummary: 'GET nie może pisać do bazy.' } }),
      'Conclusions RealDB context',
      userId,
    ]
  );

  const countConclusions = async (): Promise<number> => {
    const exists = await tablesExist(client, ['conclusions']);
    if (!exists) return 0;
    const result = await client.query<{ count: string }>(
      `SELECT count(*)::int AS count FROM conclusions WHERE organization_id = $1`,
      [organizationId]
    );
    return Number(result.rows[0]?.count ?? 0);
  };

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM conclusions WHERE organization_id = $1`, [organizationId]);
      await client.query(`DELETE FROM tool_sessions WHERE id = $1`, [toolSessionId]);
      await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
    } finally {
      await client.end().catch(() => {});
    }
  };

  return { client, organizationId, userId, toolSessionId, countConclusions, cleanup };
}

describe('1.1-Z2 #3 — GET /api/conclusions nie zapisuje, tylko POST /sync (real Postgres)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — conclusions GET-does-not-write realdb test skipped.'
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
    'GET (nawet wielokrotny) nie zmienia count(*) w conclusions; POST /sync zmienia; GET po sync nie duplikuje',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.organizationId);

      const before = await h.countConclusions();
      expect(before).toBe(0);

      const get1 = await request(app).get('/api/conclusions').set('Authorization', `Bearer ${token}`);
      expect(get1.status).toBe(200);
      expect(await h.countConclusions()).toBe(before);

      const get2 = await request(app).get('/api/conclusions').set('Authorization', `Bearer ${token}`);
      expect(get2.status).toBe(200);
      expect(await h.countConclusions()).toBe(before);
      // Odczyt naprawdę czysty: żaden z dwóch GET-ów nie wprowadził wniosku
      // `tools` z sesji narzędzia założonej w fixture.
      expect(get2.body.conclusions.some((c: { sourceModule: string }) => c.sourceModule === 'tools')).toBe(
        false
      );

      const sync = await request(app)
        .post('/api/conclusions/sync')
        .set('Authorization', `Bearer ${token}`);
      expect(sync.status).toBe(200);
      expect(sync.body.synced.tools).toBeGreaterThanOrEqual(1);
      const afterSync = await h.countConclusions();
      expect(afterSync).toBe(before + 1);

      const get3 = await request(app).get('/api/conclusions').set('Authorization', `Bearer ${token}`);
      expect(get3.status).toBe(200);
      const toolConclusion = get3.body.conclusions.find(
        (c: { sourceModule: string; sourceArtifactRefs: Array<{ id: string }> }) =>
          c.sourceModule === 'tools' && c.sourceArtifactRefs.some((ref) => ref.id === h.toolSessionId)
      );
      expect(toolConclusion).toBeTruthy();
      // GET po sync nadal nie pisze — count się nie rusza.
      expect(await h.countConclusions()).toBe(afterSync);

      const get4 = await request(app).get('/api/conclusions').set('Authorization', `Bearer ${token}`);
      expect(get4.status).toBe(200);
      expect(await h.countConclusions()).toBe(afterSync);
    }
  );
});
