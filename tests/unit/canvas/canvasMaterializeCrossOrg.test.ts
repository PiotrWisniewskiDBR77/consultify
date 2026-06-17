import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * M02 / L-15 (S7) — cross-org materialization must be refused.
 *
 * `materializeWorkspaceTarget` is the single shared write-path for promoting a
 * Canvas draft into a canonical entity (idea / note / initiative / decision /
 * task), used by both `createWorkspaceResource` (save-to-workspace) and
 * `commitProposalToDomain` (proposal approval). Downstream services persist
 * `project_id` / owner / assignee verbatim without an org check, so the C8 guard
 * `assertOrgScopedReferences` is the ONLY thing standing between a caller and
 * writing an entity that references another organization's project or users.
 *
 * This locks that guard: a referenced projectId / ownerId / assignee that the
 * org-scoped lookup cannot resolve must throw a 403 CANVAS_CROSS_ORG_REFERENCE
 * BEFORE any mutation runs.
 */

const dbGetMock = vi.fn();
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGetMock(...args),
}));
// canvasMaterialize only calls getDatabase() inside the task branch (never on the
// cross-org reject path), but stub the module so importing it never opens a pool.
vi.mock('../../../server/src/database/index.js', () => ({
  getDatabase: () => ({}),
}));

const { materializeWorkspaceTarget } = await import(
  '../../../server/src/services/canvasMaterialize.js'
);

const baseInput = {
  organizationId: 'org-1',
  actorUserId: 'user-1',
  target: 'idea' as const,
  title: 'Strategy',
  contentMd: '# Strategy',
};

describe('canvasMaterialize — cross-org guard (M02/L-15 · S7)', () => {
  beforeEach(() => {
    dbGetMock.mockReset();
    // Org-scoped lookups return null → the referenced entity is missing / foreign.
    dbGetMock.mockResolvedValue(null);
  });

  it('rejects a projectId that belongs to another organization (403)', async () => {
    await expect(
      materializeWorkspaceTarget({ ...baseInput, projectId: 'project-of-org-2' })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'CANVAS_CROSS_ORG_REFERENCE',
      field: 'projectId',
    });
    // The project lookup must be org-scoped.
    expect(dbGetMock).toHaveBeenCalledWith(
      expect.stringMatching(/FROM projects WHERE id = \? AND organization_id = \?/i),
      ['project-of-org-2', 'org-1'],
      expect.anything()
    );
  });

  it('rejects an ownerId from another organization (403)', async () => {
    await expect(
      materializeWorkspaceTarget({ ...baseInput, ownerId: 'user-of-org-2' })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'CANVAS_CROSS_ORG_REFERENCE',
      field: 'ownerId',
    });
  });

  it('rejects a task assignee from another organization (403)', async () => {
    await expect(
      materializeWorkspaceTarget({
        ...baseInput,
        target: 'task',
        taskAssigneeId: 'assignee-of-org-2',
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'CANVAS_CROSS_ORG_REFERENCE',
      field: 'taskAssigneeId',
    });
  });
});
