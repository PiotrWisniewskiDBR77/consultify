/**
 * Flaga `financeStatementPackWorkspaceV2` (Pakiet D, PKG_D_STATEMENTS).
 *
 * CLAUDE.md reguła #7: „Wygląd tylko za flagą (default OFF) do akceptu."
 * Analogicznie do `useFinanceWorkspacePlatformFlag` (Pakiet C) — NIE dotyka
 * współdzielonego `src/hooks/useFeatureFlags.tsx`, rejestruje flagę lokalnie
 * przez `useFeatureFlags({ flags: [...] })`.
 *
 * Zakres: `StatementPackWorkspaceV2` (`src/components/Finance/
 * statementPackWorkspaceV2/`) — nowy widok szczegółu Statement Pack (OWN-FIN-
 * 002/003/005/006/007), montowany WEWNĄTRZ `FinancialStatementPackWorkspace.tsx`
 * jako gałąź na starcie renderu. OFF (domyślnie) = dzisiejszy bespoke render
 * (zero zmiany wizualnej — zweryfikowane `git diff` nie modyfikuje istniejącej
 * ścieżki renderu poza dodaniem gałęzi na samym początku funkcji).
 */

import { useFeatureFlags, type FeatureFlag, type UseFeatureFlagsReturn } from './useFeatureFlags';
import { isFinanceOwnerReviewModeEnabled } from '@/utils/financeOwnerReviewMode';

export const FINANCE_STATEMENT_PACK_WORKSPACE_V2_FLAG_ID = 'financeStatementPackWorkspaceV2';

const FINANCE_STATEMENT_PACK_WORKSPACE_V2_FLAG: FeatureFlag = {
  id: FINANCE_STATEMENT_PACK_WORKSPACE_V2_FLAG_ID,
  name: 'Finance: Statement Pack workspace v2 (Pakiet D)',
  description:
    'Włącza nowy widok szczegółu Statement Pack zbudowany na FinanceWorkspaceBar + Focus Mode + ' +
    'FinanceErrorBoundary (Pakiet C) oraz kanonicznym kliencie `/finance-v2/statements/*` — jedna ' +
    'tożsamość/status w pasku (OWN-FIN-005), nazwane zwijane sekcje z licznikiem (OWN-FIN-006), ' +
    'sekcja „Powiązane" po lineage/immutable ID (OWN-FIN-007), rozdzielony przepływ ' +
    '„Generuj szkic → Otwórz wynik → Opublikuj/dołącz" (OWN-FIN-003). OFF = dzisiejszy bespoke ' +
    'render `FinancialStatementPackWorkspace` bez zmian. Domyślnie OFF do akceptu Piotra na ' +
    'zrzutach (CLAUDE.md #7).',
  defaultValue: false,
  category: 'beta',
  allowLocalOverride: true,
};

export interface UseFinanceStatementPackWorkspaceV2FlagReturn {
  enabled: boolean;
  flags: UseFeatureFlagsReturn;
}

export function useFinanceStatementPackWorkspaceV2Flag(
  config: { userId?: string; enableLocalOverrides?: boolean } = {}
): UseFinanceStatementPackWorkspaceV2FlagReturn {
  const flags = useFeatureFlags({
    flags: [FINANCE_STATEMENT_PACK_WORKSPACE_V2_FLAG],
    userId: config.userId,
    enableLocalOverrides: config.enableLocalOverrides ?? true,
  });
  return {
    enabled:
      isFinanceOwnerReviewModeEnabled() ||
      flags.isEnabled(FINANCE_STATEMENT_PACK_WORKSPACE_V2_FLAG_ID),
    flags,
  };
}

export default useFinanceStatementPackWorkspaceV2Flag;
