/**
 * P28-B: pełny przepływ workbench → score → interpretacja → complete → promotion (mock queryHelpers).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AssessmentWorkbenchService from '../AssessmentWorkbenchService.js';

const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  queryAll: vi.fn(),
}));

describe('AssessmentWorkbenchService — P28-B E2E (mocked persistence)', () => {
  const orgId = 'org-p28b';
  const assessmentId = 'asmt-p28b';
  const userId = 'user-p28b';

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

  it('DRD preset: blocked score z whatNext → evidence → happy path → promotion', async () => {
    await AssessmentWorkbenchService.load(assessmentId, orgId, 'DRD', userId);
    expect(p28Column).toBeTruthy();

    await AssessmentWorkbenchService.applyMethodologyPreset(assessmentId, orgId, userId, 'DRD');
    await AssessmentWorkbenchService.transition(assessmentId, orgId, userId, 'running');

    let blocked: any;
    try {
      await AssessmentWorkbenchService.proposeScore(assessmentId, orgId, userId, {
        scoreValues: { band: 2 },
        scoringRationale: 'Based on documents',
        evidencePointerIds: [],
        assumptions: [],
        confidence: 0.7,
      });
    } catch (e: any) {
      blocked = e;
    }
    expect(blocked?.code).toBe('P28_AWAITING_EVIDENCE');
    expect(Array.isArray(blocked?.whatNext)).toBe(true);
    expect(blocked.whatNext.length).toBeGreaterThan(0);

    await AssessmentWorkbenchService.addEvidence(assessmentId, orgId, userId, [
      { kind: 'document', ref: 'doc:1' },
      { kind: 'interview_note', ref: 'int:1' },
    ]);

    const row = JSON.parse(p28Column!);
    const docId = row.evidencePointers.find((e: { kind: string }) => e.kind === 'document').id;
    const intId = row.evidencePointers.find((e: { kind: string }) => e.kind === 'interview_note').id;

    await AssessmentWorkbenchService.proposeScore(assessmentId, orgId, userId, {
      scoreValues: { band: 3 },
      scoringRationale: 'Aligned to attached evidence',
      evidencePointerIds: [docId, intId],
      assumptions: [],
      confidence: 0.72,
    });

    await AssessmentWorkbenchService.reviewScore(assessmentId, orgId, userId, {
      action: 'accept',
    });

    await AssessmentWorkbenchService.proposeInterpretation(assessmentId, orgId, userId, {
      summary: 'Organizational readiness is moderate.',
      keyFindings: ['Gap in governance'],
      limits: 'Single-snapshot; not a full audit.',
      nextActions: ['Prioritize two initiatives'],
    });

    await AssessmentWorkbenchService.reviewInterpretation(assessmentId, orgId, userId, {
      action: 'accept',
    });

    await AssessmentWorkbenchService.transition(assessmentId, orgId, userId, 'completed');

    await AssessmentWorkbenchService.recordPromotion(assessmentId, orgId, userId, {
      targetKind: 'outputs_artifact',
      targetRef: 'artifact:report:demo-1',
    });

    const final = JSON.parse(p28Column!);
    expect(final.runState).toBe('completed');
    expect(final.promotionTraces).toHaveLength(1);
    expect(final.promotionTraces[0].targetRef).toBe('artifact:report:demo-1');
  });
});
