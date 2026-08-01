import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  ApplyFinanceLockParams,
  CoordinatedPublish,
  CreateCoordinatedPublishParams,
  CreatePublishRecordParams,
  FinanceLockedState,
  OutputRecall,
  PublishRecord,
  RecallOutputParams,
  ReviewGate,
  SubmitReviewGateParams,
} from '../../../types/publishReviewSemantics.js';
import {
  ApplyFinanceLockParamsSchema,
  ArtifactTypeValues,
  CoordinatedPublishSchema,
  CoordinationModeValues,
  CreateCoordinatedPublishParamsSchema,
  CreatePublishRecordParamsSchema,
  FinanceLockedStateSchema,
  LockLevelValues,
  OutputRecallSchema,
  PublishLifecycleStateValues,
  PublishRecordSchema,
  RecallOutputParamsSchema,
  ReviewGateSchema,
  ReviewResultValues,
  ReviewTypeValues,
  SubmitReviewGateParamsSchema,
  TransitionPublishStateParamsSchema,
  VALID_STATE_TRANSITIONS,
} from '../../../types/publishReviewSemantics.js';

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
  applyFinanceLock,
  createCoordinatedPublish,
  createPublishRecord,
  deriveReviewReadiness,
  getFinanceLocks,
  getPublishRecord,
  getRecallHistory,
  getReviewGates,
  recallOutput,
  removeFinanceLock,
  submitReviewGate,
  transitionPublishState,
} from '../publishReviewService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_A = '00000000-0000-4000-8000-000000000001';
const ORG_B = '00000000-0000-4000-8000-000000000099';
const ARTIFACT_ID = '00000000-0000-4000-8000-000000000010';
const ARTIFACT_ID_2 = '00000000-0000-4000-8000-000000000011';
const USER_ID = '00000000-0000-4000-8000-000000000020';
const USER_ID_2 = '00000000-0000-4000-8000-000000000021';
const RECORD_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const LOCK_ID = '00000000-0000-4000-8000-dddddddddddd';

function makePublishParams(
  overrides?: Partial<CreatePublishRecordParams>
): CreatePublishRecordParams {
  return {
    artifactId: ARTIFACT_ID,
    artifactType: 'report',
    organizationId: ORG_A,
    publishedBy: USER_ID,
    reviewers: [USER_ID_2],
    ...overrides,
  };
}

function makeReviewGateParams(overrides?: Partial<SubmitReviewGateParams>): SubmitReviewGateParams {
  return {
    artifactId: ARTIFACT_ID,
    organizationId: ORG_A,
    reviewType: 'peer_review',
    reviewerId: USER_ID_2,
    result: 'approved',
    comments: 'Looks good',
    ...overrides,
  };
}

function makeCoordParams(
  overrides?: Partial<CreateCoordinatedPublishParams>
): CreateCoordinatedPublishParams {
  return {
    primaryArtifactId: ARTIFACT_ID,
    pairedArtifactId: ARTIFACT_ID_2,
    organizationId: ORG_A,
    coordinationMode: 'coordinated',
    ...overrides,
  };
}

function makeRecallParams(overrides?: Partial<RecallOutputParams>): RecallOutputParams {
  return {
    artifactId: ARTIFACT_ID,
    organizationId: ORG_A,
    recalledBy: USER_ID,
    reason: 'Data error found post-publish',
    ...overrides,
  };
}

function makeLockParams(overrides?: Partial<ApplyFinanceLockParams>): ApplyFinanceLockParams {
  return {
    artifactId: ARTIFACT_ID,
    organizationId: ORG_A,
    lockedBy: USER_ID,
    lockReason: 'Budget freeze for Q2 review',
    lockLevel: 'standard',
    ...overrides,
  };
}

function makePublishRecordRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    record_id: RECORD_ID,
    artifact_id: ARTIFACT_ID,
    artifact_type: 'report',
    organization_id: ORG_A,
    current_state: 'private_draft',
    published_by: USER_ID,
    published_at: null,
    reviewers: JSON.stringify([USER_ID_2]),
    approved_by: null,
    approved_at: null,
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeReviewGateRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    gate_id: '00000000-0000-4000-8000-bbbbbbbbbbbb',
    artifact_id: ARTIFACT_ID,
    organization_id: ORG_A,
    review_type: 'peer_review',
    reviewer_id: USER_ID_2,
    result: 'approved',
    comments: 'Looks good',
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeCoordRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    coordination_id: '00000000-0000-4000-8000-cccccccccccc',
    primary_artifact_id: ARTIFACT_ID,
    paired_artifact_id: ARTIFACT_ID_2,
    organization_id: ORG_A,
    coordination_mode: 'coordinated',
    coordinated_publish_at: null,
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeRecallRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    recall_id: '00000000-0000-4000-8000-eeeeeeeeeeee',
    artifact_id: ARTIFACT_ID,
    organization_id: ORG_A,
    recalled_by: USER_ID,
    reason: 'Data error found post-publish',
    recalled_at: '2026-03-23T10:00:00.000Z',
    post_recall_state: 'recalled',
    lineage_preserved: 1,
    ...overrides,
  };
}

function makeLockRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    lock_id: LOCK_ID,
    artifact_id: ARTIFACT_ID,
    organization_id: ORG_A,
    locked_by: USER_ID,
    lock_reason: 'Budget freeze for Q2 review',
    lock_level: 'standard',
    locked_at: '2026-03-23T10:00:00.000Z',
    unlocked_at: null,
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  mockDbRun.mockReset().mockResolvedValue({ success: true });
  mockDbGet.mockReset().mockResolvedValue(null);
  mockDbAll.mockReset().mockResolvedValue([]);
});

// ------------------------------------------
// createPublishRecord
// ------------------------------------------

describe('createPublishRecord', () => {
  it('creates a publish record with private_draft initial state', async () => {
    const result = await createPublishRecord(makePublishParams());

    expect(result.recordId).toBeDefined();
    expect(result.artifactId).toBe(ARTIFACT_ID);
    expect(result.artifactType).toBe('report');
    expect(result.organizationId).toBe(ORG_A);
    expect(result.currentState).toBe('private_draft');
    expect(result.publishedBy).toBe(USER_ID);
    expect(result.publishedAt).toBeNull();
    expect(result.reviewers).toEqual([USER_ID_2]);
    expect(result.approvedBy).toBeNull();
    expect(result.approvedAt).toBeNull();
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_publish_records');
  });

  it('defaults reviewers to empty array when not provided', async () => {
    const result = await createPublishRecord(makePublishParams({ reviewers: undefined }));
    expect(result.reviewers).toEqual([]);
  });

  it('deduplicates configured reviewers before persistence', async () => {
    const result = await createPublishRecord(
      makePublishParams({ reviewers: [USER_ID_2, USER_ID_2] })
    );
    expect(result.reviewers).toEqual([USER_ID_2]);
    expect(mockDbRun.mock.calls[0][1]).toContain(JSON.stringify([USER_ID_2]));
  });

  it('accepts all artifact types', async () => {
    for (const at of ArtifactTypeValues) {
      vi.clearAllMocks();
      const result = await createPublishRecord(makePublishParams({ artifactType: at }));
      expect(result.artifactType).toBe(at);
    }
  });

  it('rejects invalid artifactType via Zod', async () => {
    await expect(
      createPublishRecord(makePublishParams({ artifactType: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects missing required fields via Zod', async () => {
    await expect(createPublishRecord({ organizationId: ORG_A } as any)).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// transitionPublishState — state machine
// ------------------------------------------

describe('transitionPublishState', () => {
  it('transitions private_draft → reviewable_share', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ current_state: 'private_draft' }));

    const result = await transitionPublishState({
      recordId: RECORD_ID,
      organizationId: ORG_A,
      newState: 'reviewable_share',
      actor: USER_ID,
    });

    expect(result.currentState).toBe('reviewable_share');
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('transitions reviewable_share → team_visible', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ current_state: 'reviewable_share' }));

    const result = await transitionPublishState({
      recordId: RECORD_ID,
      organizationId: ORG_A,
      newState: 'team_visible',
      actor: USER_ID,
    });

    expect(result.currentState).toBe('team_visible');
  });

  it('transitions reviewable_share → in_review', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ current_state: 'reviewable_share' }));

    const result = await transitionPublishState({
      recordId: RECORD_ID,
      organizationId: ORG_A,
      newState: 'in_review',
      actor: USER_ID,
    });

    expect(result.currentState).toBe('in_review');
  });

  it('transitions team_visible → in_review', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ current_state: 'team_visible' }));

    const result = await transitionPublishState({
      recordId: RECORD_ID,
      organizationId: ORG_A,
      newState: 'in_review',
      actor: USER_ID,
    });

    expect(result.currentState).toBe('in_review');
  });

  it('transitions in_review → approved and sets approvedBy/approvedAt', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ current_state: 'in_review' }));
    mockDbAll.mockResolvedValueOnce([makeReviewGateRow()]);

    const result = await transitionPublishState({
      recordId: RECORD_ID,
      organizationId: ORG_A,
      newState: 'approved',
      actor: USER_ID_2,
    });

    expect(result.currentState).toBe('approved');
    expect(result.approvedBy).toBe(USER_ID_2);
    expect(result.approvedAt).toBeDefined();
  });

  it('transitions in_review → reviewable_share (rejection loop)', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ current_state: 'in_review' }));

    const result = await transitionPublishState({
      recordId: RECORD_ID,
      organizationId: ORG_A,
      newState: 'reviewable_share',
      actor: USER_ID_2,
    });

    expect(result.currentState).toBe('reviewable_share');
  });

  it('transitions approved → published and sets publishedAt', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ current_state: 'approved' }));
    mockDbAll.mockResolvedValueOnce([makeReviewGateRow()]);

    const result = await transitionPublishState({
      recordId: RECORD_ID,
      organizationId: ORG_A,
      newState: 'published',
      actor: USER_ID,
    });

    expect(result.currentState).toBe('published');
    expect(result.publishedAt).toBeDefined();
  });

  it('returns the concurrent winner without overwriting publishedAt', async () => {
    const publishedAt = '2026-03-23T12:00:00.000Z';
    mockDbGet
      .mockResolvedValueOnce(makePublishRecordRow({ current_state: 'approved' }))
      .mockResolvedValueOnce(
        makePublishRecordRow({ current_state: 'published', published_at: publishedAt })
      );
    mockDbAll.mockResolvedValue([makeReviewGateRow()]);
    mockDbRun.mockResolvedValueOnce({ success: true, changes: 0 });

    const result = await transitionPublishState({
      recordId: RECORD_ID,
      organizationId: ORG_A,
      newState: 'published',
      actor: USER_ID,
    });

    expect(result.currentState).toBe('published');
    expect(result.publishedAt).toBe(publishedAt);
  });

  it('is idempotent when the record is already published', async () => {
    const publishedAt = '2026-03-23T12:00:00.000Z';
    mockDbGet.mockResolvedValueOnce(
      makePublishRecordRow({ current_state: 'published', published_at: publishedAt })
    );
    mockDbAll.mockResolvedValueOnce([makeReviewGateRow()]);

    const result = await transitionPublishState({
      recordId: RECORD_ID,
      organizationId: ORG_A,
      newState: 'published',
      actor: USER_ID,
    });

    expect(result.publishedAt).toBe(publishedAt);
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it.each(['approved', 'published'] as const)(
    'rejects an idempotent %s call when current quorum is not satisfied',
    async (state) => {
      mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ current_state: state }));
      mockDbAll.mockResolvedValueOnce([]);

      await expect(
        transitionPublishState({
          recordId: RECORD_ID,
          organizationId: ORG_A,
          newState: state,
          actor: USER_ID,
        })
      ).rejects.toMatchObject({ code: 'REVIEW_QUORUM_REQUIRED' });
      expect(mockDbRun).not.toHaveBeenCalled();
    }
  );

  it('transitions published → recalled', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ current_state: 'published' }));

    const result = await transitionPublishState({
      recordId: RECORD_ID,
      organizationId: ORG_A,
      newState: 'recalled',
      actor: USER_ID,
    });

    expect(result.currentState).toBe('recalled');
  });

  it('transitions published → archived', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ current_state: 'published' }));

    const result = await transitionPublishState({
      recordId: RECORD_ID,
      organizationId: ORG_A,
      newState: 'archived',
      actor: USER_ID,
    });

    expect(result.currentState).toBe('archived');
  });

  it('transitions recalled → archived', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ current_state: 'recalled' }));

    const result = await transitionPublishState({
      recordId: RECORD_ID,
      organizationId: ORG_A,
      newState: 'archived',
      actor: USER_ID,
    });

    expect(result.currentState).toBe('archived');
  });

  it('rejects invalid transition private_draft → published', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ current_state: 'private_draft' }));

    await expect(
      transitionPublishState({
        recordId: RECORD_ID,
        organizationId: ORG_A,
        newState: 'published',
        actor: USER_ID,
      })
    ).rejects.toThrow('Invalid state transition');
  });

  it('rejects invalid transition approved → private_draft', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ current_state: 'approved' }));

    await expect(
      transitionPublishState({
        recordId: RECORD_ID,
        organizationId: ORG_A,
        newState: 'private_draft',
        actor: USER_ID,
      })
    ).rejects.toThrow('Invalid state transition');
  });

  it('rejects transition from archived (terminal state)', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ current_state: 'archived' }));

    await expect(
      transitionPublishState({
        recordId: RECORD_ID,
        organizationId: ORG_A,
        newState: 'published',
        actor: USER_ID,
      })
    ).rejects.toThrow('Invalid state transition');
  });

  it('throws when record not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      transitionPublishState({
        recordId: RECORD_ID,
        organizationId: ORG_A,
        newState: 'reviewable_share',
        actor: USER_ID,
      })
    ).rejects.toThrow('not found');
  });

  it('rejects invalid newState via Zod', async () => {
    await expect(
      transitionPublishState({
        recordId: RECORD_ID,
        organizationId: ORG_A,
        newState: 'invalid_state' as any,
        actor: USER_ID,
      })
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// getPublishRecord
// ------------------------------------------

describe('getPublishRecord', () => {
  it('returns a publish record when found', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow());

    const result = await getPublishRecord(ARTIFACT_ID, ORG_A);

    expect(result).not.toBeNull();
    expect(result!.artifactId).toBe(ARTIFACT_ID);
    expect(result!.organizationId).toBe(ORG_A);
    expect(result!.reviewers).toEqual([USER_ID_2]);
  });

  it('returns null when record does not exist', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getPublishRecord('nonexistent', ORG_A);
    expect(result).toBeNull();
  });

  it('enforces organization isolation in query', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getPublishRecord(ARTIFACT_ID, ORG_B);

    const params = mockDbGet.mock.calls[0][1] as string[];
    expect(params).toContain(ORG_B);
  });
});

