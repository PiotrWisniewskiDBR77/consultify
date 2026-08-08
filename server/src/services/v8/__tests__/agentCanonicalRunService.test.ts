import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGet = vi.fn();
const dbAll = vi.fn();
const dbTransaction = vi.fn();
vi.mock('../../../utils/DbPromise.js', () => ({
  get: dbGet,
  all: dbAll,
  transaction: dbTransaction,
}));

function caseRow(overrides: Record<string, unknown> = {}) {
  return {
    transformation_case_id: 'case-1',
    execution_run_id: 'run-1',
    lineage_id: 'lineage-1',
    identity_lineage_id: 'lineage-1',
    status: 'active',
    lifecycle_stage: 'execution',
    run_state: 'planning',
    run_plan_version: 3,
    ...overrides,
  };
}

describe('agentCanonicalRunService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbTransaction.mockResolvedValue({
      success: true,
      results: [{ changes: 1 }, { changes: 1 }, { changes: 1 }],
    });
    dbAll.mockImplementation((sql: string) => {
      if (sql.includes('transformation_stage_proposals')) return Promise.resolve([]);
      if (sql.includes('v8_run_state_transitions'))
        return Promise.resolve([{ transitioned_at: '2026-08-07T09:00:00Z', to_state: 'planning' }]);
      if (sql.includes('transformation_case_audit_events'))
        return Promise.resolve([
          { created_at: '2026-08-07T09:05:00Z', event_type: 'transformation_execution.started' },
        ]);
      return Promise.resolve([]);
    });
  });

  it('detects state drift from detailed transformation lifecycle to canonical run', async () => {
    dbGet.mockResolvedValueOnce(caseRow()).mockResolvedValueOnce({ count: 0 });
    const { getCanonicalTransformationRun } = await import('../agentCanonicalRunService.js');
    const result = await getCanonicalTransformationRun({
      transformationCaseId: 'case-1',
      organizationId: 'org-a',
    });
    expect(result).toEqual(
      expect.objectContaining({
        canonicalRunId: 'run-1',
        actualState: 'planning',
        projectedState: 'applying',
        stateDrift: true,
        identityRegistered: true,
      })
    );
    expect(result.timeline.map((item: any) => item.type)).toEqual([
      'run_transition',
      'transformation_event',
    ]);
  });

  it('projects a verified final output to completed regardless of an intermediate lifecycle label', async () => {
    dbGet
      .mockResolvedValueOnce(caseRow({ lifecycle_stage: 'final_outputs', run_state: 'applying' }))
      .mockResolvedValueOnce({ count: 1 });
    const { getCanonicalTransformationRun } = await import('../agentCanonicalRunService.js');
    const result = await getCanonicalTransformationRun({
      transformationCaseId: 'case-1',
      organizationId: 'org-a',
    });
    expect(result.projectedState).toBe('completed');
    expect(result.stateDrift).toBe(true);
  });

  it('reconciles drift through one optimistic transaction with transition and audit', async () => {
    dbGet
      .mockResolvedValueOnce(caseRow())
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce(caseRow({ run_state: 'applying' }))
      .mockResolvedValueOnce({ count: 0 });
    const { reconcileCanonicalTransformationRun } = await import('../agentCanonicalRunService.js');
    const result = await reconcileCanonicalTransformationRun({
      transformationCaseId: 'case-1',
      organizationId: 'org-a',
      actorUserId: 'operator-a',
      reason: 'Execution checkpoint proves applying state.',
    });
    expect(result.reconciled).toBe(true);
    expect(dbTransaction).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          sql: expect.stringContaining('UPDATE v8_execution_runs'),
          params: expect.arrayContaining(['applying', 'run-1', 'org-a', 'planning']),
        }),
        expect.objectContaining({ sql: expect.stringContaining('v8_run_state_transitions') }),
        expect.objectContaining({
          sql: expect.stringContaining('v8_agent_run_reconciliation_events'),
        }),
      ])
    );
  });

  it('registers a durable alias once and treats a restart retry as idempotent', async () => {
    const identity = {
      canonical_run_id: 'run-1',
      organization_id: 'org-a',
      transformation_case_id: 'case-1',
    };
    dbGet
      .mockResolvedValueOnce(identity)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ canonical_run_id: 'run-1' })
      .mockResolvedValueOnce(identity)
      .mockResolvedValueOnce({ canonical_run_id: 'run-1' });
    dbTransaction.mockResolvedValueOnce({ success: true, results: [{ changes: 1 }] });
    const { registerCanonicalRunAlias } = await import('../agentCanonicalRunService.js');
    const first = await registerCanonicalRunAlias({
      canonicalRunId: 'run-1',
      organizationId: 'org-a',
      aliasType: 'wave8_run',
      externalId: 'agent8-1',
    });
    const retry = await registerCanonicalRunAlias({
      canonicalRunId: 'run-1',
      organizationId: 'org-a',
      aliasType: 'wave8_run',
      externalId: 'agent8-1',
    });
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(dbTransaction).toHaveBeenCalledTimes(1);
  });

  it('fails closed when a tenant alias is already owned by another canonical run', async () => {
    dbGet
      .mockResolvedValueOnce({
        canonical_run_id: 'run-1',
        organization_id: 'org-a',
        transformation_case_id: 'case-1',
      })
      .mockResolvedValueOnce({ canonical_run_id: 'run-other' });
    const { registerCanonicalRunAlias } = await import('../agentCanonicalRunService.js');
    await expect(
      registerCanonicalRunAlias({
        canonicalRunId: 'run-1',
        organizationId: 'org-a',
        aliasType: 'agent_plan',
        externalId: 'plan-1',
      })
    ).rejects.toThrow('canonical_run_alias_conflict');
    expect(dbTransaction).not.toHaveBeenCalled();
  });
});
