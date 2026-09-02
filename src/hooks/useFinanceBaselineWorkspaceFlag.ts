/**
 * Flaga `financeBaselineWorkspaceV1` (Pakiet F — Baseline Models Product Engineer).
 *
 * CLAUDE.md reguła #7: „Wygląd tylko za flagą (default OFF) do akceptu."
 * Gałęzi WYŁĄCZNIE montowanie `src/components/Finance/BaselineWorkspace.tsx`
 * (nowy ekran, dwa widoki: Założenia/Wyliczenia, OWN-FIN-017/018).
 *
 * ★ SPROSTOWANIE 2026-09-02 (tor funkcji, pomiar `docs/program/funkcje/
 * WOLACZE_20260902.md`). Ten komentarz twierdził do dziś, że „nic
 * produkcyjnego jej nie odczytuje". To NIEPRAWDA od czasu wpięcia w hub:
 * `FinanceHub.tsx` odczytuje ją w czterech miejscach — zweryfikowane
 * greppem, nie przepisane z cudzego raportu: import `:69`, hook
 * `useFinanceBaselineWorkspaceFlag()` `:748`, `flags.baseline` w `:530`
 * i w warunku montażu `openV3Baseline` `:676`.
 * Skutek nieaktualnego komentarza był realny: przy diagnozie zgłoszenia
 * właściciela „dalej nie mam przycisku dodawania założeń" komentarz
 * kierował na fałszywy trop (szukanie brakującego ogniwa w łańcuchu
 * zapisu), podczas gdy łańcuch jest kompletny 6/6, a jedyną przyczyną
 * jest ta flaga w pozycji OFF. ZERO zmian w zachowaniu — poprawka
 * wyłącznie w opisie.
 *
 * OFF (domyślnie) → `FinanceHub` montuje POPRZEDNI ekran; nowy Baseline jest
 * osiągalny przez `dev-render/` albo tryb owner-review
 * (`?ff_wave3FinanceOwnerReview=1`) do akceptu na zrzutach.
 *
 * Osobna flaga (nie reużycie `financeWorkspacePlatformV1`) celowo — pakiet C
 * gałęzi wyłącznie KLOCKI (bar/focus/boundary), ta gałęzi CAŁY nowy ekran
 * Baseline zbudowany na tych klockach; osobne włączenie pozwala akceptować
 * partiami (CLAUDE.md „zakaz masowego włączania").
 */

import { useFeatureFlags, type FeatureFlag, type UseFeatureFlagsReturn } from './useFeatureFlags';
import { isFinanceOwnerReviewModeEnabled } from '@/utils/financeOwnerReviewMode';

export const FINANCE_BASELINE_WORKSPACE_FLAG_ID = 'financeBaselineWorkspaceV1';

const FINANCE_BASELINE_WORKSPACE_FLAG: FeatureFlag = {
  id: FINANCE_BASELINE_WORKSPACE_FLAG_ID,
  name: 'Finance: Baseline Model workspace (Pakiet F — Założenia/Wyliczenia)',
  description:
    'Włącza nowy ekran Baseline Model (dwa widoki: Założenia i Wyliczenia, ' +
    'OWN-FIN-017/018), zbudowany na FinanceWorkspaceBar/Focus Mode/Error ' +
    'Boundary (Pakiet C) i kanonicznym /api/v8/finance-v2/baseline/* (Pakiet ' +
    'B2). OFF = ekran nieosiągalny (brak routingu produkcyjnego w allowlicie ' +
    'tego pakietu) — dostępny wyłącznie przez dev-render do akceptu Piotra na ' +
    'zrzutach (CLAUDE.md #7). Domyślnie OFF.',
  defaultValue: false,
  category: 'beta',
  allowLocalOverride: true,
};

export interface UseFinanceBaselineWorkspaceFlagReturn {
  enabled: boolean;
  flags: UseFeatureFlagsReturn;
}

export function useFinanceBaselineWorkspaceFlag(
  config: { userId?: string; enableLocalOverrides?: boolean } = {}
): UseFinanceBaselineWorkspaceFlagReturn {
  const flags = useFeatureFlags({
    flags: [FINANCE_BASELINE_WORKSPACE_FLAG],
    userId: config.userId,
    enableLocalOverrides: config.enableLocalOverrides ?? true,
  });
  return {
    enabled:
      isFinanceOwnerReviewModeEnabled() || flags.isEnabled(FINANCE_BASELINE_WORKSPACE_FLAG_ID),
    flags,
  };
}

export default useFinanceBaselineWorkspaceFlag;
