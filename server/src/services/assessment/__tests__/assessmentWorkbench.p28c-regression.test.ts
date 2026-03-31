/**
 * P28-C: regresje read-only po completed + guard promocji (mock persistence).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AssessmentWorkbenchService, {
  createInitialWorkbench,
} from '../AssessmentWorkbenchService.js';

const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockRegisterArtifactOrigin = vi.fn().mockResolvedValue({ artifactId: 'art-mock' });

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  queryAll: vi.fn(),
}));

vi.mock('../../v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: (...args: unknown[]) => mockRegisterArtifactOrigin(...args),
}));

describe('AssessmentWorkbenchService — P28-C regression', () => {
  const orgId = 'org-p28c';
  const assessmentId = 'asmt-p28c';
  const userId = 'user-p28c';

  let p28Column: string | null = null;

  beforeEach(() => {
    p28Column = null;
    vi.clearAllMocks();
    mockQueryOne.mockImplementation(async (sql: string, params: unknown[]) => {
      if (String(sql).includes('FROM assessments WHERE id = ?') && String(sql).includes('p28_workbench_v1')) {
        const [id, oid] = params as string[];
        if (id !== assessmentId || oid !== orgId) return null;
        return {
          p28: p28Column,
          assessment_type: 'DRD',
          created_by: userId,
        };
      }
      if (String(sql).includes('SELECT assessment_type, created_by FROM assessments')) {
        const [id, oid] = params as string[];
        if (id !== assessmentId || oid !== orgId) return null;
        return { assessment_type: 'DRD', created_by: userId };
      }
      return null;
    });
    mockQueryRun.mockImplementation(async (sql: string, params: unknown[]) => {
      if (String(sql).includes('p28_workbench_v1')) {
        p28Column = params[0] as string;
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('recordPromotion before completed throws P28_PROMOTION_GUARD', async () => {
    await AssessmentWorkbenchService.load(assessmentId, orgId, 'DRD', userId);
    await AssessmentWorkbenchService.applyMethodologyPreset(assessmentId, orgId, userId, 'DRD');
    await AssessmentWorkbenchService.transition(assessmentId, orgId, userId, 'running');
    await AssessmentWorkbenchService.addEvidence(assessmentId, orgId, userId, [
      { kind: 'document', ref: 'd:1' },
      { kind: 'interview_note', ref: 'i:1' },
    ]);
    const row = JSON.parse(p28Column!);
    const docId = row.evidencePointers.find((e: { kind: string }) => e.kind === 'document').id;
    const intId = row.evidencePointers.find((e: { kind: string }) => e.kind === 'interview_note').id;
    await AssessmentWorkbenchService.proposeScore(assessmentId, orgId, userId, {
      scoreValues: { x: 1 },
      scoringRationale: 'r',
      evidencePointerIds: [docId, intId],
      assumptions: [],
      confidence: 0.5,
    });
    await AssessmentWorkbenchService.reviewScore(assessmentId, orgId, userId, { action: 'accept' });
    await AssessmentWorkbenchService.proposeInterpretation(assessmentId, orgId, userId, {
      summary: 's',
      keyFindings: ['a'],
      limits: 'l',
      nextActions: ['n'],
    });
    await AssessmentWorkbenchService.reviewInterpretation(assessmentId, orgId, userId, { action: 'accept' });

    let err: any;
    try {
      await AssessmentWorkbenchService.recordPromotion(assessmentId, orgId, userId, {
        targetKind: 'outputs_artifact',
        targetRef: 'x',
      });
    } catch (e: any) {
      err = e;
    }
    expect(err?.code).toBe('P28_PROMOTION_GUARD');
  });

  it('completed run rejects proposeScore with P28_RUN_READ_ONLY', async () => {
    const base = createInitialWorkbench({
      assessmentId,
      orgId,
      methodologyId: 'DRD',
      startedBy: userId,
    });
    base.runState = 'completed';
    base.completedAt = new Date().toISOString();
    p28Column = JSON.stringify(base);

    let err: any;
    try {
      await AssessmentWorkbenchService.proposeScore(assessmentId, orgId, userId, {
        scoreValues: { x: 1 },
        scoringRationale: 'r',
        evidencePointerIds: [],
        assumptions: [],
        confidence: 0.5,
      });
    } catch (e: any) {
      err = e;
    }
    expect(err?.code).toBe('P28_RUN_READ_ONLY');
  });

  it('recordPromotion with outputs_artifact registers artifact in Outputs Library (P19 handoff)', async () => {
    await AssessmentWorkbenchService.load(assessmentId, orgId, 'DRD', userId);
    await AssessmentWorkbenchService.applyMethodologyPreset(assessmentId, orgId, userId, 'DRD');
    await AssessmentWorkbenchService.transition(assessmentId, orgId, userId, 'running');
    await AssessmentWorkbenchService.addEvidence(assessmentId, orgId, userId, [
      { kind: 'document', ref: 'd:1' },
      { kind: 'interview_note', ref: 'i:1' },
    ]);
    const row = JSON.parse(p28Column!);
    const docId = row.evidencePointers.find((e: { kind: string }) => e.kind === 'document').id;
    const intId = row.evidencePointers.find((e: { kind: string }) => e.kind === 'interview_note').id;
    await AssessmentWorkbenchService.proposeScore(assessmentId, orgId, userId, {
      scoreValues: { x: 1 },
      scoringRationale: 'r',
      evidencePointerIds: [docId, intId],
      assumptions: [],
      confidence: 0.5,
    });
    await AssessmentWorkbenchService.reviewScore(assessmentId, orgId, userId, { action: 'accept' });
    await AssessmentWorkbenchService.proposeInterpretation(assessmentId, orgId, userId, {
      summary: 's',
      keyFindings: ['a'],
      limits: 'l',
      nextActions: ['n'],
    });
    await AssessmentWorkbenchService.reviewInterpretation(assessmentId, orgId, userId, { action: 'accept' });
    await AssessmentWorkbenchService.transition(assessmentId, orgId, userId, 'completed');

    mockRegisterArtifactOrigin.mockClear();
    await AssessmentWorkbenchService.recordPromotion(assessmentId, orgId, userId, {
      targetKind: 'outputs_artifact',
      targetRef: 'artifact:report:test-1',
    });

    expect(mockRegisterArtifactOrigin).toHaveBeenCalledTimes(1);
    const call = mockRegisterArtifactOrigin.mock.calls[0][0];
    expect(call.organizationId).toBe(orgId);
    expect(call.outputType).toBe('report');
    expect(call.artifactFamily).toBe('document');
    expect(call.originRecordId).toBe(assessmentId);
    expect(call.originSummary.sourceType).toBe('ASSESSMENT');

    const final = JSON.parse(p28Column!);
    expect(final.audit.some((a: { action: string }) => a.action === 'promotion_artifact_registered')).toBe(true);
  });

  it('transition mutator rejects further moves when run is completed (P28_RUN_READ_ONLY)', async () => {
    const base = createInitialWorkbench({
      assessmentId,
      orgId,
      methodologyId: 'DRD',
      startedBy: userId,
    });
    base.runState = 'completed';
    base.completedAt = new Date().toISOString();
    p28Column = JSON.stringify(base);

    let err: any;
    try {
      await AssessmentWorkbenchService.transition(assessmentId, orgId, userId, 'running');
    } catch (e: any) {
      err = e;
    }
    expect(err?.code).toBe('P28_RUN_READ_ONLY');
  });
});
