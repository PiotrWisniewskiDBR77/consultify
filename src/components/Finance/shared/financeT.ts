/**
 * `ft` — tłumaczenie etykiety Finansów POZA hookiem `useTranslation()`.
 *
 * DLACZEGO ISTNIEJE (paczka J9, 08.09). Moduł 09 miał 183 polskie napisy
 * wpisane wprost w JSX (kategoria K4pl pomiaru `scripts/i18n/pomiar-jezyka.mjs`)
 * rozrzucone po ~40 plikach, z których tylko 5 miało `useTranslation()`.
 * Dołożenie hooka do pozostałych 35 znaczyłoby zgadywanie, gdzie kończy się
 * komponent, a gdzie zaczyna zwykły helper — hook w helperze to awaria
 * runtime, nie czerwony test. Dlatego etykiety idą przez instancję i18next.
 *
 * ALE gołe `i18n.t(klucz, 'English')` NIE WYSTARCZA i to jest zmierzony fakt,
 * nie ostrożność: na instancji, która nie przeszła jeszcze `init()`, i18next
 * zwraca PUSTY NAPIS zamiast `defaultValue`. W testach jednostkowych (globalna
 * atrapa `react-i18next` w `tests/setup.ts` nie dotyka `i18next`) dawało to
 * puste przyciski — a w aplikacji ten sam mechanizm groziłby pustą etykietą
 * przy pierwszym malowaniu ekranu, zanim backend HTTP dowiezie plik tłumaczeń
 * (`src/i18n.ts` ma `useSuspense: false`, więc render NIE czeka).
 *
 * `ft` zamyka obie dziury: gdy i18next nie jest gotowy albo oddał pustkę,
 * pokazuje angielski `fallback` — czyli dokładnie to, co `defaultValue` miało
 * pokazać. Interpolacja `{{zmienna}}` działa też na ścieżce awaryjnej.
 *
 * OGRANICZENIE, ŚWIADOME: `ft` nie subskrybuje zdarzenia `languageChanged`,
 * więc sam z siebie nie przerysuje etykiety po przełączeniu języka bez
 * przeładowania. W praktyce powłoka modułu (`FinanceHub.tsx`) używa
 * `useTranslation()`, więc całe poddrzewo i tak renderuje się od nowa i `ft`
 * policzy się ponownie. Tam, gdzie `useTranslation()` jest już w komponencie,
 * używaj `t()` z hooka — `ft` jest dla reszty.
 */
import i18n from 'i18next';

function interpoluj(tekst: string, opcje?: Record<string, unknown>): string {
  if (!opcje) return tekst;
  return tekst.replace(/\{\{(\w+)\}\}/g, (calosc, nazwa: string) =>
    opcje[nazwa] == null ? calosc : String(opcje[nazwa])
  );
}

export function ft(klucz: string, fallback: string, opcje?: Record<string, unknown>): string {
  if (i18n?.isInitialized) {
    const wynik = i18n.t(klucz, fallback, opcje);
    if (typeof wynik === 'string' && wynik.length > 0) return wynik;
  }
  return interpoluj(fallback, opcje);
}
