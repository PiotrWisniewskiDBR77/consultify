/**
 * @vitest-environment jsdom
 *
 * `useFinanceCompareFlag` — Pakiet AP-CLIENT (Gate J).
 *
 * CLAUDE.md #7: „Wygląd tylko za flagą (default OFF) do akceptu." Dowodzi: (1) flaga istnieje
 * pod stabilnym id `financeCompareV1`, (2) domyślnie WYŁĄCZONA, (3) lokalny override włącza ją.
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
  it('domyślnie WYŁĄCZONA (default OFF, CLAUDE.md #7)', () => {
    const { result } = renderHook(() => useFinanceCompareFlag());
    expect(result.current.enabled).toBe(false);
  });

  it('ma stabilne id `financeCompareV1`', () => {
    expect(FINANCE_COMPARE_FLAG_ID).toBe('financeCompareV1');
  });

  it('lokalny override włącza flagę (dev tools / akcept partiami)', () => {
    const { result } = renderHook(() => useFinanceCompareFlag());
    expect(result.current.enabled).toBe(false);
    act(() => {
      result.current.flags.setFlag(FINANCE_COMPARE_FLAG_ID, true);
    });
    expect(result.current.enabled).toBe(true);
  });

  it('KONTROLA NEGATYWNA: flaga o innym id nie włącza się przez pomyłkę', () => {
    const { result } = renderHook(() => useFinanceCompareFlag());
    expect(result.current.flags.isEnabled('some-other-flag-id')).toBe(false);
    expect(result.current.enabled).toBe(false);
  });
});
