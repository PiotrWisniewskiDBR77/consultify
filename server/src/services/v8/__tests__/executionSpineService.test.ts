import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  CreateProposalParams,
  CreateRunParams,
  RunState,
} from '../../../types/executionSpine.js';
import {
  ActionPreviewSchema,
  ActionProposalSchema,
  CreateProposalParamsSchema,
  CreateRunParamsSchema,
  ExecutionAgentRunSchema,
  MutationDescriptorSchema,
  RunStateTransitionSchema,
  TERMINAL_STATES,
  VALID_TRANSITIONS,
} from '../../../types/executionSpine.js';

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
  checkRunExpiration,
  createProposal,
  createRun,
  getProposalsByRun,
  getRun,
  getRunTransitions,
  resolveProposal,
  transitionRunState,
} from '../executionSpineService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000010';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';

function makeRunParams(overrides?: Partial<CreateRunParams>): CreateRunParams {
  return {
    organizationId: ORG_ID,
    contextSnapshotId: SNAPSHOT_ID,
    initiatorUserId: USER_ID,
    goal: 'Rebaseline initiative KPIs',
    expiresAt: null,
    metadata: { source: 'test' },
    ...overrides,
  };
}

function makeFakeRunRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    run_id: '00000000-0000-4000-8000-bbbbbbbbbbbb',
    organization_id: ORG_ID,
    context_snapshot_id: SNAPSHOT_ID,
    initiator_user_id: USER_ID,
    state: 'drafting',
    plan_version: 1,
    goal: 'Rebaseline initiative KPIs',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    resolved_at: null,
    expires_at: null,
    metadata: JSON.stringify({ source: 'test' }),
    ...overrides,
  };
}

function makeProposalParams(overrides?: Partial<CreateProposalParams>): CreateProposalParams {
  return {
    executionRunId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
    contextSnapshotRef: SNAPSHOT_ID,
    proposalType: 'update_artifact',
    targetRef: {
      artifactId: 'art-1',
      artifactType: 'initiative',
      artifactModule: 'execution',
      relationship: 'target',
    },
    summary: 'Update KPI target from 80% to 90%',
    reason: 'New business objective requires higher target',
    mutationDescription: {
      operation: 'update',
      targetFields: ['kpiTarget'],
      payloadSummary: { from: 80, to: 90 },
      reversibility: 'reversible',
      estimatedImpact: 'Low — single field update',
    },
    riskClass: 'safe_update',
    approvalClass: 'requires_human_approval',
    previewPayload: null,
    dependsOn: [],
    ...overrides,
  };
}

function makeFakeProposalRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    proposal_id: '00000000-0000-4000-8000-cccccccccccc',
    execution_run_id: '00000000-0000-4000-8000-bbbbbbbbbbbb',
    context_snapshot_ref: SNAPSHOT_ID,
    proposal_type: 'update_artifact',
    target_ref: JSON.stringify({
      artifactId: 'art-1',
      artifactType: 'initiative',
      artifactModule: 'execution',
      relationship: 'target',
    }),
    summary: 'Update KPI target from 80% to 90%',
    reason: 'New business objective',
    mutation_description: JSON.stringify({
      operation: 'update',
      targetFields: ['kpiTarget'],
      payloadSummary: { from: 80, to: 90 },
      reversibility: 'reversible',
      estimatedImpact: null,
    }),
    risk_class: 'safe_update',
    approval_class: 'requires_human_approval',
    preview_payload: null,
    depends_on: '[]',
    status: 'draft',
    created_at: '2026-03-23T10:00:00.000Z',
    resolved_at: null,
    resolved_by: null,
    ...overrides,
  };
}

function makeFakeTransitionRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    transition_id: '00000000-0000-4000-8000-dddddddddddd',
    run_id: '00000000-0000-4000-8000-bbbbbbbbbbbb',
    from_state: 'drafting',
    to_state: 'planning',
    triggered_by: USER_ID,
    reason: 'Starting plan',
    transitioned_at: '2026-03-23T10:05:00.000Z',
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createRun', () => {
  it('creates a run in drafting state with all required fields', async () => {
    const result = await createRun(makeRunParams());

    expect(result.runId).toBeDefined();
    expect(result.state).toBe('drafting');
    expect(result.planVersion).toBe(1);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.contextSnapshotId).toBe(SNAPSHOT_ID);
    expect(result.initiatorUserId).toBe(USER_ID);
    expect(result.goal).toBe('Rebaseline initiative KPIs');
    expect(result.resolvedAt).toBeNull();
    expect(result.metadata).toEqual({ source: 'test' });

    // INSERT for run + INSERT for initial transition
    expect(mockDbRun).toHaveBeenCalledTimes(2);
    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_execution_runs');
  });

  it('records an initial audit transition on creation', async () => {
    await createRun(makeRunParams());

    const transitionSql = mockDbRun.mock.calls[1][0] as string;
    expect(transitionSql).toContain('INSERT INTO v8_run_state_transitions');
  });

  it('defaults metadata to empty object', async () => {
    const result = await createRun(makeRunParams({ metadata: undefined }));
    expect(result.metadata).toEqual({});
  });

  it('rejects missing required fields via Zod', async () => {
    await expect(createRun({ organizationId: ORG_ID } as any)).rejects.toThrow(ZodError);
  });

  it('rejects invalid UUID for organizationId', async () => {
    await expect(createRun(makeRunParams({ organizationId: 'not-a-uuid' }))).rejects.toThrow(
      ZodError
    );
  });
});

describe('getRun', () => {
  it('returns a run when found with org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow());

    const result = await getRun('00000000-0000-4000-8000-bbbbbbbbbbbb', ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.runId).toBe('00000000-0000-4000-8000-bbbbbbbbbbbb');
    expect(result!.organizationId).toBe(ORG_ID);
    expect(result!.state).toBe('drafting');
    expect(result!.metadata).toEqual({ source: 'test' });

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns null when run does not exist', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getRun('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation — different org returns null', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getRun('00000000-0000-4000-8000-bbbbbbbbbbbb', OTHER_ORG_ID);
    expect(result).toBeNull();
  });
});

describe('transitionRunState', () => {
  it('transitions drafting → planning (happy path)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'drafting' }));

    const result = await transitionRunState(
      '00000000-0000-4000-8000-bbbbbbbbbbbb',
      ORG_ID,
      'planning',
      USER_ID,
      'Starting plan'
    );

    expect(result.state).toBe('planning');
    expect(result.planVersion).toBe(1);

    // UPDATE run + INSERT transition
    expect(mockDbRun).toHaveBeenCalledTimes(2);
  });

  it('transitions planning → proposals_ready', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'planning' }));

    const result = await transitionRunState(
      '00000000-0000-4000-8000-bbbbbbbbbbbb',
      ORG_ID,
      'proposals_ready',
      'system'
    );

    expect(result.state).toBe('proposals_ready');
  });

  it('transitions waiting_for_review → approved_for_apply', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'waiting_for_review' }));

    const result = await transitionRunState(
      '00000000-0000-4000-8000-bbbbbbbbbbbb',
      ORG_ID,
      'approved_for_apply',
      USER_ID,
      'All proposals approved'
    );

    expect(result.state).toBe('approved_for_apply');
  });

  it('transitions applying → completed and sets resolvedAt', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'applying' }));

    const result = await transitionRunState(
      '00000000-0000-4000-8000-bbbbbbbbbbbb',
      ORG_ID,
      'completed',
      'system',
      'All mutations applied'
    );

    expect(result.state).toBe('completed');
    expect(result.resolvedAt).not.toBeNull();
  });

  it('increments planVersion when re-planning from rejected', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'rejected', plan_version: 2 }));

    const result = await transitionRunState(
      '00000000-0000-4000-8000-bbbbbbbbbbbb',
      ORG_ID,
      'planning',
      USER_ID,
      'Re-planning after rejection'
    );

    expect(result.state).toBe('planning');
    expect(result.planVersion).toBe(3);
  });

  it('rejects invalid transition: drafting → completed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'drafting' }));

    await expect(
      transitionRunState('00000000-0000-4000-8000-bbbbbbbbbbbb', ORG_ID, 'completed', USER_ID)
    ).rejects.toThrow('Invalid state transition: drafting → completed');
  });

  it('rejects invalid transition: completed → planning', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'completed' }));

    await expect(
      transitionRunState('00000000-0000-4000-8000-bbbbbbbbbbbb', ORG_ID, 'planning', USER_ID)
    ).rejects.toThrow('Invalid state transition');
  });

  it('rejects transition from cancelled (terminal)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'cancelled' }));

    await expect(
      transitionRunState('00000000-0000-4000-8000-bbbbbbbbbbbb', ORG_ID, 'planning', USER_ID)
    ).rejects.toThrow('Invalid state transition');
  });

  it('allows cancellation from any non-terminal state', async () => {
    const nonTerminalStates: RunState[] = [
      'drafting',
      'planning',
      'proposals_ready',
      'waiting_for_review',
      'approved_for_apply',
      'rejected',
      'applying',
      'failed',
    ];

    for (const state of nonTerminalStates) {
      vi.clearAllMocks();
      mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state }));

      const result = await transitionRunState(
        '00000000-0000-4000-8000-bbbbbbbbbbbb',
        ORG_ID,
        'cancelled',
        USER_ID,
        `Cancelling from ${state}`
      );

      expect(result.state).toBe('cancelled');
      expect(result.resolvedAt).not.toBeNull();
    }
  });

  it('throws when run not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(transitionRunState('nonexistent', ORG_ID, 'planning', USER_ID)).rejects.toThrow(
      'Run nonexistent not found'
    );
  });

  it('records audit transition on every state change', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'drafting' }));

    await transitionRunState(
      '00000000-0000-4000-8000-bbbbbbbbbbbb',
      ORG_ID,
      'planning',
      USER_ID,
      'Starting plan'
    );

    const transitionSql = mockDbRun.mock.calls[1][0] as string;
    expect(transitionSql).toContain('INSERT INTO v8_run_state_transitions');
    const transitionParams = mockDbRun.mock.calls[1][1] as unknown[];
    expect(transitionParams).toContain('drafting');
    expect(transitionParams).toContain('planning');
    expect(transitionParams).toContain(USER_ID);
  });

  it('allows re-planning from failed state', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'failed', plan_version: 1 }));

    const result = await transitionRunState(
      '00000000-0000-4000-8000-bbbbbbbbbbbb',
      ORG_ID,
      'planning',
      USER_ID,
      'Retrying after failure'
    );

    expect(result.state).toBe('planning');
  });
});

