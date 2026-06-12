import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  ClassifyToolParams,
  LogInvocationTraceParams,
  RegisterToolParams,
  RequestInvocationParams,
  SetConsumerPolicyParams,
} from '../../../types/toolGovernance.js';
import {
  APPROVAL_CLASS_STRICTNESS,
  ClassifyToolParamsSchema,
  ConsumerToolPolicySchema,
  LogInvocationTraceParamsSchema,
  RegisterToolParamsSchema,
  RequestInvocationParamsSchema,
  RISK_CLASS_DEFAULT_APPROVAL,
  SetConsumerPolicyParamsSchema,
  SubagentDelegationTokenSchema,
  ToolCapabilitySchema,
  ToolInvocationRequestSchema,
  ToolInvocationTraceSchema,
} from '../../../types/toolGovernance.js';

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
  classifyTool,
  getEffectivePolicy,
  getTool,
  getToolCatalog,
  logInvocationTrace,
  registerTool,
  requestInvocation,
  setConsumerPolicy,
} from '../toolGovernanceService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000010';
const TOOL_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const PROJECT_ID = '00000000-0000-4000-8000-000000000050';
const RUN_ID = '00000000-0000-4000-8000-000000000060';

function makeRegisterParams(overrides?: Partial<RegisterToolParams>): RegisterToolParams {
  return {
    organizationId: ORG_ID,
    name: 'Search Knowledge Base',
    description: 'Searches the knowledge base for relevant articles',
    category: 'retrieval',
    mutationType: 'read_only',
    version: '1.0.0',
    ...overrides,
  };
}

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
    policy_id: '00000000-0000-4000-8000-pppppppppppp',
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

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

describe('registerTool', () => {
  it('registers a tool with D19 defaults: proposed, requires_human_approval, medium_risk', async () => {
    const result = await registerTool(makeRegisterParams());

    expect(result.toolId).toBeDefined();
    expect(result.name).toBe('Search Knowledge Base');
    expect(result.riskClass).toBe('medium_risk');
    expect(result.classificationStatus).toBe('proposed');
    expect(result.defaultApprovalMode).toBe('requires_human_approval');
    expect(result.classifiedBy).toBeNull();
    expect(result.classifiedAt).toBeNull();
    expect(result.organizationId).toBe(ORG_ID);

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_tool_catalog');
  });

  it('rejects missing required fields via Zod', async () => {
    await expect(registerTool({ organizationId: ORG_ID } as any)).rejects.toThrow(ZodError);
  });

  it('rejects invalid UUID for organizationId', async () => {
    await expect(
      registerTool(makeRegisterParams({ organizationId: 'not-a-uuid' }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid category', async () => {
    await expect(registerTool(makeRegisterParams({ category: 'invalid' as any }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects invalid mutationType', async () => {
    await expect(
      registerTool(makeRegisterParams({ mutationType: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });
});

describe('getTool', () => {
  it('returns a tool when found with org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeToolRow());

    const result = await getTool(TOOL_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.toolId).toBe(TOOL_ID);
    expect(result!.organizationId).toBe(ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns null when tool not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getTool('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation — different org returns null', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getTool(TOOL_ID, OTHER_ORG_ID);
    expect(result).toBeNull();
  });
});

describe('getToolCatalog', () => {
  it('returns all tools for an organization', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeToolRow(),
      makeFakeToolRow({ tool_id: 'tool-2', name: 'Create Draft' }),
    ]);

    const results = await getToolCatalog(ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].toolId).toBe(TOOL_ID);
  });

  it('returns empty array when no tools exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getToolCatalog(ORG_ID);
    expect(results).toEqual([]);
  });
});

describe('classifyTool', () => {
  it('classifies a tool and updates approval mode based on risk class', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeToolRow());

    const result = await classifyTool({
      toolId: TOOL_ID,
      organizationId: ORG_ID,
      riskClass: 'no_risk',
      classifiedBy: USER_ID,
    });

    expect(result.riskClass).toBe('no_risk');
    expect(result.classificationStatus).toBe('ratified');
    expect(result.defaultApprovalMode).toBe('auto_executable');
    expect(result.classifiedBy).toBe(USER_ID);
    expect(result.classifiedAt).not.toBeNull();
  });

  it('maps high_risk to requires_human_approval', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeToolRow());

    const result = await classifyTool({
      toolId: TOOL_ID,
      organizationId: ORG_ID,
      riskClass: 'high_risk',
      classifiedBy: USER_ID,
    });

    expect(result.defaultApprovalMode).toBe('requires_human_approval');
  });

  it('maps medium_risk to policy_approvable', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeToolRow());

    const result = await classifyTool({
      toolId: TOOL_ID,
      organizationId: ORG_ID,
      riskClass: 'medium_risk',
      classifiedBy: USER_ID,
    });

    expect(result.defaultApprovalMode).toBe('policy_approvable');
  });

  it('throws when tool not found', async () => {
    const missingToolId = '00000000-0000-4000-8000-ffffffffffff';
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      classifyTool({
        toolId: missingToolId,
        organizationId: ORG_ID,
        riskClass: 'low_risk',
        classifiedBy: USER_ID,
      })
    ).rejects.toThrow(`Tool ${missingToolId} not found`);
  });

  it('rejects invalid risk class via Zod', async () => {
    await expect(
      classifyTool({
        toolId: TOOL_ID,
        organizationId: ORG_ID,
        riskClass: 'invalid' as any,
        classifiedBy: USER_ID,
      })
    ).rejects.toThrow(ZodError);
  });
});

