import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
};

const mockBuildResolvedContext = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabase: () => mockDb,
}));

vi.mock('../../../server/src/services/organizationContext/OrganizationContextService.js', () => ({
  default: {
    buildResolvedContext: (...args: unknown[]) => mockBuildResolvedContext(...args),
  },
}));

describe('legacy AIContextBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildResolvedContext.mockResolvedValue({
      profile: { companyName: 'Context OS Org', industry: 'Consulting' },
      strategic: { goals: ['Increase margin'] },
    });

    mockDb.get.mockImplementation((_sql: string, _params: unknown[], cb: Function) =>
      cb(null, { id: 'org-1', name: 'Legacy Org' })
    );
    mockDb.all.mockImplementation((sql: string, _params: unknown[], cb: Function) => {
      if (sql.includes('FROM users')) return cb(null, [{ id: 'u1' }]);
      if (sql.includes('FROM tasks')) return cb(null, [{ id: 't1', status: 'OPEN', priority: 'HIGH' }]);
      if (sql.includes('FROM initiatives'))
        return cb(null, [{ id: 'i1', name: 'Init', status: 'ACTIVE', updated_at: '2026-03-12T10:00:00.000Z' }]);
      if (sql.includes('FROM help_events')) return cb(null, []);
      if (sql.includes('FROM metrics_events')) return cb(null, [{ event_type: 'VIEW' }]);
      if (sql.includes('FROM organization_events')) return cb(null, []);
      return cb(null, []);
    });
  });

  it('embeds Context OS snapshot into legacy AI coach context builder', async () => {
    const mod = await import('../../../server/src/ai/aiContextBuilder.js');
    const result = await mod.default.buildContext('org-1');

    expect(mockBuildResolvedContext).toHaveBeenCalledWith('org-1');
    expect(result.orgName).toBe('Context OS Org');
    expect(result.data.organization_context_os).toEqual(
      expect.objectContaining({
        profile: expect.objectContaining({ companyName: 'Context OS Org' }),
      })
    );
    expect(result.raw.organization_context_os).toEqual(
      expect.objectContaining({
        strategic: expect.objectContaining({ goals: ['Increase margin'] }),
      })
    );
  });
});
