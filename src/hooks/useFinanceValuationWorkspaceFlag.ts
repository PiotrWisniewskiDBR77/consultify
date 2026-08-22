/**
 * Flaga `financeValuationWorkspaceV1` (Pakiet H — Enterprise Valuation).
 *
 * CLAUDE.md reguła #7: „Wygląd tylko za flagą do akceptu."
 * Osobna flaga od `financeWorkspacePlatformV1` (Pakiet C) celowo — ta ostatnia
 * gałęzi WSPÓLNE komponenty chrome (`FinanceWorkspaceBar`/Focus Mode/
 * `FinanceErrorBoundary`) używane przez wiele workspace'ów Finance; ta flaga
 * gałęzi WYŁĄCZNIE mountowanie nowego ekranu `<ValuationWorkspace>` (Pakiet H)
 * — który dziś nie ma żadnego produkcyjnego punktu wejścia (żaden route ani
 * hub go nie renderuje; jedyny konsument to `dev-render/screens/
 * finance-valuation-workspace.tsx`, harness do zrzutów). Rozdzielenie flag
 * pozwala niezależnie wycofać ekran Wyceny bez wyłączania platformy C.
 * Piotr zaakceptował domyślne włączenie w `AMD-FIN-VALUATION-V3-001`
 * (2026-08-18); flaga pozostaje jako bezpieczny rollback.
 *
 * Wzorzec identyczny jak `useFinanceWorkspacePlatformFlag.ts` (Pakiet C):
 * NIE modyfikuje współdzielonego `src/hooks/useFeatureFlags.tsx` (poza
 * allowlistą tego pakietu) — rejestruje flagę lokalnie przez
 * `useFeatureFlags({ flags: [...] })`.
 */

import { useFeatureFlags, type FeatureFlag, type UseFeatureFlagsReturn } from './useFeatureFlags';
import { isFinanceOwnerReviewModeEnabled } from '@/utils/financeOwnerReviewMode';

export const FINANCE_VALUATION_WORKSPACE_FLAG_ID = 'financeValuationWorkspaceV1';

const FINANCE_VALUATION_WORKSPACE_FLAG: FeatureFlag = {
  id: FINANCE_VALUATION_WORKSPACE_FLAG_ID,
  name: 'Finance: Enterprise Valuation workspace (Pakiet H)',
  description:
    'Włącza ekran Wyceny przedsiębiorstwa (Source → Assumptions → Methods & weights → ' +
    'Results → Sensitivity → Valuation Advisor → Export, OWN-FIN-021/OWN-FIN-002). OFF = ' +
    'ekran nie jest mountowany nigdzie w aplikacji (dziś brak produkcyjnego punktu wejścia — ' +
    'żaden hub/route go nie renderuje). Domyślnie ON po akceptacji Piotra ' +
    '`AMD-FIN-VALUATION-V3-001`; flaga pozostaje kontrolowanym rollbackiem.',
  defaultValue: true,
  category: 'beta',
  allowLocalOverride: true,
};

export interface UseFinanceValuationWorkspaceFlagReturn {
  enabled: boolean;
  flags: UseFeatureFlagsReturn;
}

export function useFinanceValuationWorkspaceFlag(
  config: { userId?: string; enableLocalOverrides?: boolean } = {}
): UseFinanceValuationWorkspaceFlagReturn {
  const flags = useFeatureFlags({
    flags: [FINANCE_VALUATION_WORKSPACE_FLAG],
    userId: config.userId,
    enableLocalOverrides: config.enableLocalOverrides ?? true,
  });
  return {
    enabled:
      isFinanceOwnerReviewModeEnabled() || flags.isEnabled(FINANCE_VALUATION_WORKSPACE_FLAG_ID),
    flags,
  };
}

export default useFinanceValuationWorkspaceFlag;
