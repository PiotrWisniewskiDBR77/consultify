import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Delete: vi.fn(),
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8AssessmentApi } from '@/services/api/v8/assessment';
import { v8Delete, v8Get, v8Post, v8Put } from '@/services/api/v8/client';

describe('V8AssessmentApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists assessments with optional project filter', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      items: [],
      assessments: [],
      total: 0,
      limit: 100,
      offset: 0,
    });

    await V8AssessmentApi.listAssessments({ projectId: 'proj-1', limit: 25, offset: 50 });

    expect(v8Get).toHaveBeenCalledWith('/assessment', {
      projectId: 'proj-1',
      limit: '25',
      offset: '50',
    });
  });

  it('loads assessment detail from bounded V8 route', async () => {
    vi.mocked(v8Get).mockResolvedValue({ assessment: { id: 'a-1' } } as any);

    await V8AssessmentApi.getAssessment('a-1');

    expect(v8Get).toHaveBeenCalledWith('/assessment/a-1');
  });

  it('creates assessment via bounded V8 route', async () => {
    vi.mocked(v8Post).mockResolvedValue({ id: 'a-2', assessment: { id: 'a-2' } } as any);

    await V8AssessmentApi.createAssessment({
      assessmentType: 'DRD',
      name: 'Factory DRD',
      projectId: 'proj-2',
    });

    expect(v8Post).toHaveBeenCalledWith('/assessment', {
      assessmentType: 'DRD',
      name: 'Factory DRD',
      projectId: 'proj-2',
    });
  });

  it('updates assessment answers via bounded V8 route', async () => {
    vi.mocked(v8Put).mockResolvedValue({ id: 'a-3', updatedAt: '2026-03-26T00:00:00.000Z' } as any);

    await V8AssessmentApi.updateAssessment('a-3', {
      name: 'Updated',
      answers: { processes: { actual: 4 } },
      completionPercent: 60,
    });

    expect(v8Put).toHaveBeenCalledWith('/assessment/a-3', {
      name: 'Updated',
      answers: { processes: { actual: 4 } },
      completionPercent: 60,
    });
  });

  it('loads my-role via bounded V8 route', async () => {
    vi.mocked(v8Get).mockResolvedValue({ role: 'editor' } as any);

    await V8AssessmentApi.getMyRole('a-4');

    expect(v8Get).toHaveBeenCalledWith('/assessment/a-4/my-role');
  });

  it('loads and updates user state via bounded V8 routes', async () => {
    vi.mocked(v8Get).mockResolvedValue({ assessmentId: 'a-5' } as any);
    vi.mocked(v8Put).mockResolvedValue({ assessmentId: 'a-5', updatedAt: '2026-03-26T00:00:00.000Z' } as any);

    await V8AssessmentApi.getUserState('a-5');
    await V8AssessmentApi.updateUserState('a-5', {
      navigation: { axisId: 1, areaId: '1A', level: 2 },
    });

    expect(v8Get).toHaveBeenCalledWith('/assessment/a-5/user-state');
    expect(v8Put).toHaveBeenCalledWith('/assessment/a-5/user-state', {
      navigation: { axisId: 1, areaId: '1A', level: 2 },
    });
  });

  it('uses bounded P28 workbench routes', async () => {
    vi.mocked(v8Get).mockResolvedValue({ workbench: { runState: 'draft' }, whatNext: [] } as any);
    vi.mocked(v8Post).mockResolvedValue({ workbench: { runState: 'running' } } as any);

    await V8AssessmentApi.getWorkbench('a-6');
    await V8AssessmentApi.getWorkbenchDefinition('a-6');
    await V8AssessmentApi.getWorkbenchPromotionPayload('a-6');
    await V8AssessmentApi.applyWorkbenchPreset('a-6', 'DRD');
    await V8AssessmentApi.transitionWorkbench('a-6', { toState: 'running' });
    await V8AssessmentApi.addWorkbenchEvidence('a-6', [{ kind: 'document', ref: 'doc:1' }]);
    await V8AssessmentApi.setRequiredEvidenceKinds('a-6', ['document']);
    await V8AssessmentApi.proposeWorkbenchScore('a-6', {
      scoreValues: { readiness: 3 },
      scoringRationale: 'linked evidence',
      evidencePointerIds: ['ev-1'],
    });
    await V8AssessmentApi.reviewWorkbenchScore('a-6', { action: 'accept' });
    await V8AssessmentApi.proposeWorkbenchInterpretation('a-6', {
      summary: 'Moderate readiness',
      keyFindings: ['Gap'],
      limits: 'Single snapshot',
      nextActions: ['Review'],
    });
    await V8AssessmentApi.reviewWorkbenchInterpretation('a-6', { action: 'accept' });
    await V8AssessmentApi.promoteWorkbench('a-6', { targetKind: 'interview_insight' });

    expect(v8Get).toHaveBeenCalledWith('/assessment/a-6/workbench');
    expect(v8Get).toHaveBeenCalledWith('/assessment/a-6/workbench/definition');
    expect(v8Get).toHaveBeenCalledWith('/assessment/a-6/workbench/promotion-payload');
    expect(v8Post).toHaveBeenCalledWith('/assessment/a-6/workbench/methodology-preset', { preset: 'DRD' });
    expect(v8Post).toHaveBeenCalledWith('/assessment/a-6/workbench/transition', { toState: 'running' });
    expect(v8Post).toHaveBeenCalledWith('/assessment/a-6/workbench/evidence', {
      pointers: [{ kind: 'document', ref: 'doc:1' }],
    });
    expect(v8Post).toHaveBeenCalledWith('/assessment/a-6/workbench/required-evidence', {
      kinds: ['document'],
    });
    expect(v8Post).toHaveBeenCalledWith('/assessment/a-6/workbench/score-proposal', {
      scoreValues: { readiness: 3 },
      scoringRationale: 'linked evidence',
      evidencePointerIds: ['ev-1'],
    });
    expect(v8Post).toHaveBeenCalledWith('/assessment/a-6/workbench/score-review', { action: 'accept' });
    expect(v8Post).toHaveBeenCalledWith('/assessment/a-6/workbench/interpretation-proposal', {
      summary: 'Moderate readiness',
      keyFindings: ['Gap'],
      limits: 'Single snapshot',
      nextActions: ['Review'],
    });
    expect(v8Post).toHaveBeenCalledWith('/assessment/a-6/workbench/interpretation-review', {
      action: 'accept',
    });
    expect(v8Post).toHaveBeenCalledWith('/assessment/a-6/workbench/promotion', {
      targetKind: 'interview_insight',
    });
  });

  it('manages assignments via bounded V8 routes', async () => {
    vi.mocked(v8Get).mockResolvedValue({ assignments: [] } as any);
    vi.mocked(v8Put).mockResolvedValue({ assessmentId: 'a-6', areaId: '2B' } as any);
    vi.mocked(v8Delete).mockResolvedValue({ deleted: true } as any);

    await V8AssessmentApi.listAssignments('a-6');
    await V8AssessmentApi.upsertAssignment('a-6', {
      areaId: '2B',
      assignedUserId: 'user-7',
      status: 'ACTIVE',
    });
    await V8AssessmentApi.deleteAssignment('a-6', 'asg-1');

    expect(v8Get).toHaveBeenCalledWith('/assessment/a-6/assignments');
    expect(v8Put).toHaveBeenCalledWith('/assessment/a-6/assignments', {
      areaId: '2B',
      assignedUserId: 'user-7',
      status: 'ACTIVE',
    });
    expect(v8Delete).toHaveBeenCalledWith('/assessment/a-6/assignments/asg-1');
  });
});
