import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertOrganizationNameAvailable,
  buildOrganizationCanonicalKey,
  DuplicateOrganizationNameError,
  findOrganizationByCanonicalName,
} from '../organizationIdentityService.js';

const dbAll = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
}));

describe('organizationIdentityService', () => {
  beforeEach(() => {
    dbAll.mockReset();
  });

  it('builds the same canonical key for common legal suffix variations', () => {
    expect(buildOrganizationCanonicalKey('VTS Group S.A.')).toBe('vts');
    expect(buildOrganizationCanonicalKey('VTS Sp. z o.o.')).toBe('vts');
    expect(buildOrganizationCanonicalKey('DBR77 Inc.')).toBe('dbr77');
  });

  it('finds an existing organization by canonicalized company name', async () => {
    dbAll.mockResolvedValue([
      { id: 'org-vts', name: 'VTS Group S.A.', status: 'active', is_active: 1 },
      { id: 'org-demo', name: 'Atelier Demo', status: 'active', is_active: 1 },
    ]);

    const match = await findOrganizationByCanonicalName('VTS Sp. z o.o.');

    expect(match?.id).toBe('org-vts');
    expect(match?.name).toBe('VTS Group S.A.');
  });

  it('throws a typed duplicate error when the name is already taken', async () => {
    dbAll.mockResolvedValue([{ id: 'org-dbr77', name: 'DBR77', status: 'active', is_active: 1 }]);

    await expect(assertOrganizationNameAvailable('DBR77 Inc.')).rejects.toBeInstanceOf(
      DuplicateOrganizationNameError
    );
  });
});
