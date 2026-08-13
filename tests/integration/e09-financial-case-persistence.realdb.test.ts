/**
 * E09 FINANCIAL CASE — persistence evidence: save → refresh → COLD REOPEN →
 * API readback → DIRECT SQL readback of the physical row. Plus optimistic
 * concurrency (409), cross-org isolation, foreign-org refusal (403), body
 * validation (400) and the audit before/after pair read back FROM THE TABLE.
 *
 * This is the test RISK-12's settlement said would be needed
 * (10_FINANCIAL_CASE_ACCEPTANCE.md §5.7 point 5). It replaces nothing — the
 * old `FinancialCaseDialog.noPersistence.test.tsx` pinned the ABSENCE of a
 * save path and is superseded by
 * `tests/components/MyWork/table/financial/FinancialCaseDialog.persistence.test.tsx`.
 *
 * Harness pattern copied verbatim from
 * tests/integration/gate3-persistence-coldreopen.realdb.test.ts — same
 * connection probe, same E2E token minting, same buildApp() shape, and the
 * same genuine cold reopen: `resetConnection()` does `pool.end()` (real TCP
 * teardown), nulls the module-level pool and clears both singleton globals, so
 * the next query builds a brand-new pg Pool; every cold phase ALSO constructs
 * a brand-new Express app. Neither the HTTP layer nor the DB layer can be
 * serving a stale in-process object.
 *
 * Run (BOTH flags — `NODE_ENV=test` alone silently substitutes a DB mock and
 * the whole suite goes green against nothing):
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false E2E_MODE=true \
 *   DATABASE_URL=postgres://postgres@127.0.0.1:54331/ideas_e12 \
 *   npx vitest run tests/integration/e09-financial-case-persistence.realdb.test.ts --retry=0
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
const { default: ideaFinancialCaseRoutes } = await import(
  '../../server/src/routes/ideaFinancialCase.routes.js'
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
      /* best-effort */
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

const REQUIRED_TABLES = ['my_ideas', 'idea_financial_cases', 'audit_events'] as const;

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string, role = 'MEMBER'): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'E09 RealDB Test User',
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
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  app.use('/api/idea-financial-case', ideaFinancialCaseRoutes);
  return app;
}

