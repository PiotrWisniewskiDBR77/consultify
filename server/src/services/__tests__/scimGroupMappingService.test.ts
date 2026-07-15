import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();
const hasColumn = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../utils/dbSchema.js', () => ({
  hasColumn: (...args: any[]) => hasColumn(...args),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('uuid', () => ({ v4: () => 'mapping-uuid' }));

import {
  insertScimGroupMapping,
  listScimGroupMappings,
  resolveScimGroupGrant,
  ScimGroupMappingError,
} from '../scimGroupMappingService.js';

beforeEach(() => {
  dbAll.mockReset();
  dbGet.mockReset();
  dbRun.mockReset();
  hasColumn.mockReset();
  dbRun.mockResolvedValue({ success: true, changes: 1 });
});

describe('resolveScimGroupGrant', () => {
  it('prefers a project-specific mapping over the org-wide one', async () => {
    hasColumn.mockResolvedValue(true);
    // 1st lookup: project-specific hit
    dbGet.mockResolvedValueOnce({ id: 'm-proj', internal_role: 'PROJECT_LEADER' });

    const grant = await resolveScimGroupGrant('org-1', 'grp-1', 'proj-A');

    expect(grant).toEqual({
      mappingId: 'm-proj',
      internalRole: 'PROJECT_LEADER',
      projectId: 'proj-A',
      scope: 'project',
    });
    // Project-specific query carried the org + group + project, in that order.
    const [sql, params] = dbGet.mock.calls[0];
    expect(sql).toContain('project_id = ?');
    expect(params).toEqual(['org-1', 'grp-1', 'proj-A']);
    // Org-wide fallback query was never needed.
    expect(dbGet).toHaveBeenCalledTimes(1);
  });

  it('falls back to the org-wide mapping when no project-specific mapping exists', async () => {
    hasColumn.mockResolvedValue(true);
    dbGet
      .mockResolvedValueOnce(null) // no project-specific
      .mockResolvedValueOnce({ id: 'm-org', internal_role: 'member' }); // org-wide

    const grant = await resolveScimGroupGrant('org-1', 'grp-1', 'proj-A');

    expect(grant).toEqual({
      mappingId: 'm-org',
      internalRole: 'member',
      projectId: null,
      scope: 'org-wide',
    });
    const [orgWideSql, orgWideParams] = dbGet.mock.calls[1];
    expect(orgWideSql).toContain('project_id IS NULL');
    expect(orgWideParams).toEqual(['org-1', 'grp-1']);
  });

  it('resolves org-wide (no project predicate) when the column is not migrated', async () => {
    hasColumn.mockResolvedValue(false);
    dbGet.mockResolvedValueOnce({ id: 'm-org', internal_role: 'admin' });

    const grant = await resolveScimGroupGrant('org-1', 'grp-1', 'proj-A');

    expect(grant?.scope).toBe('org-wide');
    // Only one query, and it must NOT reference project_id at all.
    expect(dbGet).toHaveBeenCalledTimes(1);
    const [sql, params] = dbGet.mock.calls[0];
    expect(sql).not.toContain('project_id');
    expect(params).toEqual(['org-1', 'grp-1']);
  });

  it('returns null when neither org nor group is provided', async () => {
    expect(await resolveScimGroupGrant('', 'grp-1')).toBeNull();
    expect(await resolveScimGroupGrant('org-1', '')).toBeNull();
    expect(dbGet).not.toHaveBeenCalled();
  });
});

