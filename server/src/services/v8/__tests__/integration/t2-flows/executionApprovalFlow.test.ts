import { describe, expect, it, vi, beforeEach } from 'vitest';

import type {
  ExecutionAgentRun,
  ActionProposal,
  CreateRunParams,
  CreateProposalParams,
  RunState,
} from '../../../../../types/executionSpine.js';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true, changes: 1 });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  createRun,
  transitionRunState,
  createProposal,
  submitForReview,
  approveRun,
  applyRun,
  completeRun,
  rejectRun,
  replanFromRejection,
  checkRunExpiration,
  resolveProposalsBatch,
  getActiveRuns,
  getRun,
  getProposalsByRun,
} from '../../../executionSpineService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '20000000-0000-4000-a000-000000000001';
const SNAPSHOT_ID = '20000000-0000-4000-a000-000000000010';
const USER_ID = '20000000-0000-4000-a000-000000000020';
const REVIEWER_ID = '20000000-0000-4000-a000-000000000030';

const ARTIFACT_REF = {
  artifactId: '20000000-0000-4000-a000-000000000040',
  artifactType: 'initiative',
  artifactModule: 'initiatives',
  relationship: 'target' as const,
};

const MUTATION_DESC = {
  operation: 'update' as const,
  targetFields: ['status', 'priority'],
  payloadSummary: { status: 'active' },
  reversibility: 'reversible' as const,
  estimatedImpact: 'Low impact status change',
};

function makeRunParams(overrides?: Partial<CreateRunParams>): CreateRunParams {
  return {
    organizationId: ORG_ID,
    contextSnapshotId: SNAPSHOT_ID,
    initiatorUserId: USER_ID,
    goal: 'Update initiative status to active',
    metadata: {},
    ...overrides,
  };
}

function makeProposalParams(runId: string, overrides?: Partial<CreateProposalParams>): CreateProposalParams {
  return {
    executionRunId: runId,
    contextSnapshotRef: SNAPSHOT_ID,
    proposalType: 'update_artifact',
    targetRef: ARTIFACT_REF,
    summary: 'Update initiative status',
    reason: 'User requested status change',
    mutationDescription: MUTATION_DESC,
    riskClass: 'safe_update',
    approvalClass: 'requires_human_approval',
    dependsOn: [],
    ...overrides,
  };
}

function makeRunRow(run: ExecutionAgentRun) {
  return {
    run_id: run.runId,
    organization_id: run.organizationId,
    context_snapshot_id: run.contextSnapshotId,
    initiator_user_id: run.initiatorUserId,
    state: run.state,
    plan_version: run.planVersion,
    goal: run.goal,
    created_at: run.createdAt,
    updated_at: run.updatedAt,
    resolved_at: run.resolvedAt,
    expires_at: run.expiresAt,
    metadata: JSON.stringify(run.metadata),
  };
}

function makeProposalRow(proposal: ActionProposal) {
  return {
    proposal_id: proposal.proposalId,
    execution_run_id: proposal.executionRunId,
    context_snapshot_ref: proposal.contextSnapshotRef,
    proposal_type: proposal.proposalType,
    target_ref: JSON.stringify(proposal.targetRef),
    summary: proposal.summary,
    reason: proposal.reason,
    mutation_description: JSON.stringify(proposal.mutationDescription),
    risk_class: proposal.riskClass,
    approval_class: proposal.approvalClass,
    preview_payload: proposal.previewPayload ? JSON.stringify(proposal.previewPayload) : null,
    depends_on: JSON.stringify(proposal.dependsOn),
    status: proposal.status,
    created_at: proposal.createdAt,
    resolved_at: proposal.resolvedAt,
    resolved_by: proposal.resolvedBy,
  };
}

// ==========================================
// INTEGRATION FLOW TESTS
// ==========================================

