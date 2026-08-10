/**
 * GATE 3 — persistence evidence: save → refresh → COLD REOPEN → readback,
 * confirmed by a direct database query. Real Postgres, real Express routers
 * (server/src/routes/my-work.routes.ts + server/src/routes/ideaBusinessCase.routes.ts),
 * real `verifyToken` (E2E_MODE unsigned-JWT bypass) — no mocks.
 *
 * Harness pattern copied from tests/integration/e12-collab-security.realdb.test.ts
 * (same connection probe, same E2E token minting, same buildApp() shape).
 *
 * "Cold reopen" is made genuine by defeating the ONE module-level cache that
 * matters for data (not schema): server/src/database/Database.ts holds the
 * live pg Pool behind a `dbProxy` that re-resolves `getDatabaseInstance()` on
 * every property access, backed by `process[GLOBAL_DB_KEY]` /
 * `globalThis[GLOBAL_DB_KEY]`. Calling the exported `resetConnection()`:
 *   1. clears both global keys (so the next getDatabaseInstance() call does
 *      not find an existing instance),
 *   2. calls PostgresDatabase.close(), which does `pool.end()` (real TCP
 *      teardown of every connection in the pool) and sets the module-level
 *      `pool` variable to null.
 * The NEXT query anywhere in the process lazily does `pool = new Pool(...)`
 * — a genuinely new pg Pool with new sockets. Every "cold reopen" step below
 * calls resetConnection() AND constructs a brand-new Express app (new
 * express() + re-mounted routers) before the follow-up GET, so neither the
 * HTTP layer nor the DB layer can be serving a stale in-process object.
 * (getTableColumns' cache in server/src/utils/dbSchema.ts is schema-shape-only
 * — column names, not row data — so it is irrelevant to whether content
 * persisted; left untouched.)
 *
 * Run:
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false E2E_MODE=true \
 *   DATABASE_URL=postgres://postgres@127.0.0.1:54331/ideas_e12 \
 *   npx vitest run tests/integration/gate3-persistence-coldreopen.realdb.test.ts --retry=0
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
const { default: ideaBusinessCaseRoutes } = await import(
  '../../server/src/routes/ideaBusinessCase.routes.js'
);

// ---------------------------------------------------------------------------
// Connection probe (same contract as e12-collab-security.realdb.test.ts)
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

async function newSqlClient(): Promise<Client> {
  const config = buildClientConfig();
  if (!config) throw new Error('No DB config available');
  const client = new Client(config);
  await client.connect();
  return client;
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
  'idea_business_cases',
  'my_idea_conversions',
  'decisions',
  'tool_sessions',
] as const;

// ---------------------------------------------------------------------------
// E2E identity minting (same shape as e12-collab-security.realdb.test.ts)
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
    name: 'Gate3 RealDB Test User',
    role,
    userRole: role,
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

function buildApp(): express.Express {
  // Brand-new Express app object each call — used for both the "warm" app and
  // every "cold reopen" app so no request-scoped or app-scoped state can leak
  // between phases.
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  app.use('/api/idea-business-case', ideaBusinessCaseRoutes);
  return app;
}

/**
 * Genuine cold reopen of the DB layer: closes the live pg Pool (real socket
 * teardown) and clears the singleton globals so the next query anywhere in
 * the process creates a brand-new Pool. See file header for why this (and
 * not just `buildApp()` again) is required to defeat the module-level cache.
 */
