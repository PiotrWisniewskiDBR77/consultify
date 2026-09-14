import { describe, expect, it, vi } from 'vitest';

import { requireOrganizationExportOwner } from '../ownership.routes.js';

const response = () => {
  const res = { status: vi.fn(), json: vi.fn() } as any;
  res.status.mockReturnValue(res);
  return res;
};

const request = { params: { orgId: 'org-a' }, user: { id: 'user-a', organizationId: 'org-a', email: 'a@test.invalid' } } as any;

describe('organization full-export owner permission', () => {
  it('denies an active administrator before checking the full-export permission', async () => {
    const res = response();
    const checkPermission = vi.fn();
    const result = await requireOrganizationExportOwner(request, res, {
      getMembership: vi.fn().mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' }) as any,
      checkPermission,
    });
    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'ORG_EXPORT_OWNER_REQUIRED' });
    expect(checkPermission).not.toHaveBeenCalled();
  });

  it('denies an owner without ORGANIZATION_EXPORT_FULL', async () => {
    const res = response();
    const result = await requireOrganizationExportOwner(request, res, {
      getMembership: vi.fn().mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' }) as any,
      checkPermission: vi.fn().mockResolvedValue(false) as any,
    });
    expect(result).toBeNull();
    expect(res.json).toHaveBeenCalledWith({ error: 'ORG_EXPORT_PERMISSION_REQUIRED' });
  });

  it('accepts only the active owner with ORGANIZATION_EXPORT_FULL', async () => {
    const res = response();
    const result = await requireOrganizationExportOwner(request, res, {
      getMembership: vi.fn().mockResolvedValue({ role: 'OWNER', status: 'ACTIVE' }) as any,
      checkPermission: vi.fn().mockResolvedValue(true) as any,
    });
    expect(result).toMatchObject({ userId: 'user-a', role: 'OWNER' });
    expect(res.status).not.toHaveBeenCalled();
  });
});
