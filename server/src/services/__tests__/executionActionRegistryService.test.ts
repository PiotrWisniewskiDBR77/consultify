import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
const mockRun = vi.fn();
vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockGet(...args),
  run: (...args: unknown[]) => mockRun(...args),
}));

import {
  executeGovernedExecutionAction,
  recordExecutionActionAudit,
  requireImplementedExecutionAction,
} from '../executionActionRegistryService.js';

const IMPLEMENTED_ACTIONS = [
  'case.close', 'case.cancel', 'case.wait.cancel', 'case.run.cancel',
  'case.artifact.unlink', 'case.proposal.decide', 'case.proposal.execute',
  'case.proposal.revoke', 'execution.budget.delete',
] as const;

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

  it.each(IMPLEMENTED_ACTIONS)('governs and audits success for %s', async (actionId) => {
    mockGet.mockResolvedValue({
      action_id: actionId, target_type: 'target', destructive: true,
      minimum_role: 'ADMIN', runtime_state: 'IMPLEMENTED', audit_required: true,
    });
    mockRun.mockResolvedValue({ changes: 1 });
    const operation = vi.fn().mockResolvedValue({ id: 'target-a' });
    await expect(executeGovernedExecutionAction({
      organizationId: 'org-a', actionId, targetId: 'target-a', actorId: 'actor-a',
      membershipRole: 'ADMIN', operation,
    })).resolves.toEqual({ id: 'target-a' });
    expect(operation).toHaveBeenCalledOnce();
    expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('execution_action_audit'),
      ['org-a', actionId, 'target-a', 'actor-a', 'SUCCEEDED', null, null], { fallback: false });
  });

  it('enforces policy drift and audits denial before mutation', async () => {
    mockGet.mockResolvedValue({
      action_id: 'case.close', target_type: 'case', destructive: true,
      minimum_role: 'OWNER', runtime_state: 'IMPLEMENTED', audit_required: true,
    });
    mockRun.mockResolvedValue({ changes: 1 });
    const operation = vi.fn();
    await expect(executeGovernedExecutionAction({
      organizationId: 'org-a', actionId: 'case.close', targetId: 'case-a', actorId: 'actor-a',
      membershipRole: 'ADMIN', operation,
    })).rejects.toThrow('insufficient_org_role');
    expect(operation).not.toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalledWith(expect.any(String),
      ['org-a', 'case.close', 'case-a', 'actor-a', 'DENIED', 'insufficient_org_role', null],
      { fallback: false });
  });

  it('audits conflict and not-found terminal outcomes', async () => {
    mockGet.mockResolvedValue({ action_id: 'case.cancel', target_type: 'case', destructive: true,
      minimum_role: 'ADMIN', runtime_state: 'IMPLEMENTED', audit_required: true });
    mockRun.mockResolvedValue({ changes: 1 });
    await expect(executeGovernedExecutionAction({
      organizationId: 'org-a', actionId: 'case.cancel', targetId: 'case-a', actorId: 'actor-a',
      membershipRole: 'ADMIN', operation: async () => { throw new Error('case_version_conflict'); },
    })).rejects.toThrow('case_version_conflict');
    expect(mockRun).toHaveBeenLastCalledWith(expect.any(String),
      ['org-a', 'case.cancel', 'case-a', 'actor-a', 'CONFLICT', 'case_version_conflict', null],
      { fallback: false });

    mockRun.mockClear();
    await expect(executeGovernedExecutionAction({
      organizationId: 'org-a', actionId: 'case.cancel', targetId: 'missing', actorId: 'actor-a',
      membershipRole: 'ADMIN', operation: async () => false,
    })).resolves.toBe(false);
    expect(mockRun).toHaveBeenLastCalledWith(expect.any(String),
      ['org-a', 'case.cancel', 'missing', 'actor-a', 'NOT_FOUND', 'action_target_not_found', null],
      { fallback: false });
  });
});
