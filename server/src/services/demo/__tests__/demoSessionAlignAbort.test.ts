/**
 * Wpis 83 · DEC-539 — CTO decision (d): a failed live aggregate align must NOT
 * fail silently. `alignCloneAggregateAfterSeed` used to swallow any `processOrg`
 * error in a `catch` that only logged, so a divergent clone became observable
 * (the exact defect D-19 exists to prevent) and an orphan org was left behind.
 *
 * Locked down here: when `processOrg` throws, `startDemoSession` MUST
 *  1) reject (propagate the ORIGINAL error — no session object is returned),
 *  2) run the compensating purge of the freshly minted per-user tenant
 *     (`deleteDemoDatasetForOrganization` on the clone org, never the base org),
 *  3) commit NO `demo_sessions` row and NO session preferences, so the divergent
 *     clone is never observable.
 *
 * The database is a mocked `DbPromise` seam and `pg` is mocked so the align path
 * actually runs (a reachable DATABASE_URL is set + NODE_ENV=test); `processOrg`
 * is stubbed to throw. These are assertions about the service's own saga logic —
 * no real database is contacted.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const DEMO_ORG_ID = 'demo-org';

const ctx = vi.hoisted(() => ({
  prefs: new Map<string, string>(),
  sessions: [] as Array<Record<string, string>>,
  seedCalls: [] as string[],
  deletedOrgs: [] as string[],
  deleteThrows: false,
  /** When true, the stubbed `processOrg` throws — the align failure under test. */
  alignThrows: false,
  processOrgCalls: [] as string[],
}));

const prefKey = (userId: unknown, key: unknown) => `${String(userId)}|${String(key)}`;

vi.mock('../../../utils/DbPromise.js', () => {
  const get = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (/FROM user_preferences/i.test(sql)) {
      const value = ctx.prefs.get(prefKey(params[0], params[1]));
      return value === undefined ? null : { value };
    }
    if (/FROM demo_sessions/i.test(sql)) {
      const rows = ctx.sessions.filter((s) => s.user_id === params[0] && s.status === 'active');
      return rows[rows.length - 1] || null;
    }
    return null;
  });

  const all = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (/FROM demo_sessions/i.test(sql)) {
      if (/expires_at <= \?/i.test(sql)) {
        const now = String(params[0]);
        return ctx.sessions.filter((s) => s.status === 'active' && s.expires_at <= now);
      }
      return ctx.sessions.filter((s) => s.user_id === params[0] && s.status === 'active');
    }
    return [];
  });

  const run = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (/INSERT INTO user_preferences/i.test(sql)) {
      ctx.prefs.set(prefKey(params[0], params[1]), String(params[2]));
    } else if (/DELETE FROM user_preferences/i.test(sql)) {
      ctx.prefs.delete(prefKey(params[0], params[1]));
    } else if (/INSERT INTO demo_sessions/i.test(sql)) {
      ctx.sessions.push({
        id: String(params[0]),
        user_id: String(params[1]),
        base_org_id: String(params[2]),
        session_org_id: String(params[3]),
        locale: String(params[4]),
        source: String(params[5]),
        status: String(params[6]),
        anchor_date: String(params[7]),
        expires_at: String(params[8]),
      });
    } else if (/UPDATE demo_sessions SET status/i.test(sql)) {
      const status = /'expired'/.test(sql) ? 'expired' : 'ended';
      const id = String(params[params.length - 1]);
      const row = ctx.sessions.find((s) => s.id === id);
      if (row) row.status = status;
    }
    return { success: true, changes: 1 };
  });

  return {
    get,
    all,
    run,
    transaction: vi.fn(async () => ({ success: true, results: [] })),
    tableExists: vi.fn(async () => true),
    columnExists: vi.fn(async () => true),
    exec: vi.fn(async () => ({ success: true })),
    safeAll: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    default: {},
  };
});

// Literal, not the `DEMO_ORG_ID` const: vi.mock factories are hoisted above it.
vi.mock('../../../middleware/demoGuard.middleware.js', () => ({
  DEMO_ORG_ID: 'demo-org',
  DEMO_ORG_NAME: 'Atelier Toys',
}));

// The align helper builds `new pg.Client(...)` and calls connect/query/end. Mock
// the module so no real socket is opened; the connect/end spies let the helper
// reach `processOrg`, which is stubbed separately below.
vi.mock('pg', () => {
  class Client {
    connectionString: string;
    constructor(config: { connectionString: string }) {
      this.connectionString = config?.connectionString ?? '';
    }
    async connect() {
      return undefined;
    }
    async query() {
      return { rows: [] };
    }
    async end() {
      return undefined;
    }
  }
  return { default: { Client }, Client };
});

