import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryAllMock, queryOneMock } = vi.hoisted(() => ({
  queryAllMock: vi.fn(),
  queryOneMock: vi.fn(),
}));

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: queryAllMock,
  queryOne: queryOneMock,
}));

vi.mock('../../projectRoleCanon.js', () => ({
  mapToCanonicalProjectRole: vi.fn(() => null),
}));

import { resolveInitiativeAccessContext } from '../initiativeAccessResolver.js';

describe('initiativeAccessResolver', () => {
  beforeEach(() => {
    queryAllMock.mockReset();
    queryOneMock.mockReset();
  });

  it('honors owner/superadmin auth role hints even when the DB user role is stale', async () => {
    queryAllMock.mockResolvedValue([]);
    queryOneMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM initiatives WHERE id = ? AND organization_id = ?')) {
        return { id: 'init-1', projectId: null };
      }
      if (sql.includes('SELECT role FROM users')) {
        return { role: null };
      }
      if (sql.includes('SELECT owner_business_id, owner_execution_id, sponsor_id')) {
        return {
          owner_business_id: null,
          owner_execution_id: null,
          sponsor_id: null,
        };
      }
      return null;
    });

    const result = await resolveInitiativeAccessContext('org-1', 'init-1', 'user-1', 'OWNER');

    expect(result.systemRole).toBe('SUPERADMIN');
    expect(result.effectiveRoles).toContain('ADMIN');
  });
});
