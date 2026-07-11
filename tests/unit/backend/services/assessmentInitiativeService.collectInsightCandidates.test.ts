import { beforeEach, describe, expect, it, vi } from 'vitest';

// Content Engines §5 — reference wiring test: AssessmentInitiativeService
// (Catalog B) calling the shared insightMaterializationService to distill raw
// assessment answers into Insight-card candidates. DB and the shared service
// are both mocked so this exercises ONLY the adapter (source-item building +
// fail-soft plumbing), not the LLM/validator internals (covered by
// insightMaterializationService.test.ts).

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: vi.fn(),
  queryOne: vi.fn(),
  queryAll: vi.fn(),
}));

vi.mock('../../../../server/src/services/insightMaterializationService.js', () => ({
  materializeInsightCandidates: vi.fn(),
}));

import * as queryHelpers from '../../../../server/src/utils/queryHelpers.js';
import { materializeInsightCandidates } from '../../../../server/src/services/insightMaterializationService.js';
import AssessmentInitiativeService from '../../../../server/src/services/assessmentInitiativeService.js';

describe('AssessmentInitiativeService.collectInsightCandidatesFromAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds source items from answers_json and delegates to the shared materialization service', async () => {
    (queryHelpers.queryOne as any).mockResolvedValue({
      id: 'assess-1',
      organization_id: 'org-1',
      assessment_type: 'DRD',
      name: 'Ocena Q3',
      answers_json: JSON.stringify({
        q1: 'Brak priorytetyzacji zapytań',
        q2: { answer: 'Nikt nie mierzy SLA' },
        q3: null,
      }),
    });
    (materializeInsightCandidates as any).mockResolvedValue({
      candidates: [{ title: 'x' }],
      repaired: false,
      tokensUsed: 10,
      generationTimeMs: 5,
      degraded: false,
    });

    const outcome = await AssessmentInitiativeService.collectInsightCandidatesFromAssessment(
      'assess-1',
      'org-1'
    );

    expect(materializeInsightCandidates).toHaveBeenCalledTimes(1);
    const call = (materializeInsightCandidates as any).mock.calls[0][0];
    expect(call.sourceType).toBe('assessment');
    expect(call.sourceId).toBe('assess-1');
    expect(call.organizationId).toBe('org-1');
    // q3 is null → filtered out; q1/q2 survive with their text extracted.
    expect(call.items).toEqual([
      { id: 'q1', label: 'q1', text: 'Brak priorytetyzacji zapytań' },
      { id: 'q2', label: 'q2', text: 'Nikt nie mierzy SLA' },
    ]);
    expect(outcome.degraded).toBe(false);
    expect(outcome.candidates).toHaveLength(1);
  });

  it('is fail-soft when the assessment is not found (no LLM call, degraded outcome)', async () => {
    (queryHelpers.queryOne as any).mockResolvedValue(null);

    const outcome = await AssessmentInitiativeService.collectInsightCandidatesFromAssessment(
      'missing',
      'org-1'
    );

    expect(outcome).toMatchObject({ degraded: true, degradedReason: 'assessment_not_found', candidates: [] });
    expect(materializeInsightCandidates).not.toHaveBeenCalled();
  });

  it('is fail-soft when answers_json is empty/absent', async () => {
    (queryHelpers.queryOne as any).mockResolvedValue({
      id: 'assess-2',
      organization_id: 'org-1',
      assessment_type: 'SIRI',
      name: 'Ocena pusta',
      answers_json: null,
    });

    const outcome = await AssessmentInitiativeService.collectInsightCandidatesFromAssessment(
      'assess-2',
      'org-1'
    );

    expect(outcome).toMatchObject({ degraded: true, degradedReason: 'no_answers', candidates: [] });
    expect(materializeInsightCandidates).not.toHaveBeenCalled();
  });

  it('is fail-soft when the DB lookup throws (never propagates)', async () => {
    (queryHelpers.queryOne as any).mockRejectedValue(new Error('db down'));

    await expect(
      AssessmentInitiativeService.collectInsightCandidatesFromAssessment('assess-1', 'org-1')
    ).resolves.toMatchObject({ degraded: true, degradedReason: 'unexpected_error', candidates: [] });
  });
});