vi.mock('../../initiatives/alignInitiativeAggregateService.js', () => ({
  processOrg: vi.fn(async (_client: unknown, organizationId: string) => {
    ctx.processOrgCalls.push(organizationId);
    if (ctx.alignThrows) throw new Error('aggregate align blew up');
    return {
      counts: {
        align: 1,
        'skip-aligned': 0,
        'skip-short-circuit': 0,
        'skip-no-stage': 0,
      },
      wrote: 1,
      allowed: true,
    };
  }),
}));

vi.mock('../demoSeedService.js', () => ({
  seedAtelierToysDemoDataset: vi.fn(async ({ organizationId }: { organizationId: string }) => {
    ctx.seedCalls.push(organizationId);
    return {
      organizationId,
      anchorDate: '2026-06-01T00:00:00.000Z',
      locale: 'en',
      counts: {
        users: 1,
        projects: 1,
        initiatives: 1,
        tasks: 1,
        decisions: 1,
        reports: 1,
        docs: 1,
        decks: 3,
      },
      failures: [],
      complete: true,
      scenarios: [],
      toolCoverage: [],
    };
  }),
  deleteDemoDatasetForOrganization: vi.fn(async (organizationId: string) => {
    if (ctx.deleteThrows) throw new Error('purge refused');
    ctx.deletedOrgs.push(organizationId);
  }),
  getDemoDatasetStats: vi.fn(async () => ({
    projects: 1,
    initiatives: 1,
    tasks: 1,
    decisions: 1,
    users: 1,
  })),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { startDemoSession } from '../demoSessionService.js';

const USER = 'user-align';

beforeEach(() => {
  ctx.prefs.clear();
  ctx.sessions.length = 0;
  ctx.seedCalls.length = 0;
  ctx.deletedOrgs.length = 0;
  ctx.deleteThrows = false;
  ctx.alignThrows = false;
  ctx.processOrgCalls.length = 0;
  delete process.env.DEMO_USE_BASE_ORG;
  // A reachable DATABASE_URL + NODE_ENV=test so resolveReachableDatabaseUrl
  // resolves and the align path runs (instead of taking the no-URL skip branch).
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgres://postgres:qoder@127.0.0.1:6610/consultify_b4';
});

describe('demo session — a failed live aggregate align aborts provisioning', () => {
  it('★ processOrg throwing propagates: startDemoSession rejects, no session is returned', async () => {
    ctx.alignThrows = true;

    await expect(startDemoSession(USER)).rejects.toThrow(/aggregate align blew up/i);
    // The align step really ran (premise: this is an align failure, not a skip).
    expect(ctx.processOrgCalls.length).toBe(1);
  });

  it('★ leaves no divergent, observable clone: dataset purged, no demo_sessions row, no preferences', async () => {
    ctx.alignThrows = true;

    await startDemoSession(USER).catch(() => undefined);

    // The partial tenant of the freshly minted clone was purged…
    expect(ctx.deletedOrgs).toEqual([ctx.seedCalls[0]]);
    // …and it is a derived per-user org, never the curated base org.
    expect(ctx.deletedOrgs[0]).not.toBe(DEMO_ORG_ID);
    expect(ctx.deletedOrgs[0]).toContain(`${DEMO_ORG_ID}-session-`);
    // …and nothing was committed that would make the divergent clone look live.
    expect(ctx.sessions.filter((s) => s.status === 'active')).toEqual([]);
    expect(ctx.prefs.get(prefKey(USER, 'demo:session_id'))).toBeUndefined();
  });

  it('★ the compensating purge runs even when it itself throws — the align error still propagates', async () => {
    ctx.alignThrows = true;
    ctx.deleteThrows = true;

    await expect(startDemoSession(USER)).rejects.toThrow(/aggregate align blew up/i);
    expect(ctx.sessions.filter((s) => s.status === 'active')).toEqual([]);
  });

  it('a SUCCESSFUL align still creates the session (control — the abort is not over-eager)', async () => {
    const session = await startDemoSession(USER);

    expect(ctx.processOrgCalls.length).toBe(1);
    expect(ctx.deletedOrgs).toEqual([]);
    expect(session.session_org_id).toContain(`${DEMO_ORG_ID}-session-`);
    expect(ctx.sessions.filter((s) => s.status === 'active')).toHaveLength(1);
  });
});
