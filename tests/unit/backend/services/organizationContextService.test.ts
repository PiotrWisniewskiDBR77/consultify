import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
const uuidState = vi.hoisted(() => ({ value: 0 }));
const mockLogger = {
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
};

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: mockLogger,
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => {
    uuidState.value += 1;
    return `uuid-${uuidState.value}`;
  }),
}));

describe('OrganizationContextService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidState.value = 0;
    mockDbRun.mockResolvedValue({ changes: 1 });
    mockDbGet.mockResolvedValue(null);
    mockDbAll.mockResolvedValue([]);
  });

  it('records organization profile writes as append-only items and claims', async () => {
    const mod = await import(
      '../../../../server/src/services/organizationContext/OrganizationContextService.js'
    );
    const service = mod.organizationContextService;
    const rebuildSpy = vi.spyOn(service, 'rebuildSnapshot').mockResolvedValue();

    await service.recordOrganizationProfile({
      organizationId: 'org-1',
      userId: 'user-1',
      payload: {
        industry: 'Technology',
        companySize: 'SMB',
        website: 'https://example.com',
        strategic_priorities: ['AI rollout'],
      },
    });

    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO organization_context_items'),
      expect.arrayContaining(['uuid-1', 'org-1', 'organization_profile', 'org-1', 'user-1'])
    );
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO organization_context_claims'),
      expect.arrayContaining(['uuid-2', 'org-1', 'uuid-1', 'profile.industry'])
    );
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO organization_context_claims'),
      expect.arrayContaining(['uuid-3', 'org-1', 'uuid-1', 'profile.companySize'])
    );
    expect(rebuildSpy).toHaveBeenCalledWith('org-1');
  });

  it('builds resolved context with claim precedence over legacy rows', async () => {
    mockDbGet.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM organizations')) {
        return { id: 'org-1', name: 'Legacy Org', default_language: 'en', default_timezone: 'UTC' };
      }
      if (sql.includes('FROM organization_profiles')) {
        return { industry: 'Legacy Industry', company_size: 'ENTERPRISE' };
      }
      if (sql.includes("FROM organization_settings")) {
        return { setting_value: JSON.stringify({ brandColor: '#123456' }) };
      }
      if (sql.includes('FROM organization_context WHERE organization_id')) {
        return {
          company_name: 'Legacy Org',
          industry: 'Legacy Industry',
          company_size: 'ENTERPRISE',
          key_metrics: JSON.stringify([{ name: 'NPS', value: 40 }]),
          stakeholders: JSON.stringify([{ name: 'Legacy CEO' }]),
          open_gaps: JSON.stringify([{ description: 'Legacy gap' }]),
        };
      }
      if (sql.includes('COUNT(*) as count FROM organization_context_items')) return { count: 2 };
      if (sql.includes('COUNT(*) as count FROM organization_context_claims')) return { count: 3 };
      if (sql.includes('FROM organization_context_snapshots')) return { rebuilt_at: '2026-03-12T10:00:00.000Z' };
      return null;
    });

    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM organization_metadata')) return [];
      if (sql.includes('FROM ai_contexts')) return [];
      if (sql.includes('FROM interview_insights')) return [];
      if (sql.includes('FROM interview_evidence')) return [];
      if (sql.includes('FROM organization_context_items')) {
        return [
          {
            id: 'item-1',
            source_type: 'organization_profile',
            source_id: 'org-1',
            source_label: 'Profile updated',
            channel: 'admin',
            is_explicit: 1,
            created_at: '2026-03-12T09:00:00.000Z',
            author_user_id: 'user-1',
            content_json: JSON.stringify({ industry: 'Technology' }),
          },
        ];
      }
      if (sql.includes('FROM organization_context_claims c')) {
        return [
          {
            id: 'claim-1',
            item_id: 'item-1',
            claim_path: 'profile.industry',
            value_json: JSON.stringify('Technology'),
            confidence: 1,
            claim_type: 'fact',
            review_status: 'accepted',
            created_at: '2026-03-12T09:00:00.000Z',
            source_type: 'organization_profile',
            source_label: 'Profile updated',
            item_created_at: '2026-03-12T09:00:00.000Z',
            is_explicit: 1,
          },
          {
            id: 'claim-2',
            item_id: 'item-1',
            claim_path: 'strategic.goals',
            value_json: JSON.stringify(['Expand AI consulting']),
            confidence: 1,
            claim_type: 'fact',
            review_status: 'accepted',
            created_at: '2026-03-12T09:00:00.000Z',
            source_type: 'organization_profile',
            source_label: 'Profile updated',
            item_created_at: '2026-03-12T09:00:00.000Z',
            is_explicit: 1,
          },
          {
            id: 'claim-3',
            item_id: 'item-1',
            claim_path: 'stakeholders.people',
            value_json: JSON.stringify([{ name: 'New CEO', role: 'CEO' }]),
            confidence: 1,
            claim_type: 'fact',
            review_status: 'accepted',
            created_at: '2026-03-12T09:00:00.000Z',
            source_type: 'interview_context',
            source_label: 'Interview updated',
            item_created_at: '2026-03-12T09:00:00.000Z',
            is_explicit: 1,
          },
        ];
      }
      return [];
    });

    const mod = await import(
      '../../../../server/src/services/organizationContext/OrganizationContextService.js'
    );
    const context = await mod.organizationContextService.buildResolvedContext('org-1');

    expect(context.profile.companyName).toBe('Legacy Org');
    expect(context.profile.industry).toBe('Technology');
    expect(context.strategic.goals).toContain('Expand AI consulting');
    expect(context.stakeholders).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'New CEO' })])
    );
    expect(context.snapshotUpdatedAt).toBe('2026-03-12T10:00:00.000Z');
    expect(context.counts).toEqual({ items: 2, claims: 3, conflicts: 0 });
  });
});