describe('insertScimGroupMapping', () => {
  it('writes project_id when the column exists and the project is in-org', async () => {
    hasColumn.mockResolvedValue(true);
    dbGet.mockResolvedValueOnce({ id: 'proj-A', name: 'Alpha' }); // project-in-org check

    const result = await insertScimGroupMapping({
      orgId: 'org-1',
      externalGroupName: 'Finance',
      externalGroupId: 'grp-1',
      internalRole: 'PROJECT_LEADER',
      projectId: 'proj-A',
    });

    expect(result.projectId).toBe('proj-A');
    expect(result.projectIdApplied).toBe(true);
    // Project-in-org validation is org-scoped.
    const [checkSql, checkParams] = dbGet.mock.calls[0];
    expect(checkSql).toContain('organization_id = ?');
    expect(checkParams).toEqual(['proj-A', 'org-1']);
    // INSERT includes project_id and the token org (never body org).
    const [insertSql, insertParams] = dbRun.mock.calls[0];
    expect(insertSql).toContain('project_id');
    expect(insertParams).toEqual([
      'mapping-uuid',
      'org-1',
      'grp-1',
      'Finance',
      'PROJECT_LEADER',
      'proj-A',
    ]);
  });

  it('rejects a projectId that does not belong to the org (cross-org guard)', async () => {
    hasColumn.mockResolvedValue(true);
    dbGet.mockResolvedValueOnce(null); // project not found in this org

    await expect(
      insertScimGroupMapping({
        orgId: 'org-1',
        externalGroupName: 'Finance',
        externalGroupId: 'grp-1',
        internalRole: 'member',
        projectId: 'proj-OTHER-ORG',
      })
    ).rejects.toMatchObject({
      name: 'ScimGroupMappingError',
      code: 'PROJECT_NOT_IN_ORG',
    });
    // No write happened.
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('falls back to an org-wide mapping (dropping projectId) when the column is absent', async () => {
    hasColumn.mockResolvedValue(false);
    dbGet.mockResolvedValueOnce({ id: 'proj-A', name: 'Alpha' }); // still validates in-org first

    const result = await insertScimGroupMapping({
      orgId: 'org-1',
      externalGroupName: 'Finance',
      externalGroupId: 'grp-1',
      internalRole: 'member',
      projectId: 'proj-A',
    });

    expect(result.projectId).toBeNull();
    expect(result.projectIdApplied).toBe(false);
    // INSERT must NOT reference project_id.
    const [insertSql, insertParams] = dbRun.mock.calls[0];
    expect(insertSql).not.toContain('project_id');
    expect(insertParams).toEqual(['mapping-uuid', 'org-1', 'grp-1', 'Finance', 'member']);
  });

  it('defaults the role to member and stores an org-wide mapping when no project given', async () => {
    hasColumn.mockResolvedValue(true);

    const result = await insertScimGroupMapping({
      orgId: 'org-1',
      externalGroupName: 'Everyone',
      externalGroupId: 'grp-all',
      internalRole: '',
    });

    expect(result.internalRole).toBe('member');
    expect(result.projectId).toBeNull();
    // No project-in-org lookup because no projectId was supplied.
    expect(dbGet).not.toHaveBeenCalled();
    const [, insertParams] = dbRun.mock.calls[0];
    expect(insertParams).toEqual(['mapping-uuid', 'org-1', 'grp-all', 'Everyone', 'member', null]);
  });
});

describe('listScimGroupMappings', () => {
  it('returns project-scoped rows when the column exists', async () => {
    hasColumn.mockResolvedValue(true);
    dbAll.mockResolvedValueOnce([
      {
        id: 'm1',
        external_group_id: 'grp-1',
        external_group_name: 'Finance',
        internal_role: 'PROJECT_LEADER',
        is_active: 1,
        member_count: 3,
        project_id: 'proj-A',
        project_name: 'Alpha',
      },
    ]);

    const rows = await listScimGroupMappings('org-1');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ projectId: 'proj-A', projectName: 'Alpha', isActive: true });
    const [sql, params] = dbAll.mock.calls[0];
    expect(sql).toContain('m.organization_id = ?');
    expect(params).toEqual(['org-1']);
  });

  it('returns org-wide shape (projectId null) when the column is absent', async () => {
    hasColumn.mockResolvedValue(false);
    dbAll.mockResolvedValueOnce([
      {
        id: 'm1',
        external_group_id: 'grp-1',
        external_group_name: 'Finance',
        internal_role: 'member',
        is_active: 1,
        member_count: 0,
      },
    ]);

    const rows = await listScimGroupMappings('org-1');

    expect(rows[0].projectId).toBeNull();
    const [sql] = dbAll.mock.calls[0];
    expect(sql).not.toContain('project_id');
  });

  it('returns an empty array for a missing org', async () => {
    expect(await listScimGroupMappings('')).toEqual([]);
    expect(dbAll).not.toHaveBeenCalled();
  });
});

describe('ScimGroupMappingError', () => {
  it('carries a machine-readable code', () => {
    const err = new ScimGroupMappingError('PROJECT_NOT_IN_ORG', 'nope');
    expect(err.code).toBe('PROJECT_NOT_IN_ORG');
    expect(err).toBeInstanceOf(Error);
  });
});
