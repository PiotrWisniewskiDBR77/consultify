/**
 * OWN-FIN-014 — testy `analysisKpiTable.contract.ts`. Kontrole negatywne
 * wymagane brifem: "MISSING ≠ 0" w kontekście delty r/r, "eksport używa
 * WYBRANEGO zestawu, nie widocznego", i "wiersz niesie okresy" (jeden wiersz
 * na KPI, wartości per okres w osobnych kolumnach — nie jeden wiersz na
 * (kpi, okres) z zawsze pustymi kolumnami okresów).
 */
import { describe, expect, it } from 'vitest';

import type { AnalysisKpiValueDto } from '../../../../services/api/financeV2.types';
import {
  buildAnalysisKpiColumns,
  computeYoyDelta,
  groupAnalysisKpiValuesByKpi,
  selectExportColumns,
  toAnalysisKpiTableRow,
  type AnalysisKpiTableRowInput,
} from '../analysisKpiTable.contract';

function value(status: AnalysisKpiValueDto['value']['status'], valueDecimal: string | null): AnalysisKpiValueDto['value'] {
  return { status, valueDecimal, nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'UNITS', multiplier: '1' };
}

function kpiValue(overrides: Partial<AnalysisKpiValueDto> & Pick<AnalysisKpiValueDto, 'kpiValueId' | 'periodId' | 'value'>): AnalysisKpiValueDto {
  return {
    kpiCatalogId: 'cat-1',
    kpiCode: 'GROSS_MARGIN_PCT',
    kpiName: 'Marża brutto',
    category: 'Rentowność',
    tier: 'UNIVERSAL',
    unitType: 'PERCENT',
    entityId: 'ent-1',
    qualityFlag: null,
    deltaVsPriorPeriod: null,
    deltaPctVsPriorPeriod: null,
    interpretationText: null,
    benchmark: null,
    createdAt: '2026-08-11T00:00:00Z',
    updatedAt: '2026-08-11T00:00:00Z',
    ...overrides,
  };
}

describe('computeYoyDelta', () => {
  it('oba obecne: 120 vs 100 ⇒ +20 / +20%', () => {
    const result = computeYoyDelta(value('PRESENT_NONZERO', '120'), value('PRESENT_NONZERO', '100'));
    expect(result.status).toBe('COMPUTED');
    expect(result.absoluteDelta).toBe(20);
    expect(result.percentDelta).toBeCloseTo(20, 10);
  });

  it('KONTROLA NEGATYWNA (MISSING ≠ 0): current MISSING ⇒ status MISSING_CURRENT, delty null (nie 0, nie -100%)', () => {
    const result = computeYoyDelta(value('MISSING', null), value('PRESENT_NONZERO', '100'));
    expect(result.status).toBe('MISSING_CURRENT');
    expect(result.absoluteDelta).toBeNull();
    expect(result.percentDelta).toBeNull();
  });

  it('KONTROLA NEGATYWNA (MISSING ≠ 0): brak wartości poprzedniego okresu (null, pierwszy okres) ⇒ MISSING_PRIOR, nie "+100%"', () => {
    const result = computeYoyDelta(value('PRESENT_NONZERO', '100'), null);
    expect(result.status).toBe('MISSING_PRIOR');
    expect(result.percentDelta).toBeNull();
  });

  it('prior=0 (realne zero) ⇒ absoluteDelta policzone, ale percentDelta null (nie Infinity/0%) — dzielenie przez zero jest nieokreślone, nie "brak zmiany"', () => {
    const result = computeYoyDelta(value('PRESENT_NONZERO', '50'), value('PRESENT_ZERO', '0'));
    expect(result.status).toBe('PRIOR_ZERO_PCT_UNDEFINED');
    expect(result.absoluteDelta).toBe(50);
    expect(result.percentDelta).toBeNull();
  });

  it('oba PRESENT_ZERO (realne zera oba okresy) ⇒ delta 0, nie MISSING', () => {
    const result = computeYoyDelta(value('PRESENT_ZERO', '0'), value('PRESENT_ZERO', '0'));
    expect(result.status).toBe('PRIOR_ZERO_PCT_UNDEFINED');
    expect(result.absoluteDelta).toBe(0);
  });
});

