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
import {
  getRoiBaseline,
  getRoiCalculationPolicy,
} from '../../src/components/ResultsVNext/roi/roiCaseDetailApi';
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

  // FIX-3 (2026-08-25 odbiór dnia 4): roiCaseDetailApi.ts:204/286 fabricates a
  // baseline/calculation-policy for `?sampleData=results-vnext` WITHOUT
  // checking the case id at all — unlike getKpi/getOkrSet/getRoiCase above,
  // which only fixture-short-circuit on their own `sample-*` ids, this branch
  // fires for a real, non-sample case id too. That's the exact bug the
  // ResultsVNextRegistryShell `sampleData` banner on RoiCaseModelWorkspace's
  // settings tab now covers — these tests pin the underlying API behavior the
  // banner is compensating for, so a regression here (e.g. someone "fixing"
  // it to only fire for sample-prefixed ids) is caught even though the UI
  // fix lives in a different file.
  it('fabricates baseline/calculation-policy for ANY case id under the explicit sample-data gate, not only sample-prefixed ones', async () => {
    vi.stubGlobal('window', {
      location: { search: '?sampleData=results-vnext', hostname: 'demo.consultify.ai' },
    });
    const fetchMock = vi.mocked(fetch);

    const realCaseId = 'a1b2c3d4-real-customer-roi-case';
    const baseline = await getRoiBaseline(realCaseId);
    const policy = await getRoiCalculationPolicy(realCaseId);

    expect(baseline?.caseId).toBe(realCaseId);
    expect(baseline?.source).toBe('Owner review sample');
    expect(policy?.caseId).toBe(realCaseId);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed on public production hosts for baseline/calculation-policy, hitting the real API instead', async () => {
    vi.stubGlobal('window', {
      location: { search: '?sampleData=results-vnext', hostname: 'www.consultify.ai' },
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ baseline: { caseId: 'real-case', source: 'Live data' } }), {
        status: 200,
      })
    );

    const baseline = await getRoiBaseline('real-case');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(baseline?.source).toBe('Live data');
  });
});
