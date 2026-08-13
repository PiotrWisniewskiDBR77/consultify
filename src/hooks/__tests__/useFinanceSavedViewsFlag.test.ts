/**
 * @vitest-environment jsdom
 *
 * `useFinanceSavedViewsFlag` — Pakiet AP-CLIENT (Gate J).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FINANCE_SAVED_VIEWS_FLAG_ID, useFinanceSavedViewsFlag } from '../useFinanceSavedViewsFlag';

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

describe('useFinanceSavedViewsFlag', () => {
  it('domyślnie WYŁĄCZONA (default OFF, CLAUDE.md #7)', () => {
    const { result } = renderHook(() => useFinanceSavedViewsFlag());
    expect(result.current.enabled).toBe(false);
  });

  it('ma stabilne id `financeSavedViewsV1`', () => {
    expect(FINANCE_SAVED_VIEWS_FLAG_ID).toBe('financeSavedViewsV1');
  });

  it('lokalny override włącza flagę', () => {
    const { result } = renderHook(() => useFinanceSavedViewsFlag());
    expect(result.current.enabled).toBe(false);
    act(() => {
      result.current.flags.setFlag(FINANCE_SAVED_VIEWS_FLAG_ID, true);
    });
    expect(result.current.enabled).toBe(true);
  });

  it('KONTROLA NEGATYWNA: flaga o innym id nie włącza się przez pomyłkę', () => {
    const { result } = renderHook(() => useFinanceSavedViewsFlag());
    expect(result.current.flags.isEnabled('some-other-flag-id')).toBe(false);
    expect(result.current.enabled).toBe(false);
  });
});
