import { beforeEach, describe, expect, it, vi } from 'vitest';

import OrganizationController from '../OrganizationController.js';

const dbGet = vi.fn();
const getMembers = vi.fn();
const addMember = vi.fn();
const updateMemberRole = vi.fn();
const removeMember = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
}));

vi.mock('../../services/organizationService.js', () => ({
  getMembers: (...args: any[]) => getMembers(...args),
  addMember: (...args: any[]) => addMember(...args),
  updateMemberRole: (...args: any[]) => updateMemberRole(...args),
  removeMember: (...args: any[]) => removeMember(...args),
  normalizeOrganizationRole: (role?: string) => {
    const normalized = String(role || '')
      .trim()
      .toUpperCase();
    if (normalized === 'OWNER') return 'OWNER';
    if (normalized === 'ADMIN') return 'ADMIN';
    if (normalized === 'GUEST' || normalized === 'VIEWER') return 'GUEST';
    return 'MEMBER';
  },
}));

function createResponse() {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: any) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('OrganizationController membership safeguards', () => {
  beforeEach(() => {
    dbGet.mockReset();
    getMembers.mockReset();
    addMember.mockReset();
    updateMemberRole.mockReset();
    removeMember.mockReset();
  });

  it('rejects addMember for non-admin actors with explicit denial guidance', async () => {
    getMembers.mockResolvedValue([{ user_id: 'actor-1', role: 'MEMBER' }]);
    const req: any = {
      params: { orgId: 'org-1' },
      body: { targetEmail: 'person@example.com', role: 'MEMBER' },
      user: { id: 'actor-1', role: 'MEMBER' },
    };
    const res = createResponse();

    await OrganizationController.addMember(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.code).toBe('ADMIN_ACCESS_REQUIRED');
    expect(res.body.guidance).toContain('admin access');
    expect(addMember).not.toHaveBeenCalled();
  });

  it('rejects owner promotion by admins', async () => {
    getMembers.mockResolvedValue([
      { user_id: 'actor-1', role: 'ADMIN' },
      { user_id: 'member-1', role: 'MEMBER' },
    ]);
    const req: any = {
      params: { orgId: 'org-1', memberId: 'member-1' },
      body: { role: 'OWNER' },
      user: { id: 'actor-1', role: 'ADMIN' },
    };
    const res = createResponse();

    await OrganizationController.updateMemberRole(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.code).toBe('OWNER_ACTION_REQUIRED');
    expect(updateMemberRole).not.toHaveBeenCalled();
  });

  it('protects the last owner from demotion', async () => {
    getMembers.mockResolvedValue([
      { user_id: 'owner-1', role: 'OWNER' },
      { user_id: 'member-1', role: 'MEMBER' },
    ]);
    const req: any = {
      params: { orgId: 'org-1', memberId: 'owner-1' },
      body: { role: 'ADMIN' },
      user: { id: 'owner-1', role: 'OWNER' },
    };
    const res = createResponse();

    await OrganizationController.updateMemberRole(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body.code).toBe('LAST_OWNER_PROTECTED');
    expect(updateMemberRole).not.toHaveBeenCalled();
  });

  it('rejects self-removal when it would lock out admin access', async () => {
    getMembers.mockResolvedValue([
      { user_id: 'admin-1', role: 'ADMIN' },
      { user_id: 'member-1', role: 'MEMBER' },
    ]);
    const req: any = {
      params: { orgId: 'org-1', memberId: 'admin-1' },
      user: { id: 'admin-1', role: 'ADMIN' },
    };
    const res = createResponse();

    await OrganizationController.removeMember(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body.code).toBe('SELF_LOCKOUT_REJECTED');
    expect(removeMember).not.toHaveBeenCalled();
  });
});
