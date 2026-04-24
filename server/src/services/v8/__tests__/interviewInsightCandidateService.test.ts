import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  candidates: [] as any[],
  auditLog: [] as any[],
  updateFindingMock: vi.fn(),
}));

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryRun: vi.fn(async (sql: string, params: any[] = []) => {
    if (sql.includes('INSERT INTO interview_insight_candidates')) {
      state.candidates.push({
        id: params[0],
        organization_id: params[1],
        insight_id: params[2],
        source_section_type: params[3],
        source_section_index: params[4],
        source_key: params[5],
        candidate_statement: params[6],
        rationale_text: params[7],
        confidence_hint: params[8],
        triage_status: params[9],
        followup_type: params[10],
        followup_recommendation: params[11],
        linked_finding_id: params[12],
        created_at: params[15],
        updated_at: params[16],
      });
      return { changes: 1 };
    }
    if (sql.includes('UPDATE interview_insight_candidates')) {
      const candidateId = params[params.length - 2];
      const insightId = params[params.length - 1];
      const existing = state.candidates.find(
        (candidate) => candidate.id === candidateId && candidate.insight_id === insightId
      );
      if (!existing) return { changes: 0 };
      if (sql.includes("triage_status = 'promoted'")) {
        existing.triage_status = 'promoted';
        existing.followup_type = 'publish';
        existing.followup_recommendation = params[0];
        existing.linked_finding_id = params[1];
        existing.updated_at = params[3];
      } else {
        existing.candidate_statement = params[0];
        existing.rationale_text = params[1];
        existing.triage_status = params[2];
        existing.followup_type = params[3];
        existing.followup_recommendation = params[4];
        existing.updated_at = params[6];
      }
      return { changes: 1 };
    }
    if (sql.includes('INSERT INTO interview_insight_audit_log')) {
      state.auditLog.push({
        id: params[0],
        organization_id: params[1],
        insight_id: params[2],
        entity_type: params[3],
        entity_id: params[4],
        action: params[5],
      });
      return { changes: 1 };
    }
    return { changes: 0 };
  }),
  queryAll: vi.fn(async (sql: string, params: any[] = []) => {
    if (sql.includes('FROM interview_insight_candidates')) {
      return state.candidates
        .filter((candidate) => candidate.insight_id === params[0])
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    }
    return [];
  }),
  queryOne: vi.fn(async (sql: string, params: any[] = []) => {
    if (sql.includes('COUNT(*) as count FROM interview_insight_candidates')) {
      return {
        count: state.candidates.filter((candidate) => candidate.insight_id === params[0]).length,
      };
    }
    if (sql.includes('FROM interview_insight_candidates')) {
      return (
        state.candidates.find(
          (candidate) => candidate.insight_id === params[0] && candidate.id === params[1]
        ) || null
      );
    }
    return null;
  }),
}));

vi.mock('../../InterviewInsightService.js', () => ({
  getById: vi.fn(async (insightId: string) => ({
    id: insightId,
    organizationId: 'org_1',
    createdBy: 'user_1',
  })),
}));

vi.mock('../interviewInsightAnalysisService.js', () => ({
  buildInsightAnalysis: vi.fn(async (insightId: string) => ({
    insightId,
    insightTitle: 'Test insight',
    scope: {
      sourceSessionIds: ['s1', 's2'],
      sourceSessionCount: 2,
      distinctStakeholderCount: 2,
      stakeholderLabels: ['Operations', 'Technology'],
      departments: ['Ops', 'IT'],
      roles: ['Ops Lead', 'CTO'],
      posture: 'cross_perspective',
    },
    people: { sessionLenses: [], stakeholderLenses: [] },
    topics: [
      {
        id: 'theme:0',
        sourceKey: 'theme:0',
        kind: 'theme',
        label: 'Theme',
        description: 'Cross-team ownership is unclear.',
        confidenceLevel: 'medium',
        reviewStatus: 'draft',
        limits: 'Need review',
        nextAction: 'Review',
        evidenceCount: 2,
        supportingSessionIds: ['s1', 's2'],
        supportingStakeholderLabels: ['Operations', 'Technology'],
        crossSessionPattern: true,
        isContradicted: false,
        perspectiveLabels: ['Operations', 'Technology'],
      },
      {
        id: 'issue:0',
        sourceKey: 'issue:0',
        kind: 'issue',
        label: 'Issue',
        description: 'Only one team mentions tooling gaps.',
        confidenceLevel: 'insufficient',
        reviewStatus: 'draft',
        limits: 'Sparse',
        nextAction: 'Get more data',
        evidenceCount: 0,
        supportingSessionIds: ['s1'],
        supportingStakeholderLabels: ['Operations'],
        crossSessionPattern: false,
        isContradicted: false,
        perspectiveLabels: ['Operations'],
      },
      {
        id: 'opportunity:0',
        sourceKey: 'opportunity:0',
        kind: 'opportunity',
        label: 'Opportunity',
        description: 'Automation is framed differently by each team.',
        confidenceLevel: 'contradicted',
        reviewStatus: 'draft',
        limits: 'Split first',
        nextAction: 'Split',
        evidenceCount: 3,
        supportingSessionIds: ['s1', 's2'],
        supportingStakeholderLabels: ['Operations', 'Technology'],
        crossSessionPattern: true,
        isContradicted: true,
        perspectiveLabels: ['Operations', 'Technology'],
        divergenceNote: 'Different owners are implied.',
      },
    ],
    matrix: {
      rows: [],
      sessionColumns: [],
      stakeholderColumns: [],
      sessionCells: [],
      stakeholderCells: [],
    },
    synthesis: {
      consensusTopicIds: ['theme:0'],
      localOnlyTopicIds: ['issue:0'],
      contradictedTopicIds: ['opportunity:0'],
      coverageGaps: [
        'Interview finance to confirm whether this pattern generalizes beyond operations.',
      ],
    },
  })),
}));

