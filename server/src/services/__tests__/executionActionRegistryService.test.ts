import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
const mockRun = vi.fn();
vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockGet(...args),
  run: (...args: unknown[]) => mockRun(...args),
}));

import {
  recordExecutionActionAudit,
  requireImplementedExecutionAction,
} from '../executionActionRegistryService.js';

describe('execution action registry runtime truth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fails closed for a hidden or missing action', async () => {
    mockGet.mockResolvedValue({
      action_id: 'execution.initiative.delete',
      target_type: 'initiative',
      destructive: true,
      minimum_role: 'OWNER',
      runtime_state: 'HIDDEN',
      audit_required: true,
    });
    await expect(requireImplementedExecutionAction('execution.initiative.delete')).rejects.toThrow(
      'execution_action_hidden_or_unregistered'
    );
  });

  it('returns implemented policy and writes immutable audit with fallback disabled', async () => {
    mockGet.mockResolvedValue({
      action_id: 'execution.budget.delete',
      target_type: 'budget_entry',
      destructive: true,
      minimum_role: 'ADMIN',
      runtime_state: 'IMPLEMENTED',
      audit_required: true,
    });
    const policy = await requireImplementedExecutionAction('execution.budget.delete');
    expect(policy.minimumRole).toBe('ADMIN');
    await recordExecutionActionAudit({
      organizationId: 'org-a',
      actionId: policy.actionId,
      targetId: 'entry-a',
      actorId: 'actor-a',
      outcome: 'SUCCEEDED',
      requestId: 'request-a',
    });
    expect(mockRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO execution_action_audit'),
      ['org-a', 'execution.budget.delete', 'entry-a', 'actor-a', 'SUCCEEDED', null, 'request-a'],
      { fallback: false }
    );
  });
});
