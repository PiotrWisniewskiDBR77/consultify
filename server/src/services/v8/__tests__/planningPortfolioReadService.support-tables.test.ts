import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryAllMock } = vi.hoisted(() => ({
  queryAllMock: vi.fn(),
}));

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: queryAllMock,
  queryOne: vi.fn(),
}));

vi.mock('../../initiative/initiativeAccessResolver.js', () => ({
  resolveInitiativeAccessContext: vi.fn(),
}));

vi.mock('../../initiative/initiativeGateReadinessService.js', () => ({
  getBlockingReadinessItems: vi.fn(),
}));

import {
  getInitiativeCommentsRead,
  getInitiativeHistoryRead,
  getInitiativeStakeholdersRead,
  getInitiativeWatchersRead,
} from '../planningPortfolioReadService.js';

describe('planningPortfolioReadService support tables', () => {
  beforeEach(() => {
    queryAllMock.mockReset();
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
});
