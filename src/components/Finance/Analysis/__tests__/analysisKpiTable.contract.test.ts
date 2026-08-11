/**
 * OWN-FIN-014 — testy `analysisKpiTable.contract.ts`. Kontrole negatywne
 * wymagane brifem: "MISSING ≠ 0" w kontekście delty r/r, i "eksport używa
 * WYBRANEGO zestawu, nie widocznego".
 */
import { describe, expect, it } from 'vitest';

import type { AnalysisKpiValueDto } from '../../../../services/api/financeV2.types';
import {
  buildAnalysisKpiColumns,
  computeYoyDelta,
  selectExportColumns,
  toAnalysisKpiTableRow,
  type AnalysisKpiTableRowInput,
} from '../analysisKpiTable.contract';

function value(status: AnalysisKpiValueDto['value']['status'], valueDecimal: string | null): AnalysisKpiValueDto['value'] {
  return { status, valueDecimal, nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'UNITS', multiplier: '1' };
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

describe('toAnalysisKpiTableRow', () => {
  const baseKpiValue: AnalysisKpiValueDto = {
    kpiValueId: 'kv-1',
    kpiCatalogId: 'cat-1',
    kpiCode: 'GROSS_MARGIN_PCT',
    kpiName: 'Marża brutto',
    category: 'Rentowność',
    tier: 'UNIVERSAL',
    unitType: 'PERCENT',
    entityId: 'ent-1',
    periodId: 'p-2026-q1',
    value: value('PRESENT_NONZERO', '0.4'),
    qualityFlag: null,
    deltaVsPriorPeriod: null,
    deltaPctVsPriorPeriod: null,
    interpretationText: 'Marża rośnie dzięki niższym kosztom materiałów.',
    benchmark: null,
    createdAt: '2026-08-11T00:00:00Z',
    updatedAt: '2026-08-11T00:00:00Z',
  };

  it('spłaszcza DTO do TableRow z id=kpiValueId i poprawnym formatowaniem wartości', () => {
    const input: AnalysisKpiTableRowInput = {
      kpiValue: baseKpiValue,
      priorPeriodValue: null,
      formulaInfo: { formulaDisplay: '(Przychody − COGS) / Przychody', interpretationGeneral: 'Wyższa = lepiej', downstreamUses: ['Model bazowy'] },
      includedInReport: true,
      markedAsModelInput: false,
    };
    const row = toAnalysisKpiTableRow(input);
    expect(row.id).toBe('kv-1');
    expect(row.kpiName).toBe('Marża brutto');
    expect(row.valueIsMissingLike).toBe(false);
    expect(row.formulaDisplay).toBe('(Przychody − COGS) / Przychody');
  });

  it('KONTROLA NEGATYWNA: KPI MISSING ⇒ wiersz ma valueIsMissingLike=true i valueDisplay="—", NIGDY "0"', () => {
    const input: AnalysisKpiTableRowInput = {
      kpiValue: { ...baseKpiValue, value: value('MISSING', null) },
      priorPeriodValue: null,
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
