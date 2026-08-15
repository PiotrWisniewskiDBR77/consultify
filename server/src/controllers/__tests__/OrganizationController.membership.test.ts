import { beforeEach, describe, expect, it, vi } from 'vitest';

import OrganizationController from '../OrganizationController.js';

const dbGet = vi.fn();
const getMembers = vi.fn();
const addMember = vi.fn();
const updateMemberRole = vi.fn();
const removeMember = vi.fn();
const logAction = vi.fn();
const addViaIam = vi.fn();
const changeViaIam = vi.fn();
const removeViaIam = vi.fn();

vi.mock('../../services/orgPeopleIamService.js', () => ({
  addOrganizationMemberViaIam: (...args: any[]) => addViaIam(...args),
  changeOrganizationMemberRoleViaIam: (...args: any[]) => changeViaIam(...args),
  removeOrganizationMemberViaIam: (...args: any[]) => removeViaIam(...args),
}));

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
    logAction.mockReset();
    logAction.mockResolvedValue({ id: 'audit-1' });
    addViaIam.mockReset().mockResolvedValue({ denied: false });
    changeViaIam.mockReset().mockResolvedValue({ denied: false });
    removeViaIam.mockReset().mockResolvedValue({ denied: false });
  });

  it('rejects addMember for non-admin actors with explicit denial guidance', async () => {
    addViaIam.mockResolvedValue({
      denied: true,
      code: 'CAPABILITY_REQUIRED',
      message: 'Capability users.invite or admin.people.manage required',
    });
    getMembers.mockResolvedValue([{ user_id: 'actor-1', role: 'MEMBER' }]);
    const req: any = {
      params: { orgId: 'org-1' },
      body: { targetEmail: 'person@example.com', role: 'MEMBER' },
      user: { id: 'actor-1', role: 'MEMBER' },
    };
    const res = createResponse();

    await OrganizationController.addMember(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.code).toBe('CAPABILITY_REQUIRED');
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
    updateMemberRole.mockResolvedValue({ success: true });
    const req: any = {
      params: { orgId: 'org-1', memberId: 'member-1' },
      body: { role: 'ADMIN' },
      user: { id: 'admin-1', role: 'ADMIN' },
    };
    const res = createResponse();

    await OrganizationController.updateMemberRole(req, res, vi.fn());

    expect(updateMemberRole).toHaveBeenCalled();
    expect(logAction).toHaveBeenCalledTimes(1);
    const auditArg = logAction.mock.calls[0][0];
    expect(auditArg.actionType).toBe('update_member_role');
    expect(auditArg.adminId).toBe('admin-1');
    expect(auditArg.details).toMatchObject({
      orgId: 'org-1',
      targetUserId: 'member-1',
      fromRole: 'MEMBER',
      toRole: 'ADMIN',
      isSensitive: true,
    });
  });

  it('emits an audit event on a successful member removal (ADM-RAW-P1-004)', async () => {
    getMembers.mockResolvedValue([
      { user_id: 'admin-1', role: 'ADMIN' },
      { user_id: 'member-1', role: 'MEMBER' },
    ]);
    removeMember.mockResolvedValue({ success: true });
    const req: any = {
      params: { orgId: 'org-1', memberId: 'member-1' },
      user: { id: 'admin-1', role: 'ADMIN' },
    };
    const res = createResponse();

    await OrganizationController.removeMember(req, res, vi.fn());

    expect(removeMember).toHaveBeenCalled();
    expect(logAction).toHaveBeenCalledTimes(1);
    const auditArg = logAction.mock.calls[0][0];
    expect(auditArg.actionType).toBe('remove_member');
    expect(auditArg.adminId).toBe('admin-1');
    expect(auditArg.details).toMatchObject({
      orgId: 'org-1',
      targetUserId: 'member-1',
      targetRole: 'MEMBER',
      isSensitive: true,
    });
  });
});
