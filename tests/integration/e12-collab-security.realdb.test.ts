/**
 * E12 (collaboration, security, resilience) — SERVER-SIDE enforcement proof
 * against a REAL Postgres database (no mocks), through the REAL Express
 * routers (`server/src/routes/my-work.routes.ts` and
 * `server/src/routes/realtime-platform.routes.ts`) and the REAL `verifyToken`
 * middleware.
 *
 * Mirrors the harness pattern in tests/integration/m02-p08-ideas-hub-golden-flow.realdb.test.ts
 * (itself modeled on tests/integration/table-platform.idor.realdb.test.ts): REAL router +
 * REAL auth (E2E_MODE unsigned-JWT bypass) + a `pgReachable()` precondition that reports a
 * clean, non-failing skip when no Postgres is configured. Run mode for this file: with
 * DATABASE_URL/PGHOST set AND NODE_ENV=test AND RUN_DB_TESTS=1 AND MOCK_DB=false, every
 * assertion below runs against a REAL Postgres row — not the silent DB mock that
 * NODE_ENV=test alone would produce.
 *
 * Scope (§10.4 DoD — see docs/qa/ideas-manual-audit-2026-08-09/09_IDEAS_COMPLETE_TRANSFORMATION_PROGRAM_FOR_CLAUDE.md
 * §10.4 + 11_IDEAS_EPICS_DOD_AND_FINAL_ACCEPTANCE_PROTOCOL.md epic E12):
 *
 *  1. Idea confidentiality gate — a 'restricted' Idea's content must never reach an LLM
 *     prompt or leave as an export file. Covers the 4 AI endpoints that had NO gate before
 *     this same change (my-ideas/:id/ai-generate, ai-suggestions, ai-table-action, ai-fill)
 *     plus the CSV export endpoint (also previously ungated), and the 3 endpoints that were
 *     ALREADY gated by an earlier wave (map/expand, map/ai-suggestions, map/gap-analysis) as
 *     a regression check. A 'standard' idea is used as a same-request negative control so a
 *     false-positive block can't hide as a "pass".
 *
 *  2. Facilitation "workshop role" control — changing the phase, driving the timer, or
 *     ending a shared facilitation session are facilitator-only privileges
 *     (server/src/routes/realtime-platform.routes.ts `ensureFacilitatorControl`). A same-org
 *     colleague who is NOT the session's facilitator/owner/org-admin must be rejected with
 *     403, not merely hidden by the UI.
 *
 * Requires (this file is skipped, not failed, without it):
 *   - DATABASE_URL (or PGHOST) pointing at a real, LOCAL-ONLY scratch Postgres
 *   - server/migrations/20260810_idea_confidentiality.sql applied (adds
 *     my_ideas.confidentiality) — this suite's own beforeAll probes for the column and
 *     skips (not fails) if it is absent, exactly like the golden-flow suite does for its
 *     required tables.
 *
 * HOW TO RUN LOCALLY (mirrors the M02-P08 file header):
 *   docker run -d --name e12-scratch-pg -e POSTGRES_USER=e12_scratch \
 *     -e POSTGRES_PASSWORD=e12_scratch -e POSTGRES_DB=e12_scratch -p 55910:5432 \
 *     pgvector/pgvector:pg16
 *   DATABASE_URL=postgres://e12_scratch:e12_scratch@localhost:55910/e12_scratch \
 *     node tests/acceptance/schema.mjs   # loads full schema (some unrelated misses are fine)
 *   DATABASE_URL=postgres://e12_scratch:e12_scratch@localhost:55910/e12_scratch \
 *     node -e "require('pg') ... apply server/migrations/20260810_idea_confidentiality.sql"
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false E2E_MODE=true \
 *     DATABASE_URL=postgres://e12_scratch:e12_scratch@localhost:55910/e12_scratch \
 *     npx vitest run tests/integration/e12-collab-security.realdb.test.ts --retry=0
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

const { default: myWorkRoutes } = await import('../../server/src/routes/my-work.routes.js');
const { default: realtimePlatformRoutes } = await import(
  '../../server/src/routes/realtime-platform.routes.js'
);

// ---------------------------------------------------------------------------
// Connection probe (same contract as m02-p08-ideas-hub-golden-flow.realdb.test.ts)
// ---------------------------------------------------------------------------

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

async function columnExists(client: Client, table: string, column: string): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, column]
  );
  return (result.rowCount ?? 0) > 0;
}

const REQUIRED_TABLES = [
  'my_ideas',
  'my_idea_maps',
  'tool_facilitation_sessions',
  'tool_facilitation_roles',
] as const;

// ---------------------------------------------------------------------------
// E2E identity minting (same shape as m02-p08-ideas-hub-golden-flow.realdb.test.ts)
// ---------------------------------------------------------------------------

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8').toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string, role = 'MEMBER'): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'E12 RealDB Test User',
    role,
    userRole: role,
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
  app.use('/api/my-work', myWorkRoutes);
  app.use('/api/realtime-v4', realtimePlatformRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Harness {
  client: Client;
  orgAId: string;
  userAId: string; // idea owner / session facilitator
  userA2Id: string; // same org, NOT owner/facilitator — the negative-control colleague
  hasConfidentialityColumn: boolean;
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

  const hasConfidentialityColumn = await columnExists(client, 'my_ideas', 'confidentiality');

  const tag = suffix();
  const orgAId = `org_e12_a_${tag}`;
  const userAId = `user_e12_a_${tag}`;
  const userA2Id = `user_e12_a2_${tag}`;

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM tool_facilitation_roles WHERE facilitation_session_id IN (SELECT id FROM tool_facilitation_sessions WHERE organization_id = $1)`, [orgAId]);
      await client.query(`DELETE FROM tool_facilitation_sessions WHERE organization_id = $1`, [orgAId]);
      await client.query(`DELETE FROM my_idea_maps WHERE organization_id = $1`, [orgAId]);
      await client.query(`DELETE FROM my_ideas WHERE organization_id = $1`, [orgAId]);
    } catch {
      // Leaking a few rows is acceptable; a hung/throwing cleanup is not.
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return { client, orgAId, userAId, userA2Id, hasConfidentialityColumn, cleanup };
}

async function createIdea(app: express.Express, token: string, title: string): Promise<string> {
  const res = await request(app)
    .post('/api/my-work/my-ideas')
    .set('Authorization', `Bearer ${token}`)
    .send({ title, body: 'seed body for E12 leak-path test', tags: ['e12'] });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

async function setConfidentiality(
  client: Client,
  ideaId: string,
  level: 'standard' | 'confidential' | 'restricted'
): Promise<void> {
  await client.query(`UPDATE my_ideas SET confidentiality = $1 WHERE id = $2`, [level, ideaId]);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('E12 — collaboration/security server-side enforcement (real Postgres, no mocks)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(reason: string): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(`[skip] ${reason} — E12 realdb tests skipped. See file header to run locally.`);
  }

  beforeAll(async () => {
    harness = await setupHarness();
    if (!harness) emitSkipOnce('Postgres not reachable (or required tables missing)');
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
        if (!harness.hasConfidentialityColumn && name.includes('[confidentiality]')) {
          emitSkipOnce('my_ideas.confidentiality column missing — migration 20260810 not applied');
          expect(true).toBe(true);
          return;
        }
        await fn(harness);
      },
      timeoutMs
    );

  // -------------------------------------------------------------------------
  // 1. Confidentiality gate — AI prompt leak paths
  // -------------------------------------------------------------------------

  itDB(
    '[confidentiality] a RESTRICTED idea is rejected by all 4 AI endpoints (ai-generate, ai-suggestions, ai-table-action, ai-fill) and CSV export — server-side, not UI-only',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userAId, h.orgAId);
      const ideaId = await createIdea(app, token, 'Restricted idea — AI leak probe');
      await setConfidentiality(h.client, ideaId, 'restricted');

      const generateRes = await request(app)
        .post(`/api/my-work/my-ideas/${ideaId}/ai-generate`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          generatorType: 'mm_expand',
          tool: 'mindmap',
          context: { seedText: 'secret seed', title: 'secret title', existingNodes: [], existingEdges: [] },
        });
      expect(generateRes.status).toBe(403);
      expect(generateRes.body?.code).toBe('IDEA_CONFIDENTIALITY_BLOCKED');

      const suggestRes = await request(app)
        .post(`/api/my-work/my-ideas/${ideaId}/ai-suggestions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ context: { title: 'secret title', seedText: 'secret seed', currentNodes: [], currentEdges: [] }, mode: 'passive' });
      expect(suggestRes.status).toBe(403);
      expect(suggestRes.body?.code).toBe('IDEA_CONFIDENTIALITY_BLOCKED');

      const tableActionRes = await request(app)
        .post(`/api/my-work/my-ideas/${ideaId}/ai-table-action`)
        .set('Authorization', `Bearer ${token}`)
        .send({ command: 'add a row', schema: [] });
      expect(tableActionRes.status).toBe(403);
      expect(tableActionRes.body?.code).toBe('IDEA_CONFIDENTIALITY_BLOCKED');

      const fillRes = await request(app)
        .post(`/api/my-work/my-ideas/${ideaId}/ai-fill`)
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'summarize', rows: [{ id: 'r1' }] });
      expect(fillRes.status).toBe(403);
      expect(fillRes.body?.code).toBe('IDEA_CONFIDENTIALITY_BLOCKED');

      const csvRes = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}/export-csv`)
        .set('Authorization', `Bearer ${token}`);
      expect(csvRes.status).toBe(403);
      expect(csvRes.body?.code).toBe('IDEA_CONFIDENTIALITY_BLOCKED');
    }
  );

  itDB(
    '[confidentiality] the ALREADY-gated map endpoints (expand, ai-suggestions, gap-analysis) still reject a RESTRICTED idea — regression guard',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userAId, h.orgAId);
      const ideaId = await createIdea(app, token, 'Restricted idea — map AI regression probe');
      await setConfidentiality(h.client, ideaId, 'restricted');

      const expandRes = await request(app)
        .post(`/api/my-work/my-ideas/${ideaId}/map/expand`)
        .set('Authorization', `Bearer ${token}`)
        .send({ count: 3 });
      expect(expandRes.status).toBe(403);
      expect(expandRes.body?.code).toBe('IDEA_CONFIDENTIALITY_BLOCKED');

      const mapSuggestRes = await request(app)
        .post(`/api/my-work/my-ideas/${ideaId}/map/ai-suggestions`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(mapSuggestRes.status).toBe(403);
      expect(mapSuggestRes.body?.code).toBe('IDEA_CONFIDENTIALITY_BLOCKED');

      const gapRes = await request(app)
        .post(`/api/my-work/my-ideas/${ideaId}/map/gap-analysis`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(gapRes.status).toBe(403);
      expect(gapRes.body?.code).toBe('IDEA_CONFIDENTIALITY_BLOCKED');
    }
  );

  itDB(
    '[confidentiality] negative control: a STANDARD idea is never blocked by the confidentiality gate (rules out a false-positive "everything 403s")',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userAId, h.orgAId);
      const ideaId = await createIdea(app, token, 'Standard idea — AI gate negative control');
      // confidentiality defaults to 'standard' — no UPDATE needed, exercises the real default.

      const csvRes = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}/export-csv`)
        .set('Authorization', `Bearer ${token}`);
      // No LLM/network involved in CSV export, so this is a clean 200/404 (idea has
      // no map row yet) rather than the AI endpoints, which may legitimately 200 with
      // {degraded:true} when no LLM provider is configured in this test env — the
      // one status this MUST NOT be is 403 IDEA_CONFIDENTIALITY_BLOCKED.
      expect(csvRes.status).not.toBe(403);

      const fillRes = await request(app)
        .post(`/api/my-work/my-ideas/${ideaId}/ai-fill`)
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'summarize', rows: [{ id: 'r1' }] });
      expect(fillRes.status).not.toBe(403);
      expect(fillRes.body?.code).not.toBe('IDEA_CONFIDENTIALITY_BLOCKED');
    }
  );

  // -------------------------------------------------------------------------
  // 1b. Confidentiality gate — the write path (RISK-22: previously nothing
  //     could ever set the column, so the gate above was provably dormant).
  // -------------------------------------------------------------------------

  itDB(
    '[confidentiality] PUT sets restricted -> GET reflects it -> AI endpoint 403s; PUT sets it back to standard -> GET reflects it -> AI endpoint no longer 403s',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userAId, h.orgAId);
      const ideaId = await createIdea(app, token, 'Confidentiality write round-trip probe');

      // Freshly created idea is 'standard' by default (both column default
      // and the pre-migration fallback path).
      const getInitial = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getInitial.status).toBe(200);
      expect(getInitial.body?.confidentiality).toBe('standard');
      expect(getInitial.body?.confidentialitySupported).toBe(true);

      // --- set to restricted via the real PUT route ---
      const putRestricted = await request(app)
        .put(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confidentiality: 'restricted' });
      expect(putRestricted.status).toBe(200);
      expect(putRestricted.body?.confidentiality).toBe('restricted');

      const getRestricted = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRestricted.status).toBe(200);
      expect(getRestricted.body?.confidentiality).toBe('restricted');

      const fillBlockedRes = await request(app)
        .post(`/api/my-work/my-ideas/${ideaId}/ai-fill`)
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'summarize', rows: [{ id: 'r1' }] });
      expect(fillBlockedRes.status).toBe(403);
      expect(fillBlockedRes.body?.code).toBe('IDEA_CONFIDENTIALITY_BLOCKED');

      // --- set back to standard via the real PUT route ---
      const putStandard = await request(app)
        .put(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confidentiality: 'standard' });
      expect(putStandard.status).toBe(200);
      expect(putStandard.body?.confidentiality).toBe('standard');

      const getStandard = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getStandard.status).toBe(200);
      expect(getStandard.body?.confidentiality).toBe('standard');

      const fillAllowedRes = await request(app)
        .post(`/api/my-work/my-ideas/${ideaId}/ai-fill`)
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'summarize', rows: [{ id: 'r1' }] });
      expect(fillAllowedRes.status).not.toBe(403);
      expect(fillAllowedRes.body?.code).not.toBe('IDEA_CONFIDENTIALITY_BLOCKED');
    }
  );

  itDB(
    '[confidentiality] PUT rejects an invalid confidentiality value with 400 and leaves the stored row unchanged',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userAId, h.orgAId);
      const ideaId = await createIdea(app, token, 'Confidentiality invalid-value probe');

      const before = await h.client.query(
        `SELECT confidentiality FROM my_ideas WHERE id = $1`,
        [ideaId]
      );
      expect(before.rows[0]?.confidentiality).toBe('standard');

      const putInvalid = await request(app)
        .put(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confidentiality: 'top-secret' });
      expect(putInvalid.status).toBe(400);
      expect(String(putInvalid.body?.error || '')).toMatch(/confidentiality/i);

      const after = await h.client.query(
        `SELECT confidentiality FROM my_ideas WHERE id = $1`,
        [ideaId]
      );
      expect(after.rows[0]?.confidentiality).toBe('standard');
    }
  );

  // -------------------------------------------------------------------------
  // 2. Facilitation "workshop role" control
  // -------------------------------------------------------------------------

  itDB(
    'facilitation control: a same-org colleague who is NOT the facilitator/owner/admin is REJECTED (403) from changing phase, driving the timer, or ending the session',
    async (h) => {
      const app = buildApp();
      const facilitatorToken = makeE2EToken(h.userAId, h.orgAId, 'MEMBER');
      const colleagueToken = makeE2EToken(h.userA2Id, h.orgAId, 'MEMBER'); // same org, plain member — NOT org admin

      const toolSessionId = `whiteboard:e12-${suffix()}`;
      const createRes = await request(app)
        .post('/api/realtime-v4/facilitation/sessions')
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({ toolSessionId });
      expect(createRes.status).toBe(201);
      const sessionId = createRes.body?.id as string;
      expect(typeof sessionId).toBe('string');

      // The colleague did not create the session and holds no 'facilitator' role in it.
      const phaseRes = await request(app)
        .put(`/api/realtime-v4/facilitation/sessions/${sessionId}/phase`)
        .set('Authorization', `Bearer ${colleagueToken}`)
        .send({ phase: 'organize' });
      expect(phaseRes.status).toBe(403);
      expect(phaseRes.body?.code).toBe('REALTIME_FACILITATION_CONTROL_FORBIDDEN');

      const timerRes = await request(app)
        .put(`/api/realtime-v4/facilitation/sessions/${sessionId}/timer`)
        .set('Authorization', `Bearer ${colleagueToken}`)
        .send({ timerState: { running: true } });
      expect(timerRes.status).toBe(403);
      expect(timerRes.body?.code).toBe('REALTIME_FACILITATION_CONTROL_FORBIDDEN');

      const endRes = await request(app)
        .post(`/api/realtime-v4/facilitation/sessions/${sessionId}/end`)
        .set('Authorization', `Bearer ${colleagueToken}`)
        .send({});
      expect(endRes.status).toBe(403);
      expect(endRes.body?.code).toBe('REALTIME_FACILITATION_CONTROL_FORBIDDEN');

      // Positive control on the SAME session: the actual facilitator succeeds where
      // the colleague was rejected — proves the 403s above are a real authz gate, not
      // a broken route.
      const facilitatorPhaseRes = await request(app)
        .put(`/api/realtime-v4/facilitation/sessions/${sessionId}/phase`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({ phase: 'organize' });
      expect(facilitatorPhaseRes.status).toBe(200);
    }
  );
});
