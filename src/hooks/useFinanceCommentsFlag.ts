/**
 * Flaga `financeCommentsV1` (Pakiet AP-CLIENT / Gate J — Komentarze/review, maker-checker).
 *
 * CLAUDE.md reguła #7: „Wygląd tylko za flagą (default OFF) do akceptu."
 * Gałęzi WYŁĄCZNIE montowanie `src/components/Finance/comments/FinanceCommentsPanel.tsx` —
 * komponent SAMODZIELNY, dostępny wyłącznie przez `dev-render/` do akceptu.
 *
 * Musi być REALNIE odczytywana (nie fantom) — `FinanceCommentsPanel.tsx` woła
 * `useFinanceCommentsFlag().enabled` i przy `false` zwraca `null` przed jakimkolwiek
 * wywołaniem `listFinanceComments`/`listFinanceReviewChecklist`.
 */

import { type FeatureFlag, useFeatureFlags, type UseFeatureFlagsReturn } from './useFeatureFlags';

export const FINANCE_COMMENTS_FLAG_ID = 'financeCommentsV1';

const FINANCE_COMMENTS_FLAG: FeatureFlag = {
  id: FINANCE_COMMENTS_FLAG_ID,
  name: 'Finance: Komentarze / review panel (kotwice, wzmianki, maker-checker)',
  description:
    'Włącza samodzielny panel komentarzy/review Finance v3 (comments.routes.ts, 17 ' +
    'endpointów): kotwice na artefakcie/KPI/linii/komórce/okresie, wzmianki, przypisanie, ' +
    'resolve/reopen, flaga blokująca, checklist review. OFF = komponent nieosiągalny — ' +
    'dostępny wyłącznie przez dev-render do akceptu Piotra na zrzutach (CLAUDE.md #7). ' +
    'Domyślnie OFF.',
  defaultValue: false,
  category: 'beta',
  allowLocalOverride: true,
};

export interface UseFinanceCommentsFlagReturn {
  enabled: boolean;
  flags: UseFeatureFlagsReturn;
}

export function useFinanceCommentsFlag(
  config: { userId?: string; enableLocalOverrides?: boolean } = {}
): UseFinanceCommentsFlagReturn {
  const flags = useFeatureFlags({
    flags: [FINANCE_COMMENTS_FLAG],
    userId: config.userId,
    enableLocalOverrides: config.enableLocalOverrides ?? true,
  });
  return { enabled: flags.isEnabled(FINANCE_COMMENTS_FLAG_ID), flags };
}

export default useFinanceCommentsFlag;
