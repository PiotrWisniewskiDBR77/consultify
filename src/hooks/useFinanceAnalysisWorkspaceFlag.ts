/**
 * Flaga `financeAnalysisWorkspaceV1` (Pakiet E — Analysis Product Engineer).
 *
 * CLAUDE.md reguła #7: „Wygląd tylko za flagą (default OFF) do akceptu."
 * Wzorzec identyczny jak `useFinanceWorkspacePlatformFlag.ts` (Pakiet C) —
 * NIE modyfikuje `src/hooks/useFeatureFlags.tsx` (plik współdzielony, poza
 * allowlistą), rejestruje flagę lokalnie przez `useFeatureFlags({flags:[...]})`.
 *
 * Zakres: Kreator Analizy (Quick Create + Customize), `AnalysisWorkspace`,
 * `AnalysisKpiTable`, `AnalysisKpiDetailCard` — żaden istniejący ekran
 * Finance dziś ich nie montuje (Analysis workspace nie istniał przed tym
 * pakietem — `grep -rn "AnalysisWorkspace\|AnalysisCreator" src/` dawał 0
 * trafień przed tym plikiem), więc flaga OFF nie zmienia żadnego
 * produkcyjnego ekranu.
 */

import { useFeatureFlags, type FeatureFlag, type UseFeatureFlagsReturn } from './useFeatureFlags';
import { isFinanceOwnerReviewModeEnabled } from '@/utils/financeOwnerReviewMode';

export const FINANCE_ANALYSIS_WORKSPACE_FLAG_ID = 'financeAnalysisWorkspaceV1';

const FINANCE_ANALYSIS_WORKSPACE_FLAG: FeatureFlag = {
  id: FINANCE_ANALYSIS_WORKSPACE_FLAG_ID,
  name: 'Finance: Analysis Kreator + Workspace + Tabela KPI (Pakiet E)',
  description:
    'Włącza Kreator Analizy (Quick Create/Customize, OWN-FIN-008), lifecycle Analysis workspace ' +
    '(OWN-FIN-012/013) i StandardTable-based tabelę wskaźników z kontrolerem kolumn (OWN-FIN-014). ' +
    'F-P5 (05.09.2026): flaga jest domyślnie ON — kreator woła `derived-analysis` (F-P4), ' +
    'więc analiza powstaje z krawędzią rodowodu i z wypełnioną selekcją wskaźników. ' +
    'Praca nie chowa się za flagą; wyłączenie jest awaryjne (lokalny override).',
  defaultValue: true,
  category: 'beta',
  allowLocalOverride: true,
};

export interface UseFinanceAnalysisWorkspaceFlagReturn {
  enabled: boolean;
  flags: UseFeatureFlagsReturn;
}

export function useFinanceAnalysisWorkspaceFlag(
  config: { userId?: string; enableLocalOverrides?: boolean } = {}
): UseFinanceAnalysisWorkspaceFlagReturn {
  const flags = useFeatureFlags({
    flags: [FINANCE_ANALYSIS_WORKSPACE_FLAG],
    userId: config.userId,
    enableLocalOverrides: config.enableLocalOverrides ?? true,
  });
  return {
    enabled:
      isFinanceOwnerReviewModeEnabled() || flags.isEnabled(FINANCE_ANALYSIS_WORKSPACE_FLAG_ID),
    flags,
  };
}

export default useFinanceAnalysisWorkspaceFlag;
