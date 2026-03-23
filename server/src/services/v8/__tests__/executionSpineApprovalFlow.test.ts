import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { RunState } from '../../../types/executionSpine.js';

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
  submitForReview,
  approveRun,
  rejectRun,
  applyRun,
  completeRun,
  replanFromRejection,
  getRunsByOrg,
  getActiveRuns,
  resolveProposalsBatch,
  createRun,
  transitionRunState,
} from '../executionSpineService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const REVIEWER_ID = '00000000-0000-4000-8000-000000000004';
const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000010';
const RUN_ID = '00000000-0000-4000-8000-bbbbbbbbbbbb';
const PROPOSAL_1_ID = '00000000-0000-4000-8000-cccccccccc01';
const PROPOSAL_2_ID = '00000000-0000-4000-8000-cccccccccc02';

function makeFakeRunRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    run_id: RUN_ID,
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
    review_submitted_at: null,
    review_completed_at: null,
    review_completed_by: null,
    ...overrides,
  };
}

function makeFakeProposalRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    proposal_id: PROPOSAL_1_ID,
    execution_run_id: RUN_ID,
    context_snapshot_ref: SNAPSHOT_ID,
    proposal_type: 'update_artifact',
    target_ref: JSON.stringify({
      artifactId: 'art-1',
      artifactType: 'initiative',
      artifactModule: 'execution',
      relationship: 'target',
    }),
    summary: 'Update KPI target',
    reason: 'New objective',
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

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submitForReview', () => {
  it('transitions to waiting_for_review and sets expiresAt', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'proposals_ready' }));

    const result = await submitForReview(RUN_ID, ORG_ID, USER_ID);

    expect(result.state).toBe('waiting_for_review');
    expect(result.expiresAt).not.toBeNull();

    const expiresAt = new Date(result.expiresAt!);
    const now = new Date();
    const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    expect(hoursDiff).toBeGreaterThan(71);
    expect(hoursDiff).toBeLessThan(73);
  });

  it('updates draft proposals to pending_review', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'proposals_ready' }));

    await submitForReview(RUN_ID, ORG_ID, USER_ID);

    const proposalUpdateCall = mockDbRun.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('UPDATE v8_action_proposals') &&
        call[0].includes("status = 'pending_review'"),
    );
    expect(proposalUpdateCall).toBeDefined();
    expect(proposalUpdateCall![1]).toContain(RUN_ID);
  });

  it('throws when run is not in proposals_ready state', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'drafting' }));

    await expect(submitForReview(RUN_ID, ORG_ID, USER_ID)).rejects.toThrow(
      'Invalid state transition',
    );
  });
});

describe('approveRun', () => {
  it('transitions to approved_for_apply and resolves proposals', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'waiting_for_review' }));

    const result = await approveRun(RUN_ID, ORG_ID, REVIEWER_ID, 'Looks good');

    expect(result.state).toBe('approved_for_apply');

    const proposalUpdateCall = mockDbRun.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('UPDATE v8_action_proposals') &&
        call[0].includes("status = 'approved'"),
    );
    expect(proposalUpdateCall).toBeDefined();
    expect(proposalUpdateCall![1]).toContain(REVIEWER_ID);
  });

  it('sets review_completed_at and review_completed_by', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'waiting_for_review' }));

    await approveRun(RUN_ID, ORG_ID, REVIEWER_ID);

    const reviewUpdateCall = mockDbRun.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('review_completed_at') &&
        call[0].includes('UPDATE v8_execution_runs'),
    );
    expect(reviewUpdateCall).toBeDefined();
    expect(reviewUpdateCall![1]).toContain(REVIEWER_ID);
  });

  it('throws when run is not in waiting_for_review state', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'planning' }));

    await expect(approveRun(RUN_ID, ORG_ID, REVIEWER_ID)).rejects.toThrow(
      'Invalid state transition',
    );
  });
});

describe('rejectRun', () => {
  it('transitions to rejected and resolves proposals as rejected', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'waiting_for_review' }));

    const result = await rejectRun(RUN_ID, ORG_ID, REVIEWER_ID, 'Needs rework');

    expect(result.state).toBe('rejected');

    const proposalUpdateCall = mockDbRun.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('UPDATE v8_action_proposals') &&
        call[0].includes("status = 'rejected'"),
    );
    expect(proposalUpdateCall).toBeDefined();
  });

  it('sets review_completed_at and review_completed_by', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'waiting_for_review' }));

    await rejectRun(RUN_ID, ORG_ID, REVIEWER_ID, 'Needs rework');

    const reviewUpdateCall = mockDbRun.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('review_completed_at') &&
        call[0].includes('UPDATE v8_execution_runs'),
    );
    expect(reviewUpdateCall).toBeDefined();
    expect(reviewUpdateCall![1]).toContain(REVIEWER_ID);
  });

  it('throws when run is not in waiting_for_review state', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'approved_for_apply' }));

    await expect(rejectRun(RUN_ID, ORG_ID, REVIEWER_ID, 'Nope')).rejects.toThrow(
      'Invalid state transition',
    );
  });
});

