import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuditLog = vi.fn();
const mockResolveEffectiveAccess = vi.fn();
const mockHasEffectiveCapability = vi.fn();
const mockAddMember = vi.fn();
const mockGetMembers = vi.fn();
const mockRemoveMember = vi.fn();
const mockUpdateMemberRole = vi.fn();
const mockCanAddUser = vi.fn();
const mockAutoAddSeatOnInvite = vi.fn();
const mockUpdateSeatCount = vi.fn();
const mockDbGet = vi.fn();

vi.mock('../../../../server/src/services/AuditEventsService.js', () => ({
  default: { log: (...args: unknown[]) => mockAuditLog(...args) },
}));

vi.mock('../../../../server/src/services/effectiveAccessService.js', () => ({
  resolveEffectiveAccess: (...args: unknown[]) => mockResolveEffectiveAccess(...args),
  hasEffectiveCapability: (...args: unknown[]) => mockHasEffectiveCapability(...args),
}));

vi.mock('../../../../server/src/services/organizationService.js', () => ({
  addMember: (...args: unknown[]) => mockAddMember(...args),
  getMembers: (...args: unknown[]) => mockGetMembers(...args),
  normalizeOrganizationRole: (role: string) => {
    const normalized = String(role || '').toUpperCase();
    if (normalized === 'OWNER' || normalized === 'ADMIN' || normalized === 'GUEST') {
      return normalized;
    }
    return 'MEMBER';
  },
  removeMember: (...args: unknown[]) => mockRemoveMember(...args),
  updateMemberRole: (...args: unknown[]) => mockUpdateMemberRole(...args),
}));

vi.mock('../../../../server/src/services/seatManagementService.js', () => ({
  default: {
    canAddUser: (...args: unknown[]) => mockCanAddUser(...args),
    autoAddSeatOnInvite: (...args: unknown[]) => mockAutoAddSeatOnInvite(...args),
    updateSeatCount: (...args: unknown[]) => mockUpdateSeatCount(...args),
  },
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockDbGet(...args),
}));

describe('orgPeopleIamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveEffectiveAccess.mockResolvedValue({
      capabilities: ['users.invite', 'users.role.change'],
      platformRole: null,
    });
    mockHasEffectiveCapability.mockReturnValue(true);
    mockCanAddUser.mockResolvedValue(true);
    mockAutoAddSeatOnInvite.mockResolvedValue({ autoAdded: false });
    mockUpdateSeatCount.mockResolvedValue({ seatsUsed: 1 });
    mockDbGet.mockResolvedValue({ id: 'target-user' });
    mockAddMember.mockResolvedValue({
      id: 'member-new',
      organizationId: 'org-1',
      userId: 'target-user',
      role: 'USER',
    });
  });

  it('rejects legacy app-level roles on direct add', async () => {
    mockGetMembers.mockResolvedValue([{ user_id: 'actor', role: 'ADMIN' }]);
    const { addOrganizationMemberViaIam } = await import(
      '../../../../server/src/services/orgPeopleIamService.js'
    );

    const outcome = await addOrganizationMemberViaIam({
      organizationId: 'org-1',
      actorUserId: 'actor',
      actorRole: 'ADMIN',
      targetUserId: 'target-user',
      role: 'CONSULTANT',
    });

    expect(outcome).toMatchObject({ ok: false, status: 400, code: 'CANONICAL_ROLE_REQUIRED' });
    expect(mockAddMember).not.toHaveBeenCalled();
  });

  it('requires owner to assign owner role', async () => {
    mockGetMembers.mockResolvedValue([{ user_id: 'actor', role: 'ADMIN' }]);
    const { addOrganizationMemberViaIam } = await import(
      '../../../../server/src/services/orgPeopleIamService.js'
    );

    const outcome = await addOrganizationMemberViaIam({
      organizationId: 'org-1',
      actorUserId: 'actor',
      actorRole: 'ADMIN',
      targetUserId: 'target-user',
      role: 'OWNER',
    });

    expect(outcome).toMatchObject({ ok: false, status: 403, code: 'OWNER_ACTION_REQUIRED' });
    expect(mockAddMember).not.toHaveBeenCalled();
  });

  it('protects the last owner from role downgrade', async () => {
    mockGetMembers.mockResolvedValue([{ user_id: 'owner', role: 'OWNER' }]);
    const { updateOrganizationMemberRoleViaIam } = await import(
      '../../../../server/src/services/orgPeopleIamService.js'
    );

    const outcome = await updateOrganizationMemberRoleViaIam({
      organizationId: 'org-1',
      actorUserId: 'owner',
      actorRole: 'OWNER',
      targetUserId: 'owner',
      role: 'ADMIN',
    });

    expect(outcome).toMatchObject({ ok: false, status: 409, code: 'LAST_OWNER_PROTECTED' });
    expect(mockUpdateMemberRole).not.toHaveBeenCalled();
  });

  it('persists, read-backs and audits successful add with seat policy', async () => {
    mockGetMembers
      .mockResolvedValueOnce([{ user_id: 'actor', role: 'ADMIN' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'member-new', user_id: 'target-user', role: 'USER', status: 'ACTIVE' },
      ]);
    const { addOrganizationMemberViaIam } = await import(
      '../../../../server/src/services/orgPeopleIamService.js'
    );

    const outcome = await addOrganizationMemberViaIam({
      organizationId: 'org-1',
      actorUserId: 'actor',
      actorRole: 'ADMIN',
      targetUserId: 'target-user',
      role: 'USER',
    });

    expect(outcome).toMatchObject({ ok: true, status: 201 });
    expect(mockCanAddUser).toHaveBeenCalledWith('org-1');
    expect(mockAddMember).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', userId: 'target-user', role: 'USER' })
    );
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORG_PEOPLE_ADD',
        organizationId: 'org-1',
        resourceId: 'target-user',
      })
    );
  });
});
