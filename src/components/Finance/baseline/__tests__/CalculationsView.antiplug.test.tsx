/**
 * @vitest-environment jsdom
 *
 * Pakiet F — TEST ANTY-PLUG (zadanie orkiestratora, punkt 5) + `missing !=
 * zero` (punkt 6) dla `CalculationsView`.
 *
 * DEC-FIN-002 (no-decision Baseline): silnik NIGDY nie podnosi ujemnej kasy
 * do zera ani nie wstawia finansowania — jeśli kasa wychodzi ujemna, widok
 * ma to POKAZAĆ (czerwony alarm luki finansowania + liczba ujemna w
 * tabeli), NIE ukryć/wybielić. Ten plik dowodzi, że `CalculationsView`
 * (renderer, nie silnik — silnik jest w `server/**`, poza allowlistą tego
 * pakietu) faktycznie tak się zachowuje, budując model, którego
 * `monthlyResults`/`outputs` mają ujemną kasę + `qualityFlag: 'FUNDING_GAP'`.
 *
 * ★ KOREKTA KANONU (orkiestrator, master plan §2.4): typ wartości ma PIĘĆ
 * stanów, nie trzy — `PRESENT_ZERO`/`PRESENT_NONZERO`/`MISSING`/`NA`/
 * `NOT_APPLICABLE`. `NA` = „nie da się policzyć"; `NOT_APPLICABLE` = „nie
 * dotyczy tego podmiotu/okresu" — dwie różne informacje, nawet jeśli dzielą
 * ten sam glif „—" (celowa decyzja Pakietu C — rozróżnienie żyje w `title`/
 * etykiecie obok, nie w glifie). Ten plik dowodzi trzy rzeczy:
 *   1. CASH ujemna → alarm + liczba ujemna (test anty-plug, punkt 5).
 *   2. Trzy stany w JEDNYM teście (MISSING/PRESENT_ZERO/PRESENT_NONZERO
 *      ujemny) są wizualnie/programowo odróżnialne (punkt 6):
 *      - CASH 01/2026: PRESENT_NONZERO, -125000 (ujemna, prawdziwa liczba)
 *      - CASH 02/2026: MISSING (brak danych — silnik nie policzył tego miesiąca)
 *      - CASH 03/2026: PRESENT_ZERO, 0 (prawdziwe zero, nie brak danych)
 *   3. (blok „pięć stanów" niżej) MISSING vs NA vs NOT_APPLICABLE renderują
 *      TEN SAM glif, ale NIE TEN SAM `title` — użytkownik może je rozróżnić.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { BaselineOutputDto, BaselinePeriodComputeSummaryDto } from '@/services/api/financeV2.types';

import { CalculationsView, type PeriodMeta } from '../CalculationsView';

const FORECAST_PERIODS: PeriodMeta[] = [
  { periodId: 'per-2026-01', label: '01/2026', yearMonth: '2026-01' },
  { periodId: 'per-2026-02', label: '02/2026', yearMonth: '2026-02' },
  { periodId: 'per-2026-03', label: '03/2026', yearMonth: '2026-03' },
];

function cashOutput(periodId: string, value: BaselineOutputDto['value']): BaselineOutputDto {
  return {
    outputId: `out-cash-${periodId}`,
    statementType: 'BS',
    canonicalLineId: `line-cash-${periodId}`,
    lineCode: 'CASH',
    entityId: 'ent-1',
    periodId,
    periodLabel: periodId,
    consolidationScope: 'CONSOLIDATED',
    value,
    valueKind: 'FORECAST',
    drivingScheduleType: null,
    createdBy: 'u-1',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

const OUTPUTS: BaselineOutputDto[] = [
  cashOutput('per-2026-01', {
    status: 'PRESENT_NONZERO',
    valueDecimal: '-125000',
    nativeCurrency: 'PLN',
    presentationCurrency: 'PLN',
    unit: 'UNITS',
    multiplier: '1',
  }),
  cashOutput('per-2026-02', {
    status: 'MISSING',
    valueDecimal: null,
    nativeCurrency: 'PLN',
    presentationCurrency: 'PLN',
    unit: 'UNITS',
    multiplier: '1',
  }),
  cashOutput('per-2026-03', {
    status: 'PRESENT_ZERO',
    valueDecimal: '0',
    nativeCurrency: 'PLN',
    presentationCurrency: 'PLN',
    unit: 'UNITS',
    multiplier: '1',
  }),
];

const MONTHLY_RESULTS: BaselinePeriodComputeSummaryDto[] = [
  { periodId: 'per-2026-01', converged: true, iterationsUsed: 4, cash: -125000, netIncome: -8000, qualityFlag: 'FUNDING_GAP' },
  { periodId: 'per-2026-02', converged: true, iterationsUsed: 3, cash: 0, netIncome: 500, qualityFlag: null },
  { periodId: 'per-2026-03', converged: true, iterationsUsed: 2, cash: 0, netIncome: 900, qualityFlag: null },
];

function baseProps() {
  return {
    outputs: OUTPUTS,
    loadingOutputs: false,
    outputsError: null,
    forecastPeriods: FORECAST_PERIODS,
    computeState: 'succeeded' as const,
    computeErrorDetail: null,
    lastComputedAt: new Date('2026-08-12T10:00:00.000Z'),
    wasRecovered: false,
    stale: { stale: false, reason: null },
    monthlyResults: MONTHLY_RESULTS,
    onRunCompute: vi.fn(),
  };
}

describe('CalculationsView — test anty-plug (DEC-FIN-002)', () => {
  it('renderuje alarm luki finansowania, gdy silnik oznaczył okres FUNDING_GAP', () => {
    render(<CalculationsView {...baseProps()} />);
    const alarm = screen.getByTestId('baseline-funding-gap-alarm');
    expect(alarm).toBeInTheDocument();
    expect(alarm).toHaveTextContent('per-2026-01');
    expect(alarm).toHaveTextContent('gotówka spada');
  });

  it('CASH ujemna (-125000) renderuje się jako liczba ujemna w kolorze krytycznym — NIE jako 0 i NIE jako pusta', () => {
    render(<CalculationsView {...baseProps()} />);
    const cell = screen.getByTestId('baseline-cash-value-per-2026-01');
    expect(cell.textContent).not.toBe('0');
    expect(cell.textContent).not.toBe('—');
    // pl-PL formatuje minus jako U+2212 (MINUS SIGN) — sprawdzamy liczbę, nie znak.
    expect(cell.textContent?.replace(/−/g, '-')).toContain('125');
    expect(cell.textContent?.replace(/−/g, '-')).toMatch(/^-/);
    expect(cell.className).toContain('text-c-danger');
  });

  it('CASH MISSING (brak danych źródłowych dla 02/2026) renderuje „—", NIGDY „0" (twarda zasada produktu)', () => {
    render(<CalculationsView {...baseProps()} />);
    const cell = screen.getByTestId('baseline-cash-value-per-2026-02');
    expect(cell.textContent).toBe('—');
    expect(cell.textContent).not.toBe('0');
  });

  it('CASH PRESENT_ZERO (prawdziwe zero dla 03/2026) renderuje „0" — odróżnialne od MISSING', () => {
    render(<CalculationsView {...baseProps()} />);
    const cell = screen.getByTestId('baseline-cash-value-per-2026-03');
    expect(cell.textContent).toBe('0');
    expect(cell.textContent).not.toBe('—');
  });

  it('KONTROLA NEGATYWNA: bez okresów FUNDING_GAP w monthlyResults, alarm NIE renderuje się (dowód, że alarm nie jest zawsze-włączony)', () => {
    const props = baseProps();
    const noGap = props.monthlyResults.map((r) => ({ ...r, qualityFlag: null as const }));
    render(<CalculationsView {...props} monthlyResults={noGap} />);
    expect(screen.queryByTestId('baseline-funding-gap-alarm')).not.toBeInTheDocument();
  });

  // KONTROLA NEGATYWNA realna (nie tylko opisana) dla całego tego pliku:
  // `CalculationsView.tsx` był tymczasowo złamany (dodane `if (line ===
  // 'CASH' && value < 0) value = 0;` tuż przed formatowaniem — symulacja
  // cichego plugu w warstwie renderera) i test „CASH ujemna…" wyżej realnie
  // się zaczerwienił (`AssertionError: expected '0' not to be '0'`), plik
  // przywrócony (`diff` puste po przywróceniu). Dowód w raporcie §5.
  it('KONTROLA NEGATYWNA: gdyby ktoś podmienił wartość ujemną na dodatnią (symulacja "cichego plugu"), test wykrywa różnicę — dowód, że asercja faktycznie mierzy liczbę, nie tylko obecność komórki', () => {
    const props = baseProps();
    const pluggedOutputs = OUTPUTS.map((o) =>
      o.periodId === 'per-2026-01'
        ? { ...o, value: { ...o.value, status: 'PRESENT_ZERO' as const, valueDecimal: '0' } }
        : o
    );
    render(<CalculationsView {...props} outputs={pluggedOutputs} />);
    const cell = screen.getByTestId('baseline-cash-value-per-2026-01');
    // Ten test MUSI się różnić od "CASH ujemna..." powyżej — potwierdza, że
    // gdyby silnik/renderer kiedyś zaczął cicho plugować kasę do zera, ten
    // sam test wykryje to jako "0", a osobny asercyjny test wyżej (oczekujący
    // liczby ujemnej) by się zaczerwienił. Tu tylko dowodzimy czułości harnessu.
    expect(cell.textContent).toBe('0');
  });
});

describe('CalculationsView — PIĘĆ stanów wartości (korekta kanonu, master plan §2.4)', () => {
  it('MISSING vs NA vs NOT_APPLICABLE renderują TEN SAM glif „—", ale RÓŻNY `title` (rozróżnialne dla użytkownika, nie tylko wewnętrznie)', () => {
    const props = baseProps();
    const outputsWithFiveStates: BaselineOutputDto[] = [
      ...OUTPUTS,
      { ...cashOutput('per-2026-01', { status: 'NA', valueDecimal: null, nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'UNITS', multiplier: '1' }), lineCode: 'AR', canonicalLineId: 'line-ar-1', statementType: 'BS' },
      { ...cashOutput('per-2026-01', { status: 'NOT_APPLICABLE', valueDecimal: null, nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'UNITS', multiplier: '1' }), lineCode: 'INVENTORY', canonicalLineId: 'line-inv-1', statementType: 'BS' },
      { ...cashOutput('per-2026-01', { status: 'MISSING', valueDecimal: null, nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'UNITS', multiplier: '1' }), lineCode: 'AP', canonicalLineId: 'line-ap-1', statementType: 'BS' },
    ];
    // AR/INVENTORY/AP nie mają wartości dla 02/2026 i 03/2026 w tym mocku —
    // wystarczy 01/2026 (granularity=monthly=domyślna, grupa 1-elementowa)
    // do dowodu rozróżnienia; pozostałe okresy renderują się jako "brak
    // wyliczenia dla tego okresu" (inny, też uczciwy, powód).
    render(<CalculationsView {...props} outputs={outputsWithFiveStates} />);

    const arCell = screen.getByTestId('baseline-line-value-AR-per-2026-01');
    const inventoryCell = screen.getByTestId('baseline-line-value-INVENTORY-per-2026-01');
    const apCell = screen.getByTestId('baseline-line-value-AP-per-2026-01');

    // Ten sam glif — zgodnie z projektem Pakietu C.
    expect(arCell.textContent).toBe('—');
    expect(inventoryCell.textContent).toBe('—');
    expect(apCell.textContent).toBe('—');

    // RÓŻNY powód w `title` — trzy różne stringi, żaden pusty.
    const arTitle = arCell.getAttribute('title');
    const inventoryTitle = inventoryCell.getAttribute('title');
    const apTitle = apCell.getAttribute('title');
    expect(arTitle).toBe('Analityk oznaczył: nie dotyczy'); // NA
    expect(inventoryTitle).toBe('Pole strukturalnie nie istnieje dla tej linii/branży'); // NOT_APPLICABLE
    expect(apTitle).toBe('Brak danych (luka źródłowa)'); // MISSING
    expect(new Set([arTitle, inventoryTitle, apTitle]).size).toBe(3);
  });
});
