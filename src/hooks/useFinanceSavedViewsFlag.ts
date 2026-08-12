/**
 * Flaga `financeSavedViewsV1` (Pakiet AP-CLIENT / Gate J — Zapisane widoki).
 *
 * CLAUDE.md reguła #7. Gałęzi WYŁĄCZNIE montowanie
 * `src/components/Finance/savedViews/FinanceSavedViewsPanel.tsx` — komponent SAMODZIELNY,
 * dev-render only do akceptu.
 *
 * Realnie odczytywana: `FinanceSavedViewsPanel.tsx` woła `useFinanceSavedViewsFlag().enabled`
 * i przy `false` zwraca `null` przed `listFinanceSavedViews`.
 */

import { type FeatureFlag, useFeatureFlags, type UseFeatureFlagsReturn } from './useFeatureFlags';

export const FINANCE_SAVED_VIEWS_FLAG_ID = 'financeSavedViewsV1';

const FINANCE_SAVED_VIEWS_FLAG: FeatureFlag = {
  id: FINANCE_SAVED_VIEWS_FLAG_ID,
  name: 'Finance: Zapisane widoki (osobiste/zespołowe, filtry, kolumny)',
  description:
    'Włącza samodzielny panel zapisanych widoków Finance v3 (saved-views.routes.ts, 6 ' +
    'endpointów): widoczność PERSONAL/TEAM, kolejność/przypięcie/ukrycie kolumn, zapis i ' +
    'udostępnianie widoku linkiem. OFF = komponent nieosiągalny — dostępny wyłącznie przez ' +
    'dev-render do akceptu Piotra na zrzutach (CLAUDE.md #7). Domyślnie OFF.',
  defaultValue: false,
  category: 'beta',
  allowLocalOverride: true,
};

export interface UseFinanceSavedViewsFlagReturn {
  enabled: boolean;
  flags: UseFeatureFlagsReturn;
}

export function useFinanceSavedViewsFlag(
  config: { userId?: string; enableLocalOverrides?: boolean } = {}
): UseFinanceSavedViewsFlagReturn {
  const flags = useFeatureFlags({
    flags: [FINANCE_SAVED_VIEWS_FLAG],
    userId: config.userId,
    enableLocalOverrides: config.enableLocalOverrides ?? true,
  });
  return { enabled: flags.isEnabled(FINANCE_SAVED_VIEWS_FLAG_ID), flags };
}

export default useFinanceSavedViewsFlag;