// ------------------------------------------
// submitReviewGate — all 4 review types
// ------------------------------------------

describe('submitReviewGate', () => {
  beforeEach(() => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow());
  });

  it('creates a peer_review gate', async () => {
    const result = await submitReviewGate(makeReviewGateParams({ reviewType: 'peer_review' }));

    expect(result.gateId).toBeDefined();
    expect(result.reviewType).toBe('peer_review');
    expect(result.result).toBe('approved');
    expect(result.comments).toBe('Looks good');

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_review_gates');
  });

  it('creates a manager_approval gate', async () => {
    const result = await submitReviewGate(makeReviewGateParams({ reviewType: 'manager_approval' }));
    expect(result.reviewType).toBe('manager_approval');
  });

  it('creates a compliance_review gate', async () => {
    const result = await submitReviewGate(
      makeReviewGateParams({ reviewType: 'compliance_review' })
    );
    expect(result.reviewType).toBe('compliance_review');
  });

  it('creates a quality_gate gate', async () => {
    const result = await submitReviewGate(makeReviewGateParams({ reviewType: 'quality_gate' }));
    expect(result.reviewType).toBe('quality_gate');
  });

  it('accepts approved result', async () => {
    const result = await submitReviewGate(makeReviewGateParams({ result: 'approved' }));
    expect(result.result).toBe('approved');
  });

  it('accepts rejected result', async () => {
    const result = await submitReviewGate(makeReviewGateParams({ result: 'rejected' }));
    expect(result.result).toBe('rejected');
  });

  it('accepts changes_requested result', async () => {
    const result = await submitReviewGate(makeReviewGateParams({ result: 'changes_requested' }));
    expect(result.result).toBe('changes_requested');
  });

  it('defaults comments to null when not provided', async () => {
    const result = await submitReviewGate(makeReviewGateParams({ comments: undefined }));
    expect(result.comments).toBeNull();
  });

  it('rejects invalid reviewType via Zod', async () => {
    await expect(
      submitReviewGate(makeReviewGateParams({ reviewType: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid result via Zod', async () => {
    await expect(
      submitReviewGate(makeReviewGateParams({ result: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });
});

describe('review quorum', () => {
  it('deduplicates reviewers and applies only the latest decision per reviewer', () => {
    const readiness = deriveReviewReadiness(
      [USER_ID_2, USER_ID_2],
      [
        makeReviewGateRow({ result: 'rejected', created_at: '2026-03-23T10:00:00.000Z' }) as any,
        makeReviewGateRow({
          gate_id: '00000000-0000-4000-8000-bbbbbbbbbbbc',
          result: 'approved',
          created_at: '2026-03-23T11:00:00.000Z',
        }) as any,
      ].map((row) => ({
        gateId: row.gate_id,
        artifactId: row.artifact_id,
        organizationId: row.organization_id,
        reviewType: row.review_type,
        reviewerId: row.reviewer_id,
        result: row.result,
        comments: row.comments,
        createdAt: row.created_at,
      }))
    );

    expect(readiness).toMatchObject({
      policy: 'ALL',
      required: [USER_ID_2],
      approved: [USER_ID_2],
      pending: [],
      rejected: [],
      satisfied: true,
    });
  });

  it('lets a later rejection replace an earlier approval', () => {
    const readiness = deriveReviewReadiness(
      [USER_ID_2],
      [
        {
          gateId: 'gate-1',
          artifactId: ARTIFACT_ID,
          organizationId: ORG_A,
          reviewType: 'peer_review',
          reviewerId: USER_ID_2,
          result: 'approved',
          comments: null,
          createdAt: '2026-03-23T10:00:00.000Z',
        },
        {
          gateId: 'gate-2',
          artifactId: ARTIFACT_ID,
          organizationId: ORG_A,
          reviewType: 'peer_review',
          reviewerId: USER_ID_2,
          result: 'changes_requested',
          comments: null,
          createdAt: '2026-03-23T11:00:00.000Z',
        },
      ]
    );
    expect(readiness).toMatchObject({ approved: [], rejected: [USER_ID_2], satisfied: false });
  });

  it('fails closed when no reviewers are configured', async () => {
    mockDbGet.mockResolvedValueOnce(
      makePublishRecordRow({ current_state: 'in_review', reviewers: '[]' })
    );

    await expect(
      transitionPublishState({
        recordId: RECORD_ID,
        organizationId: ORG_A,
        newState: 'approved',
        actor: USER_ID,
      })
    ).rejects.toMatchObject({ code: 'REVIEW_CONFIGURATION_REQUIRED' });
  });

  it('rejects a decision from an unassigned reviewer without inserting a gate', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow());

    await expect(
      submitReviewGate(makeReviewGateParams({ reviewerId: USER_ID }))
    ).rejects.toMatchObject({ code: 'REVIEWER_NOT_ASSIGNED' });
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('blocks self-review even when the publisher is assigned', async () => {
    mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ reviewers: JSON.stringify([USER_ID]) }));

    await expect(
      submitReviewGate(makeReviewGateParams({ reviewerId: USER_ID }))
    ).rejects.toMatchObject({ code: 'SELF_REVIEW_NOT_ALLOWED' });
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it.each(['published', 'recalled', 'archived'] as const)(
    'blocks a new review decision when the record is %s',
    async (state) => {
      mockDbGet.mockResolvedValueOnce(makePublishRecordRow({ current_state: state }));

      await expect(submitReviewGate(makeReviewGateParams())).rejects.toMatchObject({
        code: 'REVIEW_DECISION_CLOSED',
      });
      expect(mockDbRun).not.toHaveBeenCalled();
    }
  );
});

// ------------------------------------------
// getReviewGates
// ------------------------------------------

describe('getReviewGates', () => {
  it('returns review gates ordered by created_at', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeReviewGateRow({ created_at: '2026-03-23T10:00:00.000Z' }),
      makeReviewGateRow({
        gate_id: 'gate-2',
        created_at: '2026-03-23T11:00:00.000Z',
        review_type: 'manager_approval',
      }),
    ]);

    const results = await getReviewGates(ARTIFACT_ID, ORG_A);

    expect(results).toHaveLength(2);
    expect(results[0].reviewType).toBe('peer_review');
    expect(results[1].reviewType).toBe('manager_approval');
  });

  it('returns empty array when no gates exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getReviewGates(ARTIFACT_ID, ORG_A);
    expect(results).toEqual([]);
  });

  it('enforces organization isolation in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getReviewGates(ARTIFACT_ID, ORG_B);

    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params).toContain(ORG_B);
  });
});

