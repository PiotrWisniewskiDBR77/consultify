import { beforeEach, describe, expect, it, vi } from 'vitest';

import OrganizationController from '../OrganizationController.js';

const dbGet = vi.fn();
const getMembers = vi.fn();
const getActiveMembers = vi.fn();
const addMember = vi.fn();
const updateMemberRole = vi.fn();
const removeMember = vi.fn();
const logAction = vi.fn();
const changeOrganizationMemberRoleAtomicallyViaIam = vi.fn();
const removeOrganizationMemberAtomicallyViaIam = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
}));

vi.mock('../../services/adminAuditService.js', () => ({
  default: {
    logAction: (...args: any[]) => logAction(...args),
  },
}));

vi.mock('../../services/organizationService.js', () => ({
  getMembers: (...args: any[]) => getMembers(...args),
  getActiveMembers: (...args: any[]) => getActiveMembers(...args),
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

vi.mock('../../services/orgPeopleIamService.js', () => ({
  changeOrganizationMemberRoleAtomicallyViaIam: (...args: any[]) =>
    changeOrganizationMemberRoleAtomicallyViaIam(...args),
  removeOrganizationMemberAtomicallyViaIam: (...args: any[]) =>
    removeOrganizationMemberAtomicallyViaIam(...args),
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
    getActiveMembers.mockReset();
    addMember.mockReset();
    updateMemberRole.mockReset();
    removeMember.mockReset();
    logAction.mockReset();
    changeOrganizationMemberRoleAtomicallyViaIam.mockReset();
    removeOrganizationMemberAtomicallyViaIam.mockReset();
    changeOrganizationMemberRoleAtomicallyViaIam.mockResolvedValue({ denied: false });
    removeOrganizationMemberAtomicallyViaIam.mockResolvedValue({ denied: false });
    logAction.mockResolvedValue({ id: 'audit-1' });
  });

  it('lists only active members and denies when the actor has no active tenant edge', async () => {
    getActiveMembers.mockResolvedValue([
      { user_id: 'active-owner', role: 'OWNER', status: 'ACTIVE' },
    ]);
    const req: any = {
      params: { orgId: 'org-1' },
      user: { id: 'revoked-admin', role: 'ADMIN', organizationId: 'org-1' },
    };
    const res = createResponse();

    await OrganizationController.getMembers(req, res, vi.fn());

    expect(getActiveMembers).toHaveBeenCalledWith('org-1');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.code).toBe('ORG_MEMBERSHIP_REQUIRED');
  });

  it('returns only id, displayName, and avatar to an active MEMBER in the current organization', async () => {
    getActiveMembers.mockResolvedValue([
      {
        id: 'membership-1',
        user_id: 'member-1',
        role: 'MEMBER',
        status: 'ACTIVE',
        first_name: 'Maria',
        last_name: 'Member',
        email: 'maria@example.com',
        avatar_url: 'https://cdn.invalid/maria.png',
      },
      {
        id: 'membership-2',
        user_id: 'owner-1',
        role: 'OWNER',
        status: 'ACTIVE',
        first_name: 'Olivia',
        last_name: 'Owner',
        email: 'olivia@example.com',
      },
    ]);
    const req: any = {
      params: { orgId: 'org-1' },
      userRole: 'OWNER',
      user: { id: 'member-1', role: 'OWNER', organizationId: 'org-1' },
    };
    const res = createResponse();

    await OrganizationController.getMembers(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      {
        id: 'member-1',
        displayName: 'Maria Member',
        avatar: 'https://cdn.invalid/maria.png',
      },
      { id: 'owner-1', displayName: 'Olivia Owner', avatar: null },
    ]);
    expect(JSON.stringify(res.body)).not.toContain('email');
    expect(JSON.stringify(res.body)).not.toContain('role');
  });

  it('uses the current active OWNER membership for the full response despite a stale MEMBER token', async () => {
    const fullRows = [
      {
        id: 'membership-owner',
        user_id: 'owner-1',
        role: 'OWNER',
        status: 'ACTIVE',
        first_name: 'Olivia',
        last_name: 'Owner',
        email: 'olivia@example.com',
        avatar_url: 'https://cdn.invalid/private-owner-avatar.png',
      },
    ];
    getActiveMembers.mockResolvedValue(fullRows);
    const req: any = {
      params: { orgId: 'org-1' },
      userRole: 'MEMBER',
      user: { id: 'owner-1', role: 'MEMBER', organizationId: 'org-1' },
    };
    const res = createResponse();

    await OrganizationController.getMembers(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      {
        id: 'membership-owner',
        user_id: 'owner-1',
        role: 'OWNER',
        status: 'ACTIVE',
        first_name: 'Olivia',
        last_name: 'Owner',
        email: 'olivia@example.com',
      },
    ]);
  });

  it('denies a MEMBER that requests a foreign organization even if a foreign row is returned', async () => {
    getActiveMembers.mockResolvedValue([
      { user_id: 'member-1', role: 'MEMBER', status: 'ACTIVE', first_name: 'Forged' },
    ]);
    const req: any = {
      params: { orgId: 'org-b' },
      userRole: 'MEMBER',
      user: { id: 'member-1', role: 'MEMBER', organizationId: 'org-a' },
    };
    const res = createResponse();

    await OrganizationController.getMembers(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REQUIRED' });
    expect(getActiveMembers).not.toHaveBeenCalled();
  });

  it('keeps the full directory response unchanged for SUPERADMIN', async () => {
    const fullRows = [
      {
        id: 'membership-1',
        user_id: 'member-1',
        role: 'MEMBER',
        status: 'ACTIVE',
        first_name: 'Maria',
        last_name: 'Member',
        email: 'maria@example.com',
        avatar_url: 'https://cdn.invalid/private-admin-shape.png',
      },
    ];
    getActiveMembers.mockResolvedValue(fullRows);
    const req: any = {
      params: { orgId: 'org-b' },
      userRole: 'SUPERADMIN',
      user: { id: 'superadmin-1', role: 'SUPERADMIN', organizationId: 'org-a' },
    };
    const res = createResponse();

    await OrganizationController.getMembers(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      {
        id: 'membership-1',
        user_id: 'member-1',
        role: 'MEMBER',
        status: 'ACTIVE',
        first_name: 'Maria',
        last_name: 'Member',
        email: 'maria@example.com',
      },
    ]);
    expect(fullRows[0].avatar_url).toBe('https://cdn.invalid/private-admin-shape.png');
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

  it('emits an audit event on a successful member role change (ADM-RAW-P1-004)', async () => {
    getMembers.mockResolvedValue([
      { user_id: 'admin-1', role: 'ADMIN' },
      { user_id: 'member-1', role: 'MEMBER' },
    ]);
    const req: any = {
      params: { orgId: 'org-1', memberId: 'member-1' },
      body: { role: 'ADMIN' },
      user: { id: 'admin-1', role: 'ADMIN' },
    };
    const res = createResponse();

    await OrganizationController.updateMemberRole(req, res, vi.fn());

    expect(changeOrganizationMemberRoleAtomicallyViaIam).toHaveBeenCalledWith({
      actorId: 'admin-1',
      actorRole: 'ADMIN',
      organizationId: 'org-1',
      targetMemberId: 'member-1',
      newRole: 'ADMIN',
    });
    expect(updateMemberRole).not.toHaveBeenCalled();
    expect(logAction).not.toHaveBeenCalled();
  });

  it('emits an audit event on a successful member removal (ADM-RAW-P1-004)', async () => {
    getMembers.mockResolvedValue([
      { user_id: 'admin-1', role: 'ADMIN' },
      { user_id: 'member-1', role: 'MEMBER' },
    ]);
    const req: any = {
      params: { orgId: 'org-1', memberId: 'member-1' },
      user: { id: 'admin-1', role: 'ADMIN' },
    };
    const res = createResponse();

    await OrganizationController.removeMember(req, res, vi.fn());

    expect(removeOrganizationMemberAtomicallyViaIam).toHaveBeenCalledWith({
      actorId: 'admin-1',
      actorRole: 'ADMIN',
      organizationId: 'org-1',
      targetMemberId: 'member-1',
    });
    expect(removeMember).not.toHaveBeenCalled();
    expect(logAction).not.toHaveBeenCalled();
  });
});
