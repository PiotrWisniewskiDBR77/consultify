/**
 * orgPeopleIamService — unit tests
 *
 * Tests are written against the service's exported API functions, using mocks
 * for effectiveAccessService and DbPromise so no DB is required.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks (must be declared before service import) ───────────────────────

const mockResolveEffectiveAccess = vi.fn();
const mockHasEffectiveCapability = vi.fn();

vi.mock('../../../../server/src/services/effectiveAccessService.ts', () => ({
  resolveEffectiveAccess: (...args: unknown[]) => mockResolveEffectiveAccess(...args),
  hasEffectiveCapability: (...args: unknown[]) => mockHasEffectiveCapability(...args),
}));

const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockDbRun = vi.fn().mockResolvedValue({ changes: 1 });

vi.mock('../../../../server/src/utils/DbPromise.ts', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

import {
  addOrganizationMemberViaIam,
  changeOrganizationMemberRoleViaIam,
  removeOrganizationMemberViaIam,
} from '../../../../server/src/services/orgPeopleIamService.ts';

// ─── Shared test fixtures ─────────────────────────────────────────────────

const ORG_ID = 'org-test-001';
const ACTOR_ID = 'actor-001';
const MEMBER_ID = 'member-001';
const OWNER_ID = 'owner-001';

function mockAccess(canPeopleManage = true, applicationRole = 'ADMIN') {
  mockResolveEffectiveAccess.mockResolvedValue({ applicationRole, capabilities: [] });
  mockHasEffectiveCapability.mockImplementation((_access: unknown, cap: string) => {
    if (cap === 'admin.people.manage') return canPeopleManage;
    if (cap === 'users.invite') return canPeopleManage;
    return false;
  });
}

function mockMembers(members: Array<{ user_id: string; role: string }>) {
  mockDbAll.mockResolvedValue(members);
}

// ─────────────────────────────────────────────────────────────────────────────
// addOrganizationMemberViaIam
// ─────────────────────────────────────────────────────────────────────────────

describe('addOrganizationMemberViaIam', () => {
  beforeEach(() => {
    mockResolveEffectiveAccess.mockReset();
    mockHasEffectiveCapability.mockReset();
    mockDbAll.mockReset();
    mockDbGet.mockReset();
    mockDbRun.mockReset().mockResolvedValue({ changes: 1 });
  });

  it('allows admin actor with admin.people.manage', async () => {
    mockAccess(true);
    mockMembers([]);

    const result = await addOrganizationMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'ADMIN',
      organizationId: ORG_ID,
      targetEmail: 'user@example.com',
      role: 'USER',
    });

    expect(result.denied).toBe(false);
  });

  it('denies actor without admin.people.manage or users.invite', async () => {
    mockAccess(false);
    mockMembers([]);

    const result = await addOrganizationMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'USER',
      organizationId: ORG_ID,
      targetEmail: 'user@example.com',
      role: 'USER',
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('CAPABILITY_REQUIRED');
  });

  it('denies SUPERADMIN role assignment via member flow', async () => {
    mockAccess(true);
    mockMembers([]);

    const result = await addOrganizationMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'OWNER',
      organizationId: ORG_ID,
      targetEmail: 'bad@example.com',
      role: 'SUPERADMIN',
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('SUPERADMIN_CAPABILITY_DENIED');
  });

  it('denies when seat limit is reached', async () => {
    const originalLimit = process.env.ORG_SEAT_LIMIT;
    process.env.ORG_SEAT_LIMIT = '2';
    mockAccess(true);
    mockMembers([
      { user_id: 'u1', role: 'MEMBER' },
      { user_id: 'u2', role: 'MEMBER' },
    ]);

    const result = await addOrganizationMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'OWNER',
      organizationId: ORG_ID,
      targetEmail: 'new@example.com',
      role: 'USER',
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('SEAT_LIMIT_REACHED');
    process.env.ORG_SEAT_LIMIT = originalLimit;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// changeOrganizationMemberRoleViaIam
// ─────────────────────────────────────────────────────────────────────────────

describe('changeOrganizationMemberRoleViaIam', () => {
  beforeEach(() => {
    mockResolveEffectiveAccess.mockReset();
    mockHasEffectiveCapability.mockReset();
    mockDbAll.mockReset();
    mockDbGet.mockReset();
    mockDbRun.mockReset().mockResolvedValue({ changes: 1 });
  });

  it('allows OWNER to change member role', async () => {
    mockResolveEffectiveAccess.mockResolvedValue({ applicationRole: 'OWNER', capabilities: [] });
    mockHasEffectiveCapability.mockReturnValue(true);
    mockMembers([
      { user_id: ACTOR_ID, role: 'OWNER' },
      { user_id: MEMBER_ID, role: 'USER' },
      { user_id: OWNER_ID, role: 'OWNER' },
    ]);

    const result = await changeOrganizationMemberRoleViaIam({
      actorId: ACTOR_ID,
      actorRole: 'OWNER',
      organizationId: ORG_ID,
      targetMemberId: MEMBER_ID,
      newRole: 'ADMIN',
    });

    expect(result.denied).toBe(false);
  });

  it('denies when admin.people.manage is missing', async () => {
    mockAccess(false);
    mockMembers([]);

    const result = await changeOrganizationMemberRoleViaIam({
      actorId: ACTOR_ID,
      actorRole: 'USER',
      organizationId: ORG_ID,
      targetMemberId: MEMBER_ID,
      newRole: 'ADMIN',
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('CAPABILITY_REQUIRED');
  });

  it('rejects ADMIN promoting to OWNER (owner-only action)', async () => {
    mockResolveEffectiveAccess.mockResolvedValue({ applicationRole: 'ADMIN', capabilities: [] });
    mockHasEffectiveCapability.mockReturnValue(true);
    mockMembers([
      { user_id: ACTOR_ID, role: 'ADMIN' },
      { user_id: MEMBER_ID, role: 'USER' },
    ]);

    const result = await changeOrganizationMemberRoleViaIam({
      actorId: ACTOR_ID,
      actorRole: 'ADMIN',
      organizationId: ORG_ID,
      targetMemberId: MEMBER_ID,
      newRole: 'OWNER',
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('OWNER_ACTION_REQUIRED');
  });

  it('rejects demotion of the last OWNER', async () => {
    mockResolveEffectiveAccess.mockResolvedValue({ applicationRole: 'OWNER', capabilities: [] });
    mockHasEffectiveCapability.mockReturnValue(true);
    mockMembers([
      { user_id: OWNER_ID, role: 'OWNER' }, // only owner
      { user_id: 'member-2', role: 'MEMBER' },
    ]);

    const result = await changeOrganizationMemberRoleViaIam({
      actorId: OWNER_ID,
      actorRole: 'OWNER',
      organizationId: ORG_ID,
      targetMemberId: OWNER_ID,
      newRole: 'ADMIN',
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('LAST_OWNER_PROTECTED');
  });

  it('allows demotion of an OWNER when another OWNER exists', async () => {
    mockResolveEffectiveAccess.mockResolvedValue({ applicationRole: 'OWNER', capabilities: [] });
    mockHasEffectiveCapability.mockReturnValue(true);
    mockMembers([
      { user_id: OWNER_ID, role: 'OWNER' },
      { user_id: 'owner-2', role: 'OWNER' },
    ]);

    const result = await changeOrganizationMemberRoleViaIam({
      actorId: OWNER_ID,
      actorRole: 'OWNER',
      organizationId: ORG_ID,
      targetMemberId: OWNER_ID,
      newRole: 'ADMIN',
    });

    expect(result.denied).toBe(false);
  });

  it('fails closed when the role-change audit cannot be persisted', async () => {
    mockResolveEffectiveAccess.mockResolvedValue({ applicationRole: 'OWNER', capabilities: [] });
    mockHasEffectiveCapability.mockReturnValue(true);
    mockMembers([
      { user_id: ACTOR_ID, role: 'OWNER' },
      { user_id: MEMBER_ID, role: 'MEMBER' },
    ]);
    mockDbRun.mockResolvedValue({ changes: 0 });

    await expect(
      changeOrganizationMemberRoleViaIam({
        actorId: ACTOR_ID,
        actorRole: 'OWNER',
        organizationId: ORG_ID,
        targetMemberId: MEMBER_ID,
        newRole: 'ADMIN',
      })
    ).rejects.toThrow('IAM audit event was not persisted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// removeOrganizationMemberViaIam
// ─────────────────────────────────────────────────────────────────────────────

describe('removeOrganizationMemberViaIam', () => {
  beforeEach(() => {
    mockResolveEffectiveAccess.mockReset();
    mockHasEffectiveCapability.mockReset();
    mockDbAll.mockReset();
    mockDbGet.mockReset();
    mockDbRun.mockReset().mockResolvedValue({ changes: 1 });
  });

  it('allows removal of a regular member', async () => {
    mockResolveEffectiveAccess.mockResolvedValue({ applicationRole: 'ADMIN', capabilities: [] });
    mockHasEffectiveCapability.mockReturnValue(true);
    mockMembers([
      { user_id: ACTOR_ID, role: 'ADMIN' },
      { user_id: MEMBER_ID, role: 'USER' },
      { user_id: OWNER_ID, role: 'OWNER' },
    ]);

    const result = await removeOrganizationMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'ADMIN',
      organizationId: ORG_ID,
      targetMemberId: MEMBER_ID,
    });

    expect(result.denied).toBe(false);
  });

  it('denies removal without admin.people.manage', async () => {
    mockAccess(false);
    mockMembers([]);

    const result = await removeOrganizationMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'USER',
      organizationId: ORG_ID,
      targetMemberId: MEMBER_ID,
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('CAPABILITY_REQUIRED');
  });

  it('protects the last OWNER from removal', async () => {
    mockResolveEffectiveAccess.mockResolvedValue({ applicationRole: 'OWNER', capabilities: [] });
    mockHasEffectiveCapability.mockReturnValue(true);
    mockMembers([
      { user_id: OWNER_ID, role: 'OWNER' }, // only owner
    ]);

    const result = await removeOrganizationMemberViaIam({
      actorId: OWNER_ID,
      actorRole: 'OWNER',
      organizationId: ORG_ID,
      targetMemberId: OWNER_ID,
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('LAST_OWNER_PROTECTED');
  });

  it('rejects self-removal when it would leave no admin', async () => {
    mockResolveEffectiveAccess.mockResolvedValue({ applicationRole: 'ADMIN', capabilities: [] });
    mockHasEffectiveCapability.mockReturnValue(true);
    mockMembers([
      { user_id: ACTOR_ID, role: 'ADMIN' }, // only admin
      { user_id: 'member-99', role: 'USER' },
    ]);

    const result = await removeOrganizationMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'ADMIN',
      organizationId: ORG_ID,
      targetMemberId: ACTOR_ID,
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('SELF_LOCKOUT_REJECTED');
  });

  it('allows self-removal when another admin exists', async () => {
    mockResolveEffectiveAccess.mockResolvedValue({ applicationRole: 'ADMIN', capabilities: [] });
    mockHasEffectiveCapability.mockReturnValue(true);
    mockMembers([
      { user_id: ACTOR_ID, role: 'ADMIN' },
      { user_id: 'other-admin', role: 'ADMIN' },
      { user_id: OWNER_ID, role: 'OWNER' },
    ]);

    const result = await removeOrganizationMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'ADMIN',
      organizationId: ORG_ID,
      targetMemberId: ACTOR_ID,
    });

    expect(result.denied).toBe(false);
  });
});
