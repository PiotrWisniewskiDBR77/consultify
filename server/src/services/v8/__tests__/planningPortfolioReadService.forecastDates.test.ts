import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryOne = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryOne,
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

import { getInitiativeDetailRead } from '../planningPortfolioReadService.js';

describe('planning Initiative detail operational forecast aliases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryOne.mockImplementation(async (sql: string) => ({
      id: 'initiative-forecast-1',
      organization_id: 'org-1',
      status: 'SCHEDULED',
      name: 'Operational Initiative',
      title: 'Operational Initiative',
      forecast_start_date: new Date('2026-10-09T19:00:00.000Z'),
      forecast_end_date: null,
      ...(sql.includes('forecast_start_date::text')
        ? {
            forecast_start_date_day: '2026-10-10',
            forecast_end_date_day: null,
          }
        : {}),
    }));
  });

  it('returns exact calendar-day camel aliases without serializing pg DATE through local time', async () => {
    const detail = await getInitiativeDetailRead('initiative-forecast-1', 'org-1', 'en');

    expect(queryOne.mock.calls[0][0]).toContain(
      'i.forecast_start_date::text AS forecast_start_date_day'
    );
    expect(queryOne.mock.calls[0][0]).toContain(
      'i.forecast_end_date::text AS forecast_end_date_day'
    );
    expect(detail?.forecastStartDate).toBe('2026-10-10');
    expect(detail?.forecastEndDate).toBeNull();
  });

  // K3b — REGRESJA PARYTETU: `GET /api/initiatives/:id` wypuszczał surowe
  // aliasy SQL obok pól camelCase. Alias jest szczegółem zapytania, nie
  // kolumną `initiatives`; baza 60051310d7 tych pól nie zwracała i żaden
  // konsument ich nie czyta.
  it('nie wypuszcza surowych aliasów SQL forecast_*_day do odpowiedzi', async () => {
    const detail = await getInitiativeDetailRead('initiative-forecast-1', 'org-1', 'en');

    expect(detail).not.toHaveProperty('forecast_start_date_day');
    expect(detail).not.toHaveProperty('forecast_end_date_day');
    expect(Object.keys(detail || {}).filter((key) => key.endsWith('_day'))).toEqual([]);
    // Kolumny realne zostają — usuwamy alias, nie dane.
    expect(detail).toHaveProperty('forecast_start_date');
    expect(detail).toHaveProperty('forecast_end_date');
  });
});
