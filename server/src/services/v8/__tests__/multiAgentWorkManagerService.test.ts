import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();
const dbTransaction = vi.fn();
const launchWave8Agent = vi.fn();
const getExecutionRun = vi.fn();
const createProposal = vi.fn();
const transitionRunState = vi.fn();
const submitForReview = vi.fn();
const projectCanonicalRunAfterExternalTransition = vi.fn();
const revalidateCanonicalRunContextForWorker = vi.fn();
const reserveAgentResource = vi.fn();
const settleAgentResource = vi.fn();
const releaseAgentResource = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  all: dbAll,
  get: dbGet,
  run: dbRun,
  transaction: dbTransaction,
}));
vi.mock('../../wave8AgentRuntimeService.js', () => ({ launchWave8Agent }));
vi.mock('../agentCanonicalRunService.js', () => ({ projectCanonicalRunAfterExternalTransition }));
vi.mock('../agentContextGroundingService.js', () => ({ revalidateCanonicalRunContextForWorker }));
vi.mock('../agentResourceGovernanceService.js', () => ({
  reserveAgentResource,
  settleAgentResource,
  releaseAgentResource,
}));
vi.mock('../executionSpineService.js', () => ({
  getRun: getExecutionRun,
  createProposal,
  transitionRunState,
  submitForReview,
}));

