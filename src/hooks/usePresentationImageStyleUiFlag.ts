/**
 * Flaga `presentationImageStyleUiV1` (Day 228 — pole „Styl obrazu" w edytorze
 * motywu prezentacji).
 *
 * CLAUDE.md reguła #7: „Wygląd tylko za flagą (default OFF) do akceptu" — właściciel
 * nigdy nie jest pierwszym testerem wizualnym. Odbiór adwersaryjny FIX-228 (pkt 3)
 * ustalił, że pole „Styl obrazu"
 * (`src/components/Presentations/PresentationTemplateArchitectView.tsx`) NIE było
 * za żadną flagą i nie miało zrzutu-akceptu Piotra — mechanizm doklejania stylu do
 * promptu (backend, `deckVisualsService.ts`) jest potwierdzony i realny, ale sama
 * POWIERZCHNIA UI wchodzi dopiero po akcepcie, jedna po drugiej (CLAUDE.md §9).
 *
 * Musi być REALNIE odczytywana (nie fantom) — `PresentationTemplateArchitectView.tsx`
 * woła `usePresentationImageStyleUiFlag().enabled` i przy `false` NIE renderuje pola
 * „Styl obrazu" (istniejąca wartość `imageStylePrompt` nadal jest zapisywana bez zmian
 * przy zapisie formularza — flaga chowa tylko UI edycji, nie kasuje danych).
 */

import { type FeatureFlag, useFeatureFlags, type UseFeatureFlagsReturn } from './useFeatureFlags';

export const PRESENTATION_IMAGE_STYLE_UI_FLAG_ID = 'presentationImageStyleUiV1';

const PRESENTATION_IMAGE_STYLE_UI_FLAG: FeatureFlag = {
  id: PRESENTATION_IMAGE_STYLE_UI_FLAG_ID,
  name: 'Prezentacje: pole „Styl obrazu" w edytorze motywu',
  description:
    'Pokazuje pole tekstowe „Styl obrazu" w edytorze motywu prezentacji ' +
    '(PresentationTemplateArchitectView) — treść dopisywana do każdego polecenia ' +
    'generowania obrazu AI w tym motywie (mechanizm backendowy day228, potwierdzony ' +
    'mutacyjnie, poza zakresem tej flagi). OFF = pole nieosiągalne w UI, dostępne ' +
    'wyłącznie przez dev-render do akceptu Piotra na zrzutach (CLAUDE.md #7, #9). ' +
    'Domyślnie OFF.',
  defaultValue: false,
  category: 'beta',
  allowLocalOverride: true,
};

export interface UsePresentationImageStyleUiFlagReturn {
  enabled: boolean;
  flags: UseFeatureFlagsReturn;
}

export function usePresentationImageStyleUiFlag(
  config: { userId?: string; enableLocalOverrides?: boolean } = {}
): UsePresentationImageStyleUiFlagReturn {
  const flags = useFeatureFlags({
    flags: [PRESENTATION_IMAGE_STYLE_UI_FLAG],
    userId: config.userId,
    enableLocalOverrides: config.enableLocalOverrides ?? true,
  });
  return { enabled: flags.isEnabled(PRESENTATION_IMAGE_STYLE_UI_FLAG_ID), flags };
}

export default usePresentationImageStyleUiFlag;
