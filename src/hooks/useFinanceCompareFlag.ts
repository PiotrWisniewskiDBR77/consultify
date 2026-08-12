/**
 * Flaga `financeCompareV1` (Pakiet AP-CLIENT / Gate J — Compare, 5 osi).
 *
 * CLAUDE.md reguła #7: „Wygląd tylko za flagą (default OFF) do akceptu."
 * Gałęzi WYŁĄCZNIE montowanie `src/components/Finance/compare/FinanceComparePanel.tsx` —
 * komponent jest SAMODZIELNY (nie wpięty w żaden workspace produkcyjny w tym pakiecie),
 * dostępny wyłącznie przez `dev-render/` do akceptu Piotra na zrzutach.
 *
 * Znany błąd w tym repo (5 z 6 istniejących flag workspace'owych NIE JEST odczytywanych —
 * `PKG_AP_LAYER_INVENTORY_2026-08-12.md` §Feature flags): ta flaga MUSI mieć realny punkt
 * odczytu w komponencie, inaczej jest fantomem z perspektywy użytkownika mimo realnego kodu
 * za nią. `FinanceComparePanel.tsx` woła `useFinanceCompareFlag().enabled` i przy `false`
 * zwraca `null` PRZED jakimkolwiek wywołaniem klienta API (patrz jego test „flaga OFF → zero
 * wywołań sieciowych").
 */

import { useFeatureFlags, type FeatureFlag, type UseFeatureFlagsReturn } from './useFeatureFlags';

export const FINANCE_COMPARE_FLAG_ID = 'financeCompareV1';

const FINANCE_COMPARE_FLAG: FeatureFlag = {
  id: FINANCE_COMPARE_FLAG_ID,
  name: 'Finance: Compare panel (5 osi — okres/actual-forecast/wersja/scenariusz/metoda)',
  description:
    'Włącza samodzielny panel porównań Finance v3 (compare.routes.ts, 6 endpointów): ' +
    'wartości bezwzględne, Δ i %, filtr istotności, eksport różnic. OFF = komponent ' +
    'nieosiągalny (brak montażu produkcyjnego) — dostępny wyłącznie przez dev-render do ' +
    'akceptu Piotra na zrzutach (CLAUDE.md #7). Domyślnie OFF.',
  defaultValue: false,
  category: 'beta',
  allowLocalOverride: true,
};

export interface UseFinanceCompareFlagReturn {
  enabled: boolean;
  flags: UseFeatureFlagsReturn;
}

export function useFinanceCompareFlag(
  config: { userId?: string; enableLocalOverrides?: boolean } = {}
): UseFinanceCompareFlagReturn {
  const flags = useFeatureFlags({
    flags: [FINANCE_COMPARE_FLAG],
    userId: config.userId,
    enableLocalOverrides: config.enableLocalOverrides ?? true,
  });
  return { enabled: flags.isEnabled(FINANCE_COMPARE_FLAG_ID), flags };
}

export default useFinanceCompareFlag;
