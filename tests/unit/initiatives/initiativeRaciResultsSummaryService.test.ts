import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mocks — module under test imports both of these.
const mockQueryAll = vi.hoisted(() => vi.fn());
const mockListInitiativeKpiAssignments = vi.hoisted(() => vi.fn());

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: mockQueryAll,
  buildInPlaceholders: (values: unknown[]) => values.map(() => '?').join(', '),
}));

vi.mock('../../../server/src/services/initiative/initiativeKpiAssignmentService.js', () => ({
  listInitiativeKpiAssignments: mockListInitiativeKpiAssignments,
}));

import { getInitiativesRaciResultsSummary } from '../../../server/src/services/pmo/initiativeRaciResultsSummaryService.js';

describe('initiativeRaciResultsSummaryService (Faza2 gap #5 — batched RACI+results for the list)', () => {
  beforeEach(() => {
    mockQueryAll.mockReset();
    mockListInitiativeKpiAssignments.mockReset();
  });

  it('empty ids → empty map, no DB calls', async () => {
    const result = await getInitiativesRaciResultsSummary('org-1', []);
    expect(result).toEqual({});
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  it('buckets RACI rows by raci_type and attaches per-initiative KPI results', async () => {
    mockQueryAll.mockResolvedValueOnce([
      {
        id: 's1',
        initiative_id: 'ini-1',
        raci_type: 'accountable',
        role: 'Sponsor',
        user_id: 'u1',
        external_name: null,
        external_email: null,
        first_name: 'Anna',
        last_name: 'Kowalska',
        email: 'anna@example.com',
      },
      {
        id: 's2',
        initiative_id: 'ini-1',
        raci_type: 'unknown-value',
        role: null,
        user_id: null,
        external_name: 'Ext Person',
        external_email: 'ext@example.com',
        first_name: null,
        last_name: null,
        email: null,
      },
    ]);
    mockListInitiativeKpiAssignments.mockImplementation(async (initiativeId: string) => {
      if (initiativeId === 'ini-1') {
        return [
          {
            id: 'kpi-1',
            name: 'Revenue lift',
            unit: '%',
            targetValue: 10,
            latestValue: 4,
            currentValue: 4,
            isOnTarget: false,
            status: 'active',
          },
        ];
      }
      throw new Error('Initiative not found');
    });

    const result = await getInitiativesRaciResultsSummary('org-1', ['ini-1', 'ini-2']);

    expect(result['ini-1'].raci.accountable).toHaveLength(1);
    expect(result['ini-1'].raci.accountable[0]).toMatchObject({
      userId: 'u1',
      name: 'Anna Kowalska',
      raciType: 'accountable',
    });
    // Unrecognized raci_type value falls into 'unspecified', not silently dropped.
    expect(result['ini-1'].raci.unspecified).toHaveLength(1);
    expect(result['ini-1'].raci.unspecified[0]).toMatchObject({
      name: 'Ext Person',
      userId: null,
    });
    expect(result['ini-1'].raciCount).toBe(2);
    expect(result['ini-1'].results).toEqual([
      {
        kpiId: 'kpi-1',
        name: 'Revenue lift',
        unit: '%',
        targetValue: 10,
        latestValue: 4,
        isOnTarget: false,
        status: 'active',
      },
    ]);
    expect(result['ini-1'].resultsCount).toBe(1);

    // Fail-soft: a foreign/unknown initiative id (assertInitiativeBelongsToOrg throws)
    // degrades to an empty entry instead of failing the whole batch.
    expect(result['ini-2']).toMatchObject({ raciCount: 0, resultsCount: 0, results: [] });
  });

  it('RACI batch read failure degrades to empty RACI (fail-soft), does not throw', async () => {
    mockQueryAll.mockRejectedValueOnce(new Error('db down'));
    mockListInitiativeKpiAssignments.mockResolvedValue([]);

    const result = await getInitiativesRaciResultsSummary('org-1', ['ini-1']);

    expect(result['ini-1'].raciCount).toBe(0);
    expect(result['ini-1'].resultsCount).toBe(0);
  });
});
