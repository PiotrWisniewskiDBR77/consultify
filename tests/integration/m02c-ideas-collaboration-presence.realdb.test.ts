/**
 * M02-C — Ideas collaboration presence, against a REAL Postgres database
 * (no mocks), through the REAL Express router
 * (`server/src/routes/realtime-platform.routes.ts`) and the REAL `verifyToken`
 * middleware.
 *
 * WHAT THIS GUARDS
 * `tool_sessions` / `tool_session_presence` used to have exactly one producer
 * in the active migration set (`20260719_baseline_gap.sql`), which aborts on a
 * fresh database. The result was that on any brand-new environment every
 * `/api/realtime-v4/tool-sessions/:id/{presence,heartbeat,disconnect}` call
 * returned HTTP 500 (`relation "tool_session_presence" does not exist`) —
 * invisible on demo, where the tables pre-date the failure.
 * `server/migrations/942_ideas_collaboration_tool_sessions.sql` is now the
 * deterministic producer; this file proves the runtime consequence.
 *
 * HOW TO RUN LOCALLY:
 *   docker run -d --name consultify-m02c-pg -e POSTGRES_USER=iris \
 *     -e POSTGRES_PASSWORD=iris_test -e POSTGRES_DB=iris_test -p 54820:5432 \
 *     pgvector/pgvector:pg15
 *   NODE_ENV=test DATABASE_URL=postgres://iris:iris_test@localhost:54820/iris_test \
 *     npm run db:migrate
 *   NODE_ENV=test DATABASE_URL=postgres://iris:iris_test@localhost:54820/iris_test \
 *     npx vitest run tests/integration/m02c-ideas-collaboration-presence.realdb.test.ts
 *
 * SKIP POLICY (deliberately stricter than the older realdb files):
 * a "clean skip" that still reports green is how a suite ends up proving
 * nothing. Here, if a database is CONFIGURED but unreachable, the suite FAILS.
 * It only skips when no database is configured at all, and then it says so on
 * stderr. Never run this file as evidence without a live Postgres.
 */

import { randomBytes } from 'node:crypto';

import express, { type Express } from 'express';
import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Force the real Postgres target + E2E auth bypass BEFORE importing the router.
// These are set here, in the file, on purpose: the sibling suites under
// `tests/acceptance/` rely on the caller exporting them, and when the caller
// forgets, they silently hit the mock DB and fail with assertions that look
// like product defects. Self-configuring removes that whole class of noise.
// ---------------------------------------------------------------------------
if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
  process.env.POSTGRES_SKIP_INIT_IN_TEST = 'false';
}

const { default: realtimePlatformRoutes } = await import(
  '../../server/src/routes/realtime-platform.routes.js'
);

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
      statement_timeout: 30_000,
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
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

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
      /* best effort */
    }
  }
}

function base64UrlEncode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8')
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
    name: 'M02-C collaboration test user',
    // Explicit on every call site — never rely on the E2E bypass default.
    role: 'USER',
    userRole: 'USER',
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/realtime-v4', realtimePlatformRoutes);
  return app;
}

