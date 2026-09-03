/**
 * Flaga `financeLineageNavigatorV1` (Pakiet AP-CLIENT / Gate J — Lineage navigator,
 * OWN-FIN-007/022).
 *
 * CLAUDE.md reguła #7. Gałęzi WYŁĄCZNIE montowanie
 * `src/components/Finance/lineage/FinanceLineageNavigator.tsx` — komponent SAMODZIELNY,
 * dev-render only do akceptu.
 *
 * Realnie odczytywana: `FinanceLineageNavigator.tsx` woła
 * `useFinanceLineageNavigatorFlag().enabled` i przy `false` zwraca `null` przed
 * `getFinanceLineageNavigator`.
 */

import { type FeatureFlag, useFeatureFlags, type UseFeatureFlagsReturn } from './useFeatureFlags';

export const FINANCE_LINEAGE_NAVIGATOR_FLAG_ID = 'financeLineageNavigatorV1';

const FINANCE_LINEAGE_NAVIGATOR_FLAG: FeatureFlag = {
  id: FINANCE_LINEAGE_NAVIGATOR_FLAG_ID,
  name: 'Finance: Lineage navigator (breadcrumb + panel „Powiązane")',
  description:
    'Włącza samodzielny nawigator powiązań Finance v3 (lineage-navigator.routes.ts, 2 ' +
    'endpointy): kompaktowy breadcrumb łańcucha przodków (Statement pack → Analysis → ' +
    'Baseline → Scenario → Valuation) z okresem/statusem/aktualnością każdego elementu, plus ' +
    'panel „Powiązane" z licznikami i akcją „+ Nowy" per typ. Zamyka OWN-FIN-007/022. DEC ' +
    '03.09 wieczór (A2, docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md wiersz A2 ' +
    '— 6 paneli Finansów) — domyślnie ON. Override OFF nadal możliwy (allowLocalOverride).',
  defaultValue: true,
  category: 'beta',
  allowLocalOverride: true,
};

export interface UseFinanceLineageNavigatorFlagReturn {
  enabled: boolean;
  flags: UseFeatureFlagsReturn;
}

export function useFinanceLineageNavigatorFlag(
  config: { userId?: string; enableLocalOverrides?: boolean } = {}
): UseFinanceLineageNavigatorFlagReturn {
  const flags = useFeatureFlags({
    flags: [FINANCE_LINEAGE_NAVIGATOR_FLAG],
    userId: config.userId,
    enableLocalOverrides: config.enableLocalOverrides ?? true,
  });
  return { enabled: flags.isEnabled(FINANCE_LINEAGE_NAVIGATOR_FLAG_ID), flags };
}

export default useFinanceLineageNavigatorFlag;