describe('groupAnalysisKpiValuesByKpi — jeden wiersz na KPI, wiele okresów', () => {
  const periods = ['p-2024', 'p-2025', 'p-2026'];

  it('scala trzy okresy tego samego KPI w JEDNĄ grupę z 3 kolumnami okresów wypełnionymi', () => {
    const values: AnalysisKpiValueDto[] = [
      kpiValue({ kpiValueId: 'kv-2024', periodId: 'p-2024', value: value('PRESENT_NONZERO', '0.30') }),
      kpiValue({ kpiValueId: 'kv-2025', periodId: 'p-2025', value: value('PRESENT_NONZERO', '0.35') }),
      kpiValue({ kpiValueId: 'kv-2026', periodId: 'p-2026', value: value('PRESENT_NONZERO', '0.40') }),
    ];
    const groups = groupAnalysisKpiValuesByKpi(values, periods);
    expect(groups).toHaveLength(1);
    expect(groups[0].kpiCode).toBe('GROSS_MARGIN_PCT');
    expect(groups[0].periodValuesByColumnId['p-2024']?.valueDecimal).toBe('0.30');
    expect(groups[0].periodValuesByColumnId['p-2025']?.valueDecimal).toBe('0.35');
    expect(groups[0].periodValuesByColumnId['p-2026']?.valueDecimal).toBe('0.40');
  });

  it('"bieżąca" wartość i priorPeriodValue to najnowszy okres Z DANYMI i ten bezpośrednio przed nim, NIE ostatni element tablicy wejściowej', () => {
    // Celowo w kolejności NIE-chronologicznej (dowód, że grupowanie sortuje wg periodColumnIdsChronological, nie wg kolejności sieci)
    const values: AnalysisKpiValueDto[] = [
      kpiValue({ kpiValueId: 'kv-2026', periodId: 'p-2026', value: value('PRESENT_NONZERO', '0.40') }),
      kpiValue({ kpiValueId: 'kv-2024', periodId: 'p-2024', value: value('PRESENT_NONZERO', '0.30') }),
      kpiValue({ kpiValueId: 'kv-2025', periodId: 'p-2025', value: value('PRESENT_NONZERO', '0.35') }),
    ];
    const groups = groupAnalysisKpiValuesByKpi(values, periods);
    expect(groups[0].latestValue.kpiValueId).toBe('kv-2026');
    expect(groups[0].priorPeriodValue?.valueDecimal).toBe('0.35');
  });

  it('KONTROLA NEGATYWNA: okres bez wiersza compute ⇒ `undefined` w periodValuesByColumnId, RÓŻNE od MISSING (który JEST wierszem)', () => {
    const values: AnalysisKpiValueDto[] = [
      kpiValue({ kpiValueId: 'kv-2025', periodId: 'p-2025', value: value('PRESENT_NONZERO', '0.35') }),
    ];
    const groups = groupAnalysisKpiValuesByKpi(values, periods);
    expect(groups[0].periodValuesByColumnId['p-2024']).toBeUndefined();
    expect(groups[0].periodValuesByColumnId['p-2026']).toBeUndefined();
    expect(groups[0].periodValuesByColumnId['p-2025']?.status).toBe('PRESENT_NONZERO');
  });

  it('dwa różne KPI ⇒ dwie grupy, POSORTOWANE po kpiCode (determinizm, niezależnie od kolejności wejścia)', () => {
    const values: AnalysisKpiValueDto[] = [
      kpiValue({ kpiValueId: 'kv-b', kpiCode: 'NET_MARGIN_PCT', periodId: 'p-2025', value: value('PRESENT_NONZERO', '0.1') }),
      kpiValue({ kpiValueId: 'kv-a', kpiCode: 'GROSS_MARGIN_PCT', periodId: 'p-2025', value: value('PRESENT_NONZERO', '0.4') }),
    ];
    const groups = groupAnalysisKpiValuesByKpi(values, periods);
    expect(groups.map((g) => g.kpiCode)).toEqual(['GROSS_MARGIN_PCT', 'NET_MARGIN_PCT']);
  });

  it('kolejność wejścia odwrócona daje IDENTYCZNĄ kolejność grup wyjściowych (dowód determinizmu grupowania)', () => {
    const forward: AnalysisKpiValueDto[] = [
      kpiValue({ kpiValueId: 'kv-a', kpiCode: 'A_KPI', periodId: 'p-2025', value: value('PRESENT_NONZERO', '1') }),
      kpiValue({ kpiValueId: 'kv-b', kpiCode: 'B_KPI', periodId: 'p-2025', value: value('PRESENT_NONZERO', '2') }),
      kpiValue({ kpiValueId: 'kv-c', kpiCode: 'C_KPI', periodId: 'p-2025', value: value('PRESENT_NONZERO', '3') }),
    ];
    const reversed = [...forward].reverse();
    const groupsForward = groupAnalysisKpiValuesByKpi(forward, periods).map((g) => g.kpiCode);
    const groupsReversed = groupAnalysisKpiValuesByKpi(reversed, periods).map((g) => g.kpiCode);
    expect(groupsForward).toEqual(groupsReversed);
  });
});

