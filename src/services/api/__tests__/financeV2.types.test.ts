/**
 * Kontrola negatywna: „brak danych nigdy nie renderuje się jako 0" (Pakiet C).
 *
 * `financeValueToArithmeticOperand` jest jedynym miejscem, przez które wolno
 * wyciągnąć liczbę z `FinanceValue` — ten test dowodzi, że MISSING/NA/
 * NOT_APPLICABLE dają `null`, NIGDY `0`, i że to jest ODRÓŻNIALNE od
 * prawdziwego zera (`PRESENT_ZERO`).
 */
import { describe, expect, it } from 'vitest';

import {
  describeFinanceV2Error,
  financeValueDisplayReasonLabel,
  financeValueStatusLabel,
  financeValueToArithmeticOperand,
  formatFinanceValueForDisplay,
  isMissingFinanceValue,
  isPresentFinanceValue,
  type FinanceValue,
} from '../financeV2.types';

function value(status: FinanceValue['status'], valueDecimal: string | null): FinanceValue {
  return {
    status,
    valueDecimal,
    nativeCurrency: 'PLN',
    presentationCurrency: 'PLN',
    unit: 'UNITS',
    multiplier: '1',
    sourceRef: null,
    isAdjustment: false,
    adjustmentReason: null,
  };
}

describe('financeV2.types — MISSING ≠ 0 (twarda zasada produktu)', () => {
  it('PRESENT_ZERO → operand 0 (prawdziwe zero)', () => {
    expect(financeValueToArithmeticOperand(value('PRESENT_ZERO', '0'))).toBe(0);
  });

  it('MISSING → operand null, NIGDY 0 — KONTROLA NEGATYWNA vs PRESENT_ZERO', () => {
    const missing = financeValueToArithmeticOperand(value('MISSING', null));
    const zero = financeValueToArithmeticOperand(value('PRESENT_ZERO', '0'));
    expect(missing).toBeNull();
    expect(missing).not.toBe(zero);
    // Dokumentacja PUŁAPKI, którą ta funkcja istnieje, żeby wymusić obsługę:
    // JS koerycja `null + 1 === 1` (NIE `NaN`) — czyli naiwne sumowanie BEZ
    // sprawdzenia `=== null` po cichu zamienia „brak danych" w „1", nie
    // rzuca błędu. Właśnie dlatego każdy caller MUSI obsłużyć `null`
    // jawnie zamiast wrzucać wynik wprost do sumy.
    expect((missing as unknown as number) + 1).toBe(1);
    expect(missing).not.toBe(0);
  });

  it('NA bez opt-in → null; z treatNaAsZero → 0 (jawny wybór callera, nie domyślny)', () => {
    expect(financeValueToArithmeticOperand(value('NA', null))).toBeNull();
    expect(financeValueToArithmeticOperand(value('NA', null), { treatNaAsZero: true })).toBe(0);
  });

  it('NOT_APPLICABLE bez opt-in → null', () => {
    expect(financeValueToArithmeticOperand(value('NOT_APPLICABLE', null))).toBeNull();
  });

  it('PRESENT_NONZERO → parsuje dokładny string dziesiętny', () => {
    expect(financeValueToArithmeticOperand(value('PRESENT_NONZERO', '1234.56'))).toBeCloseTo(1234.56);
  });

  it('isPresentFinanceValue/isMissingFinanceValue rozróżniają wszystkie 5 statusów', () => {
    expect(isPresentFinanceValue(value('PRESENT_ZERO', '0'))).toBe(true);
    expect(isPresentFinanceValue(value('PRESENT_NONZERO', '5'))).toBe(true);
    expect(isPresentFinanceValue(value('MISSING', null))).toBe(false);
    expect(isPresentFinanceValue(value('NA', null))).toBe(false);
    expect(isPresentFinanceValue(value('NOT_APPLICABLE', null))).toBe(false);
    expect(isMissingFinanceValue(value('MISSING', null))).toBe(true);
    expect(isMissingFinanceValue(value('PRESENT_ZERO', '0'))).toBe(false);
  });
});

