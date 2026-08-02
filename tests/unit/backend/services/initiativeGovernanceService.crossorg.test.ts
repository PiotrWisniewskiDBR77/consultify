/**
 * M13 L-09 — cross-org IDOR guard for InitiativeGovernanceService (b9f2dee9d2).
 *
 * The governance service is the spine that links goals ↔ initiatives ↔ decisions
 * and evaluates gates. Before b9f2dee9d2 several methods scoped only the primary
 * row by id, letting org A attach / read / probe org B's records by guessing an
 * id (an IDOR). The fix added `AND organization_id=$n` ownership lookups that
 * short-circuit BEFORE any mutation.
 *
 * These tests pin that contract WITHOUT a real database (queryHelpers is fully
 * mocked) — so they are safe to run against a dev env whose .env points at the
 * Railway PROD DB (no mutating statement ever reaches a connection). The guard is
 * proven two ways:
 *   1. Behaviour — when the org-scoped ownership lookup returns null (the row
 *      lives in another org), the method throws 404 / returns [] and performs NO
 *      INSERT/DELETE/UPDATE.
 *   2. SQL shape — the ownership + probe lookups carry `organization_id` bound to
 *      the CALLER's org, so a foreign id cannot be resolved.
 * A same-org positive control proves the guard blocks cross-org only, not all writes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryAll = vi.fn();
const mockQueryFirst = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryFirst: (...args: unknown[]) => mockQueryFirst(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'uuid-fixed'),
}));

const ORG_A = 'org-A';
const ORG_B = 'org-B';

async function svc() {
  const mod = await import('../../../../server/src/services/initiativeGovernanceService.js');
  return mod.initiativeGovernanceService;
}

/** A queryHelpers.queryRun call is a mutation iff its SQL is INSERT/UPDATE/DELETE. */
function mutationCalls() {
  return mockQueryRun.mock.calls.filter(([sql]) => /\b(INSERT|UPDATE|DELETE)\b/i.test(String(sql)));
}

/** Every ownership/probe lookup must be org-scoped. */
function everyQueryFirstIsOrgScoped() {
  return mockQueryFirst.mock.calls.every(([sql]) => /organization_id\s*=\s*\$\d/i.test(String(sql)));
}