describe('toAnalysisKpiTableRow', () => {
  const periods = ['p-2025', 'p-2026'];
  const baseValues: AnalysisKpiValueDto[] = [
    kpiValue({ kpiValueId: 'kv-2025', periodId: 'p-2025', value: value('PRESENT_NONZERO', '0.35'), interpretationText: 'Marża rośnie dzięki niższym kosztom materiałów.' }),
    kpiValue({ kpiValueId: 'kv-2026', periodId: 'p-2026', value: value('PRESENT_NONZERO', '0.4'), interpretationText: 'Marża rośnie dzięki niższym kosztom materiałów.' }),
  ];

  it('spłaszcza grupę do TableRow z id=kpiCode, poprawnym formatowaniem wartości i WYPEŁNIONYMI kolumnami okresów', () => {
    const groups = groupAnalysisKpiValuesByKpi(baseValues, periods);
    const input: AnalysisKpiTableRowInput = {
      group: groups[0],
      formulaInfo: { formulaDisplay: '(Przychody − COGS) / Przychody', interpretationGeneral: 'Wyższa = lepiej', downstreamUses: ['Model bazowy'] },
      includedInReport: true,
      markedAsModelInput: false,
    };
    const row = toAnalysisKpiTableRow(input);
    expect(row.id).toBe('GROSS_MARGIN_PCT');
    expect(row.kpiName).toBe('Marża brutto');
    expect(row.valueIsMissingLike).toBe(false);
    expect(row.formulaDisplay).toBe('(Przychody − COGS) / Przychody');
    // Dowód naprawy: kolumny okresów NIE są puste — niosą sformatowaną wartość TEGO okresu.
    expect(row['period.p-2025']).toBe('0,35');
    expect(row['period.p-2026']).toBe('0,4');
  });

  it('KONTROLA NEGATYWNA: KPI MISSING ⇒ wiersz ma valueIsMissingLike=true i valueDisplay="—", NIGDY "0"', () => {
    const values: AnalysisKpiValueDto[] = [kpiValue({ kpiValueId: 'kv-2026', periodId: 'p-2026', value: value('MISSING', null) })];
    const groups = groupAnalysisKpiValuesByKpi(values, periods);
    const input: AnalysisKpiTableRowInput = {
      group: groups[0],
      formulaInfo: null,
      includedInReport: false,
      markedAsModelInput: false,
    };
    const row = toAnalysisKpiTableRow(input);
    expect(row.valueIsMissingLike).toBe(true);
    expect(row.valueDisplay).toBe('—');
    expect(row.valueDisplay).not.toBe('0');
    expect(row.valueReason).toBeTruthy();
  });

  it('KONTROLA NEGATYWNA: okres bez wiersza compute (undefined) ⇒ komórka okresu "—", ODRÓŻNIONA (__periodCellIsMissingLike) od realnego formatowania liczby', () => {
    const values: AnalysisKpiValueDto[] = [kpiValue({ kpiValueId: 'kv-2026', periodId: 'p-2026', value: value('PRESENT_NONZERO', '0.4') })];
    const groups = groupAnalysisKpiValuesByKpi(values, periods);
    const row = toAnalysisKpiTableRow({ group: groups[0], formulaInfo: null, includedInReport: true, markedAsModelInput: false });
    expect(row['period.p-2025']).toBe('—');
    expect((row.__periodCellIsMissingLike as Record<string, boolean>)['period.p-2025']).toBe(true);
    expect(row['period.p-2026']).toBe('0,4');
    expect((row.__periodCellIsMissingLike as Record<string, boolean>)['period.p-2026']).toBe(false);
  });
});

describe('buildAnalysisKpiColumns', () => {
  it('zawiera katalog pól z brifu (nazwa/kategoria/wzór/interpretacja/r-r/benchmark/jakość/downstream) — nie sztywny ubogi zestaw', () => {
    const columns = buildAnalysisKpiColumns([{ id: 'p1', label: '2025' }, { id: 'p2', label: '2026P' }]);
    const ids = columns.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'kpiName',
        'category',
        'formulaDisplay',
        'interpretationGeneral',
        'period.p1',
        'period.p2',
        'yoyDelta',
        'benchmark',
        'interpretationSpecific',
        'qualityFlag',
        'downstreamUses',
      ])
    );
  });

  it('kolumny okresów są dynamiczne — inna lista okresów daje inne kolumny (dowód, nie stała atrapa)', () => {
    const twoYears = buildAnalysisKpiColumns([{ id: 'p1', label: '2025' }]);
    const fourYears = buildAnalysisKpiColumns([
      { id: 'p1', label: '2023' },
      { id: 'p2', label: '2024' },
      { id: 'p3', label: '2025' },
      { id: 'p4', label: '2026P' },
    ]);
    expect(fourYears.length).toBe(twoYears.length + 3);
  });
});

describe('selectExportColumns — OWN-FIN-014: eksport = wybrany zestaw, nie widoczny', () => {
  it('KONTROLA NEGATYWNA: brak jawnej selekcji ⇒ ok:false, nawet gdy kolumny są widoczne w tabeli', () => {
    const result = selectExportColumns(['kpiName', 'category', 'yoyDelta', 'benchmark'], null);
    expect(result.ok).toBe(false);
  });

  it('jawna selekcja różna od widocznych kolumn ⇒ eksport używa selekcji, NIE widocznych (dowód rozdzielenia)', () => {
    const visibleColumns = ['kpiName', 'category', 'yoyDelta', 'benchmark', 'qualityFlag'];
    const explicitSelection = { columnIds: ['kpiName', 'formulaDisplay'], selectedAtIso: '2026-08-11T00:00:00Z' };
    const result = selectExportColumns(visibleColumns, explicitSelection);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.columnIds).toEqual(['kpiName', 'formulaDisplay']);
      // formulaDisplay NIE jest widoczne w tabeli w tym scenariuszu, a i tak trafia do eksportu — dowód.
      expect(visibleColumns).not.toContain('formulaDisplay');
    }
  });
});
