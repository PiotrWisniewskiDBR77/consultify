import { describe, expect, it, vi, beforeEach } from 'vitest';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  enforceConsumerPolicy,
  getEffectiveConsumerPolicy,
  getDeferredApprovals,
  processDeferredApproval,
  validateSubagentAccess,
  getToolUsageByRun,
} from '../toolGovernanceService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const TOOL_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const PROJECT_ID = '00000000-0000-4000-8000-000000000050';
const RUN_ID = '00000000-0000-4000-8000-000000000060';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const INVOCATION_ID = '00000000-0000-4000-8000-bbbbbbbbbbbb';
const POLICY_ID = '00000000-0000-4000-8000-pppppppppppp';

function makeFakeToolRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    tool_id: TOOL_ID,
    organization_id: ORG_ID,
    name: 'Search Knowledge Base',
    description: 'Searches the knowledge base',
    category: 'retrieval',
    risk_class: 'medium_risk',
    mutation_type: 'read_only',
    classification_status: 'proposed',
    default_approval_mode: 'requires_human_approval',
    classified_by: null,
    classified_at: null,
    version: '1.0.0',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakePolicyRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    policy_id: POLICY_ID,
    organization_id: ORG_ID,
    project_id: null,
    consumer_class: 'chat',
    tool_id: TOOL_ID,
    allowed: 1,
    approval_override: 'inherit_from_tool',
    max_invocations_per_run: null,
    effective_from: '2026-01-01T00:00:00.000Z',
    effective_until: null,
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeInvocationRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    invocation_id: INVOCATION_ID,
    organization_id: ORG_ID,
    tool_id: TOOL_ID,
    consumer_class: 'background',
    context_snapshot_id: '00000000-0000-4000-8000-000000000010',
    execution_run_id: RUN_ID,
    initiator_user_id: USER_ID,
    parameters: '{}',
    approval_result: 'deferred_approval',
    policy_ref: null,
    block_reason: null,
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeTraceRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    trace_id: '00000000-0000-4000-8000-tttttttttttt',
    invocation_id: INVOCATION_ID,
    tool_id: TOOL_ID,
    consumer_class: 'background',
    execution_run_id: RUN_ID,
    delegation_id: null,
    initiating_user_ref: USER_ID,
    effective_role_ref: 'role:admin',
    context_snapshot_ref: '00000000-0000-4000-8000-000000000010',
    tool_risk_class: 'medium_risk',
    consumer_policy_ref: 'policy:default',
    approval_state: 'auto_executed',
    block_reason: null,
    blocking_policy_ref: null,
    approval_ref: null,
    invocation_result: 'success',
    timestamp: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ------------------------------------------
// enforceConsumerPolicy
// ------------------------------------------

describe('enforceConsumerPolicy', () => {
  it('returns allowed for read_only tool with auto_executable approval', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeToolRow({
        mutation_type: 'read_only',
        default_approval_mode: 'auto_executable',
        risk_class: 'no_risk',
      }),
    );
    // org policies query
    mockDbAll.mockResolvedValueOnce([]);

    const result = await enforceConsumerPolicy(TOOL_ID, 'chat', ORG_ID);

    expect(result.allowed).toBe(true);
    expect(result.approvalState).toBe('allowed');
    expect(result.reason).toBe('allowed');
  });

  it('returns deferred_approval for background + mutating tool (D22)', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeToolRow({
        mutation_type: 'bounded_write',
        default_approval_mode: 'auto_executable',
        risk_class: 'low_risk',
      }),
    );
    // org policies query
    mockDbAll.mockResolvedValueOnce([]);

    const result = await enforceConsumerPolicy(TOOL_ID, 'background', ORG_ID);

    expect(result.allowed).toBe(false);
    expect(result.approvalState).toBe('deferred_approval');
    expect(result.reason).toBe('background_mutating_tool_deferred');
  });

  it('applies most restrictive policy (D20) — org policy force_human_approval', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeToolRow({
        mutation_type: 'read_only',
        default_approval_mode: 'auto_executable',
        risk_class: 'no_risk',
      }),
    );
    // org policies query returns force_human_approval
    mockDbAll.mockResolvedValueOnce([
      makeFakePolicyRow({ approval_override: 'force_human_approval' }),
    ]);

    const result = await enforceConsumerPolicy(TOOL_ID, 'chat', ORG_ID);

    expect(result.allowed).toBe(false);
    expect(result.approvalState).toBe('requires_approval');
    expect(result.reason).toBe('requires_human_approval');
  });

  it('returns blocked when tool not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await enforceConsumerPolicy(TOOL_ID, 'chat', ORG_ID);

    expect(result.allowed).toBe(false);
    expect(result.approvalState).toBe('blocked');
    expect(result.reason).toBe('tool_not_found');
    expect(result.effectivePolicy).toBeNull();
  });

  it('returns blocked when org policy denies the tool', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeToolRow({ default_approval_mode: 'auto_executable' }),
    );
    mockDbAll.mockResolvedValueOnce([
      makeFakePolicyRow({ allowed: 0 }),
    ]);

    const result = await enforceConsumerPolicy(TOOL_ID, 'chat', ORG_ID);

    expect(result.allowed).toBe(false);
    expect(result.approvalState).toBe('blocked');
    expect(result.reason).toBe('org_policy_denied');
  });

  it('returns blocked when policy has force_blocked override', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeToolRow({ default_approval_mode: 'auto_executable' }),
    );
    mockDbAll.mockResolvedValueOnce([
      makeFakePolicyRow({ approval_override: 'force_blocked' }),
    ]);

    const result = await enforceConsumerPolicy(TOOL_ID, 'chat', ORG_ID);

    expect(result.allowed).toBe(false);
    expect(result.approvalState).toBe('blocked');
    expect(result.reason).toBe('policy_force_blocked');
  });
});

