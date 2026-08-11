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
  financeValueToArithmeticOperand,
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
