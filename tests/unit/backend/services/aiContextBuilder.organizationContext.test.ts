import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockGetPublishedSnapshot = vi.fn();
const mockLogger = {
  warn: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
};

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
}));

vi.mock(
  '../../../../server/src/services/organizationContext/OrganizationContextService.js',
  () => ({
    default: {
      getPublishedSnapshot: (...args: unknown[]) => mockGetPublishedSnapshot(...args),
    },
  })
);

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: mockLogger,
}));

describe('AIContextBuilder organization layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbGet.mockResolvedValue(null);
    mockDbAll.mockResolvedValue([]);
    mockGetPublishedSnapshot.mockResolvedValue({
      snapshotId: 'snapshot-1',
      contentHash: 'hash-1',
      sourceRefs: [
        {
          claimId: 'claim-1',
          itemId: 'item-1',
          sourceType: 'document_extraction',
          sourceId: 'doc-1',
          claimPath: 'evidence.documentExtraction',
          confidence: 0.8,
        },
      ],
      context: {
        profile: {
          companyName: 'Resolved Org',
          industry: 'Consulting',
        },
        strategic: {
          goals: ['Grow advisory revenue'],
        },
        operations: {
          keyMetrics: [{ name: 'Gross margin', value: 42 }],
        },
        systems: {
          stack: ['HubSpot'],
        },
        stakeholders: [{ name: 'CEO' }],
        notes: { manualContext: [] },
        metadata: { custom: [] },
        evidence: [],
        signals: { interviewInsights: ['Strong PMO support'] },
        conflicts: [
          {
            claimPath: 'profile.industry',
            values: ['Consulting', 'Tech'],
            sourceTypes: ['profile', 'interview'],
          },
        ],
        timeline: [{ id: 't-1' }, { id: 't-2' }, { id: 't-3' }],
      },
    });
  });

  it('injects resolved organization context into the central AI context builder', async () => {
    mockDbGet.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM organizations'))
        return { id: 'org-1', name: 'Legacy Org', industry: 'Legacy' };
      if (sql.includes('FROM ai_organization_memory WHERE organization_id'))
        return { pmo_maturity: 'ADVANCED' };
      return null;
    });
    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM projects')) return [{ id: 'p-1' }, { id: 'p-2' }];
      return [];
    });

    const mod = await import('../../../../server/src/services/aiContextBuilder.js');
    const organization = await mod.AIContextBuilder._buildOrganizationContext('org-1');

    expect(mockGetPublishedSnapshot).toHaveBeenCalledWith('org-1');
    expect(organization.organizationName).toBe('Resolved Org');
    expect(organization.industry).toBe('Consulting');
    expect(organization.activeProjectCount).toBe(2);
    expect(organization.profile).toEqual(expect.objectContaining({ companyName: 'Resolved Org' }));
    expect(organization.strategic).toEqual(
      expect.objectContaining({ goals: ['Grow advisory revenue'] })
    );
    expect(organization.contextConflicts).toHaveLength(1);
    expect(organization.contextTimeline).toHaveLength(3);
    expect(organization.organizationContextSnapshotId).toBe('snapshot-1');
    expect(organization.organizationContextSourceRefs).toEqual([
      expect.objectContaining({ claimId: 'claim-1', sourceId: 'doc-1' }),
    ]);
    expect(organization.organizationContextContentHash).toBe('hash-1');
    expect(organization.contextItemsSample).toBeUndefined();
  });

  it('fails closed when no approved publication exists', async () => {
    mockGetPublishedSnapshot.mockResolvedValueOnce(null);
    const mod = await import('../../../../server/src/services/aiContextBuilder.js');
    const organization = await mod.AIContextBuilder._buildOrganizationContext('org-2');

    expect(organization.organizationContextSnapshotId).toBeUndefined();
    expect(organization.profile).toBeUndefined();
    expect(organization.contextItemsSample).toBeUndefined();
  });

  it('prefers canonical assessments over legacy maturity rows for assessment context', async () => {
    mockDbGet.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM assessments')) {
        return {
          id: 'asm-1',
          name: 'Canonical DRD',
          assessment_type: 'DRD',
          status: 'IN_REVIEW',
          completion_percent: 82,
          confidence_avg: 0.78,
          score_summary: JSON.stringify({
            scores: { readiness: 3.4, data: 2.9 },
            overallScore: 3.15,
          }),
          context_snapshot: JSON.stringify({
            needsWorkTopAxes: [{ axisName: 'Data', percent: 52 }],
          }),
          p28_workbench_v1: JSON.stringify({
            assessmentRunId: 'run-42',
            runState: 'score_reviewed',
            scoreProposal: { scoreValues: { readiness: 3.4, data: 2.9 }, confidence: 0.78 },
          }),
        };
      }
      return null;
    });

    const mod = await import('../../../../server/src/services/aiContextBuilder.js');
    const assessment = await mod.AIContextBuilder._buildAssessmentContext('proj-1', 'org-1');

    expect(assessment).toEqual(
      expect.objectContaining({
        assessmentId: 'asm-1',
        name: 'Canonical DRD',
        framework: 'DRD',
        runState: 'score_reviewed',
        completionPercent: 82,
      })
    );
    expect(assessment.axisScores).toEqual(
      expect.arrayContaining([expect.objectContaining({ axis: 'readiness', asIs: 3.4 })])
    );
    expect(assessment.topGaps).toEqual(
      expect.arrayContaining([expect.objectContaining({ axis: 'Data' })])
    );
  });
});
