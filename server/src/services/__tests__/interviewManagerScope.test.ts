import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetTableColumns = vi.fn();
const mockQueryAll = vi.fn();

vi.mock('../../utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));

vi.mock('../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
}));

import {
  buildAssignmentManagerScopeClause,
  buildSessionManagerScopeClause,
  resolveInterviewManagerScope,
} from '../interviewManagerScope.js';

describe('interviewManagerScope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats ADMIN as organization-wide scope', async () => {
    await expect(
      resolveInterviewManagerScope({
        userId: 'u-1',
        organizationId: 'org-1',
        role: 'ADMIN',
      })
    ).resolves.toEqual({ kind: 'organization' });
    expect(mockGetTableColumns).not.toHaveBeenCalled();
  });

  it('resolves project-managed scope from project roles', async () => {
    mockGetTableColumns.mockResolvedValue(new Set(['project_id', 'project_role']));
    mockQueryAll.mockResolvedValue([{ project_id: 'proj-1' }, { project_id: 'proj-2' }]);

    await expect(
      resolveInterviewManagerScope({
        userId: 'u-2',
        organizationId: 'org-2',
        role: 'MEMBER',
      })
    ).resolves.toEqual({ kind: 'projects', projectIds: ['proj-1', 'proj-2'] });
  });

  it('falls back to creator scope when no manager project roles exist', async () => {
    mockGetTableColumns.mockResolvedValue(new Set(['project_id', 'project_role']));
    mockQueryAll.mockResolvedValue([]);

    await expect(
      resolveInterviewManagerScope({
        userId: 'u-3',
        organizationId: 'org-3',
        role: 'MEMBER',
      })
    ).resolves.toEqual({ kind: 'creator', creatorId: 'u-3' });
  });

  it('builds assignment and session clauses for project scope', () => {
    const assignmentScope = buildAssignmentManagerScopeClause(
      { kind: 'projects', projectIds: ['proj-1', 'proj-2'] },
      { assignmentAlias: 'a' }
    );
    expect(assignmentScope).toEqual({
      clause: ' AND a.project_id IN (?, ?)',
      params: ['proj-1', 'proj-2'],
    });

    const sessionScope = buildSessionManagerScopeClause(
      { kind: 'projects', projectIds: ['proj-1'] },
      { assignmentAlias: 'a', sessionProjectColumn: 's.project_id' }
    );
    expect(sessionScope).toEqual({
      clause: ' AND s.project_id IN (?)',
      params: ['proj-1'],
    });
  });
});
