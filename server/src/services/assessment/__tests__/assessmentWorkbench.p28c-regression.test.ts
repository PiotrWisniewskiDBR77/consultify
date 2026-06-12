/**
 * P28-C: regresje read-only po completed + guard promocji (mock persistence).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listFindings } from '../../v8/interviewInsightFindingsService.js';
import AssessmentWorkbenchService, {
  createInitialWorkbench,
} from '../AssessmentWorkbenchService.js';

const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockQueryAll = vi.fn();
const mockRegisterArtifactOrigin = vi.fn().mockResolvedValue({ artifactId: 'art-mock' });

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
}));

vi.mock('../../v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: (...args: unknown[]) => mockRegisterArtifactOrigin(...args),
}));

describe('AssessmentWorkbenchService — P28-C regression', () => {
  const orgId = 'org-p28c';
  const assessmentId = 'asmt-p28c';
  const userId = 'user-p28c';

  let p28Column: string | null = null;
  let definitionRow: Record<string, unknown> | null = null;

  beforeEach(() => {
    p28Column = null;
    definitionRow = null;
    vi.clearAllMocks();

    const capturedFindings: any[] = [];

    mockQueryOne.mockImplementation(async (sql: string, params: unknown[]) => {
      if (String(sql).includes('FROM assessment_definitions')) {
        if (!definitionRow) return null;
        if (String(sql).includes('WHERE id = ?')) {
          return params[0] === definitionRow.id ? definitionRow : null;
        }
        return definitionRow;
      }
      if (
        String(sql).includes('FROM assessments WHERE id = ?') &&
        String(sql).includes('p28_workbench_v1')
      ) {
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
      if (String(sql).includes('INSERT OR IGNORE INTO assessment_definitions')) {
        definitionRow = {
          id: params[0],
          methodology_id: params[1],
          version: params[2],
          title: params[3],
          definition_json: params[4],
          created_by: params[5],
          created_at: params[6],
          updated_at: params[7],
          published_at: params[8],
          status: 'published',
          is_read_only: 1,
        };
        return;
      }
      if (String(sql).includes('p28_workbench_v1')) {
        p28Column = params[0] as string;
        return;
      }
      if (String(sql).includes('INSERT INTO interview_insight_findings')) {
        const now = new Date().toISOString();
        capturedFindings.push({
          id: params[0],
          organization_id: params[1],
          insight_id: params[2],
          source_section_type: params[3] ?? 'manual',
          source_section_index: params[4] ?? null,
          source_key: params[5] ?? null,
          finding_statement: params[6],
          confidence_level: params[7],
          limits_text: params[8],
          next_action_text: params[10],
          review_status: 'draft',
          readback_status: 'draft_interpretation',
          readback_summary: null,
          readback_updated_at: null,
          created_at: now,
          updated_at: now,
        });
      }
    });
    mockQueryAll.mockImplementation(async (sql: string, params: unknown[]) => {
      if (String(sql).includes('FROM interview_insight_findings')) {
        const insightId = params?.[0];
        return capturedFindings.filter((f) => f.insight_id === insightId);
      }
      return [];
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
    const intId = row.evidencePointers.find(
      (e: { kind: string }) => e.kind === 'interview_note'
    ).id;
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
    await AssessmentWorkbenchService.reviewInterpretation(assessmentId, orgId, userId, {
      action: 'accept',
    });

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
    const intId = row.evidencePointers.find(
      (e: { kind: string }) => e.kind === 'interview_note'
    ).id;
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
    await AssessmentWorkbenchService.reviewInterpretation(assessmentId, orgId, userId, {
      action: 'accept',
    });
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
    expect(
      final.audit.some((a: { action: string }) => a.action === 'promotion_artifact_registered')
    ).toBe(true);
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

  it('recordPromotion with interview_insight creates draft insight proposal when targetRef is empty', async () => {
    await AssessmentWorkbenchService.load(assessmentId, orgId, 'DRD', userId);
    await AssessmentWorkbenchService.applyMethodologyPreset(assessmentId, orgId, userId, 'DRD');
    await AssessmentWorkbenchService.transition(assessmentId, orgId, userId, 'running');
    await AssessmentWorkbenchService.addEvidence(assessmentId, orgId, userId, [
      { kind: 'document', ref: 'd:1' },
      { kind: 'interview_note', ref: 'i:1' },
    ]);
    const row = JSON.parse(p28Column!);
    const docId = row.evidencePointers.find((e: { kind: string }) => e.kind === 'document').id;
    const intId = row.evidencePointers.find(
      (e: { kind: string }) => e.kind === 'interview_note'
    ).id;
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
    await AssessmentWorkbenchService.reviewInterpretation(assessmentId, orgId, userId, {
      action: 'accept',
    });
    await AssessmentWorkbenchService.transition(assessmentId, orgId, userId, 'completed');

    const state = await AssessmentWorkbenchService.recordPromotion(assessmentId, orgId, userId, {
      targetKind: 'interview_insight',
      targetRef: '',
    });

    expect(state.promotionTraces).toHaveLength(1);
    expect(state.promotionTraces[0].targetKind).toBe('interview_insight');
    expect(state.promotionTraces[0].targetRef).toMatch(/^ii_/);
    await expect(listFindings(state.promotionTraces[0].targetRef)).resolves.toHaveLength(1);
  });
});
