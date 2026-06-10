/**
 * Unit test for financialModelingService.listModels (PLAN_08b P0-A).
 *
 * The Models tab's analytical-depth label is derived from the active event count,
 * so listModels MUST return an `event_count` column via a subquery scoped to
 * active events. This test pins that SQL contract and the org scoping.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const all = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => all(...args),
  get: vi.fn(),
  run: vi.fn(),
}));

import { listModels } from '../financialModelingService.js';

beforeEach(() => {
  all.mockReset();
});

describe('financialModelingService.listModels', () => {
  it('selects an event_count subquery scoped to active events and the org', async () => {
    all.mockResolvedValue([
      {
        id: 'model-1',
        name: 'Transformation 2015 ROI',
        scenario: 'base',
        horizon_months: 36,
        start_date: '2015-01-01',
        event_count: 3,
      },
    ]);

    const rows = await listModels('org-1');

    expect(all).toHaveBeenCalledTimes(1);
    const [sql, params] = all.mock.calls[0] as [string, unknown[]];

    // event_count must be derived from a COUNT subquery over financial_model_events
    expect(sql).toMatch(/event_count/i);
    expect(sql).toMatch(/COUNT\(\*\)\s+FROM\s+financial_model_events/i);
    // ...restricted to active events only
    expect(sql).toMatch(/is_active\s*=\s*TRUE/i);
    // ...and scoped to the org
    expect(sql).toMatch(/organization_id\s*=\s*\?/i);
    expect(params).toEqual(['org-1']);

    expect(rows[0].event_count).toBe(3);
  });

  it('returns an empty array when no rows are found', async () => {
    all.mockResolvedValue(null);
    expect(await listModels('org-1')).toEqual([]);
  });
});
