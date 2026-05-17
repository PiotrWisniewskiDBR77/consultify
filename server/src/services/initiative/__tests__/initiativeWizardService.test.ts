import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('uuid', () => ({
  v4: vi
    .fn()
    .mockReturnValueOnce('candidate-1')
    .mockReturnValueOnce('audit-1')
    .mockReturnValue('id-next'),
}));

import {
  evaluateShortlistGate,
  generateCandidates,
  recordShortlistGateBlocked,
  type InitiativeWizardCandidate,
} from '../initiativeWizardService.js';

function candidate(
  overrides: Partial<InitiativeWizardCandidate> = {}
): InitiativeWizardCandidate {
  return {
    id: 'candidate-1',
    wizardSessionId: 'session-1',
    title: 'Evidence-backed initiative',
    problemStatement: 'Problem',
    opportunityStatement: 'Opportunity',
    rationale: 'Rationale',
    confidenceLevel: 'medium',
    limits: ['Requires owner confirmation.'],
    impactScore: 4,
    effortScore: 3,
    riskScore: 3,
    timeToValueScore: 4,
    strategicFitScore: 5,
    suggestedOwner: null,
    suggestedKpi: null,
    firstStep: null,
    initiativeLevel: 'standard',
    triageStatus: 'accepted_for_shortlist',
    triageReason: null,
    linkedInitiativeId: null,
    sourceRefs: [{ type: 'interview_insight', id: 'insight-1' }],
    evidenceRefs: ['insight-1'],
    createdAt: '2026-05-17T00:00:00.000Z',
    updatedAt: '2026-05-17T00:00:00.000Z',
    ...overrides,
  };
}

describe('initiativeWizardService', () => {
  beforeEach(() => {
    mockQueryAll.mockReset();
    mockQueryOne.mockReset();
    mockQueryRun.mockReset();
    mockQueryRun.mockResolvedValue({ changes: 1 });
  });

  it('generates candidates from explicit evidence and preserves lineage', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'session-1',
      organization_id: 'org-1',
      target_count: 1,
      time_horizon: '90_days',
      risk_appetite: 'balanced',
      business_priorities_json: JSON.stringify(['quality', 'governance']),
      manual_notes: 'Prioritize initiatives with clear source evidence.',
      source_basket_json: JSON.stringify([
        {
          type: 'interview_insight',
          id: 'insight-1',
          title: 'Manual reporting slows decisions',
          confidence: 'high',
          limits: ['Validate baseline KPI.'],
          evidencePointers: ['answer-1'],
        },
      ]),
    });
    mockQueryAll.mockResolvedValueOnce([]);
    mockQueryAll.mockResolvedValueOnce([
      {
        id: 'iwc_candidate-1',
        wizard_session_id: 'session-1',
        title: 'Manual reporting slows decisions',
        problem_statement: 'Problem',
        opportunity_statement: 'Opportunity',
        rationale_text: 'Rationale',
        confidence_level: 'high',
        limits_json: JSON.stringify(['Validate baseline KPI.']),
        impact_score: 5,
        effort_score: 3,
        risk_score: 3,
        time_to_value_score: 4,
        strategic_fit_score: 4,
        initiative_level: 'strategic',
        triage_status: 'new_candidate',
        source_refs_json: JSON.stringify([{ type: 'interview_insight', id: 'insight-1' }]),
        evidence_refs_json: JSON.stringify(['insight-1', 'answer-1']),
        created_at: '2026-05-17T00:00:00.000Z',
        updated_at: '2026-05-17T00:00:00.000Z',
      },
    ]);

    const result = await generateCandidates({
      organizationId: 'org-1',
      sessionId: 'session-1',
      userId: 'user-1',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        confidenceLevel: 'high',
        sourceRefs: [expect.objectContaining({ id: 'insight-1' })],
        evidenceRefs: ['insight-1', 'answer-1'],
      })
    );
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO initiative_wizard_candidates'),
      expect.arrayContaining([
        'iwc_candidate-1',
        'org-1',
        'session-1',
        expect.stringContaining('Manual reporting slows decisions'),
      ])
    );
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO initiative_wizard_audit_events'),
      expect.arrayContaining([
        'iwa_audit-1',
        'org-1',
        'session-1',
        null,
        'user-1',
        'wizard_candidates_generated',
      ])
    );
  });

  it('blocks shortlist when accepted evidence is contradicted or missing lineage', () => {
    const result = evaluateShortlistGate([
      candidate({ id: 'ok-candidate' }),
      candidate({
        id: 'contradicted-candidate',
        confidenceLevel: 'contradicted',
      }),
      candidate({
        id: 'missing-evidence-candidate',
        evidenceRefs: [],
      }),
      candidate({
        id: 'needs-evidence-candidate',
        triageStatus: 'needs_evidence',
      }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.shortlistCount).toBe(3);
    expect(result.blocked.map((entry) => entry.reason)).toEqual([
      'contradicted_confidence',
      'missing_evidence',
    ]);
  });

  it('records audit event when shortlist gate blocks draft creation', async () => {
    await recordShortlistGateBlocked({
      organizationId: 'org-1',
      sessionId: 'session-1',
      userId: 'user-1',
      result: {
        ok: false,
        shortlistCount: 1,
        blocked: [
          {
            candidateId: 'candidate-1',
            title: 'Blocked candidate',
            reason: 'contradicted_confidence',
            message: 'Contradicted evidence.',
            confidenceLevel: 'contradicted',
            triageStatus: 'accepted_for_shortlist',
            evidenceRefsCount: 1,
          },
        ],
      },
    });

    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO initiative_wizard_audit_events'),
      expect.arrayContaining([
        expect.stringMatching(/^iwa_/),
        'org-1',
        'session-1',
        null,
        'user-1',
        'wizard_shortlist_gate_blocked',
        expect.stringContaining('contradicted_confidence'),
      ])
    );
  });
});
