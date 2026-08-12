/**
 * DoD (brief): "niezależny known-answer dla co najmniej jednego KPI" +
 * kontrole negatywne "MISSING ≠ 0" i "ujemny mianownik → NA z powodem, nie
 * liczba i nie zero" + (korekta koordynatora 2026-08-12, master plan §2.4):
 * piąty stan `NOT_APPLICABLE` (rozłączny z `NA`), i cztery klasyczne pułapki
 * silników wskaźnikowych z WP-D02 — średni stan bilansowy w mianowniku
 * (average balance), okres interim, LTM, ujemny mianownik.
 *
 * Determinizm/precyzja (Decimal, nie float): `0.1 + 0.2` w IEEE-754 daje
 * `0.30000000000000004` — test poniżej dowodzi, że ten silnik NIE ma tego
 * problemu (Decimal arytmetyka dziesiętna dokładna).
 */
import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import {
  computeKnownAnswerKpi,
  evaluateArithmeticExpression,
  financeValuesToLineCodeMap,
  type AnalysisKnownAnswerKpiDef,
} from '../analysisKpiCompute';

function num(d: ReturnType<typeof evaluateArithmeticExpression>): number | null {
  return d === null ? null : d.toNumber();
}

describe('evaluateArithmeticExpression — parser bezpieczny (Decimal)', () => {
  it('arytmetyka podstawowa z nawiasami: (10 - 4) / 2 = 3', () => {
    expect(num(evaluateArithmeticExpression('(10 - 4) / 2', {}))).toBe(3);
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
    expect(num(evaluateArithmeticExpression('ABS(-5)', {}))).toBe(5);
    expect(num(evaluateArithmeticExpression('MIN(3, 7, 1)', {}))).toBe(1);
    expect(num(evaluateArithmeticExpression('MAX(3, 7, 1)', {}))).toBe(7);
    expect(num(evaluateArithmeticExpression('ROUND(2.6)', {}))).toBe(3);
  });

  it('KONTROLA NEGATYWNA (Decimal, nie float): 0.1 + 0.2 = DOKŁADNIE 0.3, nie 0.30000000000000004 (klasyczny błąd IEEE-754 float)', () => {
    const result = evaluateArithmeticExpression('A + B', { A: '0.1', B: '0.2' });
    expect(result).not.toBeNull();
    expect(result!.toString()).toBe('0.3');
    // Dowód, że plain JS float REALNIE ma ten problem (kontrast — to NIE jest wymyślony scenariusz):
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('zwraca instancję Decimal (nie number) — dowód, że arytmetyka pośrednia faktycznie jest Decimal, nie float udający Decimal', () => {
    const result = evaluateArithmeticExpression('1 + 1', {});
    expect(result).toBeInstanceOf(Decimal);
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
    expect(result.valueDecimal).toBe('0.4');
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
    expect(result.valueDecimal).toBe('1.5');
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

// ---------------------------------------------------------------------------
// Piąty stan — NOT_APPLICABLE (korekta koordynatora 2026-08-12). ROZŁĄCZNY
// z NA: "ten wskaźnik w ogóle nie dotyczy tego podmiotu", nie "nie da się
// policzyć". Klasyczny przykład z korekty: rotacja zapasów dla firmy usługowej.
// ---------------------------------------------------------------------------

describe('computeKnownAnswerKpi — piąty stan NOT_APPLICABLE (strukturalna niestosowalność)', () => {
  const INVENTORY_TURNOVER: AnalysisKnownAnswerKpiDef = {
    kpiCode: 'INVENTORY_TURNOVER',
    kpiName: 'Rotacja zapasów',
    numeratorExpression: 'COGS',
    denominatorExpression: '(BEG_INVENTORY + END_INVENTORY) / 2',
    negativeDenominatorPolicy: 'FORCE_NA',
  };

  it('firma usługowa (isStructurallyApplicable=false) ⇒ NOT_APPLICABLE, NAWET GDYBY dane istniały (nie liczy w ogóle)', () => {
    const result = computeKnownAnswerKpi(
      INVENTORY_TURNOVER,
      { COGS: 500_000, BEG_INVENTORY: 10_000, END_INVENTORY: 12_000 }, // dane KOMPLETNE — dowód, że NOT_APPLICABLE wygrywa mimo to
      { isStructurallyApplicable: false }
    );
    expect(result.status).toBe('NOT_APPLICABLE');
    expect(result.valueDecimal).toBeNull();
    expect(result.reasonCode).toBe('NOT_APPLICABLE_STRUCTURAL');
  });

  it('KONTROLA NEGATYWNA (NOT_APPLICABLE ≠ NA): ta sama definicja, isStructurallyApplicable=true, mianownik=0 ⇒ status NA (INNY stan, INNY powód)', () => {
    const result = computeKnownAnswerKpi(
      INVENTORY_TURNOVER,
      { COGS: 500_000, BEG_INVENTORY: 0, END_INVENTORY: 0 },
      { isStructurallyApplicable: true }
    );
    expect(result.status).toBe('NA');
    expect(result.status).not.toBe('NOT_APPLICABLE');
    expect(result.reasonCode).toBe('ZERO_DENOMINATOR');
  });

  it('domyślnie (context pominięty) ⇒ stosowalny, liczy normalnie — dowód, że domyślne zachowanie się nie zmieniło', () => {
    const result = computeKnownAnswerKpi(INVENTORY_TURNOVER, { COGS: 500_000, BEG_INVENTORY: 10_000, END_INVENTORY: 12_000 });
    expect(result.status).toBe('PRESENT_NONZERO');
    // COGS / ((10000+12000)/2) = 500000 / 11000 = 45.4545... — Decimal zachowuje pełną powtarzalność ułamka.
    expect(result.valueDecimal).toContain('45.454545');
  });
});

// ---------------------------------------------------------------------------
// WP-D02 — cztery klasyczne pułapki silników wskaźnikowych.
// ---------------------------------------------------------------------------

describe('WP-D02 — cztery klasyczne pułapki: average balance / interim / LTM / ujemny mianownik', () => {
  it('1) ŚREDNI STAN BILANSOWY w mianowniku (average balance) — Asset Turnover LTM: LTM_REVENUE / ((BEG_ASSETS+END_ASSETS)/2)', () => {
    const ASSET_TURNOVER_LTM: AnalysisKnownAnswerKpiDef = {
      kpiCode: 'ASSET_TURNOVER_LTM',
      kpiName: 'Rotacja aktywów (LTM)',
      numeratorExpression: 'LTM_REVENUE',
      denominatorExpression: '(BEG_ASSETS + END_ASSETS) / 2',
      negativeDenominatorPolicy: 'FORCE_NA',
    };
    // LTM_REVENUE = suma 4 ostatnich kwartałów, DOSTARCZONA callerowi już zagregowana
    // (ten silnik nie zna pojęcia okresu — okresy/agregacja LTM są odpowiedzialnością
    // callera/backendu, patrz nagłówek pliku i raport §"Co niepokryte").
    const result = computeKnownAnswerKpi(ASSET_TURNOVER_LTM, {
      LTM_REVENUE: '48200000.00',
      BEG_ASSETS: '19800000.00',
      END_ASSETS: '20600000.00',
    });
    expect(result.status).toBe('PRESENT_NONZERO');
    // (19800000+20600000)/2 = 20200000; 48200000/20200000 = 2.3861386138613861386 (Decimal, 20
    // cyfr znaczących domyślnej precyzji) — dowód, że NIE jest to float 2.3861386138613863
    // (JS `48200000/20200000` zniekształca od 17. cyfry, sprawdzone ręcznie w node).
    expect(result.valueDecimal).toBe('2.3861386138613861386');
  });

  it('1b) ŚREDNI STAN BILANSOWY — brakujący JEDEN koniec średniej (BEG_ASSETS) ⇒ CAŁY mianownik MISSING, NIE traktowany jako "połowa z END" (klasyczny błąd: average(missing,X) ≠ X/2 przez ciche podstawienie 0)', () => {
    const ASSET_TURNOVER_LTM: AnalysisKnownAnswerKpiDef = {
      kpiCode: 'ASSET_TURNOVER_LTM',
      kpiName: 'Rotacja aktywów (LTM)',
      numeratorExpression: 'LTM_REVENUE',
      denominatorExpression: '(BEG_ASSETS + END_ASSETS) / 2',
      negativeDenominatorPolicy: 'FORCE_NA',
    };
    const result = computeKnownAnswerKpi(ASSET_TURNOVER_LTM, { LTM_REVENUE: 48_200_000, END_ASSETS: 20_600_000 }); // BEG_ASSETS nieprzekazane
    expect(result.status).toBe('MISSING');
    expect(result.valueDecimal).toBeNull();
    expect(result.reasonCode).toBe('MISSING_INPUT');
  });

  it('2) OKRES INTERIM (kwartalny, nieannualizowany) — Receivables Turnover Q3: Q3_REVENUE / ((BEG_AR+END_AR)/2), wartość interim NIE jest po cichu traktowana jak roczna', () => {
    const RECEIVABLES_TURNOVER_INTERIM: AnalysisKnownAnswerKpiDef = {
      kpiCode: 'RECEIVABLES_TURNOVER_Q3',
      kpiName: 'Rotacja należności (Q3, interim)',
      numeratorExpression: 'Q3_REVENUE',
      denominatorExpression: '(BEG_AR + END_AR) / 2',
      negativeDenominatorPolicy: 'FORCE_NA',
    };
    const result = computeKnownAnswerKpi(RECEIVABLES_TURNOVER_INTERIM, {
      Q3_REVENUE: '5400000',
      BEG_AR: '1200000',
      END_AR: '1500000',
    });
    expect(result.status).toBe('PRESENT_NONZERO');
    // (1200000+1500000)/2 = 1350000; 5400000/1350000 = 4 DOKŁADNIE — celowo dobrane
    // liczby bez zaokrągleń, żeby test nie maskował błędu precyzji przypadkowym `toBeCloseTo`.
    expect(result.valueDecimal).toBe('4');
  });

  it('3) LTM (Last Twelve Months) — Net Margin LTM z realnym ujemnym wynikiem netto (strata) w liczniku, mianownik dodatni: status PRESENT_NONZERO z wartością ujemną, NIGDY NA tylko dlatego, że WYNIK jest ujemny (tylko MIANOWNIK ujemny wywołuje politykę)', () => {
    const NET_MARGIN_LTM: AnalysisKnownAnswerKpiDef = {
      kpiCode: 'NET_MARGIN_LTM',
      kpiName: 'Marża netto (LTM)',
      numeratorExpression: 'LTM_NET_INCOME',
      denominatorExpression: 'LTM_REVENUE',
      negativeDenominatorPolicy: 'FORCE_NA',
    };
    const result = computeKnownAnswerKpi(NET_MARGIN_LTM, { LTM_NET_INCOME: '-2400000', LTM_REVENUE: '48000000' });
    expect(result.status).toBe('PRESENT_NONZERO'); // mianownik DODATNI — polityka ujemnego mianownika w ogóle się nie uruchamia
    expect(result.valueDecimal).toBe('-0.05');
    expect(result.reasonCode).toBeNull();
  });

  it('4) UJEMNY MIANOWNIK z realnymi wartościami LTM (ujemny kapitał własny w ROE LTM) — polityka FORCE_NA wygrywa, NIGDY nie pokazuje mylącego dodatniego ROE ze stosunku dwóch ujemnych liczb', () => {
    const ROE_LTM: AnalysisKnownAnswerKpiDef = {
      kpiCode: 'ROE_LTM',
      kpiName: 'ROE (LTM)',
      numeratorExpression: 'LTM_NET_INCOME',
      denominatorExpression: 'AVG_EQUITY',
      negativeDenominatorPolicy: 'FORCE_NA',
    };
    // Firma w stracie, kapitał własny ujemny (typowe dla wczesnej fazy/startupu) —
    // matematycznie -1200000 / -3000000 = 0.4 (40% ROE) byłoby MYLĄCE (sugeruje
    // zdrową rentowność), stąd FORCE_NA jako domyślna polityka produktu.
    const result = computeKnownAnswerKpi(ROE_LTM, { LTM_NET_INCOME: '-1200000', AVG_EQUITY: '-3000000' });
    expect(result.status).toBe('NA');
    expect(result.valueDecimal).toBeNull();
    expect(result.reasonCode).toBe('NEGATIVE_DENOMINATOR');
  });
});

describe('financeValuesToLineCodeMap — most z semantyki FinanceValue (Pakiet C)', () => {
  it('PRESENT_NONZERO/PRESENT_ZERO mapują na Decimal; MISSING/NA/NOT_APPLICABLE mapują na null (WSZYSTKIE PIĘĆ stanów pokryte, nie tylko trzy)', () => {
    const map = financeValuesToLineCodeMap([
      { lineCode: 'REVENUE', value: { status: 'PRESENT_NONZERO', valueDecimal: '1000' } },
      { lineCode: 'DEPRECIATION', value: { status: 'PRESENT_ZERO', valueDecimal: '0' } },
      { lineCode: 'ONE_OFF', value: { status: 'MISSING', valueDecimal: null } },
      { lineCode: 'SERVICE_INVENTORY_DAYS', value: { status: 'NOT_APPLICABLE', valueDecimal: null } },
      { lineCode: 'ANALYST_NA', value: { status: 'NA', valueDecimal: null } },
    ]);
    expect(map.REVENUE).toBeInstanceOf(Decimal);
    expect(map.REVENUE!.toString()).toBe('1000');
    expect(map.DEPRECIATION).toBeInstanceOf(Decimal);
    expect(map.DEPRECIATION!.toString()).toBe('0');
    expect(map.ONE_OFF).toBeNull();
    expect(map.SERVICE_INVENTORY_DAYS).toBeNull();
    expect(map.ANALYST_NA).toBeNull();
    // Kontrola negatywna: PRESENT_ZERO NIGDY nie kolapsuje do null (byłby nie do odróżnienia od MISSING).
    expect(map.DEPRECIATION).not.toBeNull();
  });

  it('KONTROLA NEGATYWNA (precyzja): valueDecimal string pełnej precyzji przechodzi PROSTO do Decimal, nie przez Number() (dowód: 17-cyfrowy string zachowuje wszystkie cyfry)', () => {
    const map = financeValuesToLineCodeMap([
      { lineCode: 'PRECISE', value: { status: 'PRESENT_NONZERO', valueDecimal: '12345678901234.5678' } },
    ]);
    expect(map.PRECISE!.toString()).toBe('12345678901234.5678');
  });
});