vi.mock('../interviewInsightFindingsService.js', () => ({
  listFindings: vi.fn(async () => [
    {
      id: 'finding_theme',
      source_key: 'theme:0',
      review_status: 'draft',
      limits: 'Need review',
      next_action: 'Review',
    },
    {
      id: 'finding_issue',
      source_key: 'issue:0',
      review_status: 'draft',
      limits: 'Need evidence',
      next_action: 'Collect evidence',
    },
    {
      id: 'finding_opp',
      source_key: 'opportunity:0',
      review_status: 'draft',
      limits: 'Split first',
      next_action: 'Split',
    },
  ]),
  addFinding: vi.fn(),
  updateFinding: state.updateFindingMock,
}));

describe('interviewInsightCandidateService', () => {
  beforeEach(() => {
    state.candidates.length = 0;
    state.auditLog.length = 0;
    state.updateFindingMock.mockReset();
    state.updateFindingMock.mockResolvedValue({
      finding: {
        id: 'finding_theme',
        source_key: 'theme:0',
        review_status: 'draft',
        limits: 'Need review',
        next_action: 'Review',
      },
    });
  });

  it('backfills candidate findings with triage statuses and follow-up guidance', async () => {
    const { listCandidates } = await import('../interviewInsightCandidateService.js');

    const candidates = await listCandidates('insight_1');

    expect(candidates).toHaveLength(3);
    expect(candidates.find((candidate) => candidate.source_key === 'theme:0')?.triage_status).toBe(
      'ready_for_review'
    );
    expect(candidates.find((candidate) => candidate.source_key === 'issue:0')?.triage_status).toBe(
      'needs_evidence'
    );
    expect(
      candidates.find((candidate) => candidate.source_key === 'opportunity:0')?.triage_status
    ).toBe('needs_split');
    expect(candidates.find((candidate) => candidate.source_key === 'theme:0')?.followup_type).toBe(
      'reinterview'
    );
    expect(
      candidates.find((candidate) => candidate.source_key === 'theme:0')?.linked_finding_id
    ).toBe('finding_theme');
  });

  it('updates triage status without duplicating findings', async () => {
    const { listCandidates, triageCandidate } =
      await import('../interviewInsightCandidateService.js');

    const [candidate] = await listCandidates('insight_1');
    const result = await triageCandidate(
      'insight_1',
      candidate.id,
      {
        action: 'mark_ready_for_review',
        followup_recommendation: 'Ready for operator review.',
      },
      'reviewer_1'
    );

    expect(result.error).toBeUndefined();
    expect(result.candidate?.triage_status).toBe('ready_for_review');
    expect(state.auditLog.at(-1)?.action).toBe('mark_ready_for_review');
  });

  it('promotes a candidate into the linked finding lifecycle', async () => {
    const { listCandidates, promoteCandidateToFinding } =
      await import('../interviewInsightCandidateService.js');

    const candidates = await listCandidates('insight_1');
    const target = candidates.find((candidate) => candidate.source_key === 'theme:0');
    expect(target).toBeTruthy();

    const result = await promoteCandidateToFinding(
      'insight_1',
      target!.id,
      {
        finding_statement: 'Cross-team ownership is unclear and needs a single decision-maker.',
        confidence_level: 'medium',
      },
      {
        actorUserId: 'reviewer_1',
        organizationId: 'org_1',
      }
    );

    expect(result.error).toBeUndefined();
    expect(state.updateFindingMock).toHaveBeenCalledWith(
      'insight_1',
      'finding_theme',
      expect.objectContaining({
        finding_statement: 'Cross-team ownership is unclear and needs a single decision-maker.',
        confidence_level: 'medium',
      }),
      'reviewer_1'
    );
    expect(result.candidate?.triage_status).toBe('promoted');
    expect(result.candidate?.linked_finding_id).toBe('finding_theme');
  });
});
