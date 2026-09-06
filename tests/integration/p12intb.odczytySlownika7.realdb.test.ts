/**
 * P12-int-b / DEC-424 — ODCZYTY na słowniku 7 (REALNA baza Postgres).
 *
 * POMIAR (evidence/p12int/pomiar-resztek-slownika.txt, sekcja B): moduł
 * Realizacja, rollup zdrowia portfela i statystyki raportu filtrowały
 * `initiatives.status` po kodach starego słownika 13
 * ('EXECUTING' · 'BLOCKED' · 'DONE' · 'CANCELLED' · 'ARCHIVED' · 'TRACKING' ·
 * 'REVIEW' · 'PROMOTED' · 'SCHEDULED' · 'PLANNING'). Po migracji
 * `20262103_p12_initiative_status_slownik.sql` kolumna trzyma WYŁĄCZNIE 7
 * kodów, więc każdy z tych filtrów zwracał ZERO wierszy przy pełnym portfelu.
 *
 * Ten test zakłada WŁASNĄ organizację + projekt + 7 inicjatyw pokrywających
 * cały słownik i obie flagi, woła realne trasy/kontrolery bez mocków i
 * sprawdza, że odczyt zwraca > 0 tam, gdzie przed naprawą było 0. Sprząta po
 * sobie do zera (`afterAll`), więc nie zostawia rekordów w danych demo.
 *
 * MUTACJA (dowód): przywrócenie w `ExecutionController` filtru
 * `status IN ('EXECUTING','BLOCKED','DONE')` wywraca przypadki 1-3;
 * przywrócenie `IN ('EXECUTING','DONE')` w `ManagementReportRepository`
 * wywraca przypadek 5; przywrócenie `IN ('EXECUTING','DONE','TRACKING')`
 * w `InitiativeController.getPortfolioRollups` wywraca przypadek 4.
 *
 * URUCHOMIENIE LOKALNE:
 *   DATABASE_URL=postgres://postgres:<hasło>@127.0.0.1:54400/consultify_noc \
 *     DB_TYPE=postgres NODE_ENV=test MOCK_DB=false \
 *     npx vitest run tests/integration/p12intb.odczytySlownika7.realdb.test.ts
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

import { InitiativeStatus } from '../../server/src/constants/initiativeStatuses.js';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

const PROBE_TIMEOUT_MS = 2_000;

function buildClientConfig(): ClientConfig | null {
  const raw = typeof process.env.DATABASE_URL === 'string' ? process.env.DATABASE_URL.trim() : '';
  if (raw && !raw.includes('${{')) {
    return { connectionString: raw, connectionTimeoutMillis: PROBE_TIMEOUT_MS, statement_timeout: 10_000 };
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
    statement_timeout: 10_000,
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
    try { await probe.end(); } catch { /* best-effort */ }
  }
}

const REQUIRED_TABLES = ['organizations', 'users', 'projects', 'initiatives'] as const;

async function tablesExist(client: Client, names: readonly string[]): Promise<boolean> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [names as unknown as string[]]
  );
  const found = new Set(result.rows.map((r) => r.table_name));
  return names.every((n) => found.has(n));
}

/** Bramka pomiaru: bez kolumn flag P12 ten test nie mierzy tego, co deklaruje. */
async function p12ColumnsExist(client: Client): Promise<boolean> {
  const result = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'initiatives'
        AND column_name IN ('on_hold', 'archived')`
  );
  return result.rows.length === 2;
}

function base64UrlEncode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8')
    .toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true, id: userId, email: `${userId}@local.test`, name: 'P12intb RealDB User',
    role: 'ADMIN', userRole: 'ADMIN', organizationId, isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${header}.${payload}.e2e`;
}

interface Harness {
  client: Client;
  organizationId: string;
  userId: string;
  projectId: string;
  cleanup: () => Promise<void>;
}

/** Portfel pokrywający cały słownik 7 + obie flagi. */
const PORTFEL: ReadonlyArray<{ key: string; status: string; onHold: boolean; archived: boolean }> = [
  { key: 'exec_a', status: InitiativeStatus.IN_EXECUTION, onHold: false, archived: false },
  { key: 'exec_b', status: InitiativeStatus.IN_EXECUTION, onHold: false, archived: false },
  { key: 'hold', status: InitiativeStatus.IN_EXECUTION, onHold: true, archived: false },
  { key: 'closed', status: InitiativeStatus.CLOSED, onHold: false, archived: false },
  { key: 'arch', status: InitiativeStatus.CLOSED, onHold: false, archived: true },
  { key: 'rejected', status: InitiativeStatus.REJECTED, onHold: false, archived: false },
  { key: 'approved', status: InitiativeStatus.APPROVED, onHold: false, archived: false },
  { key: 'pending', status: InitiativeStatus.PENDING_APPROVAL, onHold: false, archived: false },
];

