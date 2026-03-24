import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockBuildResolvedContext = vi.fn();
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
      buildResolvedContext: (...args: unknown[]) => mockBuildResolvedContext(...args),
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
    mockBuildResolvedContext.mockResolvedValue({
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
      conflicts: [{ claimPath: 'profile.industry', values: ['Consulting', 'Tech'], sourceTypes: ['profile', 'interview'] }],
      timeline: [{ id: 't-1' }, { id: 't-2' }, { id: 't-3' }],
    });
  });

  it('injects resolved organization context into the central AI context builder', async () => {
    mockDbGet.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM organizations')) return { id: 'org-1', name: 'Legacy Org', industry: 'Legacy' };
      if (sql.includes('FROM ai_organization_memory WHERE organization_id')) return { pmo_maturity: 'ADVANCED' };
      return null;
    });
    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM projects')) return [{ id: 'p-1' }, { id: 'p-2' }];
      return [];
    });

    const mod = await import('../../../../server/src/services/aiContextBuilder.js');
    const organization = await mod.AIContextBuilder._buildOrganizationContext('org-1');

    expect(mockBuildResolvedContext).toHaveBeenCalledWith('org-1');
    expect(organization.organizationName).toBe('Resolved Org');
    expect(organization.industry).toBe('Consulting');
    expect(organization.activeProjectCount).toBe(2);
    expect(organization.profile).toEqual(expect.objectContaining({ companyName: 'Resolved Org' }));
    expect(organization.strategic).toEqual(
      expect.objectContaining({ goals: ['Grow advisory revenue'] })
    );
    expect(organization.contextConflicts).toHaveLength(1);
    expect(organization.contextTimeline).toHaveLength(3);
  });
});
