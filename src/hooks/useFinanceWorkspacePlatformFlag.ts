/**
 * Flaga `financeWorkspacePlatformV1` (Pakiet C, PKG_C_UI_PLATFORM).
 *
 * CLAUDE.md reguła #7: „Wygląd tylko za flagą (default OFF) do akceptu."
 * Ten hook NIE modyfikuje `src/hooks/useFeatureFlags.tsx` (plik współdzielony
 * przez wiele równoległych sesji, poza allowlistą tego pakietu — allowlista
 * pozwala tylko na NOWE pliki w `src/hooks/**`) — zamiast tego woła
 * `useFeatureFlags({ flags: [...] })` z lokalną definicją flagi. Ten hook
 * scala niestandardowe flagi z `DEFAULT_FLAGS` TYLKO w obrębie własnego
 * wywołania (`useFeatureFlags.tsx:388-392`), więc rejestracja nie wymaga
 * dotykania centralnego rejestru.
 *
 * Zakres flagi: `FinanceWorkspaceBar`, Focus Mode i `FinanceErrorBoundary`
 * (komponenty w `src/components/Finance/shared/`) — żaden z pięciu istniejących
 * workspace'ów Finance dziś ich nie montuje (poza allowlistą tego pakietu),
 * więc flaga dziś nie gałęzi żadnego produkcyjnego ekranu — jest gotowa dla
 * pakietów D–H, kiedy zaczną wpinać te komponenty do
 * `FinancialModelWorkspace`/`FinancialStatementPackWorkspace`/itd.
 */

import { useFeatureFlags, type FeatureFlag, type UseFeatureFlagsReturn } from './useFeatureFlags';

export const FINANCE_WORKSPACE_PLATFORM_FLAG_ID = 'financeWorkspacePlatformV1';

const FINANCE_WORKSPACE_PLATFORM_FLAG: FeatureFlag = {
  id: FINANCE_WORKSPACE_PLATFORM_FLAG_ID,
  name: 'Finance: Workspace Bar + Focus Mode + Error Boundary (Pakiet C)',
  description:
    'Włącza wspólny FinanceWorkspaceBar (OWN-FIN-011/016/020/021), Focus Mode ' +
    '(OWN-FIN-004) i lokalny FinanceErrorBoundary (OWN-FIN-002) w workspace\'ach ' +
    'Finance. OFF = dzisiejsze bespoke nagłówki pięciu workspace\'ów (zero zmiany ' +
    'wizualnej, bo żaden istniejący workspace jeszcze ich nie montuje — to teren ' +
    'pakietów D–H). Domyślnie OFF do akceptu Piotra na zrzutach (CLAUDE.md #7).',
  defaultValue: false,
  category: 'beta',
  allowLocalOverride: true,
};

export interface UseFinanceWorkspacePlatformFlagReturn {
  enabled: boolean;
  flags: UseFeatureFlagsReturn;
}

export function useFinanceWorkspacePlatformFlag(
  config: { userId?: string; enableLocalOverrides?: boolean } = {}
): UseFinanceWorkspacePlatformFlagReturn {
  const flags = useFeatureFlags({
    flags: [FINANCE_WORKSPACE_PLATFORM_FLAG],
    userId: config.userId,
    enableLocalOverrides: config.enableLocalOverrides ?? true,
  });
  return { enabled: flags.isEnabled(FINANCE_WORKSPACE_PLATFORM_FLAG_ID), flags };
}

export default useFinanceWorkspacePlatformFlag;