async function resetDbConnection(): Promise<void> {
  const { resetConnection } = await import('../../server/src/database/Database.js');
  await resetConnection();
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

function marker(tag: string): string {
  return `GATE3_${tag}_${suffix()}`;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Harness {
  probeClient: Client;
  orgId: string;
  userId: string;
  hasMaturityGatesColumn: boolean;
  hasConfidentialityColumn: boolean;
  hasMappingVersionColumn: boolean;
  ideaIds: Set<string>;
  cleanup: () => Promise<void>;
}

async function setupHarness(): Promise<Harness | null> {
  if (!(await pgReachable())) return null;
  const config = buildClientConfig();
  if (!config) return null;

  const probeClient = new Client(config);
  try {
    await probeClient.connect();
  } catch {
    return null;
  }

  try {
    if (!(await tablesExist(probeClient, REQUIRED_TABLES))) {
      await probeClient.end().catch(() => {});
      return null;
    }
  } catch {
    await probeClient.end().catch(() => {});
    return null;
  }

  const hasMaturityGatesColumn = await columnExists(probeClient, 'my_ideas', 'maturity_gates_json');
  const hasConfidentialityColumn = await columnExists(probeClient, 'my_ideas', 'confidentiality');
  const hasMappingVersionColumn = await columnExists(
    probeClient,
    'my_idea_conversions',
    'mapping_version'
  );

  const tag = suffix();
  const orgId = `org_g3_${tag}`;
  const userId = `user_g3_${tag}`;
  const ideaIds = new Set<string>();

  const cleanup = async () => {
    try {
      await probeClient.query(
        `DELETE FROM my_idea_conversions WHERE organization_id = $1`,
        [orgId]
      );
      await probeClient.query(`DELETE FROM idea_business_cases WHERE organization_id = $1`, [
        orgId,
      ]);
      await probeClient.query(`DELETE FROM my_idea_maps WHERE organization_id = $1`, [orgId]);
      await probeClient.query(`DELETE FROM decisions WHERE organization_id = $1`, [orgId]);
      await probeClient.query(`DELETE FROM tool_sessions WHERE organization_id = $1`, [orgId]);
      await probeClient.query(`DELETE FROM link_graph_edges WHERE organization_id = $1`, [orgId]);
      await probeClient.query(`DELETE FROM my_ideas WHERE organization_id = $1`, [orgId]);
    } catch {
      // Leaking a few rows is acceptable; a hung/throwing cleanup is not.
    }
    try {
      await probeClient.end();
    } catch {
      // ignore
    }
  };

  return {
    probeClient,
    orgId,
    userId,
    hasMaturityGatesColumn,
    hasConfidentialityColumn,
    hasMappingVersionColumn,
    ideaIds,
    cleanup,
  };
}

async function createIdea(
  app: express.Express,
  token: string,
  title: string,
  h: Harness
): Promise<string> {
  const res = await request(app)
    .post('/api/my-work/my-ideas')
    .set('Authorization', `Bearer ${token}`)
    .send({ title, body: 'gate3 persistence probe seed', tags: ['gate3'] });
  expect(res.status).toBe(201);
  const id = res.body.id as string;
  h.ideaIds.add(id);
  return id;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('GATE 3 — persistence: save / refresh / cold reopen / direct-SQL readback (real Postgres)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(reason: string): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(`[skip] ${reason} — GATE3 realdb tests skipped. See file header to run locally.`);
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
        await fn(harness);
      },
      timeoutMs
    );

  // -------------------------------------------------------------------------
  // 1. FOUR TOOLS — all persist through the shared PUT/GET
  //    /api/my-work/my-ideas/:id/map (my_idea_maps.nodes_json / edges_json /
  //    extensions_json / preferred_tool), differentiated by `preferredTool`
  //    and node `kind`. See my-work.routes.ts:4286 (GET) / :4584 (PUT).
  // -------------------------------------------------------------------------

  interface MapPhaseContent {
    nodes: any[];
    edges: any[];
    extensions?: Record<string, unknown>;
  }

  async function runMapToolChain(
    h: Harness,
    toolLabel: string,
    preferredTool: 'mindmap' | 'whiteboard' | 'process_flow' | 'table',
    // seedMark and mutateMark are DISJOINT tokens (neither a substring of the
    // other) — this is deliberate: if the mutate step silently no-ops, an
    // assertion that only checked a shared prefix could pass vacuously
    // against leftover seed content. Only mutateMark proves the mutation.
    build: (phase: 'seed' | 'mutate', seedMark: string, mutateMark: string) => MapPhaseContent
  ) {
    const app = buildApp();
    const token = makeE2EToken(h.userId, h.orgId);
    const ideaId = await createIdea(app, token, `Gate3 ${toolLabel} idea`, h);
    const seedMark = marker(`${toolLabel.toUpperCase().replace(/\s+/g, '_')}_SEEDTOK`);
    const mutateMark = marker(`${toolLabel.toUpperCase().replace(/\s+/g, '_')}_MUTATETOK`);

    // --- 1. create: seed graph, no baseVersion needed (row doesn't exist yet) ---
    const seed = build('seed', seedMark, mutateMark);
    const putSeed = await request(app)
      .put(`/api/my-work/my-ideas/${ideaId}/map`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nodes: seed.nodes, edges: seed.edges, extensions: seed.extensions, preferredTool });
    expect(putSeed.status, `seed PUT map (${toolLabel}): ${JSON.stringify(putSeed.body)}`).toBe(200);
    expect(putSeed.body.version).toBe(1);

    // --- 2. mutate: distinctive content-bearing addition, real OCC baseVersion ---
    const mutated = build('mutate', seedMark, mutateMark);
    const putMutate = await request(app)
      .put(`/api/my-work/my-ideas/${ideaId}/map`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        nodes: [...seed.nodes, ...mutated.nodes],
        edges: [...seed.edges, ...mutated.edges],
        extensions: mutated.extensions,
        preferredTool,
        baseVersion: 1,
      });
    expect(putMutate.status, `mutate PUT map (${toolLabel}): ${JSON.stringify(putMutate.body)}`).toBe(
      200
    );
    expect(putMutate.body.version).toBe(2);

    // --- 3. save is the PUT above; 4. refresh — re-GET same app instance ---
    const getWarm = await request(app)
      .get(`/api/my-work/my-ideas/${ideaId}/map`)
      .set('Authorization', `Bearer ${token}`);
    expect(getWarm.status).toBe(200);
    const warmSerialized = JSON.stringify(getWarm.body);
    expect(warmSerialized, `warm refresh (${toolLabel}) missing mutateMark`).toContain(mutateMark);

    // --- 5. COLD REOPEN: kill the pg Pool + build a brand-new Express app ---
    await resetDbConnection();
    const coldApp = buildApp();
    const getCold = await request(coldApp)
      .get(`/api/my-work/my-ideas/${ideaId}/map`)
      .set('Authorization', `Bearer ${token}`);
    expect(getCold.status).toBe(200);
    const coldSerialized = JSON.stringify(getCold.body);
    expect(coldSerialized, `cold-reopen GET map (${toolLabel}) missing mutateMark`).toContain(
      mutateMark
    );

    // --- 6. readback confirmed by DIRECT SQL against a brand-new pg client ---
    const sql = await newSqlClient();
    try {
      const row = await sql.query<{ nodes_json: string; edges_json: string; preferred_tool: string }>(
        `SELECT nodes_json, edges_json, preferred_tool FROM my_idea_maps WHERE idea_id = $1 AND organization_id = $2 LIMIT 1`,
        [ideaId, h.orgId]
      );
      expect(row.rowCount, `direct-SQL row for ${toolLabel}`).toBe(1);
      const r = row.rows[0];
      expect(r.preferred_tool, `preferred_tool column for ${toolLabel}`).toBe(preferredTool);
      const physicallyPresent =
        String(r.nodes_json || '').includes(mutateMark) || String(r.edges_json || '').includes(mutateMark);
      expect(
        physicallyPresent,
        `direct SQL nodes_json/edges_json for ${toolLabel} must contain ${mutateMark}`
      ).toBe(true);
      // Sanity: seedMark must ALSO still be present (no-data-loss merge) — not
      // the chain's required assertion, but catches an accidental full overwrite.
      const seedStillPresent =
        String(r.nodes_json || '').includes(seedMark) || String(r.edges_json || '').includes(seedMark);
      expect(seedStillPresent, `direct SQL for ${toolLabel} lost the seed content`).toBe(true);
    } finally {
      await sql.end();
    }
  }

  itDB('[tool: Mind Map] save → refresh → cold reopen → direct-SQL readback of a distinctive node', (h) =>
    runMapToolChain(h, 'mind map', 'mindmap', (phase, seedMark, mutateMark) => ({
      nodes:
        phase === 'seed'
          ? [{ id: 'n_seed', kind: 'topic', label: seedMark, position: { x: 10, y: 10 } }]
          : [{ id: 'n_mutate', kind: 'subtopic', label: mutateMark, position: { x: 12, y: 12 } }],
      edges: [],
    }))
  );

  itDB(
    '[tool: Whiteboard] save → refresh → cold reopen → direct-SQL readback of a distinctive shape',
    (h) =>
      runMapToolChain(h, 'whiteboard', 'whiteboard', (phase, seedMark, mutateMark) => ({
        nodes:
          phase === 'seed'
            ? [{ id: 'n_seed', kind: 'sticky', label: seedMark, position: { x: 20, y: 20 } }]
            : [{ id: 'n_mutate', kind: 'shape', label: mutateMark, position: { x: 22, y: 22 } }],
        edges: [],
      }))
  );

  itDB(
    '[tool: Process Flow] save → refresh → cold reopen → direct-SQL readback of a distinctive edge',
    (h) => {
      const stepA = { id: 'stepA', kind: 'step' as const, label: 'Start' };
      const stepB = { id: 'stepB', kind: 'step' as const, label: 'End' };
      return runMapToolChain(h, 'process flow', 'process_flow', (phase, seedMark, mutateMark) => ({
        nodes:
          phase === 'seed'
            ? [
                { ...stepA, label: `${stepA.label} ${seedMark}` },
                { ...stepB, label: `${stepB.label} ${seedMark}` },
              ]
            : [],
        edges:
          phase === 'seed'
            ? []
            : [
                {
                  id: 'e_mutate',
                  fromNodeId: 'stepA',
                  toNodeId: 'stepB',
                  relationType: 'flow',
                  label: mutateMark,
                },
              ],
      }));
    }
  );

  itDB('[tool: Table] save → refresh → cold reopen → direct-SQL readback of a distinctive row', (h) =>
    runMapToolChain(h, 'table', 'table', (phase, seedMark, mutateMark) => ({
      nodes:
        phase === 'seed'
          ? [{ id: 'n_seed', kind: 'row', label: seedMark, payload: { cellValue: seedMark } }]
          : [{ id: 'n_mutate', kind: 'row', label: mutateMark, payload: { cellValue: mutateMark } }],
      edges: [],
      extensions: phase === 'mutate' ? { table: { marker: mutateMark } } : undefined,
    }))
  );

  // -------------------------------------------------------------------------
  // 2. Wave 4/5 feature: maturity gates attestation
  //    PATCH /api/my-work/my-ideas/:id/maturity-gates → my_ideas.maturity_gates_json
  //    GET   /api/my-work/my-ideas/:id                 (feature-detected via getTableColumns)
  // -------------------------------------------------------------------------

  itDB(
    '[feature: maturity gates] save → refresh → cold reopen → direct-SQL readback of an attestation note',
    async (h) => {
      if (!h.hasMaturityGatesColumn) {
        emitSkipOnce('my_ideas.maturity_gates_json column missing');
        expect(true).toBe(true);
        return;
      }
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const ideaId = await createIdea(app, token, 'Gate3 maturity gates idea', h);
      const mark = marker('MATURITY');

      const patchRes = await request(app)
        .patch(`/api/my-work/my-ideas/${ideaId}/maturity-gates`)
        .set('Authorization', `Bearer ${token}`)
        .send({ criterionId: 'initial_economics', met: true, note: mark });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.applied).toBe(true);
      expect(JSON.stringify(patchRes.body.maturityGates)).toContain(mark);

      const getWarm = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getWarm.status).toBe(200);
      // NOTE: decorateIdeaLineage() (my-work.routes.ts ~L381-404) deletes the
      // raw `maturity_gates_json` key from every GET /my-ideas/:id response
      // (sets it to `undefined`, which JSON.stringify drops) and exposes the
      // parsed content ONLY as camelCase `maturityGates` — so the client-
      // facing readback key is `maturityGates`, not the column name.
      expect(Object.prototype.hasOwnProperty.call(getWarm.body, 'maturity_gates_json')).toBe(false);
      expect(JSON.stringify(getWarm.body.maturityGates || {})).toContain(mark);

      await resetDbConnection();
      const coldApp = buildApp();
      const getCold = await request(coldApp)
        .get(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getCold.status).toBe(200);
      expect(JSON.stringify(getCold.body.maturityGates || {})).toContain(mark);

      const sql = await newSqlClient();
      try {
        const row = await sql.query<{ maturity_gates_json: string }>(
          `SELECT maturity_gates_json FROM my_ideas WHERE id = $1 AND organization_id = $2 LIMIT 1`,
          [ideaId, h.orgId]
        );
        expect(row.rowCount).toBe(1);
        expect(String(row.rows[0].maturity_gates_json || '')).toContain(mark);
      } finally {
        await sql.end();
      }
    }
  );

  // -------------------------------------------------------------------------
  // 3. Wave 4/5 feature: business case
  //    PUT/GET /api/idea-business-case/:ideaId → idea_business_cases.sections_json
  // -------------------------------------------------------------------------

  itDB(
    '[feature: business case] save → refresh → cold reopen → direct-SQL readback of a section value',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const ideaId = await createIdea(app, token, 'Gate3 business case idea', h);
      const seedMark = marker('BIZCASE_SEEDTOK');
      const mutateMark = marker('BIZCASE_MUTATETOK');

      // --- 1. create: INSERT path in ideaBusinessCaseService.upsertBusinessCase ---
      const putSeed = await request(app)
        .put(`/api/idea-business-case/${ideaId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sections: { problemBaseline: { content: { note: seedMark } } } });
      expect(putSeed.status).toBe(200);
      expect(JSON.stringify(putSeed.body.businessCase.sections)).toContain(seedMark);

      // --- 2. mutate: UPDATE path (existing row), a DIFFERENT section, distinctive value ---
      const putMutate = await request(app)
        .put(`/api/idea-business-case/${ideaId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sections: { kpis: { content: { note: mutateMark } } } });
      expect(putMutate.status).toBe(200);
      expect(JSON.stringify(putMutate.body.businessCase.sections)).toContain(mutateMark);

      const mark = mutateMark;
      const getWarm = await request(app)
        .get(`/api/idea-business-case/${ideaId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getWarm.status).toBe(200);
      expect(JSON.stringify(getWarm.body.businessCase?.sections || {})).toContain(mark);

      await resetDbConnection();
      const coldApp = buildApp();
      const getCold = await request(coldApp)
        .get(`/api/idea-business-case/${ideaId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getCold.status).toBe(200);
      expect(JSON.stringify(getCold.body.businessCase?.sections || {})).toContain(mark);

      const sql = await newSqlClient();
      try {
        const row = await sql.query<{ sections_json: string }>(
          `SELECT sections_json FROM idea_business_cases WHERE idea_id = $1 AND organization_id = $2 LIMIT 1`,
          [ideaId, h.orgId]
        );
        expect(row.rowCount).toBe(1);
        expect(String(row.rows[0].sections_json || '')).toContain(mark);
      } finally {
        await sql.end();
      }
    }
  );

  // -------------------------------------------------------------------------
  // 4. Wave 4/5 feature: conversion mapping_version
  //    POST /api/my-work/my-ideas/:id/convert (target: 'decision')
  //      → my_idea_conversions.mapping_version = CONVERSION_MAPPING_VERSION ('v1')
  //    GET  /api/my-work/my-ideas/:id/conversions
  // -------------------------------------------------------------------------

  itDB(
    '[feature: conversion mapping_version] save (convert) → refresh → cold reopen → direct-SQL readback',
    async (h) => {
      if (!h.hasMappingVersionColumn) {
        emitSkipOnce('my_idea_conversions.mapping_version column missing');
        expect(true).toBe(true);
        return;
      }
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const ideaId = await createIdea(app, token, 'Gate3 conversion idea', h);

      const convertRes = await request(app)
        .post(`/api/my-work/my-ideas/${ideaId}/convert`)
        .set('Authorization', `Bearer ${token}`)
        .send({ target: 'decision', options: {} });
      expect(convertRes.status, JSON.stringify(convertRes.body)).toBe(200);
      const decisionId = convertRes.body.promotedEntityId as string;
      expect(typeof decisionId).toBe('string');

      const getWarm = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}/conversions`)
        .set('Authorization', `Bearer ${token}`);
      expect(getWarm.status).toBe(200);
      const warmEntry = (getWarm.body.conversions || []).find(
        (c: any) => c.targetId === decisionId
      );
      expect(warmEntry, 'warm conversions list must contain the created row').toBeTruthy();
      expect(warmEntry.mappingVersion).toBe('v1');

      await resetDbConnection();
      const coldApp = buildApp();
      const getCold = await request(coldApp)
        .get(`/api/my-work/my-ideas/${ideaId}/conversions`)
        .set('Authorization', `Bearer ${token}`);
      expect(getCold.status).toBe(200);
      const coldEntry = (getCold.body.conversions || []).find(
        (c: any) => c.targetId === decisionId
      );
      expect(coldEntry, 'cold-reopen conversions list must contain the created row').toBeTruthy();
      expect(coldEntry.mappingVersion).toBe('v1');

      const sql = await newSqlClient();
      try {
        const row = await sql.query<{ mapping_version: string }>(
          `SELECT mapping_version FROM my_idea_conversions WHERE idea_id = $1 AND organization_id = $2 AND entity_id = $3 LIMIT 1`,
          [ideaId, h.orgId, decisionId]
        );
        expect(row.rowCount).toBe(1);
        expect(row.rows[0].mapping_version).toBe('v1');
      } finally {
        await sql.end();
      }
    }
  );

  // -------------------------------------------------------------------------
  // 5. Wave 4/5 feature: confidentiality
  //    PUT /api/my-work/my-ideas/:id  { confidentiality } → my_ideas.confidentiality
  //    GET /api/my-work/my-ideas/:id                       (feature-detected via getTableColumns)
  //
  //    Previously EVIDENCE_MISSING at HTTP level: there was no HTTP route
  //    anywhere in server/src/routes that let a client SET
  //    my_ideas.confidentiality, and GET didn't select it back either — see
  //    the E12 suite's own setConfidentiality() raw-SQL test helper
  //    (tests/integration/e12-collab-security.realdb.test.ts), which existed
  //    precisely because no product route did this.
  //
  //    That gap is now closed: PUT /api/my-work/my-ideas/:id validates and
  //    persists `confidentiality` (my-work.routes.ts ~L3217-3230, against the
  //    closed IDEA_CONFIDENTIALITY_LEVELS set — 400 before the value can ever
  //    reach the DB CHECK constraint), and GET /api/my-work/my-ideas/:id
  //    feature-detects and returns the column (~L3019/L3032). This chain now
  //    exercises the full HTTP path like every other feature chain above.
  // -------------------------------------------------------------------------

  itDB(
    '[feature: confidentiality] save → refresh → cold reopen → direct-SQL readback, plus invalid-value rejection',
    async (h) => {
      if (!h.hasConfidentialityColumn) {
        emitSkipOnce('my_ideas.confidentiality column missing');
        expect(true).toBe(true);
        return;
      }
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const ideaId = await createIdea(app, token, 'Gate3 confidentiality idea', h);

      // --- 1. save: set via the real HTTP route (not raw SQL) ---
      const putRestricted = await request(app)
        .put(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confidentiality: 'restricted' });
      expect(putRestricted.status, JSON.stringify(putRestricted.body)).toBe(200);
      expect(putRestricted.body.confidentiality).toBe('restricted');

      // --- 2. warm refresh: re-GET through the same app ---
      const getWarm = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getWarm.status).toBe(200);
      expect(getWarm.body.confidentiality).toBe('restricted');

      // --- 3. COLD REOPEN: kill the pg Pool + build a brand-new Express app ---
      await resetDbConnection();
      const coldApp = buildApp();
      const getCold = await request(coldApp)
        .get(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getCold.status).toBe(200);
      expect(getCold.body.confidentiality).toBe('restricted');

      // --- 4. readback confirmed by DIRECT SQL against the physical row ---
      const sqlAfterRestricted = await newSqlClient();
      try {
        const row = await sqlAfterRestricted.query<{ confidentiality: string }>(
          `SELECT confidentiality FROM my_ideas WHERE id = $1 AND organization_id = $2 LIMIT 1`,
          [ideaId, h.orgId]
        );
        expect(row.rowCount).toBe(1);
        expect(row.rows[0].confidentiality).toBe('restricted');
      } finally {
        await sqlAfterRestricted.end();
      }

      // --- 5. round-trip back to 'standard' through the API, re-verify by direct SQL ---
      const putStandard = await request(coldApp)
        .put(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confidentiality: 'standard' });
      expect(putStandard.status, JSON.stringify(putStandard.body)).toBe(200);
      expect(putStandard.body.confidentiality).toBe('standard');

      const sqlAfterStandard = await newSqlClient();
      try {
        const row = await sqlAfterStandard.query<{ confidentiality: string }>(
          `SELECT confidentiality FROM my_ideas WHERE id = $1 AND organization_id = $2 LIMIT 1`,
          [ideaId, h.orgId]
        );
        expect(row.rowCount).toBe(1);
        expect(row.rows[0].confidentiality).toBe('standard');
      } finally {
        await sqlAfterStandard.end();
      }

      // --- 6. invalid value: rejected with 400, and the DB row is UNCHANGED ---
      const putInvalid = await request(coldApp)
        .put(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confidentiality: 'top-secret-nonsense' });
      expect(putInvalid.status, JSON.stringify(putInvalid.body)).toBe(400);
      expect(String(putInvalid.body.error || '')).toContain('confidentiality must be one of');

      const sqlAfterInvalid = await newSqlClient();
      try {
        const row = await sqlAfterInvalid.query<{ confidentiality: string }>(
          `SELECT confidentiality FROM my_ideas WHERE id = $1 AND organization_id = $2 LIMIT 1`,
          [ideaId, h.orgId]
        );
        expect(row.rowCount).toBe(1);
        expect(
          row.rows[0].confidentiality,
          'DB row must remain unchanged after a rejected invalid confidentiality value'
        ).toBe('standard');
      } finally {
        await sqlAfterInvalid.end();
      }
    }
  );
});