describe('replanFromRejection', () => {
  it('transitions from rejected to planning and increments planVersion', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'rejected', plan_version: 2 }));

    const result = await replanFromRejection(RUN_ID, ORG_ID, USER_ID);

    expect(result.state).toBe('planning');
    expect(result.planVersion).toBe(3);
  });

  it('expires old proposals before re-planning', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'rejected', plan_version: 1 }));

    await replanFromRejection(RUN_ID, ORG_ID, USER_ID);

    const expireCall = mockDbRun.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('UPDATE v8_action_proposals') &&
        call[0].includes("status = 'expired'"),
    );
    expect(expireCall).toBeDefined();
    expect(expireCall![1]).toContain(RUN_ID);
  });

  it('throws when run is not in rejected state', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'planning' }));

    await expect(replanFromRejection(RUN_ID, ORG_ID, USER_ID)).rejects.toThrow(
      'Invalid state transition',
    );
  });
});

describe('applyRun', () => {
  it('transitions from approved_for_apply to applying', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'approved_for_apply' }));

    const result = await applyRun(RUN_ID, ORG_ID, USER_ID);

    expect(result.state).toBe('applying');
  });

  it('throws when run is not in approved_for_apply state', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'waiting_for_review' }));

    await expect(applyRun(RUN_ID, ORG_ID, USER_ID)).rejects.toThrow(
      'Invalid state transition',
    );
  });
});

describe('completeRun', () => {
  it('transitions from applying to completed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'applying' }));

    const result = await completeRun(RUN_ID, ORG_ID, USER_ID);

    expect(result.state).toBe('completed');
    expect(result.resolvedAt).not.toBeNull();
  });

  it('throws when run is not in applying state', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'approved_for_apply' }));

    await expect(completeRun(RUN_ID, ORG_ID, USER_ID)).rejects.toThrow(
      'Invalid state transition',
    );
  });
});

describe('resolveProposalsBatch', () => {
  it('resolves multiple proposals at once', async () => {
    mockDbGet
      .mockResolvedValueOnce(makeFakeProposalRow({ proposal_id: PROPOSAL_1_ID, status: 'draft' }))
      .mockResolvedValueOnce(makeFakeProposalRow({ proposal_id: PROPOSAL_2_ID, status: 'pending_review' }));

    const results = await resolveProposalsBatch(
      [PROPOSAL_1_ID, PROPOSAL_2_ID],
      'approved',
      REVIEWER_ID,
    );

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('approved');
    expect(results[1].status).toBe('approved');
    expect(results[0].resolvedBy).toBe(REVIEWER_ID);
  });

  it('throws if any proposal is already resolved', async () => {
    mockDbGet
      .mockResolvedValueOnce(makeFakeProposalRow({ proposal_id: PROPOSAL_1_ID, status: 'draft' }))
      .mockResolvedValueOnce(makeFakeProposalRow({ proposal_id: PROPOSAL_2_ID, status: 'approved' }));

    await expect(
      resolveProposalsBatch([PROPOSAL_1_ID, PROPOSAL_2_ID], 'approved', REVIEWER_ID),
    ).rejects.toThrow('Cannot resolve proposal');
  });

  it('returns empty array for empty input', async () => {
    const results = await resolveProposalsBatch([], 'approved', REVIEWER_ID);
    expect(results).toEqual([]);
  });
});

describe('getRunsByOrg', () => {
  it('returns runs for an organization ordered by updated_at', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeRunRow({ run_id: '00000000-0000-4000-8000-aaaaaaaaaaaa', state: 'planning' }),
      makeFakeRunRow({ run_id: '00000000-0000-4000-8000-bbbbbbbbbbbb', state: 'completed' }),
    ]);

    const results = await getRunsByOrg(ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].runId).toBe('00000000-0000-4000-8000-aaaaaaaaaaaa');

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(query).toContain('ORDER BY updated_at DESC');
    expect(query).toContain('LIMIT');
  });

  it('filters by state when stateFilter is provided', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeRunRow({ state: 'planning' }),
    ]);

    await getRunsByOrg(ORG_ID, 'planning');

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('state = ?');
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain('planning');
  });

  it('respects custom limit', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getRunsByOrg(ORG_ID, undefined, 10);

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(10);
  });

  it('defaults limit to 50', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getRunsByOrg(ORG_ID);

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(50);
  });
});

describe('getActiveRuns', () => {
  it('excludes terminal states (completed, cancelled, expired)', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeRunRow({ state: 'planning' }),
      makeFakeRunRow({ run_id: '00000000-0000-4000-8000-aaaaaaaaaaaa', state: 'waiting_for_review' }),
    ]);

    const results = await getActiveRuns(ORG_ID);

    expect(results).toHaveLength(2);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain("NOT IN ('completed', 'cancelled', 'expired')");
    expect(query).toContain('ORDER BY created_at DESC');
  });

  it('returns empty array when no active runs exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const results = await getActiveRuns(ORG_ID);
    expect(results).toEqual([]);
  });
});