describe('financeV2.types — formatFinanceValueForDisplay (UI nigdy nie rysuje MISSING jako "0")', () => {
  it('PRESENT_ZERO renderuje się jako "0" — glif liczby, nie myślnik', () => {
    const display = formatFinanceValueForDisplay(value('PRESENT_ZERO', '0'));
    expect(display.text).toBe('0');
    expect(display.isMissingLikeGlyph).toBe(false);
  });

  it('KONTROLA NEGATYWNA: MISSING renderuje się jako „—", WIZUALNIE ODRÓŻNIALNE od PRESENT_ZERO', () => {
    const missingDisplay = formatFinanceValueForDisplay(value('MISSING', null));
    const zeroDisplay = formatFinanceValueForDisplay(value('PRESENT_ZERO', '0'));
    expect(missingDisplay.text).toBe('—');
    expect(missingDisplay.isMissingLikeGlyph).toBe(true);
    expect(missingDisplay.text).not.toBe(zeroDisplay.text);
  });

  it('NA i NOT_APPLICABLE też renderują się jako „—", z rozróżnieniem w etykiecie powodu (nie w samym glifie)', () => {
    expect(formatFinanceValueForDisplay(value('NA', null)).text).toBe('—');
    expect(formatFinanceValueForDisplay(value('NOT_APPLICABLE', null)).text).toBe('—');
    expect(financeValueDisplayReasonLabel('NA')).toMatch(/nie dotyczy/);
    expect(financeValueDisplayReasonLabel('NOT_APPLICABLE')).toMatch(/strukturalnie/);
    expect(financeValueDisplayReasonLabel('MISSING')).toMatch(/Brak danych/);
    expect(financeValueDisplayReasonLabel('PRESENT_ZERO')).toBeNull();
  });

  it('wartość ujemna renderuje się poprawnie (nie gubi znaku)', () => {
    const display = formatFinanceValueForDisplay(value('PRESENT_NONZERO', '-125000.5'), (n) => n.toString());
    expect(display.text).toBe('-125000.5');
    expect(display.text.startsWith('-')).toBe(true);
  });
});

describe('financeV2.types — financeValueStatusLabel (Pakiet D fix: raw enum "PRESENT_NONZERO" no longer leaks to the UI as a label)', () => {
  it('covers all five FinanceValueStatus values with a non-empty human label', () => {
    const statuses: FinanceValue['status'][] = ['PRESENT_ZERO', 'PRESENT_NONZERO', 'MISSING', 'NA', 'NOT_APPLICABLE'];
    for (const status of statuses) {
      const label = financeValueStatusLabel(status);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('NEGATIVE CONTROL — all five labels are pairwise distinct (never two different statuses collapsing onto one shared word)', () => {
    const statuses: FinanceValue['status'][] = ['PRESENT_ZERO', 'PRESENT_NONZERO', 'MISSING', 'NA', 'NOT_APPLICABLE'];
    const labels = statuses.map((s) => financeValueStatusLabel(s));
    expect(new Set(labels).size).toBe(statuses.length);
  });

  it('never returns the raw enum token itself — the whole point of the fix', () => {
    expect(financeValueStatusLabel('PRESENT_NONZERO')).not.toBe('PRESENT_NONZERO');
    expect(financeValueStatusLabel('PRESENT_ZERO')).not.toBe('PRESENT_ZERO');
    expect(financeValueStatusLabel('MISSING')).not.toBe('MISSING');
    expect(financeValueStatusLabel('NA')).not.toBe('NA');
    expect(financeValueStatusLabel('NOT_APPLICABLE')).not.toBe('NOT_APPLICABLE');
  });

  it('MISSING/NA/NOT_APPLICABLE status labels are distinct from their own financeValueDisplayReasonLabel — status and reason render as two separate rows in SourceEvidencePanel and must never show identical text', () => {
    expect(financeValueStatusLabel('MISSING')).not.toBe(financeValueDisplayReasonLabel('MISSING'));
    expect(financeValueStatusLabel('NA')).not.toBe(financeValueDisplayReasonLabel('NA'));
    expect(financeValueStatusLabel('NOT_APPLICABLE')).not.toBe(financeValueDisplayReasonLabel('NOT_APPLICABLE'));
  });

  it('PRESENT_ZERO and PRESENT_NONZERO labels are distinct from each other — a true zero must read differently from "has a value"', () => {
    expect(financeValueStatusLabel('PRESENT_ZERO')).not.toBe(financeValueStatusLabel('PRESENT_NONZERO'));
  });
});

describe('financeV2.types — describeFinanceV2Error (Honest UI, CANON.md §4.1)', () => {
  it('surowy "Request timed out" NIGDY nie trafia do UI bez przeformułowania', () => {
    const err = Object.assign(new Error('Request timed out'), { status: 0 });
    const described = describeFinanceV2Error(err);
    expect(described.detail).not.toBe('Request timed out');
    expect(described.title).toMatch(/dłużej/);
  });

  it('NOT_FOUND → komunikat PL, nie kod surowy (kod czytany z .data.code — zmierzony, realny kształt z baseClient.handleResponse)', () => {
    const err = Object.assign(new Error('Artifact not found'), {
      status: 404,
      data: { error: 'Artifact not found', code: 'NOT_FOUND' },
    });
    const described = describeFinanceV2Error(err);
    expect(described.code).toBe('NOT_FOUND');
    expect(described.title).toMatch(/Nie znaleziono/);
  });

  it('błąd bez .status/.code (np. TypeError sieciowy) → generyczny, wciąż PL', () => {
    const described = describeFinanceV2Error(new TypeError('Failed to fetch'));
    expect(described.title).toBe('Wystąpił nieoczekiwany błąd');
  });
});
