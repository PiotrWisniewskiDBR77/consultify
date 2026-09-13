import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryAll = vi.fn();
const getTableColumns = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => queryAll(...args),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
  getTableColumns: (...args: unknown[]) => getTableColumns(...args),
}));

import { InitiativeController } from '../InitiativeController.js';

const AS_OF = '2026-09-12T12:00:00.000Z';

const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() }) as any;

describe('E1b Initiative list evidence HTTP projection', () => {
  beforeEach(() => {
    queryAll.mockReset();
    getTableColumns.mockReset().mockResolvedValue([]);
    queryAll.mockImplementation(async (sql: string) => {
      if (/SELECT i\.\*/.test(sql)) {
        return [
          {
            id: 'initiative-evidence-a',
            organization_id: 'org-evidence-a',
            name: 'Evidence Initiative',
            title: 'Evidence Initiative',
            status: 'IN_EXECUTION',
            progress: 42,
            forecast_start_date: null,
            forecast_end_date: '2026-12-15',
            updated_at: '2026-09-12T11:59:59.000Z',
          },
        ];
      }
      if (/FROM initiatives i/.test(sql) && /forecast_start_date/.test(sql)) {
        return [
          {
            initiative_id: 'initiative-evidence-a',
            progress: 42,
            forecast_start_date: null,
            forecast_end_date: '2026-12-15',
          },
        ];
      }
      if (/FROM initiative_history h/.test(sql)) {
        return [
          {
            id: 'history-progress-42',
            initiative_id: 'initiative-evidence-a',
            action: 'progress_updated',
            old_value: JSON.stringify({ progress: 10 }),
            new_value: JSON.stringify({ progress: 42 }),
            observed_at: '2026-09-11T10:00:00.000Z',
            system: 'initiative_history',
          },
          {
            id: 'history-forecast-end',
            initiative_id: 'initiative-evidence-a',
            action: 'reforecast',
            old_value: JSON.stringify({ forecastEndDate: '2026-11-30' }),
            new_value: JSON.stringify({ forecastEndDate: '2026-12-15' }),
            observed_at: '2026-09-11T11:00:00.000Z',
            system: 'initiative_history',
          },
        ];
      }
      return [];
    });
  });

  it('keeps the ordinary Initiative list independent from optional execution evidence reads', async () => {
    const res = response();
    await InitiativeController.getInitiatives(
      {
        user: { organizationId: 'org-evidence-a', id: 'user-evidence-a' },
        query: {},
        headers: { 'accept-language': 'en' },
      } as any,
      res,
      vi.fn()
    );

    expect(queryAll).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith([
      expect.not.objectContaining({ progressEvidence: expect.anything() }),
    ]);
  });

  it('E1b production Initiative projection exposes exact per-field replan and progress receipts at controlled asOf without relabeling updatedAt', async () => {
    const res = response();
    await InitiativeController.getInitiatives(
      {
        user: { organizationId: 'org-evidence-a', id: 'user-evidence-a' },
        query: { asOf: AS_OF },
        headers: { 'accept-language': 'en' },
      } as any,
      res,
      vi.fn()
    );

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'initiative-evidence-a',
        progress: 42,
        forecastStartDate: null,
        forecastEndDate: '2026-12-15',
        progressEvidence: expect.objectContaining({
          value: 42,
          observedAt: '2026-09-11T10:00:00.000Z',
          asOf: AS_OF,
          source: expect.objectContaining({ recordId: 'history-progress-42' }),
        }),
        forecastStartEvidence: expect.objectContaining({
          value: null,
          completeness: 'UNKNOWN',
        }),
        forecastEndEvidence: expect.objectContaining({
          value: '2026-12-15',
          observedAt: '2026-09-11T11:00:00.000Z',
          source: expect.objectContaining({ recordId: 'history-forecast-end' }),
        }),
      }),
    ]);
  });

  it.each(['not-a-date', '2999-01-01T00:00:00.000Z'])(
    'rejects invalid or future controlled asOf %s before querying Initiative data',
    async (asOf) => {
      const res = response();
      await InitiativeController.getInitiatives(
        {
          user: { organizationId: 'org-evidence-a', id: 'user-evidence-a' },
          query: { asOf },
          headers: {},
        } as any,
        res,
        vi.fn()
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid asOf',
        code: 'INITIATIVES_AS_OF_INVALID',
      });
      expect(queryAll).not.toHaveBeenCalled();
    }
  );
});
