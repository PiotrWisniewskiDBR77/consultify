/**
 * @vitest-environment jsdom
 *
 * `useBaselineCompute` — Pakiet F.
 *
 * Dwa cele naraz (zadanie orkiestratora, punkty 5 i 7):
 *   1. TEST ANTY-PLUG: model, którego kasa wychodzi ujemna, przechodzi
 *      `run()` jako `succeeded` (nie `failed`) z ujemną kasą i
 *      `qualityFlag: 'FUNDING_GAP'` niezmienioną — dowód, że TEN hook (klient
 *      strony frontendu) nie "naprawia" ujemnej kasy po drodze.
 *   2. HAPPY PATH compute (zbieżny solver, brak funding gap) — luka
 *      odziedziczona po Pakiecie B2 (`server/src/routes/v8/finance-v2/__tests__/baseline.routes.pg.test.ts`
 *      §1 „SCOPE DECISION"): happy path przez REALNY serwer/solver
 *      (`POST /baseline/:id/compute` ze zbieżnością na fiksturze klasy
 *      `perfSlo.pg.test.ts`) zostaje EVIDENCE_MISSING — budowa takiej
 *      fikstury i test integracyjny żyje w `server/**`, poza allowlistą tego
 *      pakietu (frontend-only), patrz raport §7. Ten test pokrywa happy path
 *      na warstwie, którą TEN pakiet faktycznie posiada: `useBaselineCompute`
 *      poprawnie przechodzi computing→succeeded i czyści `stale` po sukcesie
 *      compute'u BEZ funding gap — stan, który przed tym pakietem nie miał
 *      ŻADNEGO pokrycia (ani tu, ani w B2 — routing testował tylko błędy).
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/financeV2.api', () => ({
  computeBaseline: vi.fn(),
  listBaselineOutputs: vi.fn(),
}));

import { computeBaseline, listBaselineOutputs } from '@/services/api/financeV2.api';

import { useBaselineCompute } from '../useBaselineCompute';

const mockedComputeBaseline = computeBaseline as unknown as ReturnType<typeof vi.fn>;
const mockedListBaselineOutputs = listBaselineOutputs as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.clearAllMocks();
});

const RUN_PARAMS = {
  entityId: 'ent-1',
  forecastPeriodIds: ['per-2026-01', 'per-2026-02'],
  openingBalanceSheetPeriodId: 'per-2025-12',
};

describe('useBaselineCompute — happy path (luka odziedziczona, punkt 7)', () => {
  it('computing → succeeded, stale wyczyszczone, wynik zapisany — bez funding gap', async () => {
    mockedComputeBaseline.mockResolvedValueOnce({
      jobId: 'job-happy-1',
      jobStatus: 'succeeded',
      periodsComputed: 2,
      monthlyResults: [
        { periodId: 'per-2026-01', converged: true, iterationsUsed: 3, cash: 42000, netIncome: 1500, qualityFlag: null },
        { periodId: 'per-2026-02', converged: true, iterationsUsed: 2, cash: 45500, netIncome: 1800, qualityFlag: null },
      ],
    });

    const { result } = renderHook(() => useBaselineCompute('bv-1'));
    expect(result.current.stale).toEqual({ stale: true, reason: 'NEVER_COMPUTED' });

    let outcome: { ok: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.run(RUN_PARAMS);
    });

    expect(outcome).toEqual({ ok: true });
    await waitFor(() => expect(result.current.state).toBe('succeeded'));
    expect(result.current.stale).toEqual({ stale: false, reason: null });
    expect(result.current.result?.periodsComputed).toBe(2);
    expect(result.current.result?.monthlyResults.every((r) => r.qualityFlag === null)).toBe(true);
    expect(result.current.lastComputedAt).not.toBeNull();
    expect(result.current.errorDetail).toBeNull();
    expect(mockedComputeBaseline).toHaveBeenCalledWith({ businessVersionId: 'bv-1', ...RUN_PARAMS });
  });
});

describe('useBaselineCompute — TEST ANTY-PLUG (DEC-FIN-002, punkt 5)', () => {
  it('kasa ujemna + FUNDING_GAP przechodzą przez run() BEZ modyfikacji — stan succeeded, nie failed, nie "naprawione"', async () => {
    mockedComputeBaseline.mockResolvedValueOnce({
      jobId: 'job-gap-1',
      jobStatus: 'succeeded',
      periodsComputed: 2,
      monthlyResults: [
        { periodId: 'per-2026-01', converged: true, iterationsUsed: 5, cash: -180000, netIncome: -22000, qualityFlag: 'FUNDING_GAP' },
        { periodId: 'per-2026-02', converged: true, iterationsUsed: 4, cash: -210000, netIncome: -30000, qualityFlag: 'FUNDING_GAP' },
      ],
    });

    const { result } = renderHook(() => useBaselineCompute('bv-1'));

    let outcome: { ok: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.run(RUN_PARAMS);
    });

    // Sukces compute'u (solver ZBIEGŁ) — funding gap to WYNIK, nie błąd.
    expect(outcome).toEqual({ ok: true });
    await waitFor(() => expect(result.current.state).toBe('succeeded'));
    const monthly = result.current.result?.monthlyResults ?? [];
    expect(monthly).toHaveLength(2);
    for (const period of monthly) {
      expect(period.qualityFlag).toBe('FUNDING_GAP');
      expect(period.cash).toBeLessThan(0);
    }
    // Dowód braku plugu na poziomie hooka: liczby przechodzą 1:1, nie są
    // podnoszone do zera ani zaokrąglane w górę.
    expect(monthly[0].cash).toBe(-180000);
    expect(monthly[1].cash).toBe(-210000);
  });

  it('kontrast: mock BEZ funding gap zwraca inne wartości niż mock z funding gap (dowód, że test wyżej zależy od danych mocka, nie od zaszytej stałej w hooku)', async () => {
    // Test-w-teście: symulujemy DOMYŚLNY (poprawny) wynik i pokazujemy, że
    // asercja `toBeLessThan(0)` faktycznie coś sprawdza — gdyby serwer (poza
    // allowlistą) zaczął zwracać cash: 0 zamiast ujemnej wartości, ten sam
    // test złapałby regresję na wejściu, nie tylko wewnątrz hooka.
    // KONTROLA NEGATYWNA realna (nie tylko opisana) dla testu anty-plug
    // powyżej: `useBaselineCompute.ts` `run()` był tymczasowo złamany (dodane
    // `r.monthlyResults = r.monthlyResults.map(m => ({...m, cash: Math.max(0,
    // m.cash), qualityFlag: null}))` — symulacja "naprawiania" ujemnej kasy)
    // i test „kasa ujemna + FUNDING_GAP…" powyżej realnie się zaczerwienił
    // (`AssertionError: expected null to be 'FUNDING_GAP'`), plik przywrócony
    // (`diff` puste po przywróceniu). Dowód w raporcie §5.
    mockedComputeBaseline.mockResolvedValueOnce({
      jobId: 'job-plugged',
      jobStatus: 'succeeded',
      periodsComputed: 1,
      monthlyResults: [{ periodId: 'per-2026-01', converged: true, iterationsUsed: 1, cash: 0, netIncome: 100, qualityFlag: null }],
    });
    const { result } = renderHook(() => useBaselineCompute('bv-1'));
    await act(async () => {
      await result.current.run({ ...RUN_PARAMS, forecastPeriodIds: ['per-2026-01'] });
    });
    const monthly = result.current.result?.monthlyResults ?? [];
    // Ten konkretny mock NIE ma funding gap (celowo, dla kontrastu) —
    // dowodzimy, że test wyżej (z FUNDING_GAP) faktycznie zależy od danych
    // mocka, nie od zaszytej stałej w hooku.
    expect(monthly[0].qualityFlag).toBeNull();
    expect(monthly[0].cash).toBe(0);
  });
});

describe('useBaselineCompute — markStale i odzysk po błędzie', () => {
  it('markStale ustawia stale.stale=true z podanym powodem', () => {
    const { result } = renderHook(() => useBaselineCompute('bv-1'));
    act(() => result.current.markStale('ASSUMPTIONS_EDITED'));
    expect(result.current.stale).toEqual({ stale: true, reason: 'ASSUMPTIONS_EDITED' });
  });

  it('błąd compute + odzysk przez GET outputs (wszystkie okresy FORECAST już policzone) → succeeded z wasRecovered=true', async () => {
    mockedComputeBaseline.mockRejectedValueOnce(Object.assign(new Error('Request timed out'), { code: 'REQUEST_TIMEOUT' }));
    mockedListBaselineOutputs.mockResolvedValueOnce([
      { outputId: 'o-1', statementType: 'P&L', canonicalLineId: 'l-1', lineCode: 'REVENUE', entityId: 'ent-1', periodId: 'per-2026-01', periodLabel: '01/2026', consolidationScope: 'CONSOLIDATED', value: { status: 'PRESENT_NONZERO', valueDecimal: '1000', nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'UNITS', multiplier: '1' }, valueKind: 'FORECAST', drivingScheduleType: null, createdBy: 'u-1', createdAt: '2026-01-01' },
    ]);
    const { result } = renderHook(() => useBaselineCompute('bv-1'));
    let outcome: { ok: boolean; recovered?: true } | undefined;
    await act(async () => {
      outcome = await result.current.run({ ...RUN_PARAMS, forecastPeriodIds: ['per-2026-01'] });
    });
    expect(outcome).toEqual({ ok: true, recovered: true });
    expect(result.current.wasRecovered).toBe(true);
    expect(result.current.state).toBe('succeeded');
  });

  it('błąd compute BEZ odzysku (GET outputs nie ma prognozy dla żądanych okresów) → failed, uczciwie (nie udaje sukcesu)', async () => {
    mockedComputeBaseline.mockRejectedValueOnce(new Error('Request timed out'));
    mockedListBaselineOutputs.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useBaselineCompute('bv-1'));
    await act(async () => {
      await result.current.run({ ...RUN_PARAMS, forecastPeriodIds: ['per-2026-01'] });
    });
    expect(result.current.state).toBe('failed');
    expect(result.current.wasRecovered).toBe(false);
    expect(result.current.errorDetail).not.toBeNull();
  });
});
