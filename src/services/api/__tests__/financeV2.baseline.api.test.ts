/**
 * @vitest-environment jsdom
 *
 * Klient `financeV2.api.ts` — rozszerzenie Pakietu F (Baseline). Ten sam wzorzec
 * mockowania `fetchWithRetry` co `financeV2.api.test.ts` (Pakiet C) — zero
 * prawdziwej sieci. Dowodzi: (1) poprawny URL/metoda/query dla wszystkich
 * czterech endpointów Baseline, (2) `{data}` jest rozpakowywane, (3) batch
 * upsert wysyła realny kształt ciała `{assumptions:[...]}`, (4) błąd 404/409
 * z serwera (`NO_SOURCE_STATEMENT_PACK_EDGE`/`CIRCULARITY_NOT_CONVERGED`)
 * trafia do rzuconego `Error` z czytelnym `.data.code`.
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
import { computeBaseline, listBaselineAssumptions, listBaselineOutputs, upsertBaselineAssumptions } from '../financeV2.api';
import { isFinanceV2ApiError } from '../financeV2.types';

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

describe('financeV2.api — rozszerzenie Baseline (Pakiet F)', () => {
  it('listBaselineAssumptions → GET .../baseline/:id/assumptions, bez query gdy brak filtrów', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, { data: [], meta: { version: 'v2', contract: 'x' } })
    );
    await listBaselineAssumptions('bv-1');
    const [url, opts] = mockedFetch.mock.calls[0];
    expect(url).toContain('/api/v8/finance-v2/baseline/bv-1/assumptions');
    expect(url).not.toContain('?');
    expect(opts?.method ?? 'GET').not.toBe('POST');
  });

  it('listBaselineAssumptions → dokleja scheduleType+entityId jako query', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: [] }));
    await listBaselineAssumptions('bv-1', { scheduleType: 'revenue_pvm', entityId: 'ent-1' });
    const [url] = mockedFetch.mock.calls[0];
    expect(url).toContain('/api/v8/finance-v2/baseline/bv-1/assumptions?scheduleType=revenue_pvm&entityId=ent-1');
  });

  it('upsertBaselineAssumptions → POST z ciałem {assumptions:[...]}, zwraca writtenCount', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        data: { businessVersionId: 'bv-1', writtenCount: 1, assumptions: [{ assumptionId: 'a-1', scheduleType: 'revenue_pvm', driverCode: 'REVENUE_GROWTH_YOY', entityId: 'ent-1', periodId: 'per-1' }] },
      })
    );
    const result = await upsertBaselineAssumptions('bv-1', [
      { scheduleType: 'revenue_pvm', driverCode: 'REVENUE_GROWTH_YOY', entityId: 'ent-1', periodId: 'per-1', rule: 'GROWTH_RATE', valueStatus: 'PRESENT_NONZERO', valueDecimal: 0.05, unit: 'PCT', quality: 'ESTIMATED' },
    ]);
    const [url, opts] = mockedFetch.mock.calls[0];
    expect(url).toContain('/api/v8/finance-v2/baseline/bv-1/assumptions');
    expect(url).not.toContain('?');
    expect(opts?.method).toBe('POST');
    const sentBody = JSON.parse(String(opts?.body));
    expect(sentBody.assumptions).toHaveLength(1);
    expect(sentBody.assumptions[0].driverCode).toBe('REVENUE_GROWTH_YOY');
    expect(result.writtenCount).toBe(1);
  });

  it('computeBaseline → POST .../compute z entityId/forecastPeriodIds/openingBalanceSheetPeriodId', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        data: { jobId: 'job-1', jobStatus: 'succeeded', periodsComputed: 12, monthlyResults: [{ periodId: 'per-1', converged: true, iterationsUsed: 3, cash: -50000, netIncome: 1000, qualityFlag: 'FUNDING_GAP' }] },
      })
    );
    const result = await computeBaseline({ businessVersionId: 'bv-1', entityId: 'ent-1', forecastPeriodIds: ['per-1'], openingBalanceSheetPeriodId: 'per-0' });
    const [url, opts] = mockedFetch.mock.calls[0];
    expect(url).toContain('/api/v8/finance-v2/baseline/bv-1/compute');
    const sentBody = JSON.parse(String(opts?.body));
    expect(sentBody).toEqual({ entityId: 'ent-1', forecastPeriodIds: ['per-1'], openingBalanceSheetPeriodId: 'per-0' });
    // Dowód „brak plugu" na poziomie klienta: ujemna kasa przechodzi przez klienta
    // BEZ modyfikacji (nigdy nie jest podnoszona do zera po drodze).
    expect(result.monthlyResults[0].cash).toBe(-50000);
    expect(result.monthlyResults[0].qualityFlag).toBe('FUNDING_GAP');
  });

  it('computeBaseline → błąd 404 NO_SOURCE_STATEMENT_PACK_EDGE trafia do Error z .data.code czytelnym przez isFinanceV2ApiError', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(404, { error: 'Business version not found in lineage', code: 'NO_SOURCE_STATEMENT_PACK_EDGE' })
    );
    let caught: unknown = null;
    try {
      await computeBaseline({ businessVersionId: 'bv-x', entityId: 'ent-1', forecastPeriodIds: ['per-1'], openingBalanceSheetPeriodId: 'per-0' });
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(isFinanceV2ApiError(caught)).toBe(true);
    // KONTROLA NEGATYWNA: gdyby klient czytał `.code` wprost (zamiast `.data.code`,
    // patrz financeV2.types.ts §1.3), ten assert dałby `undefined` — to jest
    // dokładnie błąd, który złapał Pakiet C podczas pisania własnych testów.
    expect((caught as { data?: { code?: string } }).data?.code).toBe('NO_SOURCE_STATEMENT_PACK_EDGE');
  });

  it('computeBaseline → błąd 409 CIRCULARITY_NOT_CONVERGED niesie failedAtPeriodId/partialResults', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(409, {
        error: 'Circularity solver did not converge',
        code: 'CIRCULARITY_NOT_CONVERGED',
        failedAtPeriodId: 'per-7',
        partialResults: [{ periodId: 'per-1', converged: true, iterationsUsed: 2, cash: 1000, netIncome: 100, qualityFlag: null }],
      })
    );
    let caught: unknown = null;
    try {
      await computeBaseline({ businessVersionId: 'bv-1', entityId: 'ent-1', forecastPeriodIds: ['per-1'], openingBalanceSheetPeriodId: 'per-0' });
    } catch (e) {
      caught = e;
    }
    const err = caught as { data?: { code?: string; failedAtPeriodId?: string; partialResults?: unknown[] } };
    expect(err.data?.code).toBe('CIRCULARITY_NOT_CONVERGED');
    expect(err.data?.failedAtPeriodId).toBe('per-7');
    expect(err.data?.partialResults).toHaveLength(1);
  });

  it('listBaselineOutputs → GET .../outputs z filtrami statementType/periodId', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: [] }));
    await listBaselineOutputs('bv-1', { statementType: 'BS', periodId: 'per-1' });
    const [url] = mockedFetch.mock.calls[0];
    expect(url).toContain('/api/v8/finance-v2/baseline/bv-1/outputs?statementType=BS&periodId=per-1');
  });

  it('listBaselineOutputs → CASH z value.status=PRESENT_ZERO NIE jest tym samym co MISSING (dowód na poziomie klienta)', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        data: [
          { outputId: 'o-1', statementType: 'BS', canonicalLineId: 'l-cash', lineCode: 'CASH', entityId: 'ent-1', periodId: 'per-1', periodLabel: '01/2026', consolidationScope: 'CONSOLIDATED', value: { status: 'PRESENT_ZERO', valueDecimal: '0', nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'UNITS', multiplier: '1' }, valueKind: 'FORECAST', drivingScheduleType: null, createdBy: 'u-1', createdAt: '2026-01-01' },
        ],
      })
    );
    const rows = await listBaselineOutputs('bv-1');
    expect(rows[0].value.status).toBe('PRESENT_ZERO');
    expect(rows[0].value.valueDecimal).toBe('0');
  });
});
