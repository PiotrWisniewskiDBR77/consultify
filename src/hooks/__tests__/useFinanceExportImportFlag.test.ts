/**
 * @vitest-environment jsdom
 *
 * `useFinanceExportImportFlag` — Pakiet AP-CLIENT (Gate J).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  FINANCE_EXPORT_IMPORT_FLAG_ID,
  useFinanceExportImportFlag,
} from '../useFinanceExportImportFlag';

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

describe('useFinanceExportImportFlag', () => {
  it('domyślnie WŁĄCZONA (DEC 03.09 wieczór A2)', () => {
    const { result } = renderHook(() => useFinanceExportImportFlag());
    expect(result.current.enabled).toBe(true);
  });

  it('ma stabilne id `financeExportImportV1`', () => {
    expect(FINANCE_EXPORT_IMPORT_FLAG_ID).toBe('financeExportImportV1');
  });

  it('lokalny override nadal wyłącza flagę mimo ON default', () => {
    const { result } = renderHook(() => useFinanceExportImportFlag());
    expect(result.current.enabled).toBe(true);
    act(() => {
      result.current.flags.setFlag(FINANCE_EXPORT_IMPORT_FLAG_ID, false);
    });
    expect(result.current.enabled).toBe(false);
  });

  it('KONTROLA NEGATYWNA: flaga o innym id nie włącza się przez pomyłkę', () => {
    const { result } = renderHook(() => useFinanceExportImportFlag());
    expect(result.current.flags.isEnabled('some-other-flag-id')).toBe(false);
    expect(result.current.enabled).toBe(true);
  });
});
