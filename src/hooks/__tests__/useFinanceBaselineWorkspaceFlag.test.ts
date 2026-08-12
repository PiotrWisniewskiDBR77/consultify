/**
 * @vitest-environment jsdom
 *
 * `useFinanceBaselineWorkspaceFlag` — Pakiet F.
 *
 * CLAUDE.md #7: „Wygląd tylko za flagą (default OFF) do akceptu." Dowodzi:
 * (1) flaga istnieje pod stabilnym id `financeBaselineWorkspaceV1`,
 * (2) domyślnie WYŁĄCZONA (bez tokenu auth w jsdom — brak zapisanego
 * override'u w localStorage), (3) lokalny override włącza ją (dev tools).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FINANCE_BASELINE_WORKSPACE_FLAG_ID, useFinanceBaselineWorkspaceFlag } from '../useFinanceBaselineWorkspaceFlag';

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

describe('useFinanceBaselineWorkspaceFlag', () => {
  it('domyślnie WYŁĄCZONA (default OFF, CLAUDE.md #7)', () => {
    const { result } = renderHook(() => useFinanceBaselineWorkspaceFlag());
    expect(result.current.enabled).toBe(false);
  });

  it('ma stabilne id `financeBaselineWorkspaceV1`', () => {
    expect(FINANCE_BASELINE_WORKSPACE_FLAG_ID).toBe('financeBaselineWorkspaceV1');
  });

  it('lokalny override włącza flagę (dev tools / akcept partiami)', () => {
    const { result } = renderHook(() => useFinanceBaselineWorkspaceFlag());
    expect(result.current.enabled).toBe(false);
    act(() => {
      result.current.flags.setFlag(FINANCE_BASELINE_WORKSPACE_FLAG_ID, true);
    });
    expect(result.current.enabled).toBe(true);
  });

  it('KONTROLA NEGATYWNA: flaga o innym id nie włącza się przez pomyłkę (dowód, że `isEnabled` sprawdza dokładny id)', () => {
    const { result } = renderHook(() => useFinanceBaselineWorkspaceFlag());
    expect(result.current.flags.isEnabled('some-other-flag-id')).toBe(false);
    expect(result.current.enabled).toBe(false);
  });
});
