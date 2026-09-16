import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({ kind: 'test-db' }),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAll(...args),
  get: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn(),
}));

import { getUserOrganizations } from '../organizationService.js';

describe('organizationService.getUserOrganizations', () => {
  beforeEach(() => {
    dbAll.mockReset();
  });

  it('keeps the read user-scoped, excludes inactive memberships, and orders current then name', async () => {
    dbAll.mockResolvedValue([
      {
        id: 'org-current',
        name: 'Zulu Current',
        billing_status: 'ACTIVE',
        industry: null,
        role: 'OWNER',
        is_current: true,
      },
      {
        id: 'org-alpha',
        name: 'Alpha',
        billing_status: 'ACTIVE',
        industry: null,
        role: 'MEMBER',
        is_current: false,
      },
    ]);

    const result = await getUserOrganizations('user-two-orgs', 'org-current');

    expect(result.map((org) => org.id)).toEqual(['org-current', 'org-alpha']);
    expect(dbAll).toHaveBeenCalledTimes(1);
    const [, sql, params] = dbAll.mock.calls[0] as [unknown, string, unknown[]];
    expect(sql).toMatch(/JOIN\s+organization_members\s+m\s+ON\s+o\.id\s*=\s*m\.organization_id/i);
    expect(sql).toMatch(/JOIN\s+users\s+u\s+ON\s+u\.id\s*=\s*m\.user_id/i);
    expect(sql).toMatch(/o\.id\s*=\s*COALESCE\(\?\s*,\s*u\.organization_id\)/i);
    expect(sql).toMatch(/WHERE\s+m\.user_id\s*=\s*\?/i);
    expect(sql).toMatch(/m\.status\s*=\s*'ACTIVE'/i);
    expect(sql).toMatch(/ORDER\s+BY\s+is_current\s+DESC\s*,\s*o\.name\s+ASC/i);
    expect(params).toEqual(['org-current', 'user-two-orgs']);
  });

  it('returns an empty list when no active membership remains', async () => {
    dbAll.mockResolvedValue(null);

    await expect(getUserOrganizations('user-inactive-only')).resolves.toEqual([]);
    const [, , params] = dbAll.mock.calls[0] as [unknown, string, unknown[]];
    expect(params).toEqual([null, 'user-inactive-only']);
  });
});