// ------------------------------------------
// getEffectiveConsumerPolicy
// ------------------------------------------

describe('getEffectiveConsumerPolicy', () => {
  it('returns null when no policies exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const result = await getEffectiveConsumerPolicy(TOOL_ID, 'chat', ORG_ID);

    expect(result).toBeNull();
  });

  it('returns org-level policy when no project specified', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakePolicyRow(),
    ]);

    const result = await getEffectiveConsumerPolicy(TOOL_ID, 'chat', ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.policyId).toBe(POLICY_ID);
    expect(result!.projectId).toBeNull();
  });

  it('merges org + project policies — project tightens only', async () => {
    const projectPolicyId = '00000000-0000-4000-8000-qqqqqqqqqqqq';

    // org policies
    mockDbAll.mockResolvedValueOnce([
      makeFakePolicyRow({
        approval_override: 'inherit_from_tool',
        max_invocations_per_run: 100,
      }),
    ]);
    // project policies
    mockDbAll.mockResolvedValueOnce([
      makeFakePolicyRow({
        policy_id: projectPolicyId,
        project_id: PROJECT_ID,
        approval_override: 'force_human_approval',
        max_invocations_per_run: 10,
      }),
    ]);

    const result = await getEffectiveConsumerPolicy(TOOL_ID, 'chat', ORG_ID, PROJECT_ID);

    expect(result).not.toBeNull();
    expect(result!.policyId).toBe(projectPolicyId);
    expect(result!.approvalOverride).toBe('force_human_approval');
    expect(result!.maxInvocationsPerRun).toBe(10);
  });

  it('project cannot loosen org policy — org force_human_approval stays', async () => {
    // org policies: force_human_approval
    mockDbAll.mockResolvedValueOnce([
      makeFakePolicyRow({ approval_override: 'force_human_approval' }),
    ]);
    // project policies: inherit_from_tool (less strict)
    mockDbAll.mockResolvedValueOnce([
      makeFakePolicyRow({
        policy_id: '00000000-0000-4000-8000-rrrrrrrrrrrr',
        project_id: PROJECT_ID,
        approval_override: 'inherit_from_tool',
      }),
    ]);

    const result = await getEffectiveConsumerPolicy(TOOL_ID, 'chat', ORG_ID, PROJECT_ID);

    expect(result).not.toBeNull();
    expect(result!.approvalOverride).toBe('force_human_approval');
  });

  it('project blocked overrides org allowed', async () => {
    // org policies: allowed
    mockDbAll.mockResolvedValueOnce([
      makeFakePolicyRow({ allowed: 1 }),
    ]);
    // project policies: blocked
    mockDbAll.mockResolvedValueOnce([
      makeFakePolicyRow({
        policy_id: '00000000-0000-4000-8000-ssssssssssss',
        project_id: PROJECT_ID,
        allowed: 0,
      }),
    ]);

    const result = await getEffectiveConsumerPolicy(TOOL_ID, 'chat', ORG_ID, PROJECT_ID);

    expect(result).not.toBeNull();
    expect(result!.allowed).toBe(false);
  });
});

// ------------------------------------------
// getDeferredApprovals
// ------------------------------------------

describe('getDeferredApprovals', () => {
  it('returns deferred invocations ordered by created_at', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeInvocationRow({ created_at: '2026-03-23T09:00:00.000Z' }),
      makeFakeInvocationRow({
        invocation_id: '00000000-0000-4000-8000-cccccccccccc',
        created_at: '2026-03-23T10:00:00.000Z',
      }),
    ]);

    const results = await getDeferredApprovals(ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].approvalResult).toBe('deferred_approval');
    expect(results[1].invocationId).toBe('00000000-0000-4000-8000-cccccccccccc');

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain("approval_result = 'deferred_approval'");
    expect(sql).toContain('ORDER BY created_at ASC');
  });

  it('returns empty array when no deferred items', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const results = await getDeferredApprovals(ORG_ID);

    expect(results).toEqual([]);
  });

  it('respects custom limit', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getDeferredApprovals(ORG_ID, 5);

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params[1]).toBe(5);
  });
});

