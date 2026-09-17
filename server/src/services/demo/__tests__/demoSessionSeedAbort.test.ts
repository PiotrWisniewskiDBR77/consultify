/**
 * D-69 (Wpis 86 · P1) — a seed EXCEPTION must abort provisioning exactly like
 * `seed.complete === false` does.
 *
 * Measured defect: since migration `20262260` the trigger cascade
 * (`ie_aggregate_initiative_stage_sync` -> `initiatives_lifecycle_stage_sync`)
 * rewrites a seeded `CLOSED` initiative to `DRAFT` the moment the canonical
 * register lands `REGISTERED_DRAFT`, so `ensureReceiptForMaterializedDone`
 * throws (`closureDeliveryReceiptService.ts:224`). `startDemoSession` awaited the
 * seed WITHOUT a try/catch, so the throw bypassed both compensating guards: no
 * purge ran and every failed session left an orphan clone org behind (the CTO's
 * A/B probe: 15 initiatives in a tenant nobody can reach).
 *
 * Locked down here: when the seed throws, `startDemoSession` MUST
 *  1) reject with the ORIGINAL error (no session object is returned),
 *  2) purge the freshly minted per-user tenant (never the curated base org),
 *  3) commit NO `demo_sessions` row and NO session preferences,
 *  4) still rethrow the original error when the purge itself fails.
 *
 * Mocked `DbPromise`/`pg` seams — these are assertions about the service's own
 * saga logic; no real database is contacted. The RealPG proof that the seed no
 * longer throws at all lives in `demoSeedStageParity.pg.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const DEMO_ORG_ID = 'demo-org';
const SEED_ERROR = 'materialized DONE receipt was not persisted';

const ctx = vi.hoisted(() => ({
  prefs: new Map<string, string>(),
  sessions: [] as Array<Record<string, string>>,
  seedCalls: [] as string[],
  deletedOrgs: [] as string[],
  deleteThrows: false,
  seedThrows: false,
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
  processOrg: vi.fn(async () => ({
    counts: { align: 0, 'skip-aligned': 1, 'skip-short-circuit': 0, 'skip-no-stage': 0 },
    wrote: 0,
    allowed: true,
  })),
}));

vi.mock('../demoSeedService.js', () => ({
  seedAtelierToysDemoDataset: vi.fn(async ({ organizationId }: { organizationId: string }) => {
    ctx.seedCalls.push(organizationId);
    if (ctx.seedThrows) throw new Error(SEED_ERROR);
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

const USER = 'user-d69';

beforeEach(() => {
  ctx.prefs.clear();
  ctx.sessions.length = 0;
  ctx.seedCalls.length = 0;
  ctx.deletedOrgs.length = 0;
  ctx.deleteThrows = false;
  ctx.seedThrows = false;
  delete process.env.DEMO_USE_BASE_ORG;
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgres://postgres:qoder@127.0.0.1:6612/consultify_dump';
});

describe('D-69 — a throwing seed aborts provisioning and leaves no orphan org', () => {
  it('★ the ORIGINAL seed error propagates: startDemoSession rejects, no session is returned', async () => {
    ctx.seedThrows = true;

    await expect(startDemoSession(USER)).rejects.toThrow(new RegExp(SEED_ERROR, 'i'));
    expect(ctx.seedCalls).toHaveLength(1);
  });

  it('★ the partial tenant is purged: no orphan clone org, no demo_sessions row, no preferences', async () => {
    ctx.seedThrows = true;

    await startDemoSession(USER).catch(() => undefined);

    expect(ctx.deletedOrgs).toEqual([ctx.seedCalls[0]]);
    expect(ctx.deletedOrgs[0]).not.toBe(DEMO_ORG_ID);
    expect(ctx.deletedOrgs[0]).toContain(`${DEMO_ORG_ID}-session-`);
    expect(ctx.sessions.filter((s) => s.status === 'active')).toEqual([]);
    expect(ctx.prefs.get(prefKey(USER, 'demo:session_id'))).toBeUndefined();
  });

  it('★ the compensating purge runs even when it itself throws — the seed error still propagates', async () => {
    ctx.seedThrows = true;
    ctx.deleteThrows = true;

    await expect(startDemoSession(USER)).rejects.toThrow(new RegExp(SEED_ERROR, 'i'));
    expect(ctx.deletedOrgs).toEqual([]);
    expect(ctx.sessions.filter((s) => s.status === 'active')).toEqual([]);
  });

  it('the curated base org is never purged, even when a caller passes it as the session org', async () => {
    ctx.seedThrows = true;

    await startDemoSession(USER, 'demo_toggle', 'en', DEMO_ORG_ID).catch(() => undefined);

    expect(ctx.deletedOrgs).toEqual([]);
  });

  it('a SUCCESSFUL seed still creates the session (control — the guard is not over-eager)', async () => {
    const session = await startDemoSession(USER);

    expect(ctx.deletedOrgs).toEqual([]);
    expect(session.datasetComplete).toBe(true);
    expect(ctx.sessions.filter((s) => s.status === 'active')).toHaveLength(1);
  });
});
