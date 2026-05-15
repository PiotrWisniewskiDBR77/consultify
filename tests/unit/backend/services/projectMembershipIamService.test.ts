import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuditLog = vi.fn();
const mockEnsureSchema = vi.fn();
const mockSeedTemplates = vi.fn();
const mockResolveEffectiveAccess = vi.fn();
const mockHasEffectiveCapability = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();
const mockDbRun = vi.fn();

vi.mock('uuid', () => ({ v4: () => 'member-id' }));

vi.mock('../../../../server/src/services/AuditEventsService.js', () => ({
  default: { log: (...args: unknown[]) => mockAuditLog(...args) },
}));

vi.mock('../../../../server/src/services/effectiveAccessService.js', () => ({
  ensureProjectRoleTemplateSchema: (...args: unknown[]) => mockEnsureSchema(...args),
  seedFactoryRoleTemplates: (...args: unknown[]) => mockSeedTemplates(...args),
  resolveEffectiveAccess: (...args: unknown[]) => mockResolveEffectiveAccess(...args),
  hasEffectiveCapability: (...args: unknown[]) => mockHasEffectiveCapability(...args),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

describe('projectMembershipIamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureSchema.mockResolvedValue(undefined);
    mockSeedTemplates.mockResolvedValue(undefined);
    mockResolveEffectiveAccess.mockResolvedValue({
      capabilities: ['project.team.manage', 'project.roles.assign'],
      platformRole: null,
    });
    mockHasEffectiveCapability.mockReturnValue(true);
    mockDbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  it('adds project member with canonical role and role template', async () => {
    mockDbGet
      .mockResolvedValueOnce({ id: 'project-1' })
      .mockResolvedValueOnce({ id: 'target-user' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'tpl-leader' })
      .mockResolvedValueOnce({
        id: 'member-id',
        project_id: 'project-1',
        user_id: 'target-user',
        normalized_project_role: 'PROJECT_LEADER',
        role_template_id: 'tpl-leader',
      });
    const { addProjectMemberViaIam } = await import(
      '../../../../server/src/services/projectMembershipIamService.js'
    );

    const outcome = await addProjectMemberViaIam({
      organizationId: 'org-1',
      actorUserId: 'actor',
      actorRole: 'ADMIN',
      projectId: 'project-1',
      userId: 'target-user',
      role: 'PROJECT_MANAGER',
    });

    expect(outcome).toMatchObject({ ok: true, status: 201 });
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO project_members'),
      expect.arrayContaining(['PROJECT_LEADER', 'tpl-leader']),
      { fallback: false }
    );
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROJECT_MEMBER_ADDED', organizationId: 'org-1' })
    );
  });

  it('protects the last required project role from removal', async () => {
    mockDbGet
      .mockResolvedValueOnce({ id: 'project-1' })
      .mockResolvedValueOnce({
        id: 'member-1',
        project_id: 'project-1',
        user_id: 'leader',
        normalized_project_role: 'PROJECT_LEADER',
      })
      .mockResolvedValueOnce({ total: 1 });
    const { removeProjectMemberViaIam } = await import(
      '../../../../server/src/services/projectMembershipIamService.js'
    );

    const outcome = await removeProjectMemberViaIam({
      organizationId: 'org-1',
      actorUserId: 'actor',
      actorRole: 'ADMIN',
      projectId: 'project-1',
      memberId: 'member-1',
    });

    expect(outcome).toMatchObject({
      ok: false,
      status: 409,
      code: 'LAST_REQUIRED_PROJECT_ROLE_PROTECTED',
    });
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('rejects project writes outside actor organization', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const { addProjectMemberViaIam } = await import(
      '../../../../server/src/services/projectMembershipIamService.js'
    );

    const outcome = await addProjectMemberViaIam({
      organizationId: 'org-1',
      actorUserId: 'actor',
      actorRole: 'ADMIN',
      projectId: 'foreign-project',
      userId: 'target-user',
      role: 'TASK_ASSIGNEE',
    });

    expect(outcome).toMatchObject({ ok: false, status: 404, code: 'PROJECT_NOT_FOUND' });
    expect(mockDbRun).not.toHaveBeenCalled();
  });
});
