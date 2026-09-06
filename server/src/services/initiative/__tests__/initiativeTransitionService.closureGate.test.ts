import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, withPgTransactionMock } = vi.hoisted(() => ({ queryMock: vi.fn(), withPgTransactionMock: vi.fn() }));
vi.mock('../../../utils/queryHelpers.js', () => ({
  getTableColumns: vi.fn().mockResolvedValue([]), queryAll: vi.fn().mockResolvedValue([]), queryOne: vi.fn().mockResolvedValue(null), queryRun: vi.fn(), withPgTransaction: withPgTransactionMock,
}));
vi.mock('../initiativeCapabilityMatrix.js', () => ({ canExecuteGate: vi.fn().mockReturnValue(true), resolveGateRequiredRoles: vi.fn().mockReturnValue(['INITIATIVE_OWNER', 'PMO']), resolveInitiativeCapabilityContext: vi.fn().mockResolvedValue({ effectiveRoles: ['PMO'], steeringBoardEnabled: false }) }));
vi.mock('../initiativeLifecycleGateDecisionService.js', () => ({ assertCurrentApprovedInitiativeLifecycleGateDecision: vi.fn().mockResolvedValue({ decisionId: 'closure-1' }) }));
vi.mock('../initiativeGateReadinessService.js', () => ({ getBlockingReadinessItems: vi.fn().mockResolvedValue([]) }));
vi.mock('../initiativeGateAiConfig.js', () => ({ isInitiativeGateAiEnabled: vi.fn().mockResolvedValue(false) }));

import { executeInitiativeTransition } from '../initiativeTransitionService.js';

describe('initiativeTransitionService IN_EXECUTION -> CLOSED', () => {
  beforeEach(() => {
    queryMock.mockReset().mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM initiatives')) return { rows: [{ id: 'initiative-1', organization_id: 'org-1', status: 'IN_EXECUTION', name: 'Closure test' }], rowCount: 1 };
      if (sql.includes('SELECT COUNT(*)::text AS count FROM tasks')) return { rows: [{ count: '1' }], rowCount: 1 };
      throw new Error(`unexpected write after closure guard: ${sql}`);
    });
    withPgTransactionMock.mockReset().mockImplementation(async (fn) => fn({ query: queryMock }));
  });

  it('blocks CLOSED when an open task remains', async () => {
    const result = await executeInitiativeTransition({ orgId: 'org-1', initiativeId: 'initiative-1', actorId: 'human-1', actorRole: 'PMO', expectedCurrentStatus: 'IN_EXECUTION', nextStatusInput: 'CLOSED' });
    expect(result).toEqual({ ok: false, statusCode: 400, body: { error: 'Open tasks or blocking decisions prevent closure', rule: 'OPEN_WORK_BLOCKS_CLOSURE' } });
    expect(queryMock.mock.calls.some(([sql]) => sql.includes('UPDATE initiatives'))).toBe(false);
  });

  it('uses a caller-pinned client without a nested transaction', async () => {
    const pinnedClient = { query: queryMock } as any;
    const result = await executeInitiativeTransition({ orgId: 'org-1', initiativeId: 'initiative-1', actorId: 'human-1', actorRole: 'PMO', expectedCurrentStatus: 'IN_EXECUTION', nextStatusInput: 'CLOSED', transactionClient: pinnedClient, deferPostCommitEffect: vi.fn() });
    expect(result.ok).toBe(false);
    expect(withPgTransactionMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalled();
  });
});
