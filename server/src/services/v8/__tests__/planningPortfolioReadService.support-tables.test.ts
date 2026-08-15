import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getBlockingReadinessItemsMock,
  getTableColumnsMock,
  queryAllMock,
  queryOneMock,
  resolveInitiativeAccessContextMock,
} = vi.hoisted(() => ({
  getBlockingReadinessItemsMock: vi.fn(),
  getTableColumnsMock: vi.fn(),
  queryAllMock: vi.fn(),
  queryOneMock: vi.fn(),
  resolveInitiativeAccessContextMock: vi.fn(),
}));

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: queryAllMock,
  queryOne: queryOneMock,
}));

vi.mock('../../../utils/dbSchema.js', () => ({
  getTableColumns: getTableColumnsMock,
}));

vi.mock('../../initiative/initiativeAccessResolver.js', () => ({
  resolveInitiativeAccessContext: resolveInitiativeAccessContextMock,
}));

vi.mock('../../initiative/initiativeGateReadinessService.js', () => ({
  getBlockingReadinessItems: getBlockingReadinessItemsMock,
}));

import {
  getInitiativeCommentsRead,
  getInitiativeGateReadinessRead,
  getInitiativeHistoryRead,
  getInitiativeStakeholdersRead,
  getInitiativeWatchersRead,
} from '../planningPortfolioReadService.js';

describe('planningPortfolioReadService support tables', () => {
  beforeEach(() => {
    getBlockingReadinessItemsMock.mockReset();
    getTableColumnsMock.mockReset();
    queryAllMock.mockReset();
    queryOneMock.mockReset();
    resolveInitiativeAccessContextMock.mockReset();
    getTableColumnsMock.mockResolvedValue(
      new Set([
        'id',
        'initiative_id',
        'user_id',
        'external_name',
        'external_email',
        'role',
        'raci_type',
        'influence_level',
        'interest_level',
        'created_at',
      ])
    );
  });

  it('returns empty watchers when the support table is missing', async () => {
    queryAllMock.mockRejectedValueOnce(new Error('relation "initiative_watchers" does not exist'));

    await expect(getInitiativeWatchersRead('init-1', 'org-1')).resolves.toEqual([]);
  });

  it('returns empty stakeholders when the support table is missing', async () => {
    queryAllMock.mockRejectedValueOnce(
      new Error('SQLITE_ERROR: no such table: initiative_stakeholders')
    );

    await expect(getInitiativeStakeholdersRead('init-1', 'org-1')).resolves.toEqual([]);
  });

  it('returns empty history when the support table is missing', async () => {
    queryAllMock.mockRejectedValueOnce(new Error('relation "initiative_history" does not exist'));

    await expect(getInitiativeHistoryRead('init-1', 'org-1')).resolves.toEqual([]);
  });

  it('returns empty comments when the support table is missing', async () => {
    queryAllMock.mockRejectedValueOnce(new Error('relation "initiative_comments" does not exist'));

    await expect(getInitiativeCommentsRead('init-1', 'org-1')).resolves.toEqual([]);
  });

  it('drops optional stakeholder columns when the schema is partial', async () => {
    getTableColumnsMock.mockResolvedValueOnce(
      new Set([
        'id',
        'initiative_id',
        'user_id',
        'external_name',
        'external_email',
        'role',
        'raci_type',
        'created_at',
      ])
    );
    queryAllMock.mockResolvedValueOnce([]);

    await expect(getInitiativeStakeholdersRead('init-1', 'org-1')).resolves.toEqual([]);

    const sql = String(queryAllMock.mock.calls[0]?.[0] || '');
    expect(sql).not.toContain('s.influence_level');
    expect(sql).not.toContain('s.interest_level');
    expect(sql).toContain('NULL as "influenceLevel"');
    expect(sql).toContain('NULL as "interestLevel"');
  });

  it('lets superadmin edit gated top-bar fields in V8 readiness truth', async () => {
    queryOneMock.mockResolvedValue({
      id: 'init-1',
      organization_id: 'org-1',
      status: 'DRAFT',
      name: 'Wave 1',
      owner_business_id: null,
      owner_execution_id: null,
    });
    resolveInitiativeAccessContextMock.mockResolvedValue({
      effectiveRoles: ['SUPERADMIN'],
      steeringBoard: { enabled: false, memberType: null },
      roleAssignments: [],
      projectId: null,
    });
    getBlockingReadinessItemsMock.mockResolvedValue([]);

    const result = await getInitiativeGateReadinessRead('init-1', 'org-1', 'user-1', 'OWNER');

    expect(resolveInitiativeAccessContextMock).toHaveBeenCalledWith(
      'org-1',
      'init-1',
      'user-1',
      'OWNER'
    );

    expect(result).toEqual(
      expect.objectContaining({
        capabilities: expect.objectContaining({
          topBar: expect.objectContaining({
            canEditPriority: true,
            canEditOwner: true,
            canEditTargetDate: true,
          }),
        }),
      })
    );
  });
});
