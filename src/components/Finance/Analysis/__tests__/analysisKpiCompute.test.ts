/**
 * DoD (brief): "niezależny known-answer dla co najmniej jednego KPI" +
 * kontrole negatywne "MISSING ≠ 0" i "ujemny mianownik → NA z powodem, nie
 * liczba i nie zero".
 */
import { describe, expect, it } from 'vitest';

import {
  computeKnownAnswerKpi,
  evaluateArithmeticExpression,
  financeValuesToLineCodeMap,
  type AnalysisKnownAnswerKpiDef,
} from '../analysisKpiCompute';

describe('evaluateArithmeticExpression — parser bezpieczny', () => {
  it('arytmetyka podstawowa z nawiasami: (10 - 4) / 2 = 3', () => {
    expect(evaluateArithmeticExpression('(10 - 4) / 2', {})).toBe(3);
  });

  it('identyfikator nieznany (brak w mapie) ⇒ null (MISSING), nie NaN i nie 0', () => {
    const result = evaluateArithmeticExpression('REVENUE + 10', {});
    expect(result).toBeNull();
  });

  it('MISSING propaguje przez cały wyrażenie, nawet zagnieżdżone', () => {
    const result = evaluateArithmeticExpression('ROUND((REVENUE - COGS) / OPEX)', { REVENUE: 100, COGS: null, OPEX: 5 });
    expect(result).toBeNull();
  });

  it('funkcje ABS/MIN/MAX/ROUND liczą poprawnie na znanym wejściu', () => {
    expect(evaluateArithmeticExpression('ABS(-5)', {})).toBe(5);
    expect(evaluateArithmeticExpression('MIN(3, 7, 1)', {})).toBe(1);
    expect(evaluateArithmeticExpression('MAX(3, 7, 1)', {})).toBe(7);
    expect(evaluateArithmeticExpression('ROUND(2.6)', {})).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// KNOWN-ANSWER: Marża brutto % = (REVENUE - COGS) / REVENUE.
// REVENUE=1000, COGS=600 ⇒ (1000-600)/1000 = 0.4 DOKŁADNIE. Liczone RĘCZNIE
// (nie skopiowane z backendu) — to jest niezależny known-answer wymagany DoD.
// ---------------------------------------------------------------------------

const GROSS_MARGIN: AnalysisKnownAnswerKpiDef = {
  kpiCode: 'GROSS_MARGIN_PCT',
  kpiName: 'Marża brutto',
  numeratorExpression: 'REVENUE - COGS',
  denominatorExpression: 'REVENUE',
  negativeDenominatorPolicy: 'FORCE_NA',
};

describe('computeKnownAnswerKpi — KNOWN-ANSWER (DoD)', () => {
  it('Marża brutto: REVENUE=1000, COGS=600 ⇒ dokładnie 0.4, status PRESENT_NONZERO', () => {
    const result = computeKnownAnswerKpi(GROSS_MARGIN, { REVENUE: 1000, COGS: 600 });
    expect(result.status).toBe('PRESENT_NONZERO');
    expect(Number(result.valueDecimal)).toBeCloseTo(0.4, 10);
    expect(result.reasonCode).toBeNull();
  });

  it('Marża brutto: REVENUE=COGS=500 (zysk zerowy) ⇒ dokładnie 0, status PRESENT_ZERO (nie MISSING)', () => {
    const result = computeKnownAnswerKpi(GROSS_MARGIN, { REVENUE: 500, COGS: 500 });
    expect(result.status).toBe('PRESENT_ZERO');
    expect(result.valueDecimal).toBe('0');
  });

  it('KONTROLA NEGATYWNA (MISSING ≠ 0): COGS brakujące (null) ⇒ status MISSING, valueDecimal null — NIGDY liczba, NIGDY 0', () => {
    const result = computeKnownAnswerKpi(GROSS_MARGIN, { REVENUE: 1000, COGS: null });
    expect(result.status).toBe('MISSING');
    expect(result.valueDecimal).toBeNull();
    expect(result.status).not.toBe('PRESENT_ZERO');
    expect(result.reasonCode).toBe('MISSING_INPUT');
  });

  it('KONTROLA NEGATYWNA (MISSING ≠ 0): kod linii w ogóle nieprzekazany (nie tylko null) ⇒ też MISSING, nie 0 przez domyślne "brak klucza = 0"', () => {
    const result = computeKnownAnswerKpi(GROSS_MARGIN, { REVENUE: 1000 }); // brak COGS w mapie
    expect(result.status).toBe('MISSING');
    expect(result.valueDecimal).toBeNull();
  });

  it('KONTROLA NEGATYWNA (ujemny mianownik, polityka FORCE_NA): REVENUE=-200 (mianownik ujemny) ⇒ status NA, powód NEGATIVE_DENOMINATOR, NIGDY liczba', () => {
    const result = computeKnownAnswerKpi(GROSS_MARGIN, { REVENUE: -200, COGS: 100 });
    expect(result.status).toBe('NA');
    expect(result.valueDecimal).toBeNull();
    expect(result.reasonCode).toBe('NEGATIVE_DENOMINATOR');
  });

  it('mianownik dokładnie zero ⇒ status NA z powodem ZERO_DENOMINATOR, nigdy Infinity', () => {
    const result = computeKnownAnswerKpi(GROSS_MARGIN, { REVENUE: 0, COGS: 100 });
    expect(result.status).toBe('NA');
    expect(result.valueDecimal).toBeNull();
    expect(result.reasonCode).toBe('ZERO_DENOMINATOR');
  });

  it('polityka ALLOW_NEGATIVE_RATIO: ten sam ujemny mianownik TERAZ liczy realną wartość (dowód, że polityka faktycznie rozgałęzia zachowanie, nie jest dekoracją)', () => {
    const def: AnalysisKnownAnswerKpiDef = { ...GROSS_MARGIN, negativeDenominatorPolicy: 'ALLOW_NEGATIVE_RATIO' };
    const result = computeKnownAnswerKpi(def, { REVENUE: -200, COGS: 100 });
    // (REVENUE - COGS) / REVENUE = (-200 - 100) / -200 = -300 / -200 = 1.5, liczone ręcznie.
    expect(result.status).toBe('PRESENT_NONZERO');
    expect(Number(result.valueDecimal)).toBeCloseTo(1.5, 10);
  });

  it('KPI bez mianownika (wartość liniowa, nie iloraz): denominatorExpression=null ⇒ liczy tylko licznik', () => {
    const def: AnalysisKnownAnswerKpiDef = {
      kpiCode: 'REVENUE_ABSOLUTE',
      kpiName: 'Przychody',
      numeratorExpression: 'REVENUE',
      denominatorExpression: null,
      negativeDenominatorPolicy: 'FORCE_NA',
    };
    const result = computeKnownAnswerKpi(def, { REVENUE: 1234.5 });
    expect(result.status).toBe('PRESENT_NONZERO');
    expect(result.valueDecimal).toBe('1234.5');
  });
});

describe('financeValuesToLineCodeMap — most z semantyki FinanceValue (Pakiet C)', () => {
  it('PRESENT_NONZERO/PRESENT_ZERO mapują na liczby; MISSING/NA/NOT_APPLICABLE mapują na null', () => {
    const map = financeValuesToLineCodeMap([
      { lineCode: 'REVENUE', value: { status: 'PRESENT_NONZERO', valueDecimal: '1000' } },
      { lineCode: 'DEPRECIATION', value: { status: 'PRESENT_ZERO', valueDecimal: '0' } },
      { lineCode: 'ONE_OFF', value: { status: 'MISSING', valueDecimal: null } },
      { lineCode: 'SERVICE_INVENTORY_DAYS', value: { status: 'NOT_APPLICABLE', valueDecimal: null } },
      { lineCode: 'ANALYST_NA', value: { status: 'NA', valueDecimal: null } },
    ]);
    expect(map.REVENUE).toBe(1000);
    expect(map.DEPRECIATION).toBe(0);
    expect(map.ONE_OFF).toBeNull();
    expect(map.SERVICE_INVENTORY_DAYS).toBeNull();
    expect(map.ANALYST_NA).toBeNull();
    // Kontrola negatywna: PRESENT_ZERO NIGDY nie kolapsuje do null (byłby nie do odróżnienia od MISSING).
    expect(map.DEPRECIATION).not.toBeNull();
  });
});