describe('Wave 3/4 — Execution Approval Flow Integration Proof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('F01: Full approval lifecycle', () => {
    it('creates run → plans → proposes → submits → approves → applies → completes', async () => {
      const run = await createRun(makeRunParams());
      expect(run.state).toBe('drafting');
      expect(run.planVersion).toBe(1);
      expect(run.organizationId).toBe(ORG_ID);

      mockDbGet.mockResolvedValueOnce(makeRunRow(run));
      const planningRun = await transitionRunState(run.runId, ORG_ID, 'planning', USER_ID);
      expect(planningRun.state).toBe('planning');

      const proposal = await createProposal(makeProposalParams(run.runId));
      expect(proposal.status).toBe('draft');
      expect(proposal.executionRunId).toBe(run.runId);

      mockDbGet.mockResolvedValueOnce(makeRunRow({ ...planningRun, state: 'planning' }));
      const readyRun = await transitionRunState(run.runId, ORG_ID, 'proposals_ready', USER_ID);
      expect(readyRun.state).toBe('proposals_ready');

      mockDbGet.mockResolvedValueOnce(makeRunRow({ ...readyRun, state: 'proposals_ready' }));
      const reviewRun = await submitForReview(run.runId, ORG_ID, USER_ID);
      expect(reviewRun.state).toBe('waiting_for_review');
      expect(reviewRun.expiresAt).toBeDefined();

      mockDbGet.mockResolvedValueOnce(makeRunRow({ ...reviewRun, state: 'waiting_for_review' }));
      const approvedRun = await approveRun(run.runId, ORG_ID, REVIEWER_ID, 'Looks good');
      expect(approvedRun.state).toBe('approved_for_apply');

      mockDbGet.mockResolvedValueOnce(makeRunRow({ ...approvedRun, state: 'approved_for_apply' }));
      const applyingRun = await applyRun(run.runId, ORG_ID, 'system');
      expect(applyingRun.state).toBe('applying');

      mockDbGet.mockResolvedValueOnce(makeRunRow({ ...applyingRun, state: 'applying' }));
      const completedRun = await completeRun(run.runId, ORG_ID, 'system');
      expect(completedRun.state).toBe('completed');
      expect(completedRun.resolvedAt).toBeDefined();
    });
  });

  describe('F02: Rejection and replan', () => {
    it('creates run → plans → submits → rejects → replans with incremented version', async () => {
      const run = await createRun(makeRunParams());
      expect(run.planVersion).toBe(1);

      mockDbGet.mockResolvedValueOnce(makeRunRow(run));
      const planningRun = await transitionRunState(run.runId, ORG_ID, 'planning', USER_ID);

      const proposal = await createProposal(makeProposalParams(run.runId));
      expect(proposal.status).toBe('draft');

      mockDbGet.mockResolvedValueOnce(makeRunRow({ ...planningRun, state: 'planning' }));
      const readyRun = await transitionRunState(run.runId, ORG_ID, 'proposals_ready', USER_ID);

      mockDbGet.mockResolvedValueOnce(makeRunRow({ ...readyRun, state: 'proposals_ready' }));
      const reviewRun = await submitForReview(run.runId, ORG_ID, USER_ID);
      expect(reviewRun.state).toBe('waiting_for_review');

      mockDbGet.mockResolvedValueOnce(makeRunRow({ ...reviewRun, state: 'waiting_for_review' }));
      const rejectedRun = await rejectRun(run.runId, ORG_ID, REVIEWER_ID, 'Needs rework');
      expect(rejectedRun.state).toBe('rejected');

      mockDbGet.mockResolvedValueOnce(makeRunRow({ ...rejectedRun, state: 'rejected', plan_version: 1 } as unknown as ExecutionAgentRun));
      const replanRun = await replanFromRejection(run.runId, ORG_ID, USER_ID);
      expect(replanRun.state).toBe('planning');
      expect(replanRun.planVersion).toBe(2);

      const expireCalls = mockDbRun.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('SET status = \'expired\''),
      );
      expect(expireCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('F03: Review expiration', () => {
    it('submitForReview sets 72h SLA and checkRunExpiration detects expiry', async () => {
      const run = await createRun(makeRunParams());

      mockDbGet.mockResolvedValueOnce(makeRunRow(run));
      const planningRun = await transitionRunState(run.runId, ORG_ID, 'planning', USER_ID);

      mockDbGet.mockResolvedValueOnce(makeRunRow({ ...planningRun, state: 'planning' }));
      const readyRun = await transitionRunState(run.runId, ORG_ID, 'proposals_ready', USER_ID);

      mockDbGet.mockResolvedValueOnce(makeRunRow({ ...readyRun, state: 'proposals_ready' }));
      const reviewRun = await submitForReview(run.runId, ORG_ID, USER_ID);
      expect(reviewRun.expiresAt).toBeDefined();

      const pastExpiry = new Date(Date.now() - 1000).toISOString();
      const expiredRow = makeRunRow({
        ...reviewRun,
        state: 'waiting_for_review' as RunState,
        expiresAt: pastExpiry,
      });

      mockDbGet.mockResolvedValueOnce(expiredRow);
      mockDbGet.mockResolvedValueOnce(expiredRow);

      const wasExpired = await checkRunExpiration(run.runId, ORG_ID);
      expect(wasExpired).toBe(true);

      const transitionCalls = mockDbRun.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('UPDATE v8_execution_runs') && Array.isArray(call[1]) && call[1].includes('expired'),
      );
      expect(transitionCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('does not expire a run that is still within SLA', async () => {
      const run = await createRun(makeRunParams());

      const futureExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      const activeRow = makeRunRow({
        ...run,
        state: 'waiting_for_review' as RunState,
        expiresAt: futureExpiry,
      });

      mockDbGet.mockResolvedValueOnce(activeRow);

      const wasExpired = await checkRunExpiration(run.runId, ORG_ID);
      expect(wasExpired).toBe(false);
    });
  });

  describe('F04: Batch proposal resolution', () => {
    it('resolves multiple proposals in one batch call', async () => {
      const run = await createRun(makeRunParams());

      const proposal1 = await createProposal(makeProposalParams(run.runId, { summary: 'Proposal A' }));
      const proposal2 = await createProposal(makeProposalParams(run.runId, { summary: 'Proposal B' }));
      const proposal3 = await createProposal(makeProposalParams(run.runId, { summary: 'Proposal C' }));

      mockDbGet
        .mockResolvedValueOnce(makeProposalRow(proposal1))
        .mockResolvedValueOnce(makeProposalRow(proposal2))
        .mockResolvedValueOnce(makeProposalRow(proposal3));

      const resolved = await resolveProposalsBatch(
        [proposal1.proposalId, proposal2.proposalId, proposal3.proposalId],
        'approved',
        REVIEWER_ID,
      );

      expect(resolved).toHaveLength(3);
      for (const p of resolved) {
        expect(p.status).toBe('approved');
        expect(p.resolvedBy).toBe(REVIEWER_ID);
        expect(p.resolvedAt).toBeDefined();
      }
    });
  });

  describe('F05: Active runs query', () => {
    it('returns only non-terminal runs for the organization', async () => {
      const draftingRun = await createRun(makeRunParams({ goal: 'Drafting run' }));
      const planningRun = await createRun(makeRunParams({ goal: 'Planning run' }));
      const completedRun = await createRun(makeRunParams({ goal: 'Completed run' }));

      mockDbAll.mockResolvedValueOnce([
        makeRunRow({ ...draftingRun, state: 'drafting' as RunState }),
        makeRunRow({ ...planningRun, state: 'planning' as RunState }),
      ]);

      const activeRuns = await getActiveRuns(ORG_ID);

      expect(activeRuns).toHaveLength(2);
      const states = activeRuns.map((r) => r.state);
      expect(states).not.toContain('completed');
      expect(states).not.toContain('cancelled');
      expect(states).not.toContain('expired');

      const querySql = mockDbAll.mock.calls[0][0] as string;
      expect(querySql).toContain('NOT IN');
      expect(querySql).toContain('completed');
      expect(querySql).toContain('cancelled');
      expect(querySql).toContain('expired');
    });

    it('returns empty array when all runs are terminal', async () => {
      mockDbAll.mockResolvedValueOnce([]);

      const activeRuns = await getActiveRuns(ORG_ID);
      expect(activeRuns).toEqual([]);
    });
  });
});