describe('setConsumerPolicy', () => {
  it('creates an org-level policy', async () => {
    const result = await setConsumerPolicy({
      organizationId: ORG_ID,
      consumerClass: 'chat',
      toolId: TOOL_ID,
      allowed: true,
    });

    expect(result.policyId).toBeDefined();
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.projectId).toBeNull();
    expect(result.consumerClass).toBe('chat');
    expect(result.allowed).toBe(true);
    expect(result.approvalOverride).toBe('inherit_from_tool');

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_consumer_tool_policies');
  });

  it('creates a project-level policy', async () => {
    const result = await setConsumerPolicy({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      consumerClass: 'execution',
      toolId: TOOL_ID,
      allowed: true,
      approvalOverride: 'force_human_approval',
    });

    expect(result.projectId).toBe(PROJECT_ID);
    expect(result.approvalOverride).toBe('force_human_approval');
  });

  it('supports blocking a tool via policy', async () => {
    const result = await setConsumerPolicy({
      organizationId: ORG_ID,
      consumerClass: 'worker',
      toolId: TOOL_ID,
      allowed: false,
    });

    expect(result.allowed).toBe(false);
  });

  it('rejects invalid consumer class via Zod', async () => {
    await expect(
      setConsumerPolicy({
        organizationId: ORG_ID,
        consumerClass: 'invalid' as any,
        toolId: TOOL_ID,
        allowed: true,
      })
    ).rejects.toThrow(ZodError);
  });
});

