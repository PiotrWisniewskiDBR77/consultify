/**
 * @vitest-environment jsdom
 *
 * `useFinanceCompareFlag` — Pakiet AP-CLIENT (Gate J).
 *
 * DEC 03.09 wieczór (A2, docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md wiersz
 * A2 — 6 paneli Finansów). Dowodzi: (1) flaga istnieje pod stabilnym id `financeCompareV1`,
 * (2) domyślnie WŁĄCZONA, (3) lokalny override nadal wyłącza ją.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FINANCE_COMPARE_FLAG_ID, useFinanceCompareFlag } from '../useFinanceCompareFlag';

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

describe('useFinanceCompareFlag', () => {
  it('domyślnie WŁĄCZONA (DEC 03.09 wieczór A2)', () => {
    const { result } = renderHook(() => useFinanceCompareFlag());
    expect(result.current.enabled).toBe(true);
  });

  it('ma stabilne id `financeCompareV1`', () => {
    expect(FINANCE_COMPARE_FLAG_ID).toBe('financeCompareV1');
  });

  it('lokalny override nadal wyłącza flagę mimo ON default (dev tools / akcept partiami)', () => {
    const { result } = renderHook(() => useFinanceCompareFlag());
    expect(result.current.enabled).toBe(true);
    act(() => {
      result.current.flags.setFlag(FINANCE_COMPARE_FLAG_ID, false);
    });
    expect(result.current.enabled).toBe(false);
  });

  it('KONTROLA NEGATYWNA: flaga o innym id nie włącza się przez pomyłkę', () => {
    const { result } = renderHook(() => useFinanceCompareFlag());
    expect(result.current.flags.isEnabled('some-other-flag-id')).toBe(false);
    expect(result.current.enabled).toBe(true);
  });
});
