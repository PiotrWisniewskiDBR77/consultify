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
  v4: () => 'typed-action-uuid',
}));

describe('FinalBatchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes getAction to the organization', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'a1' });

    const { finalBatchService } = await import('../../../../server/src/services/finalBatchService.js');
    await finalBatchService.getAction('org-1', 'a1');

    expect(mockQueryFirst).toHaveBeenCalledWith(
      expect.stringContaining('organization_id=$2'),
      ['a1', 'org-1'],
    );
  });

  it('reuses an existing action for the same org idempotency key', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'existing-action' });

    const { finalBatchService } = await import('../../../../server/src/services/finalBatchService.js');
    const result = await finalBatchService.proposeAction('org-1', {
      actionType: 'update',
      targetEntityType: 'report',
      proposedChanges: { title: 'Next' },
      idempotencyKey: 'idem-1',
      proposedBy: 'user-1',
    });

    expect(result).toEqual({ id: 'existing-action', reused: true });
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('blocks acceptance when caller role is below required role', async () => {
    mockQueryFirst.mockResolvedValue({
      id: 'a1',
      status: 'proposed',
      rbac_required_role: 'ADMIN',
    });

    const { finalBatchService } = await import('../../../../server/src/services/finalBatchService.js');
    const result = await finalBatchService.acceptAction('org-1', 'a1', 'user-1', 'TEAM_MEMBER');

    expect(result).toEqual({
      ok: false,
      reason: 'insufficient_role',
      requiredRole: 'ADMIN',
    });
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('accepts action only within the same organization', async () => {
    mockQueryFirst.mockResolvedValue({
      id: 'a1',
      status: 'proposed',
      rbac_required_role: 'ADMIN',
    });
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { finalBatchService } = await import('../../../../server/src/services/finalBatchService.js');
    const result = await finalBatchService.acceptAction('org-1', 'a1', 'user-1', 'ADMIN');

    expect(result).toEqual({ ok: true });
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('organization_id=$3'),
      ['user-1', 'a1', 'org-1'],
    );
  });

  it('executes only accepted actions in the same organization', async () => {
    mockQueryRun.mockResolvedValue({ changes: 0 });

    const { finalBatchService } = await import('../../../../server/src/services/finalBatchService.js');
    const result = await finalBatchService.executeAction('org-1', 'a1', { applied: true });

    expect(result).toEqual({ ok: false });
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('organization_id=$3'),
      [JSON.stringify({ applied: true }), 'a1', 'org-1'],
    );
  });
});