describe('getEffectivePolicy', () => {
  it('returns blocked when tool not found', async () => {
    // getTool calls dbGet → returns null
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getEffectivePolicy(TOOL_ID, 'chat', ORG_ID);

    expect(result.state).toBe('blocked');
    expect(result.blockReason).toBe('tool_not_found');
  });

  it('returns tool default when no consumer policies exist', async () => {
    // getTool → dbGet
    mockDbGet.mockResolvedValueOnce(
      makeFakeToolRow({ default_approval_mode: 'auto_executable', risk_class: 'no_risk' })
    );
    // org policies → dbAll
    mockDbAll.mockResolvedValueOnce([]);

    const result = await getEffectivePolicy(TOOL_ID, 'chat', ORG_ID);

    expect(result.state).toBe('allowed');
    expect(result.approvalClass).toBe('auto_executable');
  });

  it('applies org-level policy that blocks the tool', async () => {
    // getTool → dbGet
    mockDbGet.mockResolvedValueOnce(makeFakeToolRow());
    // org policies → dbAll
    mockDbAll.mockResolvedValueOnce([makeFakePolicyRow({ allowed: 0 })]);

    const result = await getEffectivePolicy(TOOL_ID, 'chat', ORG_ID);

    expect(result.state).toBe('blocked');
    expect(result.blockReason).toBe('org_policy_denied');
  });

  it('applies project-level policy that blocks the tool (D20: tighten only)', async () => {
    // getTool → dbGet
    mockDbGet.mockResolvedValueOnce(makeFakeToolRow({ default_approval_mode: 'auto_executable' }));
    // org policies → dbAll (empty)
    mockDbAll.mockResolvedValueOnce([]);
    // project policies → dbAll
    mockDbAll.mockResolvedValueOnce([makeFakePolicyRow({ project_id: PROJECT_ID, allowed: 0 })]);

    const result = await getEffectivePolicy(TOOL_ID, 'chat', ORG_ID, PROJECT_ID);

    expect(result.state).toBe('blocked');
    expect(result.blockReason).toBe('project_policy_denied');
  });

  it('picks the most restrictive approval (D20)', async () => {
    // getTool → dbGet
    mockDbGet.mockResolvedValueOnce(makeFakeToolRow({ default_approval_mode: 'auto_executable' }));
    // org policies → dbAll
    mockDbAll.mockResolvedValueOnce([
      makeFakePolicyRow({ approval_override: 'force_human_approval' }),
    ]);

    const result = await getEffectivePolicy(TOOL_ID, 'chat', ORG_ID);

    expect(result.approvalClass).toBe('requires_human_approval');
    expect(result.state).toBe('requires_approval');
  });

  it('applies D22: background consumer class gets deferred_approval for mutating tools', async () => {
    // getTool → dbGet
    mockDbGet.mockResolvedValueOnce(
      makeFakeToolRow({
        default_approval_mode: 'auto_executable',
        mutation_type: 'bounded_write',
      })
    );
    // org policies → dbAll
    mockDbAll.mockResolvedValueOnce([]);

    const result = await getEffectivePolicy(TOOL_ID, 'background', ORG_ID);

    expect(result.state).toBe('deferred_approval');
    expect(result.approvalClass).toBe('requires_human_approval');
  });

  it('background consumer class with read_only tool does NOT get deferred_approval', async () => {
    // getTool → dbGet
    mockDbGet.mockResolvedValueOnce(
      makeFakeToolRow({
        default_approval_mode: 'auto_executable',
        mutation_type: 'read_only',
      })
    );
    // org policies → dbAll
    mockDbAll.mockResolvedValueOnce([]);

    const result = await getEffectivePolicy(TOOL_ID, 'background', ORG_ID);

    expect(result.state).toBe('allowed');
    expect(result.approvalClass).toBe('auto_executable');
  });

  it('differentiates consumer classes: execution vs worker', async () => {
    // --- execution consumer ---
    // getTool → dbGet
    mockDbGet.mockResolvedValueOnce(makeFakeToolRow({ default_approval_mode: 'auto_executable' }));
    // org policies → dbAll
    mockDbAll.mockResolvedValueOnce([
      makeFakePolicyRow({
        consumer_class: 'execution',
        approval_override: 'inherit_from_tool',
      }),
    ]);

    const executionResult = await getEffectivePolicy(TOOL_ID, 'execution', ORG_ID);
    expect(executionResult.state).toBe('allowed');

    vi.clearAllMocks();

    // --- worker consumer ---
    // getTool → dbGet
    mockDbGet.mockResolvedValueOnce(makeFakeToolRow({ default_approval_mode: 'auto_executable' }));
    // org policies → dbAll
    mockDbAll.mockResolvedValueOnce([
      makeFakePolicyRow({
        consumer_class: 'worker',
        approval_override: 'force_human_approval',
      }),
    ]);

    const workerResult = await getEffectivePolicy(TOOL_ID, 'worker', ORG_ID);
    expect(workerResult.state).toBe('requires_approval');
    expect(workerResult.approvalClass).toBe('requires_human_approval');
  });
});

describe('requestInvocation', () => {
  it('creates an invocation request and evaluates policy', async () => {
    // requestInvocation → getTool → dbGet (first call)
    mockDbGet.mockResolvedValueOnce(makeFakeToolRow({ default_approval_mode: 'auto_executable' }));
    // getEffectivePolicy → getTool → dbGet (second call)
    mockDbGet.mockResolvedValueOnce(makeFakeToolRow({ default_approval_mode: 'auto_executable' }));
    // getEffectivePolicy → org policies → dbAll
    mockDbAll.mockResolvedValueOnce([]);

    const result = await requestInvocation({
      organizationId: ORG_ID,
      toolId: TOOL_ID,
      consumerClass: 'chat',
      contextSnapshotId: SNAPSHOT_ID,
      initiatorUserId: USER_ID,
    });

    expect(result.invocationId).toBeDefined();
    expect(result.approvalResult).toBe('allowed');
    expect(result.toolId).toBe(TOOL_ID);
    expect(result.consumerClass).toBe('chat');

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_tool_invocation_log');
  });

  it('records blocked result when tool not found', async () => {
    // getEffectivePolicy → getTool → dbGet returns null
    mockDbGet.mockResolvedValueOnce(null);

    const result = await requestInvocation({
      organizationId: ORG_ID,
      toolId: TOOL_ID,
      consumerClass: 'chat',
      contextSnapshotId: SNAPSHOT_ID,
      initiatorUserId: USER_ID,
    });

    expect(result.approvalResult).toBe('blocked');
    expect(result.blockReason).toBe('tool_not_found');
  });

  it('defaults parameters to empty object', async () => {
    // getEffectivePolicy → getTool → dbGet
    mockDbGet.mockResolvedValueOnce(makeFakeToolRow({ default_approval_mode: 'auto_executable' }));
    // getEffectivePolicy → org policies → dbAll
    mockDbAll.mockResolvedValueOnce([]);

    const result = await requestInvocation({
      organizationId: ORG_ID,
      toolId: TOOL_ID,
      consumerClass: 'chat',
      contextSnapshotId: SNAPSHOT_ID,
      initiatorUserId: USER_ID,
    });

    expect(result.parameters).toEqual({});
  });

  it('rejects invalid params via Zod', async () => {
    await expect(
      requestInvocation({
        organizationId: 'not-a-uuid',
        toolId: TOOL_ID,
        consumerClass: 'chat',
        contextSnapshotId: SNAPSHOT_ID,
        initiatorUserId: USER_ID,
      })
    ).rejects.toThrow(ZodError);
  });
});

