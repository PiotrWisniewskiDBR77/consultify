/**
 * The compiled DRD Method Pack in the VIEWER'S language (DEC-461, fala J1).
 *
 * Before this hook, both workspace screens imported a module-level
 * `export const { pack } = compileDrdPack()` — compiled once, in Polish, at
 * import time. An English user opened the questionnaire and read Polish area
 * names, Polish question wording and a Polish "Why do we ask", regardless of
 * the language set in Settings.
 *
 * ★ WHY `useSyncExternalStore` ON THE i18next SINGLETON AND NOT
 * `useTranslation().i18n.language`.
 * `tests/setup.ts` mocks `react-i18next` GLOBALLY, and the mock's `i18n` stub
 * does not track `i18next.changeLanguage()`. A hook built on the mocked hook
 * therefore reports one language while the rest of the module (which reads the
 * real `i18next` singleton: `drdLabels.ts`, `drdWorkspaceViewModel.ts`) reports
 * another — measured on this very screen: a Polish navigator next to an English
 * breadcrumb and English questions. Subscribing to `i18next`'s own
 * `languageChanged` event gives ONE answer in the app and in tests, and is
 * exactly the subscription that makes a Settings language switch repaint the
 * questionnaire with no page reload.
 */
import { useMemo, useSyncExternalStore } from 'react';
import i18n from 'i18next';

import type { DrdPackLanguage } from '@/method-core/methods/drd/compileDrdPack';
import { drdPackLanguageFrom } from '@/method-core/methods/drd/drdPackLanguage';

import { getDrdPack } from './drdWorkspaceViewModel';

function subscribeToLanguage(onChange: () => void): () => void {
  i18n.on('languageChanged', onChange);
  return () => {
    i18n.off('languageChanged', onChange);
  };
}

/** The pack language the viewer is on, re-read whenever i18next switches. */
export function useDrdPackLanguage(): DrdPackLanguage {
  return useSyncExternalStore(
    subscribeToLanguage,
    () => drdPackLanguageFrom(i18n.language || i18n.resolvedLanguage),
    // Server snapshot: EN, the product's leading language (DEC-461).
    () => 'en' as const
  );
}

export function useDrdPack(): ReturnType<typeof getDrdPack> {
  const lang = useDrdPackLanguage();
  // `compileDrdPack` caches per language, so this is a map lookup after the
  // first call in each language.
  return useMemo(() => getDrdPack(lang), [lang]);
}
