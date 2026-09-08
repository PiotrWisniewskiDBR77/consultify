/**
 * BRAMA JĘZYKA POWŁOKI (paczka ZZ, 2026-09-09).
 *
 * PROBLEM, zmierzony na czystym stanowisku (evidence/jezyk-jzz/README.md):
 * konto `users.language='en'` widziało POLSKI interfejs. Dwie różne przyczyny,
 * obie po stronie startu aplikacji:
 *
 *  1. `src/i18n.ts` ma `react.useSuspense: false`, więc powłoka maluje się
 *     NIE CZEKAJĄC na `translation.json` (EN waży 1,9 MB). Do czasu dojścia
 *     pliku `t('klucz', 'Polski tekst')` zwraca wartość domyślną Z KODU —
 *     a takich polskich defaultów jest w repo 1046. Użytkownik EN widzi
 *     polskie napisy mimo poprawnie ustawionego języka.
 *  2. `detection.order` zaczyna się od localStorage/navigator, a `users.language`
 *     dochodzi dopiero z `GET /auth/me`. W świeżej przeglądarce z polskim
 *     `navigator.language` konto EN dostawało polską powłokę na cały czas lotu
 *     tego zapytania.
 *
 * NAPRAWA: powłoka nie maluje pierwszego ekranu, dopóki (a) nie wiadomo, JAKI
 * to język (rozstrzygnięcie konta) i (b) nie ma zasobów tego języka. Zamiast
 * migotania polskich defaultów użytkownik widzi ten sam neutralny ekran
 * ładowania, który i tak już jest pokazywany podczas inicjalizacji autoryzacji.
 *
 * CZEGO TA BRAMA NIE ROBI — świadomie:
 *  • nie zamienia się w biały ekran: po `LIMIT_CZASU_MS` przepuszcza render
 *    bez względu na wszystko (wolna sieć, padnięty backend, brak pliku);
 *  • nie czeka na nic dla użytkownika NIEzalogowanego bez zapamiętanego języka
 *    konta — tam poprawnym źródłem jest przeglądarka i nie ma na co czekać;
 *  • nie wprowadza `useSuspense: true` — to zmieniłoby zachowanie każdego
 *    ekranu w aplikacji, a bramie wystarczy jeden warunek w jednym miejscu.
 */
import { useEffect, useState } from 'react';

import i18n from '@/i18n';
import {
  isAccountLanguageResolved,
  onAccountLanguageResolved,
  readStoredAccountLanguage,
} from '@/services/accountLanguageStorage';

/**
 * Twardy limit. Powyżej tego czasu render idzie i tak — lepszy ekran w
 * przybliżonym języku niż aplikacja, która się nie uruchamia.
 */
export const LIMIT_CZASU_MS = 3000;

const czyJestToken = (): boolean => {
  try {
    return Boolean(window.localStorage.getItem('token'));
  } catch {
    return false;
  }
};

/** Czy i18next ma już wczytany zasób dla języka, w którym zaraz namalujemy ekran. */
const czyZasobyGotowe = (): boolean => {
  if (!i18n.isInitialized) return false;
  const lng = i18n.resolvedLanguage || i18n.language;
  if (!lng) return false;
  // `hasResourceBundle` jest prawdą dopiero, gdy plik doszedł — dokładnie ten
  // moment, po którym `t()` przestaje oddawać `defaultValue` z kodu.
  return Boolean(i18n.hasResourceBundle(lng, 'translation'));
};

/**
 * Czy język powłoki jest już rozstrzygnięty.
 * Rozstrzygnięciem jest także świadome „konto nie ma zdania" — patrz
 * `markAccountLanguageResolved` w `languagePreference.ts`.
 */
const czyJezykRozstrzygniety = (): boolean => {
  if (!czyJestToken()) return true; // ekrany publiczne: język = przeglądarka, nie ma na co czekać
  if (readStoredAccountLanguage()) return true; // znamy język konta z poprzedniej sesji
  return isAccountLanguageResolved();
};

const czyGotowe = (): boolean => czyJezykRozstrzygniety() && czyZasobyGotowe();

export const useLanguageBootReady = (): boolean => {
  const [gotowe, setGotowe] = useState<boolean>(() => czyGotowe());

  useEffect(() => {
    if (gotowe) return undefined;

    let zywy = true;
    const sprawdz = () => {
      if (!zywy) return;
      if (czyGotowe()) setGotowe(true);
    };

    // trzy niezależne źródła zdarzeń, bo każde może przyjść jako pierwsze
    const odsubskrybujKonto = onAccountLanguageResolved(sprawdz);
    i18n.on('initialized', sprawdz);
    i18n.on('loaded', sprawdz);
    i18n.on('languageChanged', sprawdz);

    // ostatnia deska: gdyby żadne zdarzenie nie przyszło (np. backend padł),
    // brama i tak się otwiera — aplikacja ma się uruchomić.
    const limit = window.setTimeout(() => {
      if (zywy) setGotowe(true);
    }, LIMIT_CZASU_MS);

    sprawdz();

    return () => {
      zywy = false;
      odsubskrybujKonto();
      i18n.off('initialized', sprawdz);
      i18n.off('loaded', sprawdz);
      i18n.off('languageChanged', sprawdz);
      window.clearTimeout(limit);
    };
  }, [gotowe]);

  return gotowe;
};
