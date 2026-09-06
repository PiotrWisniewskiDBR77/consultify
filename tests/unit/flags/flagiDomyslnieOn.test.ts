/**
 * @vitest-environment jsdom
 *
 * Bezpiecznik: DEC 03.09 wieczór (A1, A2, A3, A4, R-11) — pięć rodzin flag
 * przełączonych z default OFF na default ON w kodzie (nie w env), tak żeby
 * ktoś nie cofnął po cichu jednej z nich pojedynczą zmianą bez zauważenia.
 *
 * Źródła decyzji:
 *   A1 — docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md wiersz A1
 *        (14 ekranów Wyników: KPI, OKR, ROI, wyszukiwarka, uwaga)
 *   A2 — tamże, wiersz A2 (6 paneli Finansów)
 *   A3 — tamże, wiersz A3 (przeprojektowana Organizacja)
 *   A4 — tamże, wiersz A4 (kreator wywiadu)
 *   R-11 — docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md wiersz 39
 *          (MYW-NBK-CORE-001, widok Notatnika Praca/Kontekst)
 *
 * Każdy test w tym pliku czyta REALNĄ funkcję/hook rozstrzygający (nie
 * literał `defaultValue`/`export const` osobno), na czystym środowisku
 * (bez query, bez localStorage, bez env) — więc cofnięcie fallbacku w
 * kodzie production (nie tylko w komentarzu) czerwieni ten plik.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isResultsVNextFlagEnabled } from '@/components/ResultsVNext/resultsVNextFeatureFlags';
import { useFinanceCommentsFlag } from '@/hooks/useFinanceCommentsFlag';
import { useFinanceCompareFlag } from '@/hooks/useFinanceCompareFlag';
import { useFinanceExportImportFlag } from '@/hooks/useFinanceExportImportFlag';
import { useFinanceLineageNavigatorFlag } from '@/hooks/useFinanceLineageNavigatorFlag';
import { useFinanceSavedViewsFlag } from '@/hooks/useFinanceSavedViewsFlag';
import { useFinanceStatementPackWorkspaceV2Flag } from '@/hooks/useFinanceStatementPackWorkspaceV2Flag';
import { isOrgRedesignV1Enabled } from '@/utils/orgRedesignFlag';
import { isInterviewCreatorShellEnabled } from '@/utils/interviewCreatorShellFlag';
import {
  ENABLE_NOTEBOOK_SPEC_A_SHELL,
  isNotebookSpecAShellEnabled,
} from '@/components/MyWork/notebook/notebookSpecAShellFlag';

const ORIGINAL_LOCATION = window.location;

function setLocationSearch(search = '', hostname = ORIGINAL_LOCATION.hostname) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...ORIGINAL_LOCATION, search, hostname },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  setLocationSearch();
});

afterEach(() => {
  window.localStorage.clear();
  setLocationSearch();
});

describe('DEC 03.09 wieczór — flagi domyślnie ON (bez query/localStorage/env)', () => {
  /**
   * Rejestr flag Wyników skurczył się po dwóch odbiorach właściciela:
   * DEC-422 (06.09) skasowała `attentionEntry` i `managementReportEntry`,
   * DEC-422b/e (06.09) — `resultsSearch` (zakładka „Wyszukiwarka" zastąpiona
   * „Raportami zarządczymi"). Ten plik wołał je dalej po nazwie i od DEC-422
   * przewracał się na `TypeError: Cannot read properties of undefined
   * (reading 'query')` — 3 czerwone testy ZASTANE, zmierzone przed tą zmianą.
   * Lista wraca do stanu faktycznego: trzy żyjące domeny.
   */
  describe('A1 — domeny Wyników (resultsVNextFeatureFlags.ts)', () => {
    it.each([['kpiRegistry'], ['roiRegistry'], ['okrRegistry']] as const)(
      '%s domyślnie ON poza publiczną produkcją',
      (flag) => {
        expect(isResultsVNextFlagEnabled(flag)).toBe(true);
      }
    );

    it('resultsLegacyArchive NIE jest objęty DEC 03.09 A1 — zostaje OFF', () => {
      expect(isResultsVNextFlagEnabled('resultsLegacyArchive')).toBe(false);
    });
  });

  describe('A2 — 6 paneli Finansów (useFinance*Flag.ts)', () => {
    it('financeCommentsV1 domyślnie ON', () => {
      const { result } = renderHook(() => useFinanceCommentsFlag());
      expect(result.current.enabled).toBe(true);
    });

    it('financeCompareV1 domyślnie ON', () => {
      const { result } = renderHook(() => useFinanceCompareFlag());
      expect(result.current.enabled).toBe(true);
    });

    it('financeExportImportV1 domyślnie ON', () => {
      const { result } = renderHook(() => useFinanceExportImportFlag());
      expect(result.current.enabled).toBe(true);
    });

    it('financeLineageNavigatorV1 domyślnie ON', () => {
      const { result } = renderHook(() => useFinanceLineageNavigatorFlag());
      expect(result.current.enabled).toBe(true);
    });

    it('financeSavedViewsV1 domyślnie ON', () => {
      const { result } = renderHook(() => useFinanceSavedViewsFlag());
      expect(result.current.enabled).toBe(true);
    });

    it('financeStatementPackWorkspaceV2 domyślnie ON', () => {
      const { result } = renderHook(() => useFinanceStatementPackWorkspaceV2Flag());
      expect(result.current.enabled).toBe(true);
    });
  });

  describe('A3 — Organizacja przeprojektowana (orgRedesignFlag.ts)', () => {
    it('isOrgRedesignV1Enabled() domyślnie ON', () => {
      expect(isOrgRedesignV1Enabled()).toBe(true);
    });
  });

  describe('A4 — kreator wywiadu (interviewCreatorShellFlag.ts)', () => {
    it('isInterviewCreatorShellEnabled() domyślnie ON', () => {
      expect(isInterviewCreatorShellEnabled()).toBe(true);
    });
  });

  describe('R-11 — Notatnik Praca/Kontekst (notebookSpecAShellFlag.ts)', () => {
    it('ENABLE_NOTEBOOK_SPEC_A_SHELL jest literałem true', () => {
      expect(ENABLE_NOTEBOOK_SPEC_A_SHELL).toBe(true);
    });

    it('isNotebookSpecAShellEnabled() domyślnie ON', () => {
      expect(isNotebookSpecAShellEnabled()).toBe(true);
    });
  });

  describe('każda z pięciu rodzin zachowuje awaryjny wyłącznik OFF (CLAUDE.md §8)', () => {
    it('A1: query "0" nadal wyłącza kpiRegistry mimo ON default', () => {
      setLocationSearch('?ff_resultsVNextKpi=0');
      expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(false);
    });

    it('A2: lokalny override nadal wyłącza financeCommentsV1 mimo ON default', () => {
      const { result } = renderHook(() => useFinanceCommentsFlag());
      expect(result.current.enabled).toBe(true);
      act(() => {
        result.current.flags.setFlag('financeCommentsV1', false);
      });
      expect(result.current.enabled).toBe(false);
    });

    it('A3: localStorage "off" nadal wyłącza orgRedesignV1 mimo ON default', () => {
      window.localStorage.setItem('ff.orgRedesignV1', 'off');
      expect(isOrgRedesignV1Enabled()).toBe(false);
    });

    it('A4: localStorage "0" nadal wyłącza interviewCreatorShellFlag mimo ON default', () => {
      window.localStorage.setItem('ff.interview_creator_shell', '0');
      expect(isInterviewCreatorShellEnabled()).toBe(false);
    });

    it('R-11: localStorage "false" nadal wyłącza notebookSpecAShellFlag mimo ON default', () => {
      window.localStorage.setItem('ff.ENABLE_NOTEBOOK_SPEC_A_SHELL', 'false');
      expect(isNotebookSpecAShellEnabled()).toBe(false);
    });
  });
});
