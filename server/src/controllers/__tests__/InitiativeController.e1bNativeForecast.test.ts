import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const queryAll = vi.fn();
const getTableColumns = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => queryAll(...args),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
  getTableColumns: (...args: unknown[]) => getTableColumns(...args),
}));

import { InitiativeController } from '../InitiativeController.js';

const AS_OF = '2026-09-13T08:00:00.000Z';
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() }) as any;

describe('E1b native-only Initiative forecast list projection', () => {
  const previousFlag = process.env.ENABLE_INITIATIVE_UNIFIED_READ;

  beforeEach(() => {
    process.env.ENABLE_INITIATIVE_UNIFIED_READ = 'true';
    queryAll.mockReset();
    getTableColumns.mockReset().mockResolvedValue([]);
    queryAll.mockImplementation(async (sql: string) => {
      if (/SELECT i\.\*/.test(sql)) return [];
      if (/SELECT organization_id, aggregate_id, payload_json/.test(sql)) {
        return [
          {
            organization_id: 'native-org',
            aggregate_id: 'native-initiative',
            payload_json: {
              initiativeId: 'native-initiative',
              title: 'Native forecast',
              lifecycleState: 'IN_EXECUTION',
              projectId: 'native-project',
              initiativeOwnerId: 'native-owner',
              forecastEndDate: '2028-04-30',
            },
          },
        ];
      }
      if (/SELECT id, organization_id, title, name, status/.test(sql)) return [];
      if (/version AS aggregate_version/.test(sql) && /FROM ie_aggregate_state/.test(sql)) {
        return [
          {
            initiative_id: 'native-initiative',
            aggregate_version: 7,
            payload_json: {
              forecastEndDate: '2028-04-30',
            },
          },
        ];
      }
      if (/FROM initiatives i/.test(sql) && /forecast_start_date/.test(sql)) return [];
      if (/FROM ie_command_receipts/.test(sql)) {
        return [
          {
            id: 'native-request-7',
            initiative_id: 'native-initiative',
            aggregate_version: 7,
            response_json: {
              after: { forecastStartDate: null, forecastEndDate: '2028-04-30' },
              changedFields: ['forecastEndDate'],
            },
            observed_at: '2026-09-13T07:34:56.123Z',
            system: 'ie_command_receipts',
          },
        ];
      }
      return [];
    });
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.ENABLE_INITIATIVE_UNIFIED_READ;
    else process.env.ENABLE_INITIATIVE_UNIFIED_READ = previousFlag;
  });

  it('appends the same canonical identity and then overlays its receipt-backed forecast evidence', async () => {
    const res = response();
    await InitiativeController.getInitiatives(
      {
        user: { organizationId: 'native-org', id: 'native-owner' },
        query: { asOf: AS_OF },
        headers: { 'accept-language': 'en' },
      } as any,
      res,
      vi.fn()
    );

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'native-initiative',
        recordSource: 'CANONICAL',
        progressEvidence: expect.objectContaining({
          value: null,
          completeness: 'UNKNOWN',
        }),
        forecastStartEvidence: expect.objectContaining({
          value: null,
          completeness: 'UNKNOWN',
          reason: 'VALUE_MISSING',
        }),
        forecastEndEvidence: expect.objectContaining({
          value: '2028-04-30',
          observedAt: '2026-09-13T07:34:56.123Z',
          source: {
            system: 'ie_command_receipts',
            recordId: 'native-request-7',
            formulaId: null,
            formulaVersion: null,
          },
        }),
      }),
    ]);
  });
});
