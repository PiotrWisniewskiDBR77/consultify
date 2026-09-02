/**
 * @vitest-environment jsdom
 *
 * `useFinanceBaselineWorkspaceFlag` — Pakiet F.
 *
 * ★ DYŻUR 279 — flaga przełączona na default ON (warunkowy akcept właściciela
 * spełniony: kolumna „Okres bazowy" pokazuje etykietę z bazy, nie surowe
 * `per-…`). Dowodzi:
 * (1) flaga istnieje pod stabilnym id `financeBaselineWorkspaceV1`,
 * (2) domyślnie WŁĄCZONA (bez override'u w localStorage),
 * (3) jawny lokalny override OFF nadal ją wyłącza (ścieżka cofania z
 *     `_RUNBOOK_COFANIA.md` — bez tego „domyślnie ON" byłoby nieodwracalne),
 * (4) kontrola negatywna: `isEnabled` sprawdza dokładny id.
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
  it('domyślnie WŁĄCZONA (default ON od dyżuru 279)', () => {
    const { result } = renderHook(() => useFinanceBaselineWorkspaceFlag());
    expect(result.current.enabled).toBe(true);
  });

  it('ma stabilne id `financeBaselineWorkspaceV1`', () => {
    expect(FINANCE_BASELINE_WORKSPACE_FLAG_ID).toBe('financeBaselineWorkspaceV1');
  });

  it('jawny lokalny override OFF wyłącza flagę (ścieżka cofania)', () => {
    const { result } = renderHook(() => useFinanceBaselineWorkspaceFlag());
    expect(result.current.enabled).toBe(true);
    act(() => {
      result.current.flags.setFlag(FINANCE_BASELINE_WORKSPACE_FLAG_ID, false);
    });
    expect(result.current.enabled).toBe(false);
    act(() => {
      result.current.flags.setFlag(FINANCE_BASELINE_WORKSPACE_FLAG_ID, true);
    });
    expect(result.current.enabled).toBe(true);
  });

  it('KONTROLA NEGATYWNA: flaga o innym id nie włącza się przez pomyłkę (dowód, że `isEnabled` sprawdza dokładny id)', () => {
    const { result } = renderHook(() => useFinanceBaselineWorkspaceFlag());
    expect(result.current.flags.isEnabled('some-other-flag-id')).toBe(false);
  });
});