// ------------------------------------------
// createCoordinatedPublish (Decision W6-12)
// ------------------------------------------

describe('createCoordinatedPublish', () => {
  it('creates a coordinated publish in coordinated mode', async () => {
    const result = await createCoordinatedPublish(
      makeCoordParams({ coordinationMode: 'coordinated' })
    );

    expect(result.coordinationId).toBeDefined();
    expect(result.primaryArtifactId).toBe(ARTIFACT_ID);
    expect(result.pairedArtifactId).toBe(ARTIFACT_ID_2);
    expect(result.coordinationMode).toBe('coordinated');
    expect(result.coordinatedPublishAt).toBeNull();
    expect(result.createdAt).toBeDefined();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_coordinated_publishes');
  });

  it('creates a coordinated publish in independent mode', async () => {
    const result = await createCoordinatedPublish(
      makeCoordParams({ coordinationMode: 'independent' })
    );
    expect(result.coordinationMode).toBe('independent');
  });

  it('rejects invalid coordinationMode via Zod', async () => {
    await expect(
      createCoordinatedPublish(makeCoordParams({ coordinationMode: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects missing required fields via Zod', async () => {
    await expect(createCoordinatedPublish({ organizationId: ORG_A } as any)).rejects.toThrow(
      ZodError
    );
  });
});

// ------------------------------------------
// recallOutput (Decision W6-13)
// ------------------------------------------

describe('recallOutput', () => {
  it('creates a recall record with explicit reason', async () => {
    const result = await recallOutput(makeRecallParams());

    expect(result.recallId).toBeDefined();
    expect(result.artifactId).toBe(ARTIFACT_ID);
    expect(result.recalledBy).toBe(USER_ID);
    expect(result.reason).toBe('Data error found post-publish');
    expect(result.recalledAt).toBeDefined();
    expect(result.postRecallState).toBe('recalled');
    expect(result.lineagePreserved).toBe(true);

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_output_recalls');
  });

  it('always sets postRecallState to recalled', async () => {
    const result = await recallOutput(makeRecallParams());
    expect(result.postRecallState).toBe('recalled');
  });

  it('always preserves lineage (Decision W6-13)', async () => {
    const result = await recallOutput(makeRecallParams());
    expect(result.lineagePreserved).toBe(true);
  });

  it('is auditable — records recalledBy and reason', async () => {
    const result = await recallOutput(
      makeRecallParams({ recalledBy: USER_ID_2, reason: 'Compliance issue' })
    );
    expect(result.recalledBy).toBe(USER_ID_2);
    expect(result.reason).toBe('Compliance issue');
  });

  it('rejects empty reason via Zod', async () => {
    await expect(recallOutput(makeRecallParams({ reason: '' }))).rejects.toThrow(ZodError);
  });

  it('rejects missing required fields via Zod', async () => {
    await expect(recallOutput({ artifactId: ARTIFACT_ID } as any)).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// getRecallHistory
// ------------------------------------------

describe('getRecallHistory', () => {
  it('returns recall records ordered by recalled_at', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeRecallRow({ recalled_at: '2026-03-23T10:00:00.000Z' }),
      makeRecallRow({
        recall_id: 'recall-2',
        recalled_at: '2026-03-23T11:00:00.000Z',
        reason: 'Second recall',
      }),
    ]);

    const results = await getRecallHistory(ARTIFACT_ID, ORG_A);

    expect(results).toHaveLength(2);
    expect(results[0].recalledAt).toBe('2026-03-23T10:00:00.000Z');
    expect(results[1].reason).toBe('Second recall');
  });

  it('returns empty array when no recalls exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getRecallHistory(ARTIFACT_ID, ORG_A);
    expect(results).toEqual([]);
  });

  it('enforces organization isolation in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getRecallHistory(ARTIFACT_ID, ORG_B);

    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params).toContain(ORG_B);
  });
});

// ------------------------------------------
// applyFinanceLock (Decision W6-11)
// ------------------------------------------

describe('applyFinanceLock', () => {
  it('creates a standard finance lock', async () => {
    const result = await applyFinanceLock(makeLockParams({ lockLevel: 'standard' }));

    expect(result.lockId).toBeDefined();
    expect(result.artifactId).toBe(ARTIFACT_ID);
    expect(result.lockedBy).toBe(USER_ID);
    expect(result.lockReason).toBe('Budget freeze for Q2 review');
    expect(result.lockLevel).toBe('standard');
    expect(result.lockedAt).toBeDefined();
    expect(result.unlockedAt).toBeNull();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_finance_locked_states');
  });

  it('creates a finance_strict lock', async () => {
    const result = await applyFinanceLock(makeLockParams({ lockLevel: 'finance_strict' }));
    expect(result.lockLevel).toBe('finance_strict');
  });

  it('rejects invalid lockLevel via Zod', async () => {
    await expect(applyFinanceLock(makeLockParams({ lockLevel: 'invalid' as any }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects empty lockReason via Zod', async () => {
    await expect(applyFinanceLock(makeLockParams({ lockReason: '' }))).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// removeFinanceLock
// ------------------------------------------

describe('removeFinanceLock', () => {
  it('removes a finance lock and sets unlockedAt', async () => {
    mockDbGet.mockResolvedValueOnce(makeLockRow());

    const result = await removeFinanceLock(LOCK_ID, ORG_A, USER_ID_2);

    expect(result.lockId).toBe(LOCK_ID);
    expect(result.unlockedAt).toBeDefined();
    expect(result.unlockedAt).not.toBeNull();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE v8_finance_locked_states');
  });

  it('throws when lock not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(removeFinanceLock('nonexistent', ORG_A, USER_ID)).rejects.toThrow('not found');
  });

  it('throws when lock is already unlocked', async () => {
    mockDbGet.mockResolvedValueOnce(makeLockRow({ unlocked_at: '2026-03-23T12:00:00.000Z' }));

    await expect(removeFinanceLock(LOCK_ID, ORG_A, USER_ID)).rejects.toThrow('already unlocked');
  });
});

// ------------------------------------------
// getFinanceLocks
// ------------------------------------------

describe('getFinanceLocks', () => {
  it('returns finance locks ordered by locked_at', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeLockRow({ locked_at: '2026-03-23T10:00:00.000Z' }),
      makeLockRow({
        lock_id: 'lock-2',
        locked_at: '2026-03-23T11:00:00.000Z',
        lock_level: 'finance_strict',
      }),
    ]);

    const results = await getFinanceLocks(ARTIFACT_ID, ORG_A);

    expect(results).toHaveLength(2);
    expect(results[0].lockLevel).toBe('standard');
    expect(results[1].lockLevel).toBe('finance_strict');
  });

  it('returns empty array when no locks exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getFinanceLocks(ARTIFACT_ID, ORG_A);
    expect(results).toEqual([]);
  });

  it('enforces organization isolation in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getFinanceLocks(ARTIFACT_ID, ORG_B);

    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params).toContain(ORG_B);
  });
});

// ------------------------------------------
// Organization isolation (cross-cutting)
// ------------------------------------------

describe('organization isolation', () => {
  it('getPublishRecord scopes to correct org', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getPublishRecord(ARTIFACT_ID, ORG_B);

    const params = mockDbGet.mock.calls[0][1] as string[];
    expect(params[0]).toBe(ARTIFACT_ID);
    expect(params[1]).toBe(ORG_B);
  });

  it('getReviewGates scopes to correct org', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getReviewGates(ARTIFACT_ID, ORG_B);

    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[0]).toBe(ARTIFACT_ID);
    expect(params[1]).toBe(ORG_B);
  });

  it('getRecallHistory scopes to correct org', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getRecallHistory(ARTIFACT_ID, ORG_B);

    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[0]).toBe(ARTIFACT_ID);
    expect(params[1]).toBe(ORG_B);
  });

  it('getFinanceLocks scopes to correct org', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getFinanceLocks(ARTIFACT_ID, ORG_B);

    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[0]).toBe(ARTIFACT_ID);
    expect(params[1]).toBe(ORG_B);
  });

  it('transitionPublishState scopes to correct org', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      transitionPublishState({
        recordId: RECORD_ID,
        organizationId: ORG_B,
        newState: 'reviewable_share',
        actor: USER_ID,
      })
    ).rejects.toThrow('not found');

    const params = mockDbGet.mock.calls[0][1] as string[];
    expect(params[1]).toBe(ORG_B);
  });

  it('removeFinanceLock scopes to correct org', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(removeFinanceLock(LOCK_ID, ORG_B, USER_ID)).rejects.toThrow('not found');

    const params = mockDbGet.mock.calls[0][1] as string[];
    expect(params[1]).toBe(ORG_B);
  });
});