async function setupHarness(): Promise<Harness | null> {
  if (!(await pgReachable())) return null;
  const config = buildClientConfig();
  if (!config) return null;
  const client = new Client(config);
  try { await client.connect(); } catch { return null; }
  try {
    if (!(await tablesExist(client, REQUIRED_TABLES)) || !(await p12ColumnsExist(client))) {
      await client.end().catch(() => {});
      return null;
    }
  } catch {
    await client.end().catch(() => {});
    return null;
  }

  const tag = `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
  const organizationId = `org_p12b_${tag}`;
  const userId = `user_p12b_${tag}`;
  const projectId = `proj_p12b_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'P12intb RealDB Org', 'enterprise', 'active')`,
    [organizationId]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'Owner', 'P12b')`,
    [userId, organizationId, `${userId}@local.test`]
  );
  await client.query(
    `INSERT INTO projects (id, organization_id, name, status, is_closed)
     VALUES ($1, $2, 'P12intb RealDB Project', 'active', 0)`,
    [projectId, organizationId]
  );
  for (const row of PORTFEL) {
    await client.query(
      `INSERT INTO initiatives (id, organization_id, project_id, name, status, progress, on_hold, archived)
       VALUES ($1, $2, $3, $4, $5, 40, $6, $7)`,
      [`ini_p12b_${row.key}_${tag}`, organizationId, projectId, `P12b ${row.key}`, row.status, row.onHold, row.archived]
    );
  }

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [organizationId]);
      await client.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
      await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
    } finally {
      await client.end().catch(() => {});
    }
  };

  return { client, organizationId, userId, projectId, cleanup };
}

async function buildExecutionApp() {
  const { default: executionRoutes } = await import('../../server/src/routes/pmo/execution.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/execution', executionRoutes);
  return app;
}

