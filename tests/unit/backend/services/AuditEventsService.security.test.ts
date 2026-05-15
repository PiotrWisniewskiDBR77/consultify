import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
};

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: () => mockDb,
}));

describe('AuditEventsService security scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.get.mockResolvedValue({ count: 0 });
    mockDb.all.mockResolvedValue([]);
  });

  it('does not include null-org platform events in tenant-scoped queries', async () => {
    const { default: auditEventsService } = await import(
      '../../../../server/src/services/AuditEventsService.js'
    );

    await auditEventsService.query({ organizationId: 'org-a' });

    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('WHERE 1=1 AND org_id = ?'),
      ['org-a']
    );
    expect(mockDb.get.mock.calls[0][0]).not.toContain('org_id IS NULL');
    expect(mockDb.all.mock.calls[0][0]).not.toContain('org_id IS NULL');
  });
});
