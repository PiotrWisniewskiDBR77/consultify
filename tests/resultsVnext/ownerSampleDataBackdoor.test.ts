import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('../../src/services/api', () => ({
  Api: { get: apiGet },
  API_URL: '/api',
  getHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

import { getKpi, listKpis } from '../../src/components/ResultsVNext/kpiApi';
import { getOkrSet } from '../../src/components/ResultsVNext/okr/okrApi';
import { getRoiCase } from '../../src/components/ResultsVNext/roi/roiApi';
import { shouldUseResultsVNextOwnerSampleData } from '../../src/components/ResultsVNext/resultsVNextOwnerSampleData';

describe('Results VNext owner sample-data gate', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/results');
    apiGet.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the API for the KPI registry and preserves an honest empty result', async () => {
    apiGet.mockResolvedValue({ kpis: [] });

    await expect(listKpis()).resolves.toEqual([]);
    expect(apiGet).toHaveBeenCalledOnce();
  });

  it('does not treat sample-prefixed KPI IDs as an implicit fixture gate', async () => {
    apiGet.mockResolvedValue({ kpi: { kpiId: 'sample-kpi-delivery' } });

    await expect(getKpi('sample-kpi-delivery')).resolves.toEqual({
      kpiId: 'sample-kpi-delivery',
    });
    expect(apiGet).toHaveBeenCalledWith('/vnext/results/kpi/sample-kpi-delivery');
  });

  it.each([
    ['ROI', getRoiCase, 'sample-roi-case', { case: { caseId: 'sample-roi-case' } }],
    ['OKR', getOkrSet, 'sample-okr-set', { set: { setId: 'sample-okr-set' } }],
  ])(
    'does not treat sample-prefixed %s IDs as an implicit fixture gate',
    async (_label, load, id, body) => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

      await load(id);

      expect(fetchMock).toHaveBeenCalledOnce();
    }
  );

  it('keeps the explicit supervisor sample-data path available off production', async () => {
    vi.stubGlobal('window', {
      location: { search: '?sampleData=results-vnext', hostname: 'demo.consultify.ai' },
    });

    const result = await getKpi('sample-kpi-delivery');

    expect(result?.kpiId).toBe('sample-kpi-delivery');
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('fails closed on public production hosts even with the explicit parameter', () => {
    expect(
      shouldUseResultsVNextOwnerSampleData({
        search: '?sampleData=results-vnext',
        hostname: 'www.consultify.ai',
      })
    ).toBe(false);
  });
});
