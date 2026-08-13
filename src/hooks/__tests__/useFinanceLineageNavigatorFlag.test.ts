/**
 * @vitest-environment jsdom
 *
 * `useFinanceLineageNavigatorFlag` — Pakiet AP-CLIENT (Gate J).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  FINANCE_LINEAGE_NAVIGATOR_FLAG_ID,
  useFinanceLineageNavigatorFlag,
} from '../useFinanceLineageNavigatorFlag';

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

describe('useFinanceLineageNavigatorFlag', () => {
  it('domyślnie WYŁĄCZONA (default OFF, CLAUDE.md #7)', () => {
    const { result } = renderHook(() => useFinanceLineageNavigatorFlag());
    expect(result.current.enabled).toBe(false);
  });

  it('ma stabilne id `financeLineageNavigatorV1`', () => {
    expect(FINANCE_LINEAGE_NAVIGATOR_FLAG_ID).toBe('financeLineageNavigatorV1');
  });

  it('lokalny override włącza flagę', () => {
    const { result } = renderHook(() => useFinanceLineageNavigatorFlag());
    expect(result.current.enabled).toBe(false);
    act(() => {
      result.current.flags.setFlag(FINANCE_LINEAGE_NAVIGATOR_FLAG_ID, true);
    });
    expect(result.current.enabled).toBe(true);
  });

  it('KONTROLA NEGATYWNA: flaga o innym id nie włącza się przez pomyłkę', () => {
    const { result } = renderHook(() => useFinanceLineageNavigatorFlag());
    expect(result.current.flags.isEnabled('some-other-flag-id')).toBe(false);
    expect(result.current.enabled).toBe(false);
  });
});
