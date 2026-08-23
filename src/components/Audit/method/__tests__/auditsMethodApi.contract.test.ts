import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/services/api', () => ({
  Api: { get },
}));

import { getProgramCoverage, listOutputs, listPacks, listPrograms } from '../auditsMethodApi';

describe('auditsMethodApi canonical response contract', () => {
  beforeEach(() => get.mockReset());

  it('reads an array and sibling total from the canonical packs envelope', async () => {
    get.mockResolvedValue({
      data: { success: true, data: [{ id: 'pack-1' }], total: 17 },
    });

    await expect(listPacks()).resolves.toEqual({ items: [{ id: 'pack-1' }], total: 17 });
  });

  it('reads the canonical programs list result', async () => {
    get.mockResolvedValue({
      data: { success: true, data: { items: [{ id: 'program-1' }], total: 1 } },
    });

    await expect(listPrograms()).resolves.toEqual({
      items: [{ id: 'program-1' }],
      total: 1,
    });
  });

  it('maps the criterion-service coverage totals without silently rendering 0/0', async () => {
    get.mockResolvedValue({
      data: {
        success: true,
        data: {
          applicableTotal: 1,
          testedTotal: 1,
          concludedTotal: 1,
          evidenceInsufficientTotal: 0,
          conformingTotal: 0,
          nonconformingTotal: 1,
          notApplicableTotal: 0,
        },
      },
    });

    await expect(getProgramCoverage('program-1')).resolves.toMatchObject({
      applicableCriteria: 1,
      concludedCriteria: 1,
      insufficientEvidenceCriteria: 0,
    });
  });

  it('rejects coverage contract drift instead of substituting zeroes', async () => {
    get.mockResolvedValue({
      data: { success: true, data: { applicableCriteria: 1, concludedCriteria: 1 } },
    });

    await expect(getProgramCoverage('program-1')).rejects.toThrow('AUDITS_API_CONTRACT_ERROR');
  });

  it.each([
    ['missing success', { data: { data: [] } }],
    ['unsuccessful envelope', { data: { success: false, data: [] } }],
    ['missing data', { data: { success: true } }],
    ['wrong list shape', { data: { success: true, data: { records: [] } } }],
  ])(
    'rejects malformed 200 instead of rendering a false empty state: %s',
    async (_label, response) => {
      get.mockResolvedValue(response);

      await expect(listOutputs()).rejects.toThrow('AUDITS_API_CONTRACT_ERROR');
    }
  );
});