describe('full approval lifecycle', () => {
  it('create → plan → submit → approve → apply → complete', async () => {
    // createRun
    const run = await createRun({
      organizationId: ORG_ID,
      contextSnapshotId: SNAPSHOT_ID,
      initiatorUserId: USER_ID,
      goal: 'Full lifecycle test',
    });
    expect(run.state).toBe('drafting');
    expect(run.planVersion).toBe(1);

    // drafting → planning
    vi.clearAllMocks();
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'drafting', run_id: run.runId }));
    const planned = await transitionRunState(run.runId, ORG_ID, 'planning', USER_ID);
    expect(planned.state).toBe('planning');

    // planning → proposals_ready
    vi.clearAllMocks();
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'planning', run_id: run.runId }));
    const ready = await transitionRunState(run.runId, ORG_ID, 'proposals_ready', 'system');
    expect(ready.state).toBe('proposals_ready');

    // proposals_ready → waiting_for_review (submitForReview)
    vi.clearAllMocks();
    mockDbGet.mockResolvedValueOnce(
      makeFakeRunRow({ state: 'proposals_ready', run_id: run.runId }),
    );
    const submitted = await submitForReview(run.runId, ORG_ID, USER_ID);
    expect(submitted.state).toBe('waiting_for_review');
    expect(submitted.expiresAt).not.toBeNull();

    // waiting_for_review → approved_for_apply (approveRun)
    vi.clearAllMocks();
    mockDbGet.mockResolvedValueOnce(
      makeFakeRunRow({ state: 'waiting_for_review', run_id: run.runId }),
    );
    const approved = await approveRun(run.runId, ORG_ID, REVIEWER_ID, 'LGTM');
    expect(approved.state).toBe('approved_for_apply');

    // approved_for_apply → applying (applyRun)
    vi.clearAllMocks();
    mockDbGet.mockResolvedValueOnce(
      makeFakeRunRow({ state: 'approved_for_apply', run_id: run.runId }),
    );
    const applying = await applyRun(run.runId, ORG_ID, USER_ID);
    expect(applying.state).toBe('applying');

    // applying → completed (completeRun)
    vi.clearAllMocks();
    mockDbGet.mockResolvedValueOnce(
      makeFakeRunRow({ state: 'applying', run_id: run.runId }),
    );
    const completed = await completeRun(run.runId, ORG_ID, USER_ID);
    expect(completed.state).toBe('completed');
    expect(completed.resolvedAt).not.toBeNull();
  });

  it('create → plan → submit → reject → replan → submit → approve', async () => {
    const run = await createRun({
      organizationId: ORG_ID,
      contextSnapshotId: SNAPSHOT_ID,
      initiatorUserId: USER_ID,
      goal: 'Rejection-replan lifecycle test',
    });
    expect(run.planVersion).toBe(1);

    // drafting → planning → proposals_ready → waiting_for_review → rejected
    vi.clearAllMocks();
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'drafting', run_id: run.runId }));
    await transitionRunState(run.runId, ORG_ID, 'planning', USER_ID);

    vi.clearAllMocks();
    mockDbGet.mockResolvedValueOnce(makeFakeRunRow({ state: 'planning', run_id: run.runId }));
    await transitionRunState(run.runId, ORG_ID, 'proposals_ready', 'system');

    vi.clearAllMocks();
    mockDbGet.mockResolvedValueOnce(
      makeFakeRunRow({ state: 'proposals_ready', run_id: run.runId }),
    );
    await submitForReview(run.runId, ORG_ID, USER_ID);

    vi.clearAllMocks();
    mockDbGet.mockResolvedValueOnce(
      makeFakeRunRow({ state: 'waiting_for_review', run_id: run.runId }),
    );
    const rejected = await rejectRun(run.runId, ORG_ID, REVIEWER_ID, 'Needs rework');
    expect(rejected.state).toBe('rejected');

    // rejected → planning (replanFromRejection) — increments planVersion
    vi.clearAllMocks();
    mockDbGet.mockResolvedValueOnce(
      makeFakeRunRow({ state: 'rejected', run_id: run.runId, plan_version: 1 }),
    );
    const replanned = await replanFromRejection(run.runId, ORG_ID, USER_ID);
    expect(replanned.state).toBe('planning');
    expect(replanned.planVersion).toBe(2);

    // planning → proposals_ready → waiting_for_review → approved_for_apply
    vi.clearAllMocks();
    mockDbGet.mockResolvedValueOnce(
      makeFakeRunRow({ state: 'planning', run_id: run.runId, plan_version: 2 }),
    );
    await transitionRunState(run.runId, ORG_ID, 'proposals_ready', 'system');

    vi.clearAllMocks();
    mockDbGet.mockResolvedValueOnce(
      makeFakeRunRow({ state: 'proposals_ready', run_id: run.runId, plan_version: 2 }),
    );
    await submitForReview(run.runId, ORG_ID, USER_ID);

    vi.clearAllMocks();
    mockDbGet.mockResolvedValueOnce(
      makeFakeRunRow({ state: 'waiting_for_review', run_id: run.runId, plan_version: 2 }),
    );
    const approved = await approveRun(run.runId, ORG_ID, REVIEWER_ID, 'Now it looks good');
    expect(approved.state).toBe('approved_for_apply');
  });
});
