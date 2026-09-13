import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryAll = vi.fn();
const getTableColumns = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => queryAll(...args),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
  getTableColumns: (...args: unknown[]) => getTableColumns(...args),
}));

import { InitiativeController } from '../InitiativeController';

const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() }) as any;
const row = (id: string, progress: number | null) => ({
  id,
  organization_id: 'org-e1b',
  name: id,
  title: id,
  status: 'IN_EXECUTION',
  progress,
});

describe('E1b InitiativeController nullable progress read contract', () => {
  beforeEach(() => {
    queryAll.mockReset();
    getTableColumns.mockReset();
    getTableColumns.mockResolvedValue([]);
    queryAll.mockResolvedValue([row('missing-progress', null), row('zero-progress', 0)]);
  });

  it('preserves missing progress separately from a measured zero in the initiative list', async () => {
    const res = response();
    await InitiativeController.getInitiatives(
      {
        user: { organizationId: 'org-e1b', id: 'user-e1b' },
        query: {},
        headers: { 'accept-language': 'en' },
      } as any,
      res,
      vi.fn()
    );

    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'missing-progress', progress: null }),
      expect.objectContaining({ id: 'zero-progress', progress: 0 }),
    ]);
  });

  it('preserves the same nullable progress contract in the status-filtered list', async () => {
    const res = response();
    await InitiativeController.getInitiativesByStatus(
      {
        user: { organizationId: 'org-e1b', id: 'user-e1b' },
        params: { statuses: 'IN_EXECUTION' },
      } as any,
      res,
      vi.fn()
    );

    expect(res.json).toHaveBeenCalledWith({
      initiatives: [
        expect.objectContaining({ id: 'missing-progress', progress: null }),
        expect.objectContaining({ id: 'zero-progress', progress: 0 }),
      ],
    });
  });
});
