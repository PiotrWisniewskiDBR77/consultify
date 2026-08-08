import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();
const retryBranchTask = vi.fn();
const cancelWorkGraph = vi.fn();
const pgQuery = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({ all: dbAll, get: dbGet, run: dbRun }));
vi.mock('../multiAgentWorkManagerService.js', () => ({ retryBranchTask, cancelWorkGraph }));
vi.mock('../../../utils/queryHelpers.js', () => ({ withPgTransaction: (fn: any) => fn({ query: pgQuery }) }));

describe('agentOperatorConsoleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pgQuery.mockReset();
    dbRun.mockResolvedValue({ changes: 1 });
    dbAll.mockImplementation((sql: string) => {
      if (sql.includes('v8_run_state_transitions'))
        return Promise.resolve([{ to_state: 'applying' }]);
      if (sql.includes('v8_action_proposals'))
        return Promise.resolve([{ status: 'pending_review' }]);
      if (sql.includes('v8_agent_work_graphs WHERE'))
        return Promise.resolve([{ graph_id: 'graph-1', status: 'blocked' }]);
      if (sql.includes('v8_agent_branch_tasks'))
        return Promise.resolve([
          { task_id: 'expired-1', status: 'running', lease_expires_at: '2026-08-07T09:00:00.000Z' },
          { task_id: 'failed-1', status: 'failed', attempt_count: 1, max_attempts: 3 },
        ]);
      if (sql.includes('wave8_agent_tool_governance_events'))
        return Promise.resolve([{ decision: 'allowed' }, { decision: 'denied' }]);
      if (sql.includes('v8_agent_quality_eval_runs'))
        return Promise.resolve([{ status: 'failed' }]);
      if (sql.includes('v8_agent_operator_recovery_events')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
  });

  it('correlates run state and emits actionable operational alerts', async () => {
    dbGet.mockResolvedValue({
      run_id: 'run-1',
      state: 'waiting_for_review',
      expires_at: '2026-08-07T09:30:00.000Z',
    });
    const { getAgentRunOperationalSnapshot } = await import('../agentOperatorConsoleService.js');
    const snapshot = await getAgentRunOperationalSnapshot({
      executionRunId: 'run-1',
      organizationId: 'org-a',
      now: '2026-08-07T10:00:00.000Z',
    });
    expect(snapshot.correlationId).toBe('run-1');
    expect(snapshot.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'EXPIRED_BRANCH_LEASE',
          safeAction: 'recover_expired_lease',
        }),
        expect.objectContaining({ code: 'FAILED_BRANCH', safeAction: 'retry_failed_branch' }),
        expect.objectContaining({ code: 'BLOCKED_GRAPH' }),
        expect.objectContaining({ code: 'EXPIRED_APPROVAL_REVIEW', safeAction: 'expire_stale_review' }),
      ])
    );
    expect(snapshot.metrics).toEqual(
      expect.objectContaining({
        proposalsPending: 1,
        branchesRunning: 1,
        branchesFailed: 1,
        toolInvocationsAllowed: 1,
        toolInvocationsDenied: 1,
        latestQualityStatus: 'failed',
      })
    );
  });

  it('recovers only an actually expired tenant-scoped lease and audits before/after', async () => {
    pgQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{
      task_id: 'expired-1',
      status: 'running',
      lease_owner: 'dead-worker',
      lease_expires_at: '2026-08-07T09:00:00.000Z',
      }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const { recoverAgentRunTarget } = await import('../agentOperatorConsoleService.js');
    const result = await recoverAgentRunTarget({
      organizationId: 'org-a',
      executionRunId: 'run-1',
      actorUserId: 'operator-a',
      targetId: 'expired-1',
      action: 'recover_expired_lease',
      reason: 'Worker terminated after lease acquisition.',
      idempotencyKey: 'recovery-key-1',
      now: '2026-08-07T10:00:00.000Z',
    });
    expect(result.status).toBe('pending');
    expect(pgQuery).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("status='running' AND lease_expires_at<=?"),
      ['expired-1', 'org-a', '2026-08-07T10:00:00.000Z']
    );
    expect(pgQuery).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('v8_agent_operator_recovery_events'),
      expect.arrayContaining([
        'run-1',
        'expired-1',
        'recover_expired_lease',
        'operator-a',
      ])
    );
  });

  it('refuses expired-lease recovery when the guarded update changes no row', async () => {
    pgQuery.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{task_id:'active-1',status:'running'}]}).mockResolvedValueOnce({rowCount:0,rows:[]});
    const { recoverAgentRunTarget } = await import('../agentOperatorConsoleService.js');
    await expect(
      recoverAgentRunTarget({
        organizationId: 'org-a',
        executionRunId: 'run-1',
        actorUserId: 'operator-a',
        targetId: 'active-1',
        action: 'recover_expired_lease',
        reason: 'Attempt recovery',
        idempotencyKey: 'recovery-key-2',
      })
    ).rejects.toThrow('branch_lease_not_expired');
  });

  it('atomically expires only a stale tenant-scoped review run and records transition and receipt', async () => {
    pgQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ run_id: 'run-1', organization_id: 'org-a', state: 'waiting_for_review', expires_at: '2026-08-07T09:00:00.000Z' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const { recoverAgentRunTarget } = await import('../agentOperatorConsoleService.js');
    const result = await recoverAgentRunTarget({
      organizationId: 'org-a', executionRunId: 'run-1', actorUserId: 'operator-a',
      targetId: 'run-1', action: 'expire_stale_review', reason: 'Review deadline elapsed.',
      idempotencyKey: 'expire-review-key', now: '2026-08-07T10:00:00.000Z',
    });
    expect(result).toEqual(expect.objectContaining({ status: 'expired', idempotentReplay: false }));
    expect(pgQuery).toHaveBeenNthCalledWith(4, expect.stringContaining("state='waiting_for_review'"), [
      '2026-08-07T10:00:00.000Z', '2026-08-07T10:00:00.000Z', 'run-1', 'org-a', '2026-08-07T10:00:00.000Z',
    ]);
    expect(pgQuery).toHaveBeenNthCalledWith(5, expect.stringContaining('v8_run_state_transitions'), expect.arrayContaining(['run-1', 'operator-a']));
    expect(pgQuery).toHaveBeenNthCalledWith(6, expect.stringContaining("'execution_run'"), expect.arrayContaining(['expire_stale_review']));
  });

  it('fails closed when stale-review guarded update changes no row', async () => {
    pgQuery.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]})
      .mockResolvedValueOnce({rows:[{run_id:'run-1',state:'waiting_for_review'}]})
      .mockResolvedValueOnce({rowCount:0,rows:[]});
    const { recoverAgentRunTarget } = await import('../agentOperatorConsoleService.js');
    await expect(recoverAgentRunTarget({organizationId:'org-a',executionRunId:'run-1',actorUserId:'operator-a',targetId:'run-1',action:'expire_stale_review',reason:'Too early.',idempotencyKey:'future-review-key'})).rejects.toThrow('stale_review_expiry_not_allowed');
  });
});