describe('createProposal', () => {
  it('creates a proposal in draft status', async () => {
    const result = await createProposal(makeProposalParams());

    expect(result.proposalId).toBeDefined();
    expect(result.status).toBe('draft');
    expect(result.executionRunId).toBe('00000000-0000-4000-8000-bbbbbbbbbbbb');
    expect(result.proposalType).toBe('update_artifact');
    expect(result.riskClass).toBe('safe_update');
    expect(result.approvalClass).toBe('requires_human_approval');
    expect(result.resolvedAt).toBeNull();
    expect(result.resolvedBy).toBeNull();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_action_proposals');
  });

  it('stores mutation description correctly', async () => {
    const result = await createProposal(makeProposalParams());

    expect(result.mutationDescription.operation).toBe('update');
    expect(result.mutationDescription.targetFields).toEqual(['kpiTarget']);
    expect(result.mutationDescription.reversibility).toBe('reversible');
  });

  it('supports all proposal types', async () => {
    const types = [
      'create_artifact',
      'update_artifact',
      'transform_artifact',
      'link_artifacts',
      'workflow_transition',
      'generate_structured_output',
      'review_or_quality_pass',
      'request_human_decision',
    ] as const;

    for (const proposalType of types) {
      vi.clearAllMocks();
      const result = await createProposal(makeProposalParams({ proposalType }));
      expect(result.proposalType).toBe(proposalType);
    }
  });

  it('rejects invalid proposal type via Zod', async () => {
    await expect(
      createProposal(makeProposalParams({ proposalType: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('defaults dependsOn to empty array', async () => {
    const result = await createProposal(makeProposalParams({ dependsOn: undefined }));
    expect(result.dependsOn).toEqual([]);
  });
});

describe('getProposalsByRun', () => {
  it('returns proposals for a run with org isolation', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeProposalRow(),
      makeFakeProposalRow({ proposal_id: 'prop-2', summary: 'Second proposal' }),
    ]);

    const results = await getProposalsByRun('00000000-0000-4000-8000-bbbbbbbbbbbb', ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].proposalId).toBe('00000000-0000-4000-8000-cccccccccccc');

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns empty array when no proposals exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getProposalsByRun('00000000-0000-4000-8000-bbbbbbbbbbbb', ORG_ID);
    expect(results).toEqual([]);
  });
});

describe('resolveProposal', () => {
  it('approves a draft proposal', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow({ status: 'draft' }));

    const result = await resolveProposal(
      '00000000-0000-4000-8000-cccccccccccc',
      'approved',
      USER_ID
    );

    expect(result.status).toBe('approved');
    expect(result.resolvedAt).not.toBeNull();
    expect(result.resolvedBy).toBe(USER_ID);

    const updateSql = mockDbRun.mock.calls[0][0] as string;
    expect(updateSql).toContain('UPDATE v8_action_proposals');
  });

  it('rejects a pending_review proposal', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow({ status: 'pending_review' }));

    const result = await resolveProposal(
      '00000000-0000-4000-8000-cccccccccccc',
      'rejected',
      USER_ID
    );

    expect(result.status).toBe('rejected');
  });

  it('marks a proposal as policy_allowed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow({ status: 'draft' }));

    const result = await resolveProposal(
      '00000000-0000-4000-8000-cccccccccccc',
      'policy_allowed',
      'policy:auto-approve-safe-additive'
    );

    expect(result.status).toBe('policy_allowed');
    expect(result.resolvedBy).toBe('policy:auto-approve-safe-additive');
  });

  it('throws when proposal not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(resolveProposal('nonexistent', 'approved', USER_ID)).rejects.toThrow(
      'Proposal nonexistent not found'
    );
  });

  it('throws when proposal already resolved', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow({ status: 'approved' }));

    await expect(
      resolveProposal('00000000-0000-4000-8000-cccccccccccc', 'rejected', USER_ID)
    ).rejects.toThrow('Cannot resolve proposal');
  });

  it('throws for invalid resolution status', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow({ status: 'draft' }));

    await expect(
      resolveProposal('00000000-0000-4000-8000-cccccccccccc', 'draft' as any, USER_ID)
    ).rejects.toThrow('Invalid resolution status');
  });
});