function tag(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

const PREFIX = 'm02c-collab-';
const createdSessionIds: string[] = [];

describe('M02-C — Ideas collaboration presence (real Postgres, real router)', () => {
  let reachable = false;
  let app: Express;

  beforeAll(async () => {
    reachable = await pgReachable();
    if (!reachable && DB_CONFIGURED) {
      throw new Error(
        'A database is configured (DATABASE_URL/PGHOST/DB_HOST) but is not reachable. ' +
          'Refusing to report a green run without exercising it.'
      );
    }
    if (!reachable) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — M02-C collaboration presence tests did NOT run. ' +
          'This run is not evidence.'
      );
    }
    app = buildApp();
  }, 30_000);

  afterAll(async () => {
    if (!reachable || createdSessionIds.length === 0) return;
    const config = buildClientConfig();
    if (!config) return;
    const client = new Client(config);
    await client.connect();
    try {
      await client.query('DELETE FROM tool_session_presence WHERE tool_session_id = ANY($1::text[])', [
        createdSessionIds,
      ]);
    } finally {
      await client.end();
    }
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 120_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB(
    'connect -> list -> heartbeat -> disconnect: every step is 2xx, never 500, and the row lifecycle is real',
    async () => {
      const t = tag();
      const orgId = `${PREFIX}org-${t}`;
      const userId = `${PREFIX}user-${t}`;
      const toolSessionId = `${PREFIX}whiteboard-${t}`;
      createdSessionIds.push(toolSessionId);
      const token = makeE2EToken(userId, orgId);

      // 1. connect
      const connect = await request(app)
        .post(`/api/realtime-v4/tool-sessions/${toolSessionId}/presence`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userName: 'M02C Probe', userColor: '#3366ff', cursorState: { x: 1, y: 2 } });
      expect(connect.status).toBe(201);

      // 2. list — the connected user is visible to their own tenant
      const list = await request(app)
        .get(`/api/realtime-v4/tool-sessions/${toolSessionId}/presence`)
        .set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(200);
      const presence = list.body?.presence;
      expect(Array.isArray(presence)).toBe(true);
      expect(presence.some((p: { userId?: string; user_id?: string }) => (p.userId || p.user_id) === userId)).toBe(true);

      // 3. heartbeat
      const heartbeat = await request(app)
        .post(`/api/realtime-v4/tool-sessions/${toolSessionId}/heartbeat`)
        .set('Authorization', `Bearer ${token}`)
        .send({ cursorState: { x: 9, y: 9 } });
      expect(heartbeat.status).toBe(200);

      // 4. disconnect
      const disconnect = await request(app)
        .post(`/api/realtime-v4/tool-sessions/${toolSessionId}/disconnect`)
        .set('Authorization', `Bearer ${token}`);
      expect(disconnect.status).toBe(200);

      // 5. after disconnect the user is no longer listed as present
      const listAfter = await request(app)
        .get(`/api/realtime-v4/tool-sessions/${toolSessionId}/presence`)
        .set('Authorization', `Bearer ${token}`);
      expect(listAfter.status).toBe(200);
      expect(
        (listAfter.body?.presence || []).some(
          (p: { userId?: string; user_id?: string }) => (p.userId || p.user_id) === userId
        )
      ).toBe(false);

      // Nothing in this lifecycle may be a server fault.
      for (const res of [connect, list, heartbeat, disconnect, listAfter]) {
        expect(res.status).toBeLessThan(500);
      }
    }
  );

  itDB('a foreign tenant never sees presence written by another organization', async () => {
    const t = tag();
    const orgA = `${PREFIX}orgA-${t}`;
    const orgB = `${PREFIX}orgB-${t}`;
    const userA = `${PREFIX}userA-${t}`;
    const userB = `${PREFIX}userB-${t}`;
    // Same tool session id on purpose: isolation must come from the tenant,
    // not from the id being unguessable.
    const toolSessionId = `${PREFIX}shared-${t}`;
    createdSessionIds.push(toolSessionId);

    const tokenA = makeE2EToken(userA, orgA);
    const tokenB = makeE2EToken(userB, orgB);

    const connectA = await request(app)
      .post(`/api/realtime-v4/tool-sessions/${toolSessionId}/presence`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ userName: 'Tenant A' });
    expect(connectA.status).toBe(201);

    const listB = await request(app)
      .get(`/api/realtime-v4/tool-sessions/${toolSessionId}/presence`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(listB.status).toBe(200);
    expect(
      (listB.body?.presence || []).some(
        (p: { userId?: string; user_id?: string }) => (p.userId || p.user_id) === userA
      )
    ).toBe(false);

    // Tenant A still sees its own row — proves the empty result for B is
    // isolation, not a broken read.
    const listA = await request(app)
      .get(`/api/realtime-v4/tool-sessions/${toolSessionId}/presence`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(listA.status).toBe(200);
    expect(
      (listA.body?.presence || []).some(
        (p: { userId?: string; user_id?: string }) => (p.userId || p.user_id) === userA
      )
    ).toBe(true);

    // Tenant B's heartbeat/disconnect against A's session must not touch A.
    const heartbeatB = await request(app)
      .post(`/api/realtime-v4/tool-sessions/${toolSessionId}/heartbeat`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({});
    expect(heartbeatB.status).toBeLessThan(500);

    const disconnectB = await request(app)
      .post(`/api/realtime-v4/tool-sessions/${toolSessionId}/disconnect`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(disconnectB.status).toBeLessThan(500);

    const listAAfter = await request(app)
      .get(`/api/realtime-v4/tool-sessions/${toolSessionId}/presence`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(
      (listAAfter.body?.presence || []).some(
        (p: { userId?: string; user_id?: string }) => (p.userId || p.user_id) === userA
      )
    ).toBe(true);
  });

  itDB('repeated connects from the same user do not multiply presence rows', async () => {
    const t = tag();
    const orgId = `${PREFIX}org-idem-${t}`;
    const userId = `${PREFIX}user-idem-${t}`;
    const toolSessionId = `${PREFIX}idem-${t}`;
    createdSessionIds.push(toolSessionId);
    const token = makeE2EToken(userId, orgId);

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app)
        .post(`/api/realtime-v4/tool-sessions/${toolSessionId}/presence`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userName: `M02C Probe ${i}` });
      expect(res.status).toBe(201);
    }

    const config = buildClientConfig();
    const client = new Client(config as ClientConfig);
    await client.connect();
    try {
      const { rows } = await client.query(
        'SELECT COUNT(*)::int AS n FROM tool_session_presence WHERE organization_id = $1 AND tool_session_id = $2 AND user_id = $3',
        [orgId, toolSessionId, userId]
      );
      expect(rows[0].n).toBe(1);
    } finally {
      await client.end();
    }
  });
});