// ------------------------------------------
// processDeferredApproval
// ------------------------------------------

describe('processDeferredApproval', () => {
  it('approves a deferred invocation — transitions to allowed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeInvocationRow());

    const result = await processDeferredApproval(INVOCATION_ID, 'approve', USER_ID);

    expect(result.approvalResult).toBe('allowed');
    expect(result.blockReason).toBeNull();

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE v8_tool_invocation_log');
    expect(sql).toContain('deferred_resolved_at');
    expect(sql).toContain('deferred_resolved_by');
  });

  it('rejects a deferred invocation — transitions to blocked', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeInvocationRow());

    const result = await processDeferredApproval(
      INVOCATION_ID,
      'reject',
      USER_ID,
      'not_authorized',
    );

    expect(result.approvalResult).toBe('blocked');
    expect(result.blockReason).toBe('not_authorized');
  });

  it('throws when invocation not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      processDeferredApproval(INVOCATION_ID, 'approve', USER_ID),
    ).rejects.toThrow(`Invocation ${INVOCATION_ID} not found`);
  });

  it('throws when invocation is not in deferred_approval state', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeInvocationRow({ approval_result: 'allowed' }),
    );

    await expect(
      processDeferredApproval(INVOCATION_ID, 'approve', USER_ID),
    ).rejects.toThrow('not in deferred_approval state');
  });
});

// ------------------------------------------
// validateSubagentAccess
// ------------------------------------------

describe('validateSubagentAccess', () => {
  it('blocks critical tools (D21)', async () => {
    // run exists in applying state
    mockDbGet.mockResolvedValueOnce({
      run_id: RUN_ID,
      state: 'applying',
      organization_id: ORG_ID,
    });
    // getTool
    mockDbGet.mockResolvedValueOnce(
      makeFakeToolRow({ risk_class: 'critical' }),
    );

    const result = await validateSubagentAccess(TOOL_ID, RUN_ID, ORG_ID);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('critical_tools_denied_for_subagents');
  });

  it('requires run in applying state', async () => {
    mockDbGet.mockResolvedValueOnce({
      run_id: RUN_ID,
      state: 'planning',
      organization_id: ORG_ID,
    });

    const result = await validateSubagentAccess(TOOL_ID, RUN_ID, ORG_ID);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('parent_run_not_in_applying_state');
    expect(result.reason).toContain('planning');
  });

  it('returns not found when parent run does not exist', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await validateSubagentAccess(TOOL_ID, RUN_ID, ORG_ID);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('parent_run_not_found');
  });

  it('allows non-critical tool with run in applying state', async () => {
    // run exists in applying state
    mockDbGet.mockResolvedValueOnce({
      run_id: RUN_ID,
      state: 'applying',
      organization_id: ORG_ID,
    });
    // getTool
    mockDbGet.mockResolvedValueOnce(
      makeFakeToolRow({ risk_class: 'low_risk' }),
    );

    const result = await validateSubagentAccess(TOOL_ID, RUN_ID, ORG_ID);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('allowed');
  });

  it('returns tool_not_found when tool does not exist', async () => {
    mockDbGet.mockResolvedValueOnce({
      run_id: RUN_ID,
      state: 'applying',
      organization_id: ORG_ID,
    });
    mockDbGet.mockResolvedValueOnce(null);

    const result = await validateSubagentAccess(TOOL_ID, RUN_ID, ORG_ID);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('tool_not_found');
  });
});

// ------------------------------------------
// getToolUsageByRun
// ------------------------------------------

describe('getToolUsageByRun', () => {
  it('returns invocations and traces for a run', async () => {
    mockDbAll
      .mockResolvedValueOnce([makeFakeInvocationRow()])
      .mockResolvedValueOnce([makeFakeTraceRow()]);

    const result = await getToolUsageByRun(RUN_ID, ORG_ID);

    expect(result.invocations).toHaveLength(1);
    expect(result.invocations[0].invocationId).toBe(INVOCATION_ID);
    expect(result.traces).toHaveLength(1);
    expect(result.traces[0].invocationId).toBe(INVOCATION_ID);
  });

  it('returns empty arrays when no usage exists', async () => {
    mockDbAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getToolUsageByRun(RUN_ID, ORG_ID);

    expect(result.invocations).toEqual([]);
    expect(result.traces).toEqual([]);
  });

  it('queries with correct run and org filters', async () => {
    mockDbAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await getToolUsageByRun(RUN_ID, ORG_ID);

    const invocationSql = mockDbAll.mock.calls[0][0] as string;
    expect(invocationSql).toContain('execution_run_id');
    expect(invocationSql).toContain('organization_id');

    const invocationParams = mockDbAll.mock.calls[0][1] as unknown[];
    expect(invocationParams[0]).toBe(RUN_ID);
    expect(invocationParams[1]).toBe(ORG_ID);
  });
});
