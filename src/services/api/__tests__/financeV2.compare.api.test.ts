/**
 * @vitest-environment jsdom
 *
 * Klient `financeV2.api.ts` §AP-CLIENT Compare (Gate J) — `compare.routes.ts`, 6 endpointów
 * (5 osi z brief + entity/entity). Ten sam wzorzec mockowania `fetchWithRetry`.
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
import {
  compareFinanceActualVsForecast,
  compareFinanceEntities,
  compareFinancePeriods,
  compareFinanceScenarios,
  compareFinanceValuationMethods,
  compareFinanceVersions,
} from '../financeV2.api';

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

function sampleCompareResult(comparisonType: string) {
  return {
    comparisonType,
    generatedAt: '2026-08-12T00:00:00.000Z',
    sourceA: { artifactType: 'STATEMENT_PACK', businessVersionId: 'bv-a', label: 'A' },
    sourceB: { artifactType: 'STATEMENT_PACK', businessVersionId: 'bv-b', label: 'B' },
    ignoreDimensions: [],
    materialityThresholdPct: 5,
    onlyMaterial: false,
    summary: {
      totalRows: 1,
      bothPresent: 1,
      missingInA: 0,
      missingInB: 0,
      missingInBoth: 0,
      currencyMismatch: 0,
      materialCount: 0,
    },
    rows: [],
  };
}

const ARTIFACT_REF = {
  artifactType: 'STATEMENT_PACK' as const,
  artifactId: 'art-1',
  businessVersionId: 'bv-1',
};

describe('financeV2.api — AP-CLIENT Compare', () => {
  it('compareFinancePeriods → POST /compare/periods z periodIdA/periodIdB', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, { data: sampleCompareResult('PERIOD'), meta: {} })
    );
    const result = await compareFinancePeriods({
      artifactRef: ARTIFACT_REF,
      periodIdA: 'p1',
      periodIdB: 'p2',
    });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/compare/periods');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({
      artifactRef: ARTIFACT_REF,
      periodIdA: 'p1',
      periodIdB: 'p2',
    });
    expect(result.comparisonType).toBe('PERIOD');
  });

  it('compareFinanceVersions → POST /compare/versions z artifactType/businessVersionIdA/B', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, { data: sampleCompareResult('VERSION'), meta: {} })
    );
    await compareFinanceVersions({
      artifactType: 'BASELINE_MODEL',
      artifactId: 'art-1',
      businessVersionIdA: 'bv-a',
      businessVersionIdB: 'bv-b',
    });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/compare/versions');
    expect(JSON.parse(init.body)).toMatchObject({
      artifactType: 'BASELINE_MODEL',
      businessVersionIdA: 'bv-a',
      businessVersionIdB: 'bv-b',
    });
  });

  it('compareFinanceEntities → POST /compare/entities z periodId/entityIdA/B', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        data: { ...sampleCompareResult('ENTITY'), relationship: 'SUBSIDIARY' },
        meta: {},
      })
    );
    const result = await compareFinanceEntities({
      artifactRef: ARTIFACT_REF,
      periodId: 'p1',
      entityIdA: 'e1',
      entityIdB: 'e2',
    });
    const [url] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/compare/entities');
    expect(result.relationship).toBe('SUBSIDIARY');
  });

  it('compareFinanceScenarios → POST /compare/scenarios z businessVersionIdBase/Other', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, { data: sampleCompareResult('SCENARIO'), meta: {} })
    );
    await compareFinanceScenarios({
      businessVersionIdBase: 'bv-base',
      businessVersionIdOther: 'bv-upside',
    });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/compare/scenarios');
    expect(JSON.parse(init.body)).toMatchObject({
      businessVersionIdBase: 'bv-base',
      businessVersionIdOther: 'bv-upside',
    });
  });

  it('compareFinanceValuationMethods → POST /compare/valuation-methods z methodTypeA/B', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, { data: sampleCompareResult('VALUATION_METHOD'), meta: {} })
    );
    await compareFinanceValuationMethods({
      businessVersionId: 'bv-1',
      methodTypeA: 'DCF_FCFF',
      methodTypeB: 'TRADING_COMPS',
    });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/compare/valuation-methods');
    expect(JSON.parse(init.body)).toMatchObject({
      methodTypeA: 'DCF_FCFF',
      methodTypeB: 'TRADING_COMPS',
    });
  });

  it('compareFinanceActualVsForecast → POST /compare/actual-vs-forecast z dwoma ArtifactRef + periodIds', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, { data: sampleCompareResult('ACTUAL_VS_FORECAST'), meta: {} })
    );
    await compareFinanceActualVsForecast({
      actualArtifactRef: ARTIFACT_REF,
      forecastArtifactRef: {
        artifactType: 'BASELINE_MODEL',
        artifactId: 'art-2',
        businessVersionId: 'bv-2',
      },
      entityCode: 'PARENT',
      periodIds: ['p1', 'p2'],
      accumulationBasis: 'YTD',
    });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/compare/actual-vs-forecast');
    const body = JSON.parse(init.body);
    expect(body.entityCode).toBe('PARENT');
    expect(body.periodIds).toEqual(['p1', 'p2']);
  });

  it('KONTROLA NEGATYWNA: błąd 403 ORGANIZATION_MISMATCH trafia do .data.code, nie do .code', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(403, { error: 'cross-tenant artifactRef', code: 'ORGANIZATION_MISMATCH' })
    );
    let caught: any;
    try {
      await compareFinancePeriods({ artifactRef: ARTIFACT_REF, periodIdA: 'p1', periodIdB: 'p2' });
    } catch (e) {
      caught = e;
    }
    expect(caught.status).toBe(403);
    expect(caught.code).toBeUndefined();
    expect(caught.data.code).toBe('ORGANIZATION_MISMATCH');
  });
});
