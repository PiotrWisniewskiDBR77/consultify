/**
 * @vitest-environment jsdom
 *
 * Pakiet E — rozszerzenie klienta `financeV2.api.ts` o trzy endpointy domeny
 * Analysis (`analysis.routes.ts`, Pakiet B2/DEC-FIN-012): kształt żądania
 * (URL/query/metoda) i rozpakowanie odpowiedzi `{data}`, tym samym wzorcem co
 * `financeV2.api.test.ts` (Pakiet C) — mockuje `fetchWithRetry`, zero
 * prawdziwej sieci (reguła sesji: zero żywej bazy).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../baseClient', async () => {
  const actual = await vi.importActual<typeof import('../baseClient')>('../baseClient');
  return {
    ...actual,
    fetchWithRetry: vi.fn(),
    getHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer test-token' }),
  };
});

import { fetchWithRetry } from '../baseClient';
import { computeAnalysisKpis, getAnalysisKpiCatalog, getAnalysisKpiValues } from '../financeV2.api';
import { describeFinanceV2Error } from '../financeV2.types';

const mockedFetch = fetchWithRetry as unknown as ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown): Response {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    url: 'https://example.test/mock',
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone(): Response {
      return response as unknown as Response;
    },
  };
  return response as unknown as Response;
}

beforeEach(() => {
  mockedFetch.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('financeV2.api — rozszerzenie Analysis (Pakiet E)', () => {
  it('getAnalysisKpiCatalog() bez parametrów → GET /analysis/kpi-catalog, bez query string', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: [], meta: {} }));
    await getAnalysisKpiCatalog();
    const [url] = mockedFetch.mock.calls[0];
    // v8Get buduje URL absolutny przez `new URL(path, window.location.origin)` —
    // w jsdom origin to http://localhost:3000; sprawdzamy ścieżkę, nie origin.
    expect(String(url)).toContain('/api/v8/finance-v2/analysis/kpi-catalog');
    expect(String(url).endsWith('/analysis/kpi-catalog')).toBe(true);
  });

  it('getAnalysisKpiCatalog({tier, includeAllStatuses}) → dopisuje oba query paramy', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: [], meta: {} }));
    await getAnalysisKpiCatalog({ tier: 'INDUSTRY', includeAllStatuses: true });
    const [url] = mockedFetch.mock.calls[0];
    expect(String(url)).toContain('/api/v8/finance-v2/analysis/kpi-catalog?tier=INDUSTRY&includeAllStatuses=true');
  });

  it('getAnalysisKpiCatalog() rozpakowuje {data} do tablicy wpisów katalogu, pole po polu', async () => {
    const entry = {
      kpiCatalogId: 'cat-1',
      kpiCode: 'GROSS_MARGIN_PCT',
      catalogVersion: 1,
      status: 'ACTIVE',
      tier: 'UNIVERSAL',
      industryCode: null,
      category: 'Rentowność',
      kpiName: 'Marża brutto',
      description: null,
      unitType: 'PERCENT',
      compileStatus: 'OK',
      resolvedOutputUnit: 'PERCENT',
      periodConvention: 'FISCAL_QUARTER',
      negativeDenominatorPolicy: 'FORCE_NA',
      requiredCanonicalLineCodes: ['REVENUE', 'COGS'],
    };
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: [entry], meta: {} }));
    const result = await getAnalysisKpiCatalog();
    expect(result).toEqual([entry]);
  });

  it('computeAnalysisKpis → POST /analysis/:businessVersionId/compute, attemptReadinessTransition domyślnie false', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, { data: { jobId: 'job-1', jobStatus: 'succeeded', resultsCount: 3, results: [], readiness: null }, meta: {} })
    );
    await computeAnalysisKpis({ businessVersionId: 'bv-analysis-1' });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/analysis/bv-analysis-1/compute');
    expect(JSON.parse(init.body)).toEqual({ attemptReadinessTransition: false });
  });

  it('computeAnalysisKpis({attemptReadinessTransition:true, expectedVersion}) → dopisuje expectedVersion do body (serwer wymaga go tylko w tym przypadku, analysis.routes.ts:89-93)', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, { data: { jobId: 'job-2', jobStatus: 'succeeded', resultsCount: 5, results: [], readiness: { ok: true } }, meta: {} })
    );
    await computeAnalysisKpis({ businessVersionId: 'bv-analysis-1', attemptReadinessTransition: true, expectedVersion: 2 });
    const [, init] = mockedFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ attemptReadinessTransition: true, expectedVersion: 2 });
  });

  it('computeAnalysisKpis → błąd 404 NO_SOURCE_STATEMENT_PACK_EDGE (realny, potwierdzony gap — brak zapisu lineage edge w całym finance-v2, patrz PKG_E_ANALYSIS_report.md) mapuje się na komunikat Honest UI, nie generyczny', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(404, { error: 'No source Statement Pack lineage edge found', code: 'NO_SOURCE_STATEMENT_PACK_EDGE' })
    );
    await expect(computeAnalysisKpis({ businessVersionId: 'bv-orphan' })).rejects.toMatchObject({
      status: 404,
      data: { code: 'NO_SOURCE_STATEMENT_PACK_EDGE' },
    });
    // Kontrola negatywna: ten kod NIE trafia w domyślną gałąź "Nie udało się wykonać operacji" —
    // ma własny, przetłumaczony komunikat (dowód: dwa różne kody dają dwa różne title).
    // `describeFinanceV2Error` sprawdza `err instanceof Error` (isFinanceV2ApiError) — musi być
    // prawdziwy Error, nie plain object, inaczej test fałszywie wpadłby w gałąź "nieoczekiwany błąd".
    const noSourceErr = Object.assign(new Error('No source Statement Pack lineage edge found'), {
      status: 404,
      data: { code: 'NO_SOURCE_STATEMENT_PACK_EDGE' },
    });
    const genericErr = Object.assign(new Error('boom'), { status: 500, data: { code: 'SOME_UNKNOWN_CODE' } });
    const described = describeFinanceV2Error(noSourceErr);
    const genericDescribed = describeFinanceV2Error(genericErr);
    expect(described.code).toBe('NO_SOURCE_STATEMENT_PACK_EDGE');
    expect(described.title).not.toBe(genericDescribed.title);
    expect(described.title).toContain('źródłow');
  });

  it('getAnalysisKpiValues → GET /analysis/:businessVersionId/kpi-values, rozpakowuje {data}', async () => {
    const row = {
      kpiValueId: 'kv-1',
      kpiCatalogId: 'cat-1',
      kpiCode: 'GROSS_MARGIN_PCT',
      kpiName: 'Marża brutto',
      category: 'Rentowność',
      tier: 'UNIVERSAL',
      unitType: 'PERCENT',
      entityId: 'ent-1',
      periodId: 'p-2026-q1',
      value: { status: 'PRESENT_NONZERO', valueDecimal: '0.42', nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'UNITS', multiplier: '1' },
      qualityFlag: null,
      deltaVsPriorPeriod: null,
      deltaPctVsPriorPeriod: null,
      interpretationText: null,
      benchmark: null,
      createdAt: '2026-08-11T00:00:00Z',
      updatedAt: '2026-08-11T00:00:00Z',
    };
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: [row], meta: {} }));
    const result = await getAnalysisKpiValues('bv-analysis-1');
    const [url] = mockedFetch.mock.calls[0];
    expect(String(url)).toContain('/api/v8/finance-v2/analysis/bv-analysis-1/kpi-values');
    expect(result).toEqual([row]);
  });
});
