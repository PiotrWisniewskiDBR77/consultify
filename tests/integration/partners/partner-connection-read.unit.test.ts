/**
 * @vitest-environment node
 *
 * D8 / DEC-2026-08-25-64 canonical connection contract. The real read
 * service is exercised while only its database resolver seam is mocked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getActivePartnerOrgIdForTenantUser = vi.fn();

vi.mock('../../../server/src/services/partnerOrgResolution.js', () => ({
  getActivePartnerOrgIdForTenantUser: (...args: unknown[]) =>
    getActivePartnerOrgIdForTenantUser(...args),
}));

import { getPartnerConnectionForTenant } from '../../../server/src/services/partnerConnectionService';

describe('canonical Partner connection read', () => {
  beforeEach(() => {
    getActivePartnerOrgIdForTenantUser.mockReset();
  });

  it('returns connected for the exact bound tenant and user', async () => {
    getActivePartnerOrgIdForTenantUser.mockResolvedValue('partner-org-1');

    await expect(
      getPartnerConnectionForTenant({ organizationId: 'tenant-a', userId: 'user-1' })
    ).resolves.toEqual({ connected: true, partnerOrganizationId: 'partner-org-1' });
    expect(getActivePartnerOrgIdForTenantUser).toHaveBeenCalledWith('tenant-a', 'user-1');
  });

  it('returns connected false when the selected tenant has no Partner binding', async () => {
    getActivePartnerOrgIdForTenantUser.mockResolvedValue(null);

    await expect(
      getPartnerConnectionForTenant({ organizationId: 'tenant-a', userId: 'user-1' })
    ).resolves.toEqual({ connected: false, partnerOrganizationId: null });
  });

  it('does not expose a foreign tenant Partner connection', async () => {
    getActivePartnerOrgIdForTenantUser.mockImplementation(async (organizationId: string) =>
      organizationId === 'tenant-a' ? 'partner-org-1' : null
    );

    await expect(
      getPartnerConnectionForTenant({ organizationId: 'tenant-b', userId: 'user-1' })
    ).resolves.toEqual({ connected: false, partnerOrganizationId: null });
  });

  it('fails closed when the strict resolver cannot read connection state', async () => {
    getActivePartnerOrgIdForTenantUser.mockRejectedValue(new Error('database unavailable'));

    await expect(
      getPartnerConnectionForTenant({ organizationId: 'tenant-a', userId: 'user-1' })
    ).rejects.toThrow('database unavailable');
  });
});
