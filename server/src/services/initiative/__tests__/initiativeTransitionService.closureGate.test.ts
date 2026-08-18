import { beforeEach, describe, expect, it, vi } from 'vitest';

const { assertCurrentMock, getTableColumnsMock, queryMock, withPgTransactionMock } = vi.hoisted(
  () => ({
    assertCurrentMock: vi.fn(),
    getTableColumnsMock: vi.fn(),
    queryMock: vi.fn(),
    withPgTransactionMock: vi.fn(),
  })
);

vi.mock('../../../utils/queryHelpers.js', () => ({
  getTableColumns: getTableColumnsMock,
  queryAll: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn(),
  withPgTransaction: withPgTransactionMock,
}));

vi.mock('../initiativeCapabilityMatrix.js', () => ({
  canExecuteGate: vi.fn().mockReturnValue(true),
  resolveGateRequiredRoles: vi.fn().mockReturnValue(['INITIATIVE_OWNER', 'PMO']),
  resolveInitiativeCapabilityContext: vi.fn().mockResolvedValue({
    effectiveRoles: ['PMO'],
    steeringBoardEnabled: false,
  }),
}));

vi.mock('../initiativeLifecycleGateDecisionService.js', () => ({
  assertCurrentApprovedInitiativeLifecycleGateDecision: assertCurrentMock,
}));

vi.mock('../initiativeGateReadinessService.js', () => ({
  getBlockingReadinessItems: vi.fn().mockResolvedValue([]),
}));

vi.mock('../initiativeGateAiConfig.js', () => ({
  isInitiativeGateAiEnabled: vi.fn().mockResolvedValue(false),
}));

import { executeInitiativeTransition } from '../initiativeTransitionService.js';

describe('initiativeTransitionService EXECUTING -> DONE canonical closure gate', () => {
  let openTasks: number;
  let openMilestones: number;

  beforeEach(() => {
    openTasks = 0;
    openMilestones = 0;
    assertCurrentMock.mockReset().mockRejectedValue(new Error('canonical_closure_missing'));
    getTableColumnsMock.mockReset().mockResolvedValue([]);
    queryMock.mockReset().mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM initiatives')) {
        return {
          rows: [
            {
              id: 'initiative-1',
              organization_id: 'org-1',
              status: 'EXECUTING',
              name: 'Canonical closure test',
            },
          ],
          rowCount: 1,
        };
      }
      if (
        sql.includes('SELECT id FROM tasks') ||
        sql.includes('SELECT id FROM initiative_milestones')
      ) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('AS open_tasks') && sql.includes('AS open_milestones')) {
        return {
          rows: [{ open_tasks: openTasks, open_milestones: openMilestones }],
          rowCount: 1,
        };
      }
      throw new Error(`unexpected owner write: ${sql}`);
    });
    withPgTransactionMock.mockReset().mockImplementation(async (fn) => fn({ query: queryMock }));
  });

  it('blocks DONE before any owner write when the canonical CLOSURE decision is absent', async () => {
    const result = await executeInitiativeTransition({
      orgId: 'org-1',
      initiativeId: 'initiative-1',
      actorId: 'human-1',
      actorRole: 'PMO',
      expectedCurrentStatus: 'EXECUTING',
      nextStatusInput: 'DONE',
    });

    expect(result).toEqual({
      ok: false,
      statusCode: 400,
      body: {
        error: 'An approved Closure decision is required to complete this initiative',
        rule: 'CLOSURE_GATE_DECISION_REQUIRED',
      },
    });
    expect(assertCurrentMock).toHaveBeenCalledWith(expect.objectContaining({ query: queryMock }), {
      organizationId: 'org-1',
      initiativeId: 'initiative-1',
      pmoDomain: 'CLOSURE',
    });
    expect(queryMock.mock.calls.some(([sql]) => sql.includes('UPDATE initiatives'))).toBe(false);
    expect(queryMock.mock.calls.some(([sql]) => sql.includes('initiative_history'))).toBe(false);
  });

  it('uses a caller-pinned client without opening or committing a nested transaction', async () => {
    const pinnedClient = { query: queryMock } as any;
    const result = await executeInitiativeTransition({
      orgId: 'org-1',
      initiativeId: 'initiative-1',
      actorId: 'human-1',
      actorRole: 'PMO',
      expectedCurrentStatus: 'EXECUTING',
      nextStatusInput: 'DONE',
      transactionClient: pinnedClient,
      deferPostCommitEffect: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(withPgTransactionMock).not.toHaveBeenCalled();
    expect(assertCurrentMock).toHaveBeenCalledWith(pinnedClient, expect.any(Object));
  });

  it.each([
    { label: 'task', tasks: 1, milestones: 0 },
    { label: 'milestone', tasks: 0, milestones: 1 },
  ])('blocks DONE when a canonical $label remains incomplete', async ({ tasks, milestones }) => {
    openTasks = tasks;
    openMilestones = milestones;
    assertCurrentMock.mockResolvedValue({ decisionId: 'closure-decision-1' });

    const result = await executeInitiativeTransition({
      orgId: 'org-1',
      initiativeId: 'initiative-1',
      actorId: 'human-1',
      actorRole: 'PMO',
      expectedCurrentStatus: 'EXECUTING',
      nextStatusInput: 'DONE',
    });

    expect(result).toEqual({
      ok: false,
      statusCode: 400,
      body: {
        error: 'All Initiative tasks and milestones must be complete before closure',
        rule: 'CLOSURE_WORK_INCOMPLETE',
        openTasks: tasks,
        openMilestones: milestones,
      },
    });
    expect(queryMock.mock.calls.some(([sql]) => sql.includes('SELECT id FROM tasks'))).toBe(true);
    expect(
      queryMock.mock.calls.some(([sql]) => sql.includes('SELECT id FROM initiative_milestones'))
    ).toBe(true);
    expect(queryMock.mock.calls.some(([sql]) => sql.includes('UPDATE initiatives'))).toBe(false);
    expect(queryMock.mock.calls.some(([sql]) => sql.includes('initiative_history'))).toBe(false);
  });
});
