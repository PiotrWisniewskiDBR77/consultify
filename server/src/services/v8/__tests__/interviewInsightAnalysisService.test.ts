import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetInsightById = vi.fn();
const mockQueryAll = vi.fn();
const mockListFindings = vi.fn();

vi.mock('../../InterviewInsightService.js', () => ({
  getById: (...args: unknown[]) => mockGetInsightById(...args),
}));

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
}));

vi.mock('../interviewInsightFindingsService.js', () => ({
  listFindings: (...args: unknown[]) => mockListFindings(...args),
}));

import { buildInsightAnalysis } from '../interviewInsightAnalysisService.js';

describe('interviewInsightAnalysisService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetInsightById.mockResolvedValue({
      id: 'ins-1',
      organizationId: 'org-1',
      title: 'Insight',
      sourceSessionIds: ['sess-1', 'sess-2'],
      themes: [
        {
          title: 'Ownership clarity',
          description: 'Ownership is unclear across teams.',
          evidence_refs: ['ans-1', 'ans-2'],
          strength: 'strong',
          crossSessionPattern: true,
          perspective_labels: ['Operations', 'Technology'],
          divergence_note:
            'Technology sees ownership as system-level, while operations sees it as workflow-level.',
        },
      ],
      issues: [
        {
          title: 'Slow approvals',
          description: 'Approvals are slow in operations.',
          evidence_refs: ['ans-1'],
          severity: 'high',
        },
      ],
      opportunities: [
        {
          title: 'Automate routing',
          description: 'Routing can be automated.',
          evidence_refs: ['ans-2'],
          impact: 'medium',
        },
      ],
      missingData: ['Need frontline coverage from logistics.'],
    });

    mockListFindings.mockResolvedValue([
      {
        id: 'finding-theme',
        insightId: 'ins-1',
        organizationId: 'org-1',
        source_key: 'theme:0',
        source_section_type: 'theme',
        finding_statement: 'Ownership is unclear across the interviewed functions.',
        confidence_level: 'high',
        limits: 'Current coverage excludes logistics.',
        next_action: 'Validate with logistics leads.',
        evidence_pointers: [
          {
            pointerId: 'ptr-1',
            type: 'question_answer',
            sourceRef: 'answer:ans-1',
            sourceFingerprint: 'answer:ans-1',
            capturedAt: '2026-01-01T00:00:00.000Z',
            isTombstone: false,
          },
          {
            pointerId: 'ptr-2',
            type: 'question_answer',
            sourceRef: 'answer:ans-2',
            sourceFingerprint: 'answer:ans-2',
            capturedAt: '2026-01-01T00:00:00.000Z',
            isTombstone: false,
          },
        ],
        review_status: 'published',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'finding-issue',
        insightId: 'ins-1',
        organizationId: 'org-1',
        source_key: 'issue:0',
        source_section_type: 'issue',
        finding_statement: 'Approval delays are concentrated in operations.',
        confidence_level: 'contradicted',
        limits: 'Evidence conflicts between teams.',
        next_action: 'Split the workflow by function before action.',
        evidence_pointers: [
          {
            pointerId: 'ptr-3',
            type: 'question_answer',
            sourceRef: 'answer:ans-1',
            sourceFingerprint: 'answer:ans-1',
            capturedAt: '2026-01-01T00:00:00.000Z',
            isTombstone: false,
          },
        ],
        review_status: 'in_review',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    mockQueryAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM interview_sessions')) {
        return [
          {
            id: 'sess-1',
            name: 'Operations Lead',
            respondent_name: 'Anna Ops',
            job_title: 'Operations Lead',
            department: 'Operations',
          },
          {
            id: 'sess-2',
            name: 'IT Lead',
            respondent_name: 'Jan IT',
            job_title: 'IT Lead',
            department: 'Technology',
          },
        ];
      }
      if (sql.includes('FROM interview_questions')) {
        return [
          { id: 'ans-1', session_id: 'sess-1' },
          { id: 'ans-2', session_id: 'sess-2' },
        ];
      }
      return [];
    });
  });

  it('builds people-topic analysis from findings and source sessions', async () => {
    const result = await buildInsightAnalysis('ins-1');

    expect(result).not.toBeNull();
    expect(result?.scope.posture).toBe('organization_synthesis');
    expect(result?.scope.roles).toEqual(['Operations Lead', 'IT Lead']);
    expect(result?.people.sessionLenses).toHaveLength(2);
    expect(result?.people.stakeholderLenses).toHaveLength(2);
    expect(result?.topics).toHaveLength(3);
    expect(result?.synthesis.consensusTopicIds).toContain('theme:0');
    expect(result?.synthesis.contradictedTopicIds).toContain('issue:0');
    expect(result?.synthesis.coverageGaps).toContain('Need frontline coverage from logistics.');
    expect(result?.topics.find((topic) => topic.id === 'theme:0')?.perspectiveLabels).toEqual([
      'Operations',
      'Technology',
    ]);
    expect(result?.topics.find((topic) => topic.id === 'theme:0')?.divergenceNote).toContain(
      'system-level'
    );
  });

  it('marks stakeholder matrix cells with contradiction and support state', async () => {
    const result = await buildInsightAnalysis('ins-1');

    const contradictedCell = result?.matrix.stakeholderCells.find(
      (cell) => cell.topicId === 'issue:0' && cell.lensId === 'stakeholder:operations_lead'
    );
    const supportedCell = result?.matrix.stakeholderCells.find(
      (cell) => cell.topicId === 'theme:0' && cell.lensId === 'stakeholder:it_lead'
    );

    expect(contradictedCell?.state).toBe('contradicted');
    expect(supportedCell?.state).toBe('supported');
  });
});