// ------------------------------------------
// VALID_STATE_TRANSITIONS map
// ------------------------------------------

describe('VALID_STATE_TRANSITIONS', () => {
  it('private_draft can only go to reviewable_share', () => {
    expect(VALID_STATE_TRANSITIONS.private_draft).toEqual(['reviewable_share']);
  });

  it('reviewable_share can go to team_visible or in_review', () => {
    expect(VALID_STATE_TRANSITIONS.reviewable_share).toEqual(['team_visible', 'in_review']);
  });

  it('team_visible can only go to in_review', () => {
    expect(VALID_STATE_TRANSITIONS.team_visible).toEqual(['in_review']);
  });

  it('in_review can go to approved or reviewable_share', () => {
    expect(VALID_STATE_TRANSITIONS.in_review).toEqual(['approved', 'reviewable_share']);
  });

  it('approved can only go to published', () => {
    expect(VALID_STATE_TRANSITIONS.approved).toEqual(['published']);
  });

  it('published can go to recalled or archived', () => {
    expect(VALID_STATE_TRANSITIONS.published).toEqual(['recalled', 'archived']);
  });

  it('recalled can only go to archived', () => {
    expect(VALID_STATE_TRANSITIONS.recalled).toEqual(['archived']);
  });

  it('archived is terminal — no transitions', () => {
    expect(VALID_STATE_TRANSITIONS.archived).toEqual([]);
  });

  it('covers all lifecycle states', () => {
    for (const state of PublishLifecycleStateValues) {
      expect(VALID_STATE_TRANSITIONS[state]).toBeDefined();
    }
  });
});

