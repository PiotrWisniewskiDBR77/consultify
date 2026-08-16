/**
 * MAT-006B — a resume must not FABRICATE a complete dataset, and a failed
 * required seed must not leave a half-provisioned tenant.
 *
 * Two defects are locked down here.
 *
 * 1. `resolveOrCreateDemoSession` used to hand back `datasetComplete: true` from
 *    its resume branch and from the `DEMO_USE_BASE_ORG` branch, with the comment
 *    "no seed ran, so there is no failure to report". That is the fallacy: no
 *    seed ran means the outcome is UNKNOWN, and unknown is not complete. A
 *    session whose seed had actually failed would report `true` on every reload
 *    after the first.
 *
 * 2. `startDemoSession` seeded a brand-new per-user tenant and then persisted the
 *    `demo_sessions` / `demo_session_tenants` rows regardless of the seed result,
 *    so a failed REQUIRED stage produced a live-looking, content-less tenant.
 *
 * The database is a mocked `DbPromise` seam (an in-memory stand-in for
 * `user_preferences` + `demo_sessions`), so these are assertions about the
 * service's own logic — no real database is contacted.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const DEMO_ORG_ID = 'demo-org';

const ctx = vi.hoisted(() => ({
  prefs: new Map<string, string>(),
  sessions: [] as Array<Record<string, string>>,
  /** Result the stubbed seed returns. */
  seed: {
    complete: true,
    failures: [] as Array<{ stage: string; detail: string }>,
  },
  seedCalls: [] as string[],
  deletedOrgs: [] as string[],
  /** When true, the compensating delete itself throws. */
  deleteThrows: false,
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
        decks: ctx.seed.complete ? 3 : 0,
      },
      failures: ctx.seed.failures,
      complete: ctx.seed.complete,
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

import {
  DemoDatasetIncompleteError,
  isDemoDatasetIncompleteError,
  resolveOrCreateDemoSession,
  startDemoSession,
} from '../demoSessionService.js';

const USER = 'user-1';
const DECK_FAILURES = [
  { stage: 'presentation_decks', detail: 'line-3: rolled back' },
  { stage: 'presentation_decks', detail: 'board-update: rolled back' },
  { stage: 'presentation_decks', detail: 'value-story: rolled back' },
];

beforeEach(() => {
  ctx.prefs.clear();
  ctx.sessions.length = 0;
  ctx.seed = { complete: true, failures: [] };
  ctx.seedCalls.length = 0;
  ctx.deletedOrgs.length = 0;
  ctx.deleteThrows = false;
  delete process.env.DEMO_USE_BASE_ORG;
});

