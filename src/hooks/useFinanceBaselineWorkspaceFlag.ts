/**
 * Flaga `financeBaselineWorkspaceV1` (Pakiet F — Baseline Models Product Engineer).
 *
 * CLAUDE.md reguła #7: „Wygląd tylko za flagą (default OFF) do akceptu."
 * Gałęzi WYŁĄCZNIE montowanie `src/components/Finance/BaselineWorkspace.tsx`
 * (nowy ekran, dwa widoki: Założenia/Wyliczenia, OWN-FIN-017/018) — nic
 * produkcyjnego dziś jej nie odczytuje (żaden routing/`FinanceHub.tsx` nie
 * jest w allowlicie tego pakietu), więc jak `financeWorkspacePlatformV1`
 * (Pakiet C) ta flaga dziś nie gałęzi żadnego produkcyjnego ekranu w ogóle —
 * ekran jest dostępny wyłącznie przez `dev-render/` do akceptu na zrzutach.
 *
 * Osobna flaga (nie reużycie `financeWorkspacePlatformV1`) celowo — pakiet C
 * gałęzi wyłącznie KLOCKI (bar/focus/boundary), ta gałęzi CAŁY nowy ekran
 * Baseline zbudowany na tych klockach; osobne włączenie pozwala akceptować
 * partiami (CLAUDE.md „zakaz masowego włączania").
 */

import { useFeatureFlags, type FeatureFlag, type UseFeatureFlagsReturn } from './useFeatureFlags';

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
  return { enabled: flags.isEnabled(FINANCE_BASELINE_WORKSPACE_FLAG_ID), flags };
}

export default useFinanceBaselineWorkspaceFlag;