// ------------------------------------------
// Zod schema validation
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates a correct PublishRecord', () => {
    const valid: PublishRecord = {
      recordId: RECORD_ID,
      artifactId: ARTIFACT_ID,
      artifactType: 'report',
      organizationId: ORG_A,
      currentState: 'private_draft',
      publishedBy: USER_ID,
      publishedAt: null,
      reviewers: [USER_ID_2],
      approvedBy: null,
      approvedAt: null,
      createdAt: '2026-03-23T10:00:00.000Z',
      updatedAt: '2026-03-23T10:00:00.000Z',
    };
    expect(() => PublishRecordSchema.parse(valid)).not.toThrow();
  });

  it('validates a correct ReviewGate', () => {
    const valid: ReviewGate = {
      gateId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
      artifactId: ARTIFACT_ID,
      organizationId: ORG_A,
      reviewType: 'peer_review',
      reviewerId: USER_ID_2,
      result: 'approved',
      comments: 'Looks good',
      createdAt: '2026-03-23T10:00:00.000Z',
    };
    expect(() => ReviewGateSchema.parse(valid)).not.toThrow();
  });

  it('validates a correct CoordinatedPublish', () => {
    const valid: CoordinatedPublish = {
      coordinationId: '00000000-0000-4000-8000-cccccccccccc',
      primaryArtifactId: ARTIFACT_ID,
      pairedArtifactId: ARTIFACT_ID_2,
      organizationId: ORG_A,
      coordinationMode: 'coordinated',
      coordinatedPublishAt: null,
      createdAt: '2026-03-23T10:00:00.000Z',
    };
    expect(() => CoordinatedPublishSchema.parse(valid)).not.toThrow();
  });

  it('validates a correct OutputRecall', () => {
    const valid: OutputRecall = {
      recallId: '00000000-0000-4000-8000-eeeeeeeeeeee',
      artifactId: ARTIFACT_ID,
      organizationId: ORG_A,
      recalledBy: USER_ID,
      reason: 'Data error',
      recalledAt: '2026-03-23T10:00:00.000Z',
      postRecallState: 'recalled',
      lineagePreserved: true,
    };
    expect(() => OutputRecallSchema.parse(valid)).not.toThrow();
  });

  it('validates a correct FinanceLockedState', () => {
    const valid: FinanceLockedState = {
      lockId: LOCK_ID,
      artifactId: ARTIFACT_ID,
      organizationId: ORG_A,
      lockedBy: USER_ID,
      lockReason: 'Budget freeze',
      lockLevel: 'standard',
      lockedAt: '2026-03-23T10:00:00.000Z',
      unlockedAt: null,
    };
    expect(() => FinanceLockedStateSchema.parse(valid)).not.toThrow();
  });

  it('rejects PublishRecord with invalid artifactType', () => {
    expect(() =>
      PublishRecordSchema.parse({
        recordId: RECORD_ID,
        artifactId: ARTIFACT_ID,
        artifactType: 'invalid_type',
        organizationId: ORG_A,
        currentState: 'private_draft',
        publishedBy: USER_ID,
        publishedAt: null,
        reviewers: [],
        approvedBy: null,
        approvedAt: null,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).toThrow(ZodError);
  });

  it('rejects OutputRecall with postRecallState != recalled', () => {
    expect(() =>
      OutputRecallSchema.parse({
        recallId: '00000000-0000-4000-8000-eeeeeeeeeeee',
        artifactId: ARTIFACT_ID,
        organizationId: ORG_A,
        recalledBy: USER_ID,
        reason: 'Data error',
        recalledAt: '2026-03-23T10:00:00.000Z',
        postRecallState: 'archived',
        lineagePreserved: true,
      })
    ).toThrow(ZodError);
  });

  it('rejects OutputRecall with lineagePreserved != true', () => {
    expect(() =>
      OutputRecallSchema.parse({
        recallId: '00000000-0000-4000-8000-eeeeeeeeeeee',
        artifactId: ARTIFACT_ID,
        organizationId: ORG_A,
        recalledBy: USER_ID,
        reason: 'Data error',
        recalledAt: '2026-03-23T10:00:00.000Z',
        postRecallState: 'recalled',
        lineagePreserved: false,
      })
    ).toThrow(ZodError);
  });

  it('validates all ArtifactType values in CreatePublishRecordParams', () => {
    for (const at of ArtifactTypeValues) {
      const params = makePublishParams({ artifactType: at });
      expect(() => CreatePublishRecordParamsSchema.parse(params)).not.toThrow();
    }
  });

  it('validates all ReviewType values in SubmitReviewGateParams', () => {
    for (const rt of ReviewTypeValues) {
      const params = makeReviewGateParams({ reviewType: rt });
      expect(() => SubmitReviewGateParamsSchema.parse(params)).not.toThrow();
    }
  });

  it('validates all ReviewResult values in SubmitReviewGateParams', () => {
    for (const rr of ReviewResultValues) {
      const params = makeReviewGateParams({ result: rr });
      expect(() => SubmitReviewGateParamsSchema.parse(params)).not.toThrow();
    }
  });

  it('validates all CoordinationMode values in CreateCoordinatedPublishParams', () => {
    for (const cm of CoordinationModeValues) {
      const params = makeCoordParams({ coordinationMode: cm });
      expect(() => CreateCoordinatedPublishParamsSchema.parse(params)).not.toThrow();
    }
  });

  it('validates all LockLevel values in ApplyFinanceLockParams', () => {
    for (const ll of LockLevelValues) {
      const params = makeLockParams({ lockLevel: ll });
      expect(() => ApplyFinanceLockParamsSchema.parse(params)).not.toThrow();
    }
  });

  it('validates TransitionPublishStateParams', () => {
    expect(() =>
      TransitionPublishStateParamsSchema.parse({
        recordId: RECORD_ID,
        organizationId: ORG_A,
        newState: 'reviewable_share',
        actor: USER_ID,
      })
    ).not.toThrow();
  });

  it('validates RecallOutputParams', () => {
    expect(() => RecallOutputParamsSchema.parse(makeRecallParams())).not.toThrow();
  });
});
