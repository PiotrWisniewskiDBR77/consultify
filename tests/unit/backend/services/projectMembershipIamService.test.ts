/**
 * projectMembershipIamService — unit tests
 *
 * Tests are written against the service's exported API functions using mocks
 * for effectiveAccessService, roleNormalization and DbPromise.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockResolveEffectiveAccess = vi.fn();
const mockHasEffectiveCapability = vi.fn();

vi.mock('../../../../server/src/services/effectiveAccessService.ts', () => ({
  resolveEffectiveAccess: (...args: unknown[]) => mockResolveEffectiveAccess(...args),
  hasEffectiveCapability: (...args: unknown[]) => mockHasEffectiveCapability(...args),
}));

const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockDbRun = vi.fn().mockResolvedValue({ success: true });

vi.mock('../../../../server/src/utils/DbPromise.ts', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

import {
  addProjectMemberViaIam,
  removeProjectMemberViaIam,
} from '../../../../server/src/services/projectMembershipIamService.ts';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const ORG_ID = 'org-001';
const PROJECT_ID = 'proj-001';
const ACTOR_ID = 'actor-001';
const TARGET_ID = 'target-001';

function mockProjectExists() {
  mockDbGet.mockResolvedValue({ id: PROJECT_ID });
}

function mockProjectNotFound() {
  mockDbGet.mockResolvedValue(null);
}

function mockCanManage(value = true) {
  mockResolveEffectiveAccess.mockResolvedValue({ applicationRole: 'ADMIN', capabilities: [] });
  mockHasEffectiveCapability.mockImplementation((_a: unknown, cap: string) => {
    if (cap === 'project.team.manage') return value;
    if (cap === 'admin.people.manage') return value;
    return false;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// addProjectMemberViaIam
// ─────────────────────────────────────────────────────────────────────────────

describe('addProjectMemberViaIam', () => {
  beforeEach(() => {
    mockResolveEffectiveAccess.mockReset();
    mockHasEffectiveCapability.mockReset();
    mockDbAll.mockReset();
    mockDbGet.mockReset();
    mockDbRun.mockReset().mockResolvedValue({ success: true });
  });

  it('allows adding a PROJECT_LEADER when actor has project.team.manage', async () => {
    mockProjectExists();
    mockCanManage(true);

    const result = await addProjectMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'ADMIN',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      targetUserId: TARGET_ID,
      projectRole: 'PROJECT_LEADER',
    });

    expect(result.denied).toBe(false);
    if (!result.denied) expect(result.normalizedRole).toBe('PROJECT_LEADER');
  });

  it('allows adding a PROJECT_SPONSOR', async () => {
    mockProjectExists();
    mockCanManage(true);

    const result = await addProjectMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'OWNER',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      targetUserId: TARGET_ID,
      projectRole: 'PROJECT_SPONSOR',
    });

    expect(result.denied).toBe(false);
    if (!result.denied) expect(result.normalizedRole).toBe('PROJECT_SPONSOR');
  });

  it('normalises legacy alias to canonical role (PROJECT_EXECUTIVE → PROJECT_SPONSOR)', async () => {
    mockProjectExists();
    mockCanManage(true);

    const result = await addProjectMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'OWNER',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      targetUserId: TARGET_ID,
      projectRole: 'PROJECT_EXECUTIVE',
    });

    expect(result.denied).toBe(false);
    if (!result.denied) expect(result.normalizedRole).toBe('PROJECT_SPONSOR');
  });

  it('denies when project does not belong to the organisation', async () => {
    mockProjectNotFound();
    mockCanManage(true);

    const result = await addProjectMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'ADMIN',
      organizationId: ORG_ID,
      projectId: 'wrong-proj',
      targetUserId: TARGET_ID,
      projectRole: 'PROJECT_LEADER',
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('PROJECT_NOT_IN_ORG');
  });

  it('denies when actor lacks project.team.manage and admin.people.manage', async () => {
    mockProjectExists();
    mockCanManage(false);

    const result = await addProjectMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'GUEST',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      targetUserId: TARGET_ID,
      projectRole: 'OBSERVER',
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('CAPABILITY_REQUIRED');
  });

  it('denies invalid/unknown role string', async () => {
    mockProjectExists();
    mockCanManage(true);

    const result = await addProjectMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'ADMIN',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      targetUserId: TARGET_ID,
      projectRole: 'MADE_UP_ROLE_XYZ',
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('INVALID_PROJECT_ROLE');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// removeProjectMemberViaIam
// ─────────────────────────────────────────────────────────────────────────────

describe('removeProjectMemberViaIam', () => {
  beforeEach(() => {
    mockResolveEffectiveAccess.mockReset();
    mockHasEffectiveCapability.mockReset();
    mockDbAll.mockReset();
    mockDbGet.mockReset();
    mockDbRun.mockReset().mockResolvedValue({ success: true });
  });

  it('allows removing a regular TASK_ASSIGNEE', async () => {
    mockProjectExists();
    mockCanManage(true);
    mockDbAll.mockResolvedValue([
      { user_id: TARGET_ID, role: 'TASK_ASSIGNEE', normalized_project_role: 'TASK_ASSIGNEE' },
      { user_id: 'sponsor-1', role: 'PROJECT_SPONSOR', normalized_project_role: 'PROJECT_SPONSOR' },
      { user_id: 'leader-1', role: 'PROJECT_LEADER', normalized_project_role: 'PROJECT_LEADER' },
    ]);

    const result = await removeProjectMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'ADMIN',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      targetMemberId: TARGET_ID,
    });

    expect(result.denied).toBe(false);
  });

  it('denies removal when project not found in org', async () => {
    mockProjectNotFound();
    mockCanManage(true);

    const result = await removeProjectMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'ADMIN',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      targetMemberId: TARGET_ID,
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('PROJECT_NOT_IN_ORG');
  });

  it('denies when actor lacks capability', async () => {
    mockProjectExists();
    mockCanManage(false);
    mockDbAll.mockResolvedValue([]);

    const result = await removeProjectMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'GUEST',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      targetMemberId: TARGET_ID,
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('CAPABILITY_REQUIRED');
  });

  it('denies removal of member not in project', async () => {
    mockProjectExists();
    mockCanManage(true);
    mockDbAll.mockResolvedValue([
      { user_id: 'someone-else', role: 'OBSERVER', normalized_project_role: 'OBSERVER' },
    ]);

    const result = await removeProjectMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'ADMIN',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      targetMemberId: TARGET_ID,
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('MEMBER_NOT_FOUND');
  });

  it('protects last PROJECT_SPONSOR from removal', async () => {
    mockProjectExists();
    mockCanManage(true);
    mockDbAll.mockResolvedValue([
      { user_id: TARGET_ID, role: 'PROJECT_SPONSOR', normalized_project_role: 'PROJECT_SPONSOR' },
      { user_id: 'leader-1', role: 'PROJECT_LEADER', normalized_project_role: 'PROJECT_LEADER' },
    ]);

    const result = await removeProjectMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'ADMIN',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      targetMemberId: TARGET_ID,
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('LAST_SPONSOR_PROTECTED');
  });

  it('protects last PROJECT_LEADER from removal', async () => {
    mockProjectExists();
    mockCanManage(true);
    mockDbAll.mockResolvedValue([
      { user_id: 'sponsor-1', role: 'PROJECT_SPONSOR', normalized_project_role: 'PROJECT_SPONSOR' },
      { user_id: TARGET_ID, role: 'PROJECT_LEADER', normalized_project_role: 'PROJECT_LEADER' },
    ]);

    const result = await removeProjectMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'ADMIN',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      targetMemberId: TARGET_ID,
    });

    expect(result.denied).toBe(true);
    if (result.denied) expect(result.code).toBe('LAST_LEADER_PROTECTED');
  });

  it('allows removal of a PROJECT_SPONSOR when another sponsor exists', async () => {
    mockProjectExists();
    mockCanManage(true);
    mockDbAll.mockResolvedValue([
      { user_id: TARGET_ID, role: 'PROJECT_SPONSOR', normalized_project_role: 'PROJECT_SPONSOR' },
      { user_id: 'sponsor-2', role: 'PROJECT_SPONSOR', normalized_project_role: 'PROJECT_SPONSOR' },
      { user_id: 'leader-1', role: 'PROJECT_LEADER', normalized_project_role: 'PROJECT_LEADER' },
    ]);

    const result = await removeProjectMemberViaIam({
      actorId: ACTOR_ID,
      actorRole: 'ADMIN',
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      targetMemberId: TARGET_ID,
    });

    expect(result.denied).toBe(false);
  });
});
