/**
 * @vitest-environment jsdom
 *
 * `useFinanceCommentsFlag` — Pakiet AP-CLIENT (Gate J).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FINANCE_COMMENTS_FLAG_ID, useFinanceCommentsFlag } from '../useFinanceCommentsFlag';

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

describe('useFinanceCommentsFlag', () => {
  it('domyślnie WYŁĄCZONA (default OFF, CLAUDE.md #7)', () => {
    const { result } = renderHook(() => useFinanceCommentsFlag());
    expect(result.current.enabled).toBe(false);
  });

  it('ma stabilne id `financeCommentsV1`', () => {
    expect(FINANCE_COMMENTS_FLAG_ID).toBe('financeCommentsV1');
  });

  it('lokalny override włącza flagę', () => {
    const { result } = renderHook(() => useFinanceCommentsFlag());
    expect(result.current.enabled).toBe(false);
    act(() => {
      result.current.flags.setFlag(FINANCE_COMMENTS_FLAG_ID, true);
    });
    expect(result.current.enabled).toBe(true);
  });

  it('KONTROLA NEGATYWNA: flaga o innym id nie włącza się przez pomyłkę', () => {
    const { result } = renderHook(() => useFinanceCommentsFlag());
    expect(result.current.flags.isEnabled('some-other-flag-id')).toBe(false);
    expect(result.current.enabled).toBe(false);
  });
});