describe('logInvocationTrace', () => {
  it('records a 7-step trace', async () => {
    const result = await logInvocationTrace({
      invocationId: '00000000-0000-4000-8000-111111111111',
      toolId: TOOL_ID,
      consumerClass: 'chat',
      initiatingUserRef: USER_ID,
      effectiveRoleRef: 'role:project_admin',
      contextSnapshotRef: SNAPSHOT_ID,
      toolRiskClass: 'no_risk',
      consumerPolicyRef: 'policy:default',
      approvalState: 'auto_executed',
      invocationResult: 'success',
    });

    expect(result.traceId).toBeDefined();
    expect(result.invocationId).toBe('00000000-0000-4000-8000-111111111111');
    expect(result.approvalState).toBe('auto_executed');
    expect(result.invocationResult).toBe('success');
    expect(result.blockReason).toBeNull();

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_tool_invocation_traces');
  });

  it('records a blocked trace with reason', async () => {
    const result = await logInvocationTrace({
      invocationId: '00000000-0000-4000-8000-111111111111',
      toolId: TOOL_ID,
      consumerClass: 'worker',
      initiatingUserRef: USER_ID,
      effectiveRoleRef: 'role:viewer',
      contextSnapshotRef: SNAPSHOT_ID,
      toolRiskClass: 'high_risk',
      consumerPolicyRef: 'policy:org-default',
      approvalState: 'blocked',
      blockReason: 'consumer_class_denied',
      blockingPolicyRef: 'policy:org-default',
      invocationResult: 'not_executed',
    });

    expect(result.approvalState).toBe('blocked');
    expect(result.blockReason).toBe('consumer_class_denied');
    expect(result.blockingPolicyRef).toBe('policy:org-default');
    expect(result.invocationResult).toBe('not_executed');
  });

  it('rejects invalid approvalState via Zod', async () => {
    await expect(
      logInvocationTrace({
        invocationId: '00000000-0000-4000-8000-111111111111',
        toolId: TOOL_ID,
        consumerClass: 'chat',
        initiatingUserRef: USER_ID,
        effectiveRoleRef: 'role:admin',
        contextSnapshotRef: SNAPSHOT_ID,
        toolRiskClass: 'no_risk',
        consumerPolicyRef: 'policy:default',
        approvalState: 'invalid' as any,
        invocationResult: 'success',
      })
    ).rejects.toThrow(ZodError);
  });
});

describe('RISK_CLASS_DEFAULT_APPROVAL mapping', () => {
  it('maps no_risk → auto_executable', () => {
    expect(RISK_CLASS_DEFAULT_APPROVAL.no_risk).toBe('auto_executable');
  });

  it('maps low_risk → auto_executable', () => {
    expect(RISK_CLASS_DEFAULT_APPROVAL.low_risk).toBe('auto_executable');
  });

  it('maps medium_risk → policy_approvable', () => {
    expect(RISK_CLASS_DEFAULT_APPROVAL.medium_risk).toBe('policy_approvable');
  });

  it('maps high_risk → requires_human_approval', () => {
    expect(RISK_CLASS_DEFAULT_APPROVAL.high_risk).toBe('requires_human_approval');
  });

  it('maps critical → requires_human_approval', () => {
    expect(RISK_CLASS_DEFAULT_APPROVAL.critical).toBe('requires_human_approval');
  });
});