describe('getRunTransitions', () => {
  it('returns transitions ordered by time', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeTransitionRow({ transitioned_at: '2026-03-23T10:00:00.000Z' }),
      makeFakeTransitionRow({
        transition_id: 'tr-2',
        from_state: 'planning',
        to_state: 'proposals_ready',
        transitioned_at: '2026-03-23T10:05:00.000Z',
      }),
    ]);

    const results = await getRunTransitions('00000000-0000-4000-8000-bbbbbbbbbbbb');

    expect(results).toHaveLength(2);
    expect(results[0].fromState).toBe('drafting');
    expect(results[0].toState).toBe('planning');
    expect(results[1].fromState).toBe('planning');
    expect(results[1].toState).toBe('proposals_ready');
  });

  it('returns empty array when no transitions exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getRunTransitions('nonexistent');
    expect(results).toEqual([]);
  });
});

describe('checkRunExpiration', () => {
  it('expires a run past its deadline', async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString();

    // First call: getRun
    mockDbGet.mockResolvedValueOnce(
      makeFakeRunRow({ state: 'waiting_for_review', expires_at: pastDate })
    );
    // Second call: getRun inside transitionRunState
    mockDbGet.mockResolvedValueOnce(
      makeFakeRunRow({ state: 'waiting_for_review', expires_at: pastDate })
    );

    const expired = await checkRunExpiration('00000000-0000-4000-8000-bbbbbbbbbbbb', ORG_ID);

    expect(expired).toBe(true);
  });

  it('does not expire a run before its deadline', async () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();

    mockDbGet.mockResolvedValueOnce(
      makeFakeRunRow({ state: 'waiting_for_review', expires_at: futureDate })
    );

    const expired = await checkRunExpiration('00000000-0000-4000-8000-bbbbbbbbbbbb', ORG_ID);

    expect(expired).toBe(false);
  });

  it('returns false for runs not in waiting_for_review', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'planning' }));

    const expired = await checkRunExpiration('00000000-0000-4000-8000-bbbbbbbbbbbb', ORG_ID);

    expect(expired).toBe(false);
  });

  it('returns false for runs without expiresAt', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeRunRow({ state: 'waiting_for_review', expires_at: null })
    );

    const expired = await checkRunExpiration('00000000-0000-4000-8000-bbbbbbbbbbbb', ORG_ID);

    expect(expired).toBe(false);
  });

  it('returns false when run not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const expired = await checkRunExpiration('nonexistent', ORG_ID);

    expect(expired).toBe(false);
  });
});

