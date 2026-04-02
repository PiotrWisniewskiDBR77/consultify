import { describe, expect, it, vi } from 'vitest';

import { setIntegrationOwner } from '../integrationOwnershipService.js';

const dbRun = vi.fn();
vi.mock('../../utils/DbPromise.js', () => ({
  run: (...args: any[]) => dbRun(...args),
  get: vi.fn(),
  all: vi.fn(),
}));

describe('integrationOwnershipService', () => {
  it('upserts ownership with ON CONFLICT', async () => {
    dbRun.mockResolvedValue({ success: true });

    await setIntegrationOwner({
      integrationId: 'int-1',
      organizationId: 'org-1',
      ownerUserId: 'user-1',
    });

    const sqlCalls = dbRun.mock.calls.map((c) => String(c[0]));
    expect(sqlCalls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS integration_ownership'))).toBe(
      true
    );
    expect(sqlCalls.some((sql) => sql.includes('ON CONFLICT (integration_id)'))).toBe(true);
  });
});