describe('APPROVAL_CLASS_STRICTNESS ordering', () => {
  it('auto_executable < policy_approvable < requires_human_approval', () => {
    expect(APPROVAL_CLASS_STRICTNESS.auto_executable).toBeLessThan(
      APPROVAL_CLASS_STRICTNESS.policy_approvable
    );
    expect(APPROVAL_CLASS_STRICTNESS.policy_approvable).toBeLessThan(
      APPROVAL_CLASS_STRICTNESS.requires_human_approval
    );
  });
});

describe('Zod schema validation', () => {
  it('validates a correct ToolCapability', () => {
    expect(() =>
      ToolCapabilitySchema.parse({
        toolId: TOOL_ID,
        organizationId: ORG_ID,
        name: 'Test Tool',
        description: 'A test tool',
        category: 'retrieval',
        riskClass: 'no_risk',
        mutationType: 'read_only',
        classificationStatus: 'proposed',
        defaultApprovalMode: 'auto_executable',
        classifiedBy: null,
        classifiedAt: null,
        version: '1.0.0',
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('rejects ToolCapability with invalid riskClass', () => {
    expect(() =>
      ToolCapabilitySchema.parse({
        toolId: TOOL_ID,
        organizationId: ORG_ID,
        name: 'Test Tool',
        description: 'A test tool',
        category: 'retrieval',
        riskClass: 'invalid',
        mutationType: 'read_only',
        classificationStatus: 'proposed',
        defaultApprovalMode: 'auto_executable',
        classifiedBy: null,
        classifiedAt: null,
        version: '1.0.0',
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).toThrow(ZodError);
  });

  it('validates RegisterToolParams', () => {
    expect(() => RegisterToolParamsSchema.parse(makeRegisterParams())).not.toThrow();
  });

  it('validates ClassifyToolParams', () => {
    expect(() =>
      ClassifyToolParamsSchema.parse({
        toolId: TOOL_ID,
        organizationId: ORG_ID,
        riskClass: 'low_risk',
        classifiedBy: USER_ID,
      })
    ).not.toThrow();
  });

  it('validates SetConsumerPolicyParams', () => {
    expect(() =>
      SetConsumerPolicyParamsSchema.parse({
        organizationId: ORG_ID,
        consumerClass: 'chat',
        toolId: TOOL_ID,
        allowed: true,
      })
    ).not.toThrow();
  });

  it('validates RequestInvocationParams', () => {
    expect(() =>
      RequestInvocationParamsSchema.parse({
        organizationId: ORG_ID,
        toolId: TOOL_ID,
        consumerClass: 'chat',
        contextSnapshotId: SNAPSHOT_ID,
        initiatorUserId: USER_ID,
      })
    ).not.toThrow();
  });

  it('validates LogInvocationTraceParams', () => {
    expect(() =>
      LogInvocationTraceParamsSchema.parse({
        invocationId: '00000000-0000-4000-8000-111111111111',
        toolId: TOOL_ID,
        consumerClass: 'chat',
        initiatingUserRef: USER_ID,
        effectiveRoleRef: 'role:admin',
        contextSnapshotRef: SNAPSHOT_ID,
        toolRiskClass: 'no_risk',
        consumerPolicyRef: 'policy:default',
        approvalState: 'auto_executed',
        invocationResult: 'success',
      })
    ).not.toThrow();
  });

  it('validates SubagentDelegationToken', () => {
    expect(() =>
      SubagentDelegationTokenSchema.parse({
        delegationId: '00000000-0000-4000-8000-dddddddddddd',
        parentRunId: RUN_ID,
        subagentRef: 'subagent:worker-1',
        allowedToolIds: [TOOL_ID],
        deniedToolIds: [],
        maxMutationType: 'bounded_write',
        credentialMode: 'scoped_temporary_grant',
        expiresAt: '2026-03-24T10:00:00.000Z',
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('rejects SubagentDelegationToken with invalid credentialMode', () => {
    expect(() =>
      SubagentDelegationTokenSchema.parse({
        delegationId: '00000000-0000-4000-8000-dddddddddddd',
        parentRunId: RUN_ID,
        subagentRef: 'subagent:worker-1',
        allowedToolIds: [TOOL_ID],
        deniedToolIds: [],
        maxMutationType: 'bounded_write',
        credentialMode: 'full_access',
        expiresAt: '2026-03-24T10:00:00.000Z',
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).toThrow(ZodError);
  });
});
