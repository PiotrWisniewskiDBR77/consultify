import { beforeEach, describe, expect, it, vi } from 'vitest';

const { databaseRun, getDatabase, transactionQuery } = vi.hoisted(() => ({
  databaseRun: vi.fn(),
  getDatabase: vi.fn(),
  transactionQuery: vi.fn(),
}));

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase,
}));

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  getCurrentPgTransactionClient: () => ({ query: transactionQuery }),
}));

describe('AuditEventsService transaction participation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDatabase.mockReturnValue({ run: databaseRun });
    transactionQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it('writes through the request-pinned PostgreSQL transaction', async () => {
    const { default: auditEventsService } = await import(
      '../../../../server/src/services/AuditEventsService.js'
    );

    const id = await auditEventsService.log({
      actorId: 'u-1',
      actorType: 'USER',
      organizationId: 'org-1',
      action: 'chat.visibility_consent_recorded',
      resourceType: 'conversation',
      resourceId: 'c-1',
    });

    expect(id).toMatch(/^ae-/);
    expect(transactionQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_events'),
      expect.arrayContaining([
        'u-1',
        'USER',
        'org-1',
        'chat.visibility_consent_recorded',
        'conversation',
        'c-1',
      ])
    );
    expect(getDatabase).not.toHaveBeenCalled();
    expect(databaseRun).not.toHaveBeenCalled();
  });
});