async function resetDbConnection(): Promise<void> {
  const { resetConnection } = await import('../../server/src/database/Database.js');
  await resetConnection();
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

function marker(tag: string): string {
  return `E09_${tag}_${suffix()}`;
}

/** A valid, minimally-complete financial case body. */
function caseInput(label: string, opts: { horizonMonths?: number; currency?: string } = {}) {
  return {
    currency: opts.currency ?? 'PLN',
    discountRatePct: 10,
    startPeriod: '2026-01',
    horizonMonths: opts.horizonMonths ?? 12,
    scenarios: ['base', 'upside', 'downside'] as const,
    drivers: [
      {
        id: `drv_cost_${label}`,
        kind: 'cost' as const,
        costType: 'investment' as const,
        label: `COST ${label}`,
        category: 'Implementation',
        unit: 'PLN',
        monthlyValues: { '2026-01': 100000 },
        scenarioMultipliers: { upside: 0.9, downside: 1.2 },
        confidence: 'medium' as const,
        evidence: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: `drv_benefit_${label}`,
        kind: 'benefit' as const,
        benefitType: 'cash' as const,
        label: `BENEFIT ${label}`,
        category: 'Savings',
        unit: 'PLN',
        monthlyValues: { '2026-03': 25000, '2026-04': 25000 },
        scenarioMultipliers: { upside: 1.15, downside: 0.8 },
        confidence: 'high' as const,
        evidence: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };
}

interface Harness {
  probeClient: Client;
  orgA: string;
  orgB: string;
  userA: string;
  userB: string;
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

  const tag = suffix();
  const orgA = `org_e09a_${tag}`;
  const orgB = `org_e09b_${tag}`;

  const cleanup = async () => {
    // Probe rows are the product's face — leave nothing behind. Financial
    // cases first (FK child), then audit rows, then the ideas themselves.
    try {
      for (const org of [orgA, orgB]) {
        await probeClient.query(`DELETE FROM idea_financial_cases WHERE organization_id = $1`, [
          org,
        ]);
        await probeClient.query(`DELETE FROM audit_events WHERE org_id = $1`, [org]);
        await probeClient.query(`DELETE FROM my_ideas WHERE organization_id = $1`, [org]);
      }
    } catch {
      /* leaking a few rows is acceptable; a hung cleanup is not */
    }
    try {
      await probeClient.end();
    } catch {
      /* ignore */
    }
  };

  return {
    probeClient,
    orgA,
    orgB,
    userA: `user_e09a_${tag}`,
    userB: `user_e09b_${tag}`,
    cleanup,
  };
}

async function createIdea(
  app: express.Express,
  token: string,
  title: string
): Promise<string> {
  const res = await request(app)
    .post('/api/my-work/my-ideas')
    .set('Authorization', `Bearer ${token}`)
    .send({ title, body: 'e09 financial case probe seed', tags: ['e09'] });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.id as string;
}

describe('E09 financial case — real Postgres persistence, OCC, org isolation, audit', () => {
  let harness: Harness | null = null;
  let skipEmitted = false;

  function emitSkipOnce(reason: string): void {
    if (skipEmitted) return;
    skipEmitted = true;
    // eslint-disable-next-line no-console
    console.error(`[skip] ${reason} — E09 realdb tests skipped. See file header to run locally.`);
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
  // 1. THE CHAIN: save → mutate → warm refresh → cold reopen → direct SQL
  // -------------------------------------------------------------------------
  itDB(
    'save → refresh → cold reopen → API readback → direct-SQL readback of the physical row',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userA, h.orgA);
      const ideaId = await createIdea(app, token, 'E09 financial case idea');

      // seedMark and mutateMark are DISJOINT tokens (neither a substring of
      // the other): if the mutate PUT silently no-ops, an assertion sharing a
      // prefix could pass vacuously against leftover seed content.
      const seedMark = marker('SEEDTOK');
      const mutateMark = marker('MUTATETOK');
      const computedAt = '2026-02-03T10:11:12.000Z';

      // --- 1. create (INSERT path). No `version` — no row exists yet. ---
      const putSeed = await request(app)
        .put(`/api/idea-financial-case/${ideaId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ case: { input: caseInput(seedMark), result: null, lastComputedAt: null } });
      expect(putSeed.status, JSON.stringify(putSeed.body)).toBe(200);
      expect(putSeed.body.financialCase.version).toBe(1);
      expect(JSON.stringify(putSeed.body.financialCase.payload.input)).toContain(seedMark);

      // --- 2. mutate (UPDATE path) with the correct version, carrying a
      //        computed result snapshot + lastComputedAt. ---
      const putMutate = await request(app)
        .put(`/api/idea-financial-case/${ideaId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          case: {
            input: caseInput(mutateMark, { horizonMonths: 24, currency: 'EUR' }),
            result: {
              formulaVersion: 'engine-1',
              computedAt,
              currency: 'EUR',
              scenarios: {},
              sensitivity: [],
              warnings: [],
            },
            lastComputedAt: computedAt,
          },
          version: 1,
        });
      expect(putMutate.status, JSON.stringify(putMutate.body)).toBe(200);
      expect(putMutate.body.financialCase.version).toBe(2);

      // --- 3. warm refresh through the SAME app instance ---
      const getWarm = await request(app)
        .get(`/api/idea-financial-case/${ideaId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getWarm.status).toBe(200);
      expect(JSON.stringify(getWarm.body.financialCase)).toContain(mutateMark);

      // --- 4. COLD REOPEN: kill the pg Pool + brand-new Express app ---
      await resetDbConnection();
      const coldApp = buildApp();
      const getCold = await request(coldApp)
        .get(`/api/idea-financial-case/${ideaId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getCold.status).toBe(200);
      const cold = getCold.body.financialCase;
      expect(JSON.stringify(cold), 'cold-reopen GET lost the mutated drivers').toContain(
        mutateMark
      );
      expect(cold.version).toBe(2);
      expect(cold.payload.input.currency).toBe('EUR');
      expect(cold.payload.input.horizonMonths).toBe(24);
      expect(cold.payload.input.drivers).toHaveLength(2);
      // The result snapshot and its timestamp survive too — this is the field
      // the falsifiability sabotage targets (see the acceptance doc).
      expect(cold.payload.lastComputedAt).toBe(computedAt);
      expect(cold.payload.result?.formulaVersion).toBe('engine-1');

      // --- 5. DIRECT SQL against the physical row, brand-new pg client ---
      const sql = await newSqlClient();
      try {
        const row = await sql.query<{
          case_json: string;
          version: number;
          updated_by: string;
          organization_id: string;
        }>(
          `SELECT case_json, version, updated_by, organization_id
             FROM idea_financial_cases WHERE idea_id = $1 AND organization_id = $2 LIMIT 1`,
          [ideaId, h.orgA]
        );
        expect(row.rowCount, 'exactly one physical row for this idea').toBe(1);
        const physical = String(row.rows[0].case_json || '');
        expect(physical, 'physical case_json must contain the mutated driver').toContain(
          mutateMark
        );
        expect(physical, 'physical case_json must contain lastComputedAt').toContain(computedAt);
        expect(Number(row.rows[0].version)).toBe(2);
        expect(row.rows[0].updated_by).toBe(h.userA);
        expect(row.rows[0].organization_id).toBe(h.orgA);
        // The seed content was REPLACED (whole-case PUT), not merged — assert
        // the documented contract rather than assuming it.
        expect(physical).not.toContain(seedMark);
      } finally {
        await sql.end();
      }
    }
  );

  // -------------------------------------------------------------------------
  // 2. OPTIMISTIC CONCURRENCY — a stale version must 409, not overwrite
  // -------------------------------------------------------------------------
  itDB('a stale version is refused with 409 and the stored row is UNCHANGED', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.userA, h.orgA);
    const ideaId = await createIdea(app, token, 'E09 OCC idea');
    const winnerMark = marker('WINNER');
    const loserMark = marker('LOSER');

    const create = await request(app)
      .put(`/api/idea-financial-case/${ideaId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ case: { input: caseInput('BASE'), result: null, lastComputedAt: null } });
    expect(create.status).toBe(200);
    expect(create.body.financialCase.version).toBe(1);

    // Editor 1 saves against v1 → wins, row becomes v2.
    const winner = await request(app)
      .put(`/api/idea-financial-case/${ideaId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ case: { input: caseInput(winnerMark), result: null, lastComputedAt: null }, version: 1 });
    expect(winner.status).toBe(200);
    expect(winner.body.financialCase.version).toBe(2);

    // Editor 2 still holds v1 → must be refused.
    const loser = await request(app)
      .put(`/api/idea-financial-case/${ideaId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ case: { input: caseInput(loserMark), result: null, lastComputedAt: null }, version: 1 });
    expect(loser.status, JSON.stringify(loser.body)).toBe(409);
    expect(loser.body.code).toBe('IDEA_FINANCIAL_CASE_VERSION_CONFLICT');
    expect(loser.body.currentVersion).toBe(2);
    // The 409 carries the server's current row so the UI can offer it.
    expect(JSON.stringify(loser.body.financialCase)).toContain(winnerMark);

    // Omitting `version` entirely against an existing row is also a conflict —
    // otherwise a client could bypass OCC by simply not sending the field.
    const noVersion = await request(app)
      .put(`/api/idea-financial-case/${ideaId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ case: { input: caseInput(loserMark), result: null, lastComputedAt: null } });
    expect(noVersion.status).toBe(409);

    // THE POINT: the loser's content never reached the database.
    const sql = await newSqlClient();
    try {
      const row = await sql.query<{ case_json: string; version: number }>(
        `SELECT case_json, version FROM idea_financial_cases WHERE idea_id = $1 LIMIT 1`,
        [ideaId]
      );
      expect(row.rowCount).toBe(1);
      expect(String(row.rows[0].case_json)).toContain(winnerMark);
      expect(String(row.rows[0].case_json), 'a refused write must not land').not.toContain(
        loserMark
      );
      expect(Number(row.rows[0].version)).toBe(2);
    } finally {
      await sql.end();
    }
  });

  // -------------------------------------------------------------------------
  // 3. CROSS-ORG — org B must not read or write org A's financial case
  // -------------------------------------------------------------------------
  itDB('org B can neither read nor write org A financial case', async (h) => {
    const app = buildApp();
    const tokenA = makeE2EToken(h.userA, h.orgA);
    const tokenB = makeE2EToken(h.userB, h.orgB);
    const ideaId = await createIdea(app, tokenA, 'E09 cross-org idea');
    const secretMark = marker('ORGA_SECRET');
    const intruderMark = marker('ORGB_INTRUDER');

    const create = await request(app)
      .put(`/api/idea-financial-case/${ideaId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ case: { input: caseInput(secretMark), result: null, lastComputedAt: null } });
    expect(create.status).toBe(200);

    // READ from org B → 404 (non-disclosure: never confirm the idea exists).
    const readB = await request(app)
      .get(`/api/idea-financial-case/${ideaId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(readB.status, JSON.stringify(readB.body)).toBe(404);
    expect(JSON.stringify(readB.body), 'a 404 body must not leak org A content').not.toContain(
      secretMark
    );

    // WRITE from org B → 404, and nothing lands.
    const writeB = await request(app)
      .put(`/api/idea-financial-case/${ideaId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ case: { input: caseInput(intruderMark), result: null, lastComputedAt: null }, version: 1 });
    expect(writeB.status, JSON.stringify(writeB.body)).toBe(404);

    const sql = await newSqlClient();
    try {
      const rows = await sql.query<{ case_json: string; organization_id: string }>(
        `SELECT case_json, organization_id FROM idea_financial_cases WHERE idea_id = $1`,
        [ideaId]
      );
      expect(rows.rowCount, 'org B must not have created a second row').toBe(1);
      expect(rows.rows[0].organization_id).toBe(h.orgA);
      expect(String(rows.rows[0].case_json)).toContain(secretMark);
      expect(String(rows.rows[0].case_json)).not.toContain(intruderMark);
    } finally {
      await sql.end();
    }

    // Org A is unaffected and still reads its own case.
    const readA = await request(app)
      .get(`/api/idea-financial-case/${ideaId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(readA.status).toBe(200);
    expect(JSON.stringify(readA.body)).toContain(secretMark);
  });

  // -------------------------------------------------------------------------
  // 4. FOREIGN-ORG CASE ROW → 403 (the caller CAN see the idea; see the
  //    route header for why this one is not a 404)
  // -------------------------------------------------------------------------
  itDB('a case row owned by another org blocks the write with 403, not a silent takeover', async (h) => {
    const app = buildApp();
    const tokenA = makeE2EToken(h.userA, h.orgA);
    const ideaId = await createIdea(app, tokenA, 'E09 foreign-org row idea');
    const foreignMark = marker('FOREIGN_ROW');
    const takeoverMark = marker('TAKEOVER');

    // Plant a case row for org A's idea but owned by org B (data anomaly the
    // service must refuse rather than silently UPDATE across tenants).
    const seed = await newSqlClient();
    try {
      await seed.query(
        `INSERT INTO idea_financial_cases
           (id, idea_id, organization_id, case_json, version, created_by, updated_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 1, $5, $5, NOW(), NOW())`,
        [
          `fc_foreign_${suffix()}`,
          ideaId,
          h.orgB,
          JSON.stringify({ input: { marker: foreignMark }, result: null, lastComputedAt: null }),
          h.userB,
        ]
      );
    } finally {
      await seed.end();
    }

    const res = await request(app)
      .put(`/api/idea-financial-case/${ideaId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ case: { input: caseInput(takeoverMark), result: null, lastComputedAt: null } });
    expect(res.status, JSON.stringify(res.body)).toBe(403);
    expect(res.body.code).toBe('IDEA_FINANCIAL_CASE_FOREIGN_ORG');

    const sql = await newSqlClient();
    try {
      const rows = await sql.query<{ case_json: string; organization_id: string }>(
        `SELECT case_json, organization_id FROM idea_financial_cases WHERE idea_id = $1`,
        [ideaId]
      );
      expect(rows.rowCount).toBe(1);
      expect(rows.rows[0].organization_id, 'org B row must not change owner').toBe(h.orgB);
      expect(String(rows.rows[0].case_json)).toContain(foreignMark);
      expect(String(rows.rows[0].case_json)).not.toContain(takeoverMark);
    } finally {
      await sql.end();
    }
  });

  // -------------------------------------------------------------------------
  // 5. BODY VALIDATION — 400, and nothing is written
  // -------------------------------------------------------------------------
  itDB('an invalid body is rejected with 400 and never reaches the table', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.userA, h.orgA);
    const ideaId = await createIdea(app, token, 'E09 validation idea');

    const bad: Array<[string, unknown]> = [
      ['missing case', {}],
      ['missing currency', { case: { input: { discountRatePct: 1, startPeriod: '2026-01', horizonMonths: 12, drivers: [], scenarios: [] } } }],
      ['horizonMonths not positive', { case: { input: { ...caseInput('X'), horizonMonths: 0 } } }],
      ['driver without id', { case: { input: { ...caseInput('X'), drivers: [{ kind: 'cost' }] } } }],
      ['driver with unknown kind', { case: { input: { ...caseInput('X'), drivers: [{ id: 'd1', kind: 'wishful' }] } } }],
      ['scenario not in enum', { case: { input: { ...caseInput('X'), scenarios: ['sideways'] } } }],
    ];

    for (const [label, body] of bad) {
      const res = await request(app)
        .put(`/api/idea-financial-case/${ideaId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body as object);
      expect(res.status, `${label} should be 400, got ${res.status}`).toBe(400);
    }

    const sql = await newSqlClient();
    try {
      const rows = await sql.query(
        `SELECT id FROM idea_financial_cases WHERE idea_id = $1`,
        [ideaId]
      );
      expect(rows.rowCount, 'a rejected body must not create a row').toBe(0);
    } finally {
      await sql.end();
    }
  });

  // -------------------------------------------------------------------------
  // 6. AUDIT TRAIL — before/after read back FROM THE TABLE.
  //    The middleware's allow-list once dropped both fields for every caller
  //    (0 of 8 IDEA_UPDATE rows carried a payload). Reading the middleware
  //    proves nothing; this queries audit_events directly.
  // -------------------------------------------------------------------------
  itDB('audit_events carries a non-null before/after pair with the real values', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.userA, h.orgA);
    const ideaId = await createIdea(app, token, 'E09 audit idea');

    // v1: create (before = the "no row yet" zero-state).
    const create = await request(app)
      .put(`/api/idea-financial-case/${ideaId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        case: { input: caseInput('AUDIT1', { currency: 'PLN', horizonMonths: 12 }), result: null, lastComputedAt: null },
      });
    expect(create.status).toBe(200);

    // v2: a change with DIFFERENT, distinguishable values on both sides.
    const update = await request(app)
      .put(`/api/idea-financial-case/${ideaId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        case: {
          input: {
            ...caseInput('AUDIT2', { currency: 'EUR', horizonMonths: 36 }),
            drivers: caseInput('AUDIT2').drivers.slice(0, 1),
          },
          result: null,
          lastComputedAt: null,
        },
        version: 1,
      });
    expect(update.status, JSON.stringify(update.body)).toBe(200);

    const sql = await newSqlClient();
    try {
      const rows = await sql.query<{
        action: string;
        before_json: string | null;
        after_json: string | null;
        actor_id: string | null;
        org_id: string | null;
        resource_id: string | null;
      }>(
        `SELECT action, before_json, after_json, actor_id, org_id, resource_id
           FROM audit_events
          WHERE resource_id = $1 AND action = 'IDEA_FINANCIAL_CASE_UPDATE'
          ORDER BY ts ASC`,
        [ideaId]
      );
      expect(rows.rowCount, 'both PUTs must have written an audit row').toBe(2);

      for (const r of rows.rows) {
        expect(r.org_id).toBe(h.orgA);
        expect(r.actor_id).toBe(h.userA);
        // THE ASSERTION THAT MATTERS: not null. This is exactly what was
        // silently NULL for every caller before the middleware fix.
        expect(r.before_json, 'before_json must not be NULL').not.toBeNull();
        expect(r.after_json, 'after_json must not be NULL').not.toBeNull();
      }

      const first = {
        before: JSON.parse(rows.rows[0].before_json as string),
        after: JSON.parse(rows.rows[0].after_json as string),
      };
      const second = {
        before: JSON.parse(rows.rows[1].before_json as string),
        after: JSON.parse(rows.rows[1].after_json as string),
      };

      // Create: 0 → v1, no currency before, PLN after, 2 drivers.
      expect(first.before.version).toBe(0);
      expect(first.before.currency).toBeNull();
      expect(first.after.version).toBe(1);
      expect(first.after.currency).toBe('PLN');
      expect(first.after.driverCount).toBe(2);
      expect(first.after.horizonMonths).toBe(12);

      // Update: the before half must describe the PREVIOUS state, and the
      // after half the new one — a pair that merely repeats itself would be
      // useless, so assert they genuinely DIFFER on every tracked field.
      expect(second.before.version).toBe(1);
      expect(second.before.currency).toBe('PLN');
      expect(second.before.horizonMonths).toBe(12);
      expect(second.before.driverCount).toBe(2);
      expect(second.after.version).toBe(2);
      expect(second.after.currency).toBe('EUR');
      expect(second.after.horizonMonths).toBe(36);
      expect(second.after.driverCount).toBe(1);
      expect(second.before).not.toEqual(second.after);
    } finally {
      await sql.end();
    }
  });
});