describe('demo session — dataset signal is first-hand or admitted unknown', () => {
  it('startDemoSession reports its OWN seed outcome and records it', async () => {
    const session = await startDemoSession(USER);

    expect(session.datasetComplete).toBe(true);
    expect(session.datasetFailures).toEqual([]);
    expect(session.datasetStatusReason).toBe('seeded_in_this_call');

    const recorded = JSON.parse(
      ctx.prefs.get(prefKey(USER, 'demo:session_dataset_outcome')) || '{}'
    );
    expect(recorded).toMatchObject({ sessionId: session.id, complete: true });
  });

  it('★ a resumed session does NOT report complete: true when no seed ran and nothing is on record', async () => {
    // A session row exists (as after a server restart or a lost preference) but
    // no seed outcome is recorded for it.
    ctx.sessions.push({
      id: 'demo-session-orphan',
      user_id: USER,
      base_org_id: DEMO_ORG_ID,
      session_org_id: `${DEMO_ORG_ID}-session-user1-orphan`,
      locale: 'en',
      source: 'demo_toggle',
      status: 'active',
      anchor_date: '2026-06-01T00:00:00.000Z',
      expires_at: '2999-01-01T00:00:00.000Z',
    });

    const session = await resolveOrCreateDemoSession(USER);

    expect(ctx.seedCalls).toEqual([]); // premise: this really was a resume
    expect(session.datasetComplete).toBeNull();
    expect(session.datasetComplete).not.toBe(true);
    expect(session.datasetStatusReason).toBe('resumed_session_no_seed_record');
    expect(session.datasetFailures).toEqual([]);
  });

  it('a resumed session QUOTES the recorded outcome of the seed that built it', async () => {
    const started = await startDemoSession(USER);
    ctx.seedCalls.length = 0;

    const resumed = await resolveOrCreateDemoSession(USER);

    expect(ctx.seedCalls).toEqual([]);
    expect(resumed.id).toBe(started.id);
    expect(resumed.datasetComplete).toBe(true);
    expect(resumed.datasetStatusReason).toBe('resumed_session_recorded_outcome');
  });

  it('★ a recorded outcome belonging to a DIFFERENT session is not reused', async () => {
    await startDemoSession(USER);
    // Same user, new session id — e.g. the record survived a session swap.
    ctx.sessions[0].id = 'demo-session-somethingelse';

    const resumed = await resolveOrCreateDemoSession(USER);

    expect(resumed.datasetComplete).toBeNull();
    expect(resumed.datasetStatusReason).toBe('resumed_session_no_seed_record');
  });

  it('★ DEMO_USE_BASE_ORG reports unknown, not complete — the base org is seeded out of band', async () => {
    process.env.DEMO_USE_BASE_ORG = 'true';

    const fresh = await resolveOrCreateDemoSession(USER);
    expect(ctx.seedCalls).toEqual([]);
    expect(fresh.datasetComplete).toBeNull();
    expect(fresh.datasetStatusReason).toBe('base_org_not_seeded_by_this_call');

    const resumed = await resolveOrCreateDemoSession(USER);
    expect(resumed.datasetComplete).toBeNull();
    expect(resumed.datasetStatusReason).toBe('base_org_not_seeded_by_this_call');
  });
});

describe('demo session provisioning saga — an incomplete required seed aborts and cleans up', () => {
  it('★ throws DemoDatasetIncompleteError instead of returning a session', async () => {
    ctx.seed = { complete: false, failures: DECK_FAILURES };

    await expect(startDemoSession(USER)).rejects.toBeInstanceOf(DemoDatasetIncompleteError);
  });

  it('★ leaves no half-provisioned tenant: dataset purged, no demo_sessions row, no preferences', async () => {
    ctx.seed = { complete: false, failures: DECK_FAILURES };

    const error = await startDemoSession(USER).catch((e) => e);

    expect(isDemoDatasetIncompleteError(error)).toBe(true);
    expect(error.failures).toEqual(DECK_FAILURES);
    expect(error.cleanedUp).toBe(true);
    // The partial dataset of the freshly minted tenant was purged…
    expect(ctx.deletedOrgs).toEqual([ctx.seedCalls[0]]);
    // …and it is a derived per-user org, never the curated base org.
    expect(ctx.deletedOrgs[0]).not.toBe(DEMO_ORG_ID);
    expect(ctx.deletedOrgs[0]).toContain(`${DEMO_ORG_ID}-session-`);
    // …and nothing was committed that would make it look live.
    expect(ctx.sessions.filter((s) => s.status === 'active')).toEqual([]);
    expect(ctx.prefs.get(prefKey(USER, 'demo:session_id'))).toBeUndefined();
    expect(ctx.prefs.get(prefKey(USER, 'demo:session_dataset_outcome'))).toBeUndefined();
  });

  it('★ says so when the rollback itself failed, instead of claiming a clean abort', async () => {
    ctx.seed = { complete: false, failures: DECK_FAILURES };
    ctx.deleteThrows = true;

    const error = await startDemoSession(USER).catch((e) => e);

    expect(isDemoDatasetIncompleteError(error)).toBe(true);
    expect(error.cleanedUp).toBe(false);
    expect(ctx.sessions.filter((s) => s.status === 'active')).toEqual([]);
  });

  it('★ resolveOrCreateDemoSession propagates the abort — no session is minted on a failed seed', async () => {
    ctx.seed = { complete: false, failures: DECK_FAILURES };

    const error = await resolveOrCreateDemoSession(USER).catch((e) => e);

    expect(isDemoDatasetIncompleteError(error)).toBe(true);
    expect(ctx.sessions.filter((s) => s.status === 'active')).toEqual([]);
  });
});