describe('multiAgentWorkManagerService', () => {
  beforeEach(() => {
    dbAll.mockReset();
    dbGet.mockReset();
    dbRun.mockReset();
    dbTransaction.mockReset();
    dbRun.mockResolvedValue({ success: true, changes: 1 });
    dbTransaction.mockResolvedValue({ success: true, results: [] });
    launchWave8Agent.mockReset();
    getExecutionRun.mockReset();
    createProposal.mockReset();
    transitionRunState.mockReset();
    submitForReview.mockReset();
    projectCanonicalRunAfterExternalTransition.mockReset();
    projectCanonicalRunAfterExternalTransition.mockResolvedValue({ stateDrift: false });
    revalidateCanonicalRunContextForWorker.mockReset().mockResolvedValue({
      decision: 'allowed',
      reason: 'fresh',
      revalidationId: 'revalidation-1',
    });
    reserveAgentResource.mockReset().mockResolvedValue({
      allowed: true,
      reason: 'resource_reservation_allowed',
      reservationId: 'work-graph-resource-1',
      status: 'reserved',
      idempotentReplay: false,
    });
    settleAgentResource.mockReset().mockResolvedValue({ status: 'settled' });
    releaseAgentResource.mockReset().mockResolvedValue({ status: 'released' });
  });

  it('rejects a circular graph before writing anything', async () => {
    const { createWorkGraph } = await import('../multiAgentWorkManagerService.js');
    await expect(
      createWorkGraph({
        executionRunId: 'run-1',
        organizationId: 'org-a',
        leadAgentId: 'lead',
        createdBy: 'user-a',
        mode: 'router_parallel',
        tasks: [
          {
            key: 'finance',
            specialistAgentId: 'finance',
            title: 'Finance',
            objective: 'Assess',
            dependsOn: ['risk'],
          },
          {
            key: 'risk',
            specialistAgentId: 'risk',
            title: 'Risk',
            objective: 'Assess',
            dependsOn: ['finance'],
          },
        ],
      })
    ).rejects.toThrow('circular_branch_dependency');
    expect(dbRun).not.toHaveBeenCalled();
    expect(dbTransaction).not.toHaveBeenCalled();
  });

  it('rejects branch allocations above the graph budget before writing', async () => {
    const { createWorkGraph } = await import('../multiAgentWorkManagerService.js');
    await expect(
      createWorkGraph({
        executionRunId: 'run-1',
        organizationId: 'org-a',
        leadAgentId: 'lead',
        createdBy: 'user-a',
        mode: 'router_parallel',
        budget: { maxTokens: 100 },
        tasks: [
          {
            key: 'one',
            specialistAgentId: 'research-agent',
            title: 'One',
            objective: 'Research',
            budget: { maxTokens: 101 },
          },
        ],
      })
    ).rejects.toThrow('branch_token_budget_exceeds_graph_budget');
    expect(dbTransaction).not.toHaveBeenCalled();
  });

  it('durably projects a newly created graph onto its canonical execution run', async () => {
    const { createWorkGraph } = await import('../multiAgentWorkManagerService.js');
    const created = await createWorkGraph({
      executionRunId: 'run-1',
      organizationId: 'org-a',
      leadAgentId: 'lead',
      createdBy: 'user-a',
      mode: 'sequential',
      tasks: [
        {
          key: 'research',
          specialistAgentId: 'research-agent',
          title: 'Research',
          objective: 'Collect evidence',
        },
      ],
    });
    expect(created.graphId).toMatch(/^graph-/);
    expect(projectCanonicalRunAfterExternalTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalRunId: 'run-1',
        organizationId: 'org-a',
        aliasType: 'work_graph',
        externalId: created.graphId,
      })
    );
  });

  it('keeps graph reads tenant-scoped', async () => {
    dbGet.mockResolvedValue(null);
    const { getWorkGraph } = await import('../multiAgentWorkManagerService.js');
    await expect(getWorkGraph('graph-a', 'org-b')).resolves.toBeNull();
    expect(dbGet).toHaveBeenCalledWith(expect.stringContaining('organization_id = ?'), [
      'graph-a',
      'org-b',
    ]);
    expect(dbAll).not.toHaveBeenCalled();
  });

  it('blocks a transformation graph before branch claim when canonical context drifted', async () => {
    dbGet.mockResolvedValue({
      execution_run_id: 'run-a',
      transformation_case_id: 'case-a',
    });
    revalidateCanonicalRunContextForWorker.mockResolvedValue({
      decision: 'blocked_drift',
      reason: 'Context drift requires a new snapshot',
      revalidationId: 'revalidation-blocked',
    });
    const { claimReadyBranchTasks } = await import('../multiAgentWorkManagerService.js');
    await expect(
      claimReadyBranchTasks({
        graphId: 'graph-a',
        organizationId: 'org-a',
        workerId: 'worker-a',
      })
    ).resolves.toEqual([]);
    expect(dbAll).not.toHaveBeenCalled();
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining("status = 'blocked'"),
      expect.arrayContaining(['graph-a', 'org-a'])
    );
  });

  it('blocks synthesis when specialist claims contradict each other', async () => {
    dbGet.mockResolvedValue({
      graph_id: 'graph-a',
      organization_id: 'org-a',
      execution_run_id: 'run-a',
    });
    dbAll.mockResolvedValue([
      {
        task_id: 'one',
        specialist_agent_id: 'finance',
        status: 'completed',
        confidence: 0.9,
        evidence_json: '[{"ref":"fin"}]',
        output_json: '{"claims":[{"key":"go","value":true}]}',
      },
      {
        task_id: 'two',
        specialist_agent_id: 'risk',
        status: 'completed',
        confidence: 0.8,
        evidence_json: '[{"ref":"risk"}]',
        output_json: '{"claims":[{"key":"go","value":false}]}',
      },
    ]);
    const { synthesizeWorkGraph } = await import('../multiAgentWorkManagerService.js');
    const result = await synthesizeWorkGraph({ graphId: 'graph-a', organizationId: 'org-a' });
    expect(result.status).toBe('blocked');
    expect(result.contradictions).toHaveLength(1);
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('organization_id = ?'),
      expect.arrayContaining(['blocked', 'graph-a', 'org-a'])
    );
  });

  it('atomically records a reviewed contradiction resolution with branch lineage', async () => {
    dbGet.mockResolvedValue({
      graph_id: 'graph-a',
      organization_id: 'org-a',
      execution_run_id: 'run-a',
      status: 'blocked',
      synthesis_json: '{"outputs":[]}',
      contradictions_json:
        '[{"key":"go","entries":[{"taskId":"finance","value":true},{"taskId":"risk","value":false}]}]',
    });
    dbAll.mockResolvedValue([]);
    const { resolveWorkGraphContradiction } = await import('../multiAgentWorkManagerService.js');
    await expect(
      resolveWorkGraphContradiction({
        graphId: 'graph-a',
        organizationId: 'org-a',
        actorUserId: 'owner-a',
        claimKey: 'go',
        resolutionType: 'choose_branch',
        sourceTaskId: 'finance',
        selectedValue: true,
        rationale: 'Finance evidence is current and reconciled.',
      })
    ).resolves.toEqual({ graphStatus: 'completed', unresolvedCount: 0 });
    expect(dbTransaction).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          sql: expect.stringContaining('v8_agent_contradiction_resolutions'),
          params: expect.arrayContaining(['go', 'choose_branch', 'finance', 'owner-a']),
        }),
        expect.objectContaining({
          sql: expect.stringContaining('v8_agent_work_graphs SET status'),
          params: expect.arrayContaining(['completed', 'graph-a', 'org-a']),
        }),
      ])
    );
  });

  it('rejects a chosen value that does not match the cited specialist branch', async () => {
    dbGet.mockResolvedValue({
      status: 'blocked',
      contradictions_json: '[{"key":"go","entries":[{"taskId":"finance","value":true}]}]',
    });
    const { resolveWorkGraphContradiction } = await import('../multiAgentWorkManagerService.js');
    await expect(
      resolveWorkGraphContradiction({
        graphId: 'graph-a',
        organizationId: 'org-a',
        actorUserId: 'owner-a',
        claimKey: 'go',
        resolutionType: 'choose_branch',
        sourceTaskId: 'finance',
        selectedValue: false,
        rationale: 'Mismatch must not pass.',
      })
    ).rejects.toThrow('contradiction_selected_value_mismatch');
    expect(dbTransaction).not.toHaveBeenCalled();
  });

  it('executes a ready branch through its scoped specialist and records the run as evidence', async () => {
    dbGet.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('v8_agent_work_graphs')
          ? { execution_run_id: 'run-a', project_id: 'project-a' }
          : { budget_json: '{"maxTokens":100,"maxCostUsd":1}' }
      )
    );
    dbAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          task_id: 'branch-1',
          specialist_agent_id: 'research-agent',
          objective: 'Gather cited evidence',
          dependencies_json: '[]',
          tool_scope_json: '["search_web"]',
          budget_json: '{"timeoutSeconds":30}',
        },
      ])
      .mockResolvedValueOnce([]);
    launchWave8Agent.mockResolvedValue({
      allowed: true,
      run: {
        runId: 'specialist-run-1',
        schemaValid: true,
        output: { summary: 'Evidence' },
        audit: {
          telemetry: {
            usage: {
              inputTokens: 10,
              outputTokens: 20,
              totalTokens: 30,
              costUsd: 0.01,
              durationMs: 25,
              source: 'provider',
            },
          },
        },
      },
    });
    const { executeReadyWorkGraphBranches } = await import('../multiAgentWorkManagerService.js');
    const result = await executeReadyWorkGraphBranches({
      graphId: 'graph-1',
      organizationId: 'org-a',
      userId: 'user-a',
      workerId: 'worker-a',
    });
    expect(result).toEqual([
      { taskId: 'branch-1', status: 'completed', runId: 'specialist-run-1' },
    ]);
    expect(launchWave8Agent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'research-agent',
        requestedTools: ['search_web'],
        organizationId: 'org-a',
      })
    );
    expect(reserveAgentResource).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-a',
        projectId: 'project-a',
        estimatedCostUsd: 0,
        idempotencyKey: 'work-graph:run-a:graph-1:branch-1:attempt:1',
      })
    );
    expect(settleAgentResource).toHaveBeenCalledTimes(1);
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining("status = 'completed'"),
      expect.arrayContaining([
        JSON.stringify({
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
          costUsd: 0.01,
          durationMs: 25,
          source: 'provider',
        }),
        'branch-1',
        'org-a',
        'worker-a',
      ])
    );
  });

  it('rejects completion when measured runtime usage exceeds the branch allocation', async () => {
    dbGet.mockResolvedValue({ budget_json: '{"maxTokens":25,"maxCostUsd":1}' });
    const { completeBranchTask } = await import('../multiAgentWorkManagerService.js');
    await expect(
      completeBranchTask({
        taskId: 'branch-budget',
        organizationId: 'org-a',
        workerId: 'worker-a',
        output: {},
        evidence: [{ ref: 'run-1' }],
        confidence: 0.8,
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
          costUsd: 0.01,
          durationMs: 25,
          source: 'provider',
        },
      })
    ).rejects.toThrow('branch_token_budget_exceeded:30:25');
    expect(dbRun).not.toHaveBeenCalledWith(
      expect.stringContaining("status = 'completed'"),
      expect.anything()
    );
  });

  it('persists an explicit failed branch when specialist policy blocks execution', async () => {
    dbGet.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('v8_agent_work_graphs')
          ? { execution_run_id: 'run-a', project_id: 'project-a' }
          : {}
      )
    );
    dbAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          task_id: 'branch-2',
          specialist_agent_id: 'execution-agent',
          objective: 'Mutate',
          dependencies_json: '[]',
          tool_scope_json: '[]',
          budget_json: '{}',
        },
      ])
      .mockResolvedValueOnce([]);
    launchWave8Agent.mockResolvedValue({ allowed: false, error: 'airun_required' });
    const { executeReadyWorkGraphBranches } = await import('../multiAgentWorkManagerService.js');
    const result = await executeReadyWorkGraphBranches({
      graphId: 'graph-1',
      organizationId: 'org-a',
      userId: 'user-a',
      workerId: 'worker-a',
    });
    expect(result).toEqual([{ taskId: 'branch-2', status: 'failed', error: 'airun_required' }]);
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining("status = 'failed'"),
      expect.arrayContaining(['airun_required', 'branch-2', 'org-a', 'worker-a'])
    );
  });

  it('records a failed branch but performs zero Wave8 launch when resources deny', async () => {
    dbGet.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('v8_agent_work_graphs')
          ? { execution_run_id: 'run-a', project_id: 'project-a' }
          : {}
      )
    );
    dbAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          task_id: 'branch-denied',
          specialist_agent_id: 'research-agent',
          objective: 'Must not launch',
          dependencies_json: '[]',
          tool_scope_json: '[]',
          budget_json: '{}',
          attempt_count: 1,
        },
      ])
      .mockResolvedValueOnce([]);
    reserveAgentResource.mockResolvedValue({
      allowed: false,
      reason: 'resource_concurrency_limit_exceeded',
      reservationId: 'resource-denied',
      status: 'denied',
      idempotentReplay: false,
    });
    const { executeReadyWorkGraphBranches } = await import('../multiAgentWorkManagerService.js');
    const result = await executeReadyWorkGraphBranches({
      graphId: 'graph-1',
      organizationId: 'org-a',
      userId: 'user-a',
      workerId: 'worker-a',
    });
    expect(result).toEqual([
      {
        taskId: 'branch-denied',
        status: 'failed',
        error: 'work_graph_resource_denied:resource_concurrency_limit_exceeded',
      },
    ]);
    expect(launchWave8Agent).not.toHaveBeenCalled();
    expect(settleAgentResource).not.toHaveBeenCalled();
    expect(releaseAgentResource).not.toHaveBeenCalled();
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining("status = 'failed'"),
      expect.arrayContaining(['branch-denied', 'org-a', 'worker-a'])
    );
  });

  it('cancels a pending dependent branch when its prerequisite failed', async () => {
    dbGet.mockResolvedValue({ execution_run_id: 'run-a', transformation_case_id: null });
    dbAll
      .mockResolvedValueOnce([
        { task_id: 'source', status: 'failed', dependencies_json: '[]' },
        { task_id: 'dependent', status: 'pending', dependencies_json: '["source"]' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const { claimReadyBranchTasks } = await import('../multiAgentWorkManagerService.js');
    await expect(
      claimReadyBranchTasks({ graphId: 'graph-1', organizationId: 'org-a', workerId: 'worker-a' })
    ).resolves.toEqual([]);
    expect(dbRun).toHaveBeenCalledWith(expect.stringContaining("status = 'cancelled'"), [
      'dependency_failed:source',
      'dependent',
      'org-a',
    ]);
  });

  it('allows retry only through the atomic failed-to-pending transition', async () => {
    const { retryBranchTask } = await import('../multiAgentWorkManagerService.js');
    await expect(
      retryBranchTask({ taskId: 'branch-1', organizationId: 'org-a' })
    ).resolves.toBeUndefined();
    expect(dbRun).toHaveBeenCalledWith(expect.stringContaining("status = 'failed'"), [
      'branch-1',
      'org-a',
    ]);
  });

  it('refuses graph cancellation while a branch is actively leased', async () => {
    dbGet.mockResolvedValue({ count: 1 });
    const { cancelWorkGraph } = await import('../multiAgentWorkManagerService.js');
    await expect(cancelWorkGraph({ graphId: 'graph-1', organizationId: 'org-a' })).rejects.toThrow(
      'work_graph_has_running_branches'
    );
  });

  it('routes completed synthesis into the canonical human approval spine', async () => {
    dbGet.mockResolvedValue({
      graph_id: 'graph-1',
      organization_id: 'org-a',
      execution_run_id: '00000000-0000-4000-8000-000000000001',
      status: 'completed',
      synthesis_json: '{"outputs":[]}',
      synthesis_proposal_id: null,
    });
    dbAll.mockResolvedValue([]);
    getExecutionRun.mockResolvedValue({
      runId: '00000000-0000-4000-8000-000000000001',
      state: 'planning',
      contextSnapshotId: 'snapshot-1',
    });
    createProposal.mockResolvedValue({ proposalId: 'proposal-1' });
    const { proposeWorkGraphSynthesis } = await import('../multiAgentWorkManagerService.js');
    await expect(
      proposeWorkGraphSynthesis({
        graphId: 'graph-1',
        organizationId: 'org-a',
        actorUserId: 'user-a',
      })
    ).resolves.toEqual({ proposalId: 'proposal-1', runState: 'waiting_for_review' });
    expect(createProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalClass: 'requires_human_approval',
        executionRunId: '00000000-0000-4000-8000-000000000001',
      })
    );
    expect(transitionRunState).toHaveBeenCalledWith(
      expect.any(String),
      'org-a',
      'proposals_ready',
      'user-a',
      expect.any(String)
    );
    expect(submitForReview).toHaveBeenCalledWith(expect.any(String), 'org-a', 'user-a');
  });
});