describe('M13 L-09 — InitiativeGovernanceService cross-org IDOR guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockQueryAll.mockResolvedValue([]);
  });

  // ── linkGoalToInitiative ────────────────────────────────────────────────────

  it('linkGoalToInitiative rejects a goal owned by another org (no link written)', async () => {
    // getGoal() returns null → org A cannot see org B's goal.
    mockQueryFirst.mockResolvedValueOnce(null);
    const s = await svc();

    await expect(s.linkGoalToInitiative(ORG_A, 'goal-of-B', 'init-of-A')).rejects.toMatchObject({
      status: 404,
    });
    expect(mutationCalls()).toHaveLength(0);
    expect(everyQueryFirstIsOrgScoped()).toBe(true);
  });

  it('linkGoalToInitiative rejects an initiative owned by another org (no link written)', async () => {
    mockQueryFirst
      .mockResolvedValueOnce({ id: 'goal-of-A', organization_id: ORG_A }) // getGoal ok
      .mockResolvedValueOnce(null); // initiative lookup scoped to ORG_A → foreign init invisible
    const s = await svc();

    await expect(s.linkGoalToInitiative(ORG_A, 'goal-of-A', 'init-of-B')).rejects.toMatchObject({
      status: 404,
    });
    expect(mutationCalls()).toHaveLength(0);
    // The initiative ownership lookup must be bound to the caller's org.
    const initLookup = mockQueryFirst.mock.calls.find(([sql]) =>
      /FROM\s+initiatives/i.test(String(sql))
    );
    expect(initLookup).toBeDefined();
    expect(String(initLookup![0])).toMatch(/organization_id\s*=\s*\$2/i);
    expect(initLookup![1]).toContain(ORG_A);
  });

  it('linkGoalToInitiative writes the link for same-org goal + initiative (positive control)', async () => {
    mockQueryFirst
      .mockResolvedValueOnce({ id: 'goal-of-A', organization_id: ORG_A })
      .mockResolvedValueOnce({ id: 'init-of-A' });
    const s = await svc();

    await s.linkGoalToInitiative(ORG_A, 'goal-of-A', 'init-of-A');
    expect(
      mockQueryRun.mock.calls.some(([sql]) =>
        /INSERT INTO goal_initiative_links/i.test(String(sql))
      )
    ).toBe(true);
  });

  // ── getGoalInitiatives / unlinkGoalFromInitiative ───────────────────────────

  it('getGoalInitiatives returns [] for a goal in another org (no rollup query)', async () => {
    mockQueryFirst.mockResolvedValueOnce(null); // getGoal scoped to ORG_A
    const s = await svc();

    await expect(s.getGoalInitiatives(ORG_A, 'goal-of-B')).resolves.toEqual([]);
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  it('unlinkGoalFromInitiative rejects a goal in another org (no delete)', async () => {
    mockQueryFirst.mockResolvedValueOnce(null);
    const s = await svc();

    await expect(
      s.unlinkGoalFromInitiative(ORG_A, 'goal-of-B', 'init-x')
    ).rejects.toMatchObject({ status: 404 });
    expect(mutationCalls()).toHaveLength(0);
  });

  // ── RES-10: getGoalRollup tenant fail-closed ───────────────────────────────
  //
  // getGoalRollup was the ONE goal method the M13 L-09 sweep missed. It called the
  // org-scoped getGoal() but did not short-circuit on null, then read two tables
  // with NO organization_id:
  //     SELECT * FROM goal_initiative_links WHERE goal_id=$1
  //     SELECT id, progress FROM goals WHERE parent_goal_id=$1
  // A foreign goalId therefore returned {goal:null, linkedInitiatives:N, childGoals:M,
  // rollupProgress:X} — counts and aggregate progress of another tenant, served 200.
  // These tests pin the fail-closed contract: null out, and NOT ONE rollup query.

  /** Answers the unscoped rollup reads as if org B's data were there to leak. */
  function armForeignRollupData() {
    mockQueryAll.mockImplementation(async (sql: string) => {
      if (/goal_initiative_links/i.test(sql) && !/JOIN\s+initiatives/i.test(sql)) {
        return [
          { contribution_weight: 1, initiative_id: 'init-of-B-1' },
          { contribution_weight: 1, initiative_id: 'init-of-B-2' },
        ];
      }
      if (/FROM\s+goals\s+WHERE\s+parent_goal_id/i.test(sql)) {
        return [
          { id: 'child-of-B-1', progress: 80 },
          { id: 'child-of-B-2', progress: 40 },
        ];
      }
      return [];
    });
  }

  it('getGoalRollup returns null for a goal in another org (no rollup query, no leak)', async () => {
    mockQueryFirst.mockResolvedValueOnce(null); // getGoal scoped to ORG_A → foreign goal invisible
    armForeignRollupData();
    const s = await svc();

    const result = await s.getGoalRollup(ORG_A, 'goal-of-B');

    // Fail-closed: nothing at all comes back — not a shape with null fields.
    expect(result).toBeNull();
    // The guard must fire BEFORE any rollup read. This is the assertion that would
    // have caught the original defect: the leak was in queryAll, not in the return.
    expect(mockQueryAll).not.toHaveBeenCalled();
    expect(mutationCalls()).toHaveLength(0);
    // And the ownership lookup that gated it was bound to the CALLER's org.
    expect(everyQueryFirstIsOrgScoped()).toBe(true);
    expect(mockQueryFirst.mock.calls[0]?.[1]).toContain(ORG_A);
  });

  it('getGoalRollup returns null for a goal id that exists nowhere (no rollup query)', async () => {
    mockQueryFirst.mockResolvedValueOnce(null);
    const s = await svc();

    await expect(s.getGoalRollup(ORG_A, 'goal-does-not-exist')).resolves.toBeNull();
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  it('getGoalRollup still computes the rollup for a same-org goal (positive control)', async () => {
    mockQueryFirst.mockResolvedValueOnce({ id: 'goal-of-A', organization_id: ORG_A });
    mockQueryAll.mockImplementation(async (sql: string) => {
      if (/goal_initiative_links/i.test(sql) && !/JOIN\s+initiatives/i.test(sql)) {
        return [{ contribution_weight: 1, initiative_id: 'init-of-A' }];
      }
      if (/FROM\s+goals\s+WHERE\s+parent_goal_id/i.test(sql)) {
        return [{ id: 'child-of-A', progress: 60 }];
      }
      if (/JOIN\s+initiatives/i.test(sql)) {
        return [{ id: 'init-of-A', progress: 40, contribution_weight: 1 }];
      }
      return [];
    });
    const s = await svc();

    const result = await s.getGoalRollup(ORG_A, 'goal-of-A');

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      goal: { id: 'goal-of-A' },
      linkedInitiatives: 1,
      childGoals: 1,
      initiativeProgressCount: 1,
      rollupProgress: 50, // (60 + 40*1) / (1 + 1)
    });
    // The initiative join stays org-bound — the guard did not replace that filter.
    const joinQuery = mockQueryAll.mock.calls.find(([sql]) =>
      /JOIN\s+initiatives/i.test(String(sql))
    );
    expect(String(joinQuery![0])).toMatch(/i\.organization_id\s*=\s*\$2/i);
    expect(joinQuery![1]).toContain(ORG_A);
  });

  // ── linkDecisionToInitiative / getInitiativeDecisions ───────────────────────

  it('linkDecisionToInitiative rejects an initiative in another org (no link written)', async () => {
    mockQueryFirst.mockResolvedValueOnce(null); // initiative lookup scoped to ORG_A
    const s = await svc();

    await expect(
      s.linkDecisionToInitiative(ORG_A, 'init-of-B', 'dec-of-A')
    ).rejects.toMatchObject({ status: 404 });
    expect(mutationCalls()).toHaveLength(0);
  });

  it('linkDecisionToInitiative rejects a decision in another org (no link written)', async () => {
    mockQueryFirst
      .mockResolvedValueOnce({ id: 'init-of-A' }) // initiative ok
      .mockResolvedValueOnce(null); // decision lookup scoped to ORG_A → foreign decision invisible
    const s = await svc();

    await expect(
      s.linkDecisionToInitiative(ORG_A, 'init-of-A', 'dec-of-B')
    ).rejects.toMatchObject({ status: 404 });
    expect(mutationCalls()).toHaveLength(0);
    const decLookup = mockQueryFirst.mock.calls.find(([sql]) =>
      /FROM\s+decisions/i.test(String(sql))
    );
    expect(decLookup).toBeDefined();
    expect(String(decLookup![0])).toMatch(/organization_id\s*=\s*\$2/i);
    expect(decLookup![1]).toContain(ORG_A);
  });

  it('getInitiativeDecisions returns [] for an initiative in another org (no detail query)', async () => {
    mockQueryFirst.mockResolvedValueOnce(null);
    const s = await svc();

    await expect(s.getInitiativeDecisions(ORG_A, 'init-of-B')).resolves.toEqual([]);
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  // ── createGovernanceGate / evaluateGate ─────────────────────────────────────

  it('createGovernanceGate rejects an initiative in another org (no gate written)', async () => {
    mockQueryFirst.mockResolvedValueOnce(null); // owner lookup scoped to ORG_A
    const s = await svc();

    await expect(
      s.createGovernanceGate(ORG_A, { initiativeId: 'init-of-B', gateName: 'G1' })
    ).rejects.toMatchObject({ status: 404 });
    expect(mutationCalls()).toHaveLength(0);
  });

  it('evaluateGate probes required decisions scoped to the gate org (cannot read another org status)', async () => {
    mockQueryFirst
      .mockResolvedValueOnce({
        required_decisions: JSON.stringify(['dec-foreign']),
        required_approvers: JSON.stringify([]),
        required_raid_status: JSON.stringify({}),
        initiative_id: 'init-of-A',
      })
      // decision probe: scoped to ORG_A → a foreign decision id resolves to null,
      // so its publish status can never leak through the gate result.
      .mockResolvedValueOnce(null);
    const s = await svc();

    const result = await s.evaluateGate(ORG_A, 'gate-1');
    expect(result).toMatchObject({ decisionsReady: false });
    expect(result?.decisionDetails).toEqual([false]);

    const decisionProbe = mockQueryFirst.mock.calls.find(([sql]) =>
      /FROM\s+decisions/i.test(String(sql))
    );
    expect(decisionProbe).toBeDefined();
    expect(String(decisionProbe![0])).toMatch(/organization_id\s*=\s*\$2/i);
    expect(decisionProbe![1]).toContain(ORG_A);
  });
});
