import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  default: dbMock,
  ...dbMock,
}));

import { getInitiativeCapacity } from '../../../server/src/services/workloadCapacityService.js';

const ORG_ID = 'org-1';
const INITIATIVE_ID = 'init-1';

function configureAll(sqlToRows: Record<string, unknown[]>) {
  dbMock.all.mockImplementation(async (sql: string) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    for (const [needle, rows] of Object.entries(sqlToRows)) {
      if (normalized.includes(needle.replace(/\s+/g, ' ').trim())) return rows;
    }
    return [];
  });
}

describe('workloadCapacityService.getInitiativeCapacity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('derives required FTE from staffing demand independently of allocated FTE', async () => {
    configureAll({
      'FROM initiative_resources ir': [
        { user_id: 'u1', name: 'Alice', role: 'Engineer', allocation_percentage: 50 },
      ],
      'FROM initiative_resources WHERE user_id IN': [{ user_id: 'u1', total_alloc: 50 }],
      'FROM tasks': [{ assignee_id: 'u1', hours: 10 }],
      'FROM time_entries': [{ user_id: 'u1', hours: 5 }],
    });
    dbMock.get.mockResolvedValue({ total_req: 3.5 });

    const result = await getInitiativeCapacity(ORG_ID, INITIATIVE_ID);

    expect(result.summary.totalFteAllocated).toBe(0.5);
    expect(result.summary.totalFteRequired).toBe(3.5);
    expect(dbMock.get).toHaveBeenCalledWith(expect.stringContaining('staffing_plan_roles'), [
      INITIATIVE_ID,
      ORG_ID,
    ]);
  });

  it('retains staffing demand when no resources have been assigned yet', async () => {
    configureAll({ 'FROM initiative_resources ir': [] });
    dbMock.get.mockResolvedValue({ total_req: 2 });

    const result = await getInitiativeCapacity(ORG_ID, INITIATIVE_ID);

    expect(result.resources).toEqual([]);
    expect(result.summary.totalFteAllocated).toBe(0);
    expect(result.summary.totalFteRequired).toBe(2);
  });

  it('reports zero demand when the optional staffing schema is unavailable', async () => {
    configureAll({ 'FROM initiative_resources ir': [] });
    dbMock.get.mockRejectedValue(new Error('staffing_plan_roles does not exist'));

    const result = await getInitiativeCapacity(ORG_ID, INITIATIVE_ID);

    expect(result.summary.totalFteRequired).toBe(0);
  });
});
