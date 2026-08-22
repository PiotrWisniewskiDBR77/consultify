/**
 * Flaga `financePredictionWorkspaceV1` (Pakiet G — Prediction).
 *
 * CLAUDE.md reguła #7: „Wygląd tylko za flagą (default OFF) do akceptu." Ten hook NIE modyfikuje
 * `src/hooks/useFeatureFlags.tsx` (plik współdzielony przez wiele równoległych sesji, poza
 * allowlistą tego pakietu) — zamiast tego woła `useFeatureFlags({ flags: [...] })` z lokalną
 * definicją flagi, dokładnie ten sam wzorzec co `useFinanceWorkspacePlatformFlag.ts` (Pakiet C).
 *
 * Zakres: powłoka `PredictionWorkspace` (`src/components/Finance/Prediction/PredictionWorkspace.tsx`)
 * — oba widoki (Budowa założeń / Modele-Wyniki), wszystkie trzy tryby budowy (A/B/C). Domyślnie OFF
 * do akceptu Piotra na CZYSTYM zrzucie (CLAUDE.md #7 — Piotr nigdy nie jest pierwszym testerem
 * wizualnym).
 */

import { useFeatureFlags, type FeatureFlag, type UseFeatureFlagsReturn } from './useFeatureFlags';
import { isFinanceOwnerReviewModeEnabled } from '@/utils/financeOwnerReviewMode';

export const FINANCE_PREDICTION_WORKSPACE_FLAG_ID = 'financePredictionWorkspaceV1';

const FINANCE_PREDICTION_WORKSPACE_FLAG: FeatureFlag = {
  id: FINANCE_PREDICTION_WORKSPACE_FLAG_ID,
  name: 'Finance: Prediction — scenario builder + Modele/Wyniki (Pakiet G)',
  description:
    'Włącza workspace Prediction (dwa widoki: Budowa założeń, Modele/Wyniki; trzy tryby budowy ' +
    'scenariusza — standardowy Base/Bull/Bear, wskaźnikowy driver override, fundamentalny ' +
    'initiative->driver->linia->prognoza). OFF = ekran niedostępny, zero zmiany istniejących ' +
    'ekranów Finance. Domyślnie OFF do akceptu Piotra na CZYSTYM zrzucie (CLAUDE.md #7).',
  defaultValue: false,
  category: 'beta',
  allowLocalOverride: true,
};

export interface UseFinancePredictionWorkspaceFlagReturn {
  enabled: boolean;
  flags: UseFeatureFlagsReturn;
}

export function useFinancePredictionWorkspaceFlag(
  config: { userId?: string; enableLocalOverrides?: boolean } = {}
): UseFinancePredictionWorkspaceFlagReturn {
  const flags = useFeatureFlags({
    flags: [FINANCE_PREDICTION_WORKSPACE_FLAG],
    userId: config.userId,
    enableLocalOverrides: config.enableLocalOverrides ?? true,
  });
  return {
    enabled:
      isFinanceOwnerReviewModeEnabled() || flags.isEnabled(FINANCE_PREDICTION_WORKSPACE_FLAG_ID),
    flags,
  };
}

export default useFinancePredictionWorkspaceFlag;
