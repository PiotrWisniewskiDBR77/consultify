/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPartnerConnectionForTenant = vi.fn();

vi.mock('../../../server/src/services/partnerConnectionService.js', () => ({
  PartnerConnectionError: class PartnerConnectionError extends Error {},
  connectPartnerOrganization: vi.fn(),
  getPartnerConnectionForTenant: (...args: unknown[]) => getPartnerConnectionForTenant(...args),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { getPartnerConnectionHandler } from '../../../server/src/routes/v8/partner.routes';

const requestFor = (organizationId: string, userId = 'user-1') =>
  ({ v8Context: { organizationId, userId, userRole: 'MEMBER', isSuperAdmin: false } }) as any;

const response = () => {
  const res: any = { json: vi.fn() };
  res.json.mockImplementation((body: unknown) => body);
  return res;
};

describe('GET /api/v8/partner/connection handler', () => {
  beforeEach(() => getPartnerConnectionForTenant.mockReset());

  it('returns the strict connected projection with V8 metadata', async () => {
    getPartnerConnectionForTenant.mockResolvedValue({
      connected: true,
      partnerOrganizationId: 'partner-1',
    });
    const res = response();

    await getPartnerConnectionHandler(requestFor('tenant-a'), res);

    expect(getPartnerConnectionForTenant).toHaveBeenCalledWith({
      organizationId: 'tenant-a',
      userId: 'user-1',
    });
    expect(res.json).toHaveBeenCalledWith({
      data: { connected: true, partnerOrganizationId: 'partner-1' },
      meta: {
        version: 'v8',
        contract: 'partner_runtime_read_v1',
        v8TenantOrganizationId: 'tenant-a',
      },
    });
  });

  it('returns connected false for an unbound selected tenant', async () => {
    getPartnerConnectionForTenant.mockResolvedValue({
      connected: false,
      partnerOrganizationId: null,
    });
    const res = response();

    await getPartnerConnectionHandler(requestFor('tenant-a'), res);

    expect(res.json.mock.calls[0][0].data).toEqual({
      connected: false,
      partnerOrganizationId: null,
    });
  });

  it('does not substitute a connection from a foreign tenant', async () => {
    getPartnerConnectionForTenant.mockResolvedValue({
      connected: false,
      partnerOrganizationId: null,
    });
    const res = response();

    await getPartnerConnectionHandler(requestFor('tenant-b'), res);

    expect(getPartnerConnectionForTenant).toHaveBeenCalledWith({
      organizationId: 'tenant-b',
      userId: 'user-1',
    });
    expect(res.json.mock.calls[0][0].data.connected).toBe(false);
    expect(res.json.mock.calls[0][0].data.partnerOrganizationId).toBeNull();
  });
});