describe('state machine completeness', () => {
  it('VALID_TRANSITIONS covers all RunState values', () => {
    const allStates: RunState[] = [
      'drafting',
      'planning',
      'proposals_ready',
      'waiting_for_review',
      'approved_for_apply',
      'rejected',
      'applying',
      'completed',
      'failed',
      'cancelled',
      'expired',
    ];

    for (const state of allStates) {
      expect(VALID_TRANSITIONS).toHaveProperty(state);
    }
  });

  it('terminal states have no outgoing transitions', () => {
    for (const state of TERMINAL_STATES) {
      const transitions = VALID_TRANSITIONS[state];
      expect(transitions).toHaveLength(0);
    }
  });

  it('all non-terminal states allow cancellation', () => {
    const allStates: RunState[] = [
      'drafting',
      'planning',
      'proposals_ready',
      'waiting_for_review',
      'approved_for_apply',
      'rejected',
      'applying',
      'completed',
      'failed',
      'cancelled',
      'expired',
    ];

    for (const state of allStates) {
      if (TERMINAL_STATES.has(state)) continue;
      expect(VALID_TRANSITIONS[state]).toContain('cancelled');
    }
  });
});

describe('Zod schema validation', () => {
  it('validates a correct ExecutionAgentRun', () => {
    const valid = {
      runId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
      organizationId: ORG_ID,
      contextSnapshotId: SNAPSHOT_ID,
      initiatorUserId: USER_ID,
      state: 'drafting' as const,
      planVersion: 1,
      goal: 'Test goal',
      createdAt: '2026-03-23T10:00:00.000Z',
      updatedAt: '2026-03-23T10:00:00.000Z',
      resolvedAt: null,
      expiresAt: null,
      metadata: {},
    };

    expect(() => ExecutionAgentRunSchema.parse(valid)).not.toThrow();
  });

  it('rejects run with invalid state', () => {
    expect(() =>
      ExecutionAgentRunSchema.parse({
        runId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
        organizationId: ORG_ID,
        contextSnapshotId: SNAPSHOT_ID,
        initiatorUserId: USER_ID,
        state: 'invalid_state',
        planVersion: 1,
        goal: 'Test',
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
        resolvedAt: null,
        expiresAt: null,
        metadata: {},
      })
    ).toThrow(ZodError);
  });

  it('validates MutationDescriptor', () => {
    expect(() =>
      MutationDescriptorSchema.parse({
        operation: 'update',
        targetFields: ['field1'],
        payloadSummary: { key: 'value' },
        reversibility: 'reversible',
        estimatedImpact: 'Low',
      })
    ).not.toThrow();

    expect(() =>
      MutationDescriptorSchema.parse({
        operation: 'invalid_op',
        targetFields: null,
        payloadSummary: null,
        reversibility: 'reversible',
        estimatedImpact: null,
      })
    ).toThrow(ZodError);
  });

  it('validates ActionPreview', () => {
    expect(() =>
      ActionPreviewSchema.parse({
        diff: null,
        beforeState: null,
        afterState: null,
        createdObjects: [],
        updatedFields: ['field1'],
        destructiveImpact: null,
        followupEffects: [],
      })
    ).not.toThrow();
  });

  it('validates CreateRunParams', () => {
    expect(() => CreateRunParamsSchema.parse(makeRunParams())).not.toThrow();
  });

  it('validates CreateProposalParams', () => {
    expect(() => CreateProposalParamsSchema.parse(makeProposalParams())).not.toThrow();
  });

  it('validates RunStateTransition', () => {
    expect(() =>
      RunStateTransitionSchema.parse({
        transitionId: '00000000-0000-4000-8000-dddddddddddd',
        runId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
        fromState: 'drafting',
        toState: 'planning',
        triggeredBy: USER_ID,
        reason: null,
        transitionedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });
});
