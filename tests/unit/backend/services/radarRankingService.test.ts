import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockTableExists = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  tableExists: (...args: unknown[]) => mockTableExists(...args),
}));

describe('radarRankingService.buildDynamicContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryOne.mockResolvedValue(null);
    mockQueryRun.mockResolvedValue({ changes: 1 });
  });

  it('uses my_ideas when legacy ideas table is unavailable', async () => {
    mockTableExists.mockImplementation(async (table: string) => table === 'my_ideas');
    mockQueryAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM tasks')) return [{ title: 'Task Alpha' }];
      if (sql.includes('FROM decisions')) return [{ title: 'Decision Beta' }];
      if (sql.includes('FROM my_ideas')) return [{ title: 'Idea Gamma' }];
      if (sql.includes('FROM notebook_pages')) return [{ title: 'Note Delta' }];
      if (sql.includes('FROM initiatives')) return [{ title: 'Initiative Epsilon' }];
      if (sql.includes('FROM radar_actions')) return [{ action_type: 'opened', signal_id: 'sig-1' }];
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { radarRankingService } = await import(
      '../../../../server/src/services/radar/radarRankingService.js'
    );

    const context = await radarRankingService.buildDynamicContext('user-1', 'org-1');

    expect(context.ideaTitles).toEqual(['Idea Gamma']);
    expect(
      mockQueryAll.mock.calls.some(([sql]) => String(sql).includes('FROM ideas'))
    ).toBe(false);
  });

  it('falls back to legacy ideas when my_ideas is absent', async () => {
    mockTableExists.mockImplementation(async (table: string) => table === 'ideas');
    mockQueryAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM tasks')) return [];
      if (sql.includes('FROM decisions')) return [];
      if (sql.includes('FROM ideas')) return [{ title: 'Legacy Idea' }];
      if (sql.includes('FROM notebook_pages')) return [];
      if (sql.includes('FROM initiatives')) return [];
      if (sql.includes('FROM radar_actions')) return [];
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const { radarRankingService } = await import(
      '../../../../server/src/services/radar/radarRankingService.js'
    );

    const context = await radarRankingService.buildDynamicContext('user-2', 'org-2');

    expect(context.ideaTitles).toEqual(['Legacy Idea']);
    expect(
      mockQueryAll.mock.calls.some(([sql]) => String(sql).includes('FROM ideas'))
    ).toBe(true);
  });
});
