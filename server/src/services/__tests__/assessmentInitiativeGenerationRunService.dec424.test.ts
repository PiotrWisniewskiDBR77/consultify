import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryOne = vi.fn();
const queryAll = vi.fn();
const executeInitiativeTransition = vi.fn();
vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => queryOne(...args),
  queryAll: (...args: unknown[]) => queryAll(...args),
  queryRun: vi.fn(),
}));
vi.mock('../initiative/initiativeTransitionService.js', () => ({
  executeInitiativeTransition: (...args: unknown[]) => executeInitiativeTransition(...args),
}));
vi.mock('../assessment/AssessmentWorkbenchService.js', () => ({
  upsertActiveAssessmentInitiativeBatch: vi.fn(),
}));
vi.mock('../assessmentInitiativeService.js', () => ({ default: {} }));

import AssessmentInitiativeGenerationRunService from '../assessmentInitiativeGenerationRunService';

const params = { runId: 'run-p12', assessmentId: 'assessment-p12', organizationId: 'org-p12',
  actorId: 'author-p12', actorRole: 'CONSULTANT' };

describe('DEC-424 — bulk submit używa silnika', () => {
  beforeEach(() => {
    queryOne.mockReset(); queryAll.mockReset(); executeInitiativeTransition.mockReset();
    queryOne.mockResolvedValue({ id: params.runId, assessment_id: params.assessmentId,
      organization_id: params.organizationId });
    queryAll.mockResolvedValue([{ id: 'draft-owned-1' }, { id: 'draft-owned-2' }]);
    executeInitiativeTransition.mockResolvedValue({ ok: true, status: 'PENDING_APPROVAL' });
  });

  it('selekcjonuje szkice po created_by i każdy przekazuje silnikowi', async () => {
    await expect(AssessmentInitiativeGenerationRunService.bulkSubmitRunDrafts(params))
      .resolves.toEqual({ updated: 2 });
    expect(queryAll).toHaveBeenCalledWith(expect.stringContaining('i.created_by = ?'),
      [params.runId, params.organizationId, params.actorId]);
    expect(executeInitiativeTransition).toHaveBeenCalledTimes(2);
    expect(executeInitiativeTransition).toHaveBeenNthCalledWith(1, expect.objectContaining({
      initiativeId: 'draft-owned-1', actorId: params.actorId,
      nextStatusInput: 'PENDING_APPROVAL', expectedCurrentStatus: 'DRAFT',
    }));
  });

  it('propaguje pierwszą odmowę silnika i nie udaje powodzenia', async () => {
    executeInitiativeTransition.mockResolvedValueOnce({ ok: false, statusCode: 403,
      body: { code: 'AUTHOR_ONLY', error: 'Only author' } });
    await expect(AssessmentInitiativeGenerationRunService.bulkSubmitRunDrafts(params))
      .rejects.toMatchObject({ statusCode: 403, code: 'AUTHOR_ONLY' });
    expect(executeInitiativeTransition).toHaveBeenCalledTimes(1);
  });
});
