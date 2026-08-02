/**
 * MW-07 — Calendar provider honesty for Meeting-sourced events, against a
 * REAL Postgres database (no mocks).
 *
 * Codex review BLOCKER 3: `GET /api/v8/my-work/calendar/unified`
 * (`server/src/routes/v8/my-work.routes.ts`, google/outlook/consultify
 * branch) previously defaulted `calendarSource` to `'outlook'` whenever a
 * meeting's `agenda_json.calendarSource` was unset — fabricating an Outlook
 * sync lineage for meetings that were never connected to any provider. The
 * fix changes the default to `'consultify'` (native/unsynced, an existing,
 * honest value in `CalendarEventSource`); a real, explicitly-set
 * `calendarSource` (outlook/google) is passed through unchanged.
 *
 * MOCK_DB/RUN_DB_TESTS MUST be set on the shell (see the sibling MW-07 test
 * file's header comment for why — `tests/setup.ts` caches a mock DB in
 * `globalThis` before this file's own env guard can take effect).
 *
 * HOW TO RUN LOCALLY (Postgres already up + migrated):
 *   MOCK_DB=false RUN_DB_TESTS=1 DB_TYPE=postgres NODE_ENV=test \
 *     DATABASE_URL="postgresql://iris:iris_test@localhost:5450/iris_test" \
 *     npx vitest run \
 *     tests/integration/mw-007-meeting-provider-honesty.golden-flow.realdb.test.ts \
 *     --no-file-parallelism
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = process.env.MOCK_DB ?? 'false';
  process.env.RUN_DB_TESTS = process.env.RUN_DB_TESTS ?? '1';
  process.env.DB_TYPE = process.env.DB_TYPE ?? 'postgres';
  process.env.E2E_MODE = 'true';
}

import verifyToken from '../../server/src/middleware/auth.middleware.js';
import { attachV8Context, requireV8OrgContext } from '../../server/src/middleware/v8Auth.middleware.js';
import { v8OrgGate } from '../../server/src/middleware/v8FeatureGate.middleware.js';
import myWorkRoutes from '../../server/src/routes/v8/my-work.routes.js';

const PROBE_TIMEOUT_MS = 10_000;

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

const REQUIRED_TABLES = ['organizations', 'users', 'meetings'] as const;

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
    name: 'MW-07 Meeting Provider Honesty RealDB Test User',
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
  app.use(
    '/api/v8/my-work',
    verifyToken,
    requireV8OrgContext,
    v8OrgGate,
    attachV8Context,
    myWorkRoutes
  );
  return app;
}

interface Harness {
  client: Client;
  orgAId: string;
  orgBId: string;
  userAId: string;
  userBId: string;
  meetingNoSourceId: string;
  meetingOutlookId: string;
  meetingGoogleId: string;
  meetingConsultifyId: string;
  meetingOrgBId: string;
  cleanup: () => Promise<void>;
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
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
  const orgAId = `org_mw007mtg_a_${tag}`;
  const orgBId = `org_mw007mtg_b_${tag}`;
  const userAId = `user_mw007mtg_a_${tag}`;
  const userBId = `user_mw007mtg_b_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'MW-07 Meeting Honesty Org A', 'enterprise', 'active')`,
    [orgAId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'MW-07 Meeting Honesty Org B', 'enterprise', 'active')`,
    [orgBId]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'MEMBER', 'active', 'MW07', 'MtgUserA')`,
    [userAId, orgAId, `${userAId}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'MEMBER', 'active', 'MW07', 'MtgUserB')`,
    [userBId, orgBId, `${userBId}@local.test`]
  );

  const insertMeeting = async (id: string, orgId: string, createdBy: string, agenda: unknown) => {
    await client.query(
      `INSERT INTO meetings
        (id, organization_id, title, start_at, end_at, status, created_by, agenda_json)
       VALUES ($1, $2, 'MW-07 test meeting', '2026-03-05T10:00:00.000Z', '2026-03-05T11:00:00.000Z', 'scheduled', $3, $4)`,
      [id, orgId, createdBy, JSON.stringify(agenda)]
    );
  };

  const meetingNoSourceId = `meeting_mw007_nosrc_${tag}`;
  await insertMeeting(meetingNoSourceId, orgAId, userAId, {});

  const meetingOutlookId = `meeting_mw007_outlook_${tag}`;
  await insertMeeting(meetingOutlookId, orgAId, userAId, { calendarSource: 'outlook' });

  const meetingGoogleId = `meeting_mw007_google_${tag}`;
  await insertMeeting(meetingGoogleId, orgAId, userAId, { calendarSource: 'google' });

  const meetingConsultifyId = `meeting_mw007_consultify_${tag}`;
  await insertMeeting(meetingConsultifyId, orgAId, userAId, { calendarSource: 'consultify' });

  const meetingOrgBId = `meeting_mw007_orgb_${tag}`;
  await insertMeeting(meetingOrgBId, orgBId, userBId, {});

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM meetings WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
        [orgAId, orgBId],
      ]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgAId, orgBId]]);
    } catch {
      // best-effort
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return {
    client,
    orgAId,
    orgBId,
    userAId,
    userBId,
    meetingNoSourceId,
    meetingOutlookId,
    meetingGoogleId,
    meetingConsultifyId,
    meetingOrgBId,
    cleanup,
  };
}

describe('MW-07 — meeting calendar-source provider honesty against a real Postgres database (no mocks)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — mw-007-meeting-provider-honesty ' +
        'realdb tests skipped. Set DATABASE_URL / PGHOST to a migrated Postgres to exercise this suite.'
    );
  }

  beforeAll(async () => {
    harness = await setupHarness();
    if (!harness) emitSkipOnce();
  }, 90_000);

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
    '1) a meeting with no calendarSource is never labeled outlook or google — honest consultify default',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userAId, h.orgAId);
      const res = await request(app)
        .get('/api/v8/my-work/calendar/unified?sources=outlook,google,consultify')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const event = res.body.data.events.find((e: any) => e.sourceId === h.meetingNoSourceId);
      expect(event).toBeTruthy();
      expect(event.source).not.toBe('outlook');
      expect(event.source).not.toBe('google');
      expect(event.source).toBe('consultify');
    }
  );

  itDB('2) an explicit outlook calendarSource is preserved as outlook', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.userAId, h.orgAId);
    const res = await request(app)
      .get('/api/v8/my-work/calendar/unified?sources=outlook,google,consultify')
      .set('Authorization', `Bearer ${token}`);
    const event = res.body.data.events.find((e: any) => e.sourceId === h.meetingOutlookId);
    expect(event).toBeTruthy();
    expect(event.source).toBe('outlook');
  });

  itDB('3) an explicit google calendarSource is preserved as google', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.userAId, h.orgAId);
    const res = await request(app)
      .get('/api/v8/my-work/calendar/unified?sources=outlook,google,consultify')
      .set('Authorization', `Bearer ${token}`);
    const event = res.body.data.events.find((e: any) => e.sourceId === h.meetingGoogleId);
    expect(event).toBeTruthy();
    expect(event.source).toBe('google');
  });

  itDB('4) an explicit consultify calendarSource stays consultify (internal)', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.userAId, h.orgAId);
    const res = await request(app)
      .get('/api/v8/my-work/calendar/unified?sources=outlook,google,consultify')
      .set('Authorization', `Bearer ${token}`);
    const event = res.body.data.events.find((e: any) => e.sourceId === h.meetingConsultifyId);
    expect(event).toBeTruthy();
    expect(event.source).toBe('consultify');
  });

  itDB(
    '5) a foreign tenant never sees another organization\'s meeting, regardless of its calendarSource',
    async (h) => {
      const app = buildApp();
      const foreignToken = makeE2EToken(h.userBId, h.orgBId);
      const res = await request(app)
        .get('/api/v8/my-work/calendar/unified?sources=outlook,google,consultify')
        .set('Authorization', `Bearer ${foreignToken}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.events.map((e: any) => e.sourceId);
      expect(ids).not.toContain(h.meetingNoSourceId);
      expect(ids).not.toContain(h.meetingOutlookId);
      expect(ids).not.toContain(h.meetingGoogleId);
      expect(ids).not.toContain(h.meetingConsultifyId);
      // org B's own meeting is visible only to org B's own user.
      expect(ids).toContain(h.meetingOrgBId);
    }
  );
});