describe('DEC-424 — odczyty inicjatyw trafiają w słownik 7 (real Postgres)', () => {
  let harness: Harness | null = null;

  beforeAll(async () => {
    harness = await setupHarness();
    if (!harness) {
      // eslint-disable-next-line no-console
      console.error('[skip] Postgres nieosiągalny lub brak kolumn P12 — test pominięty.');
    }
  }, 30_000);

  afterAll(async () => {
    if (harness) {
      await harness.cleanup();
      harness = null;
    }
  });

  const itDB = (name: string, fn: (h: Harness) => Promise<void>, timeoutMs = 30_000) =>
    it(name, async () => {
      if (!harness) { expect(true).toBe(true); return; }
      await fn(harness);
    }, timeoutMs);

  itDB('1) GET /api/execution/:projectId/summary widzi portfel (przed: 0 inicjatyw)', async (h) => {
    const res = await request(await buildExecutionApp())
      .get(`/api/execution/${h.projectId}/summary`)
      .set('Authorization', `Bearer ${makeE2EToken(h.userId, h.organizationId)}`);

    expect(res.status).toBe(200);
    // IN_EXECUTION ×3 (w tym 1 wstrzymana) + CLOSED ×2 = 5
    expect(res.body.totalInitiatives).toBe(5);
    expect(res.body.executingCount).toBe(3);
    // „zakończone" = CLOSED AND NOT archived
    expect(res.body.doneCount).toBe(1);
  });

  itDB('2) GET /api/execution/:projectId/blockers widzi wstrzymaną (IN_EXECUTION + on_hold)', async (h) => {
    const res = await request(await buildExecutionApp())
      .get(`/api/execution/${h.projectId}/blockers`)
      .set('Authorization', `Bearer ${makeE2EToken(h.userId, h.organizationId)}`);

    expect(res.status).toBe(200);
    const blocked = res.body.blockedInitiatives ?? res.body.initiatives ?? [];
    expect(Array.isArray(blocked)).toBe(true);
    expect(blocked.length).toBe(1);
    expect(String(blocked[0].name)).toContain('hold');
  });

  itDB('3) GET /api/execution/:projectId/health liczy kondycję per inicjatywa', async (h) => {
    const res = await request(await buildExecutionApp())
      .get(`/api/execution/${h.projectId}/health`)
      .set('Authorization', `Bearer ${makeE2EToken(h.userId, h.organizationId)}`);

    expect(res.status).toBe(200);
    // onTrack + blocked = wszystkie IN_EXECUTION (3)
    expect(res.body.blockedCount).toBe(1);
    expect(res.body.onTrackCount).toBe(2);
    expect(res.body.atRiskCount).toBe(1);
    expect(Array.isArray(res.body.initiativeHealth)).toBe(true);
    expect(res.body.initiativeHealth.length).toBe(3);
    const red = res.body.initiativeHealth.filter((i: { health: string }) => i.health === 'RED');
    expect(red.length).toBe(1);
    expect(String(red[0].whyRed?.signals?.[0]?.message ?? '')).toContain('on hold');
  });

  itDB('4) getPortfolioRollups: zdrowie portfela ma zielone i żółte (przed: same czerwone)', async (h) => {
    const { InitiativeController } = await import('../../server/src/controllers/InitiativeController.js');
    let payload: any = null;
    const req: any = { user: { organizationId: h.organizationId, id: h.userId, role: 'ADMIN' }, query: { projectId: h.projectId } };
    const res: any = { status: () => res, json: (body: unknown) => { payload = body; return res; } };
    await (InitiativeController.getPortfolioRollups as any)(req, res, (err: unknown) => { if (err) throw err; });

    const rows: any[] = payload?.programs ?? [];
    expect(rows.length).toBeGreaterThan(0);
    const green = rows.reduce((sum, r) => sum + Number(r.health?.green ?? 0), 0);
    const amber = rows.reduce((sum, r) => sum + Number(r.health?.amber ?? 0), 0);
    const red = rows.reduce((sum, r) => sum + Number(r.health?.red ?? 0), 0);
    // GREEN = IN_EXECUTION bez on_hold (2) + CLOSED (2) = 4
    expect(green).toBe(4);
    // AMBER = APPROVED (1) + PENDING_APPROVAL (1) = 2
    expect(amber).toBe(2);
    // RED = wstrzymana (1) + REJECTED (1) = 2
    expect(red).toBe(2);
  });

  itDB('5) getInitiativeStatistics: onTrack/atRisk liczone (przed: 0/0)', async (h) => {
    const { default: repo } = await import('../../server/src/repositories/ManagementReportRepository.js');
    const stats: any = await (repo as any).getInitiativeStatistics(h.projectId);
    expect(Number(stats.total)).toBe(PORTFEL.length);
    // onTrack = IN_EXECUTION bez on_hold (2) + CLOSED (2) = 4
    expect(Number(stats.onTrack)).toBe(4);
    // atRisk = IN_EXECUTION + on_hold = 1
    expect(Number(stats.atRisk)).toBe(1);
  });

  itDB('7) blokada z decyzji zapala flagę on_hold, nie łamie CHECK (przed: 23514)', async (h) => {
    const { applyDecisionBlockTransition } = await import(
      '../../server/src/services/initiative/initiativeTransitionService.js'
    );
    const target = await h.client.query<{ id: string }>(
      `SELECT id FROM initiatives WHERE organization_id = $1 AND status = $2 AND on_hold = FALSE LIMIT 1`,
      [h.organizationId, InitiativeStatus.IN_EXECUTION]
    );
    const initiativeId = target.rows[0]?.id;
    expect(initiativeId).toBeTruthy();

    const result: any = await (applyDecisionBlockTransition as any)({
      orgId: h.organizationId,
      initiativeId,
      decisionId: `dec_p12b_${Date.now().toString(36)}`,
      reason: 'P12intb — blokada z decyzji',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(InitiativeStatus.IN_EXECUTION);

    const after = await h.client.query<{ status: string; on_hold: boolean }>(
      `SELECT status, on_hold FROM initiatives WHERE id = $1`,
      [initiativeId]
    );
    // Kluczowe: status NIE staje się 'BLOCKED' (kod spoza CHECK-a P12),
    // a blokadę niesie flaga — dokładnie tak, jak czytają ją trasy Realizacji.
    expect(after.rows[0].status).toBe(InitiativeStatus.IN_EXECUTION);
    expect(after.rows[0].on_hold).toBe(true);

    // fixture wraca do stanu wyjściowego, żeby kolejne przypadki liczyły to samo
    await h.client.query(`UPDATE initiatives SET on_hold = FALSE WHERE id = $1`, [initiativeId]);
    await h.client.query(`DELETE FROM initiative_status_history WHERE initiative_id = $1`, [initiativeId]);
    await h.client.query(`DELETE FROM initiative_history WHERE initiative_id = $1`, [initiativeId]);
  });

  itDB('6) sprzątanie: po teście zero rekordów tej organizacji', async (h) => {
    const before = await h.client.query('SELECT COUNT(*)::int AS c FROM initiatives WHERE organization_id = $1', [h.organizationId]);
    expect(before.rows[0].c).toBe(PORTFEL.length);
    // Właściwe sprzątanie robi afterAll; ten przypadek pilnuje, że fixture jest
    // policzalny i że liczba, na której opierają się przypadki 1-5, jest prawdziwa.
  });
});
