/**
 * Wydzielony, czysty ekstraktor cytatów z treści wniosku (Insight).
 *
 * DLACZEGO OSOBNY MODUŁ: `InsightViewer.tsx` ma ~9,9 tys. linii i jego import
 * w teście wymaga pełnego rusztowania (jsdom, i18n, router, mocki API). Sama
 * logika wyszukiwania cytatów jest czysto tekstowa, więc mieszka tu — dzięki
 * temu ma szybki test jednostkowy bez żadnych mocków.
 *
 * DEFEKT, KTÓRY TO NAPRAWIA (M03, zrzut karty wniosku):
 * poprzedni wzorzec `/"([^"\n]{16,220})"/g` znał wyłącznie prosty cudzysłów
 * ASCII. Polska typografia używa pary „…" (U+201E + 0x22) albo „…” (U+201E +
 * U+201D). Gdy w jednym akapicie były DWIE takie pary:
 *
 *     Kierownik Produkcji: „Cytat A". Utrzymanie Ruchu: „Cytat B".
 *
 * wzorzec parował cudzysłów ZAMYKAJĄCY pierwszej pary z ZAMYKAJĄCYM drugiej,
 * przeskakując otwierające „ pomiędzy nimi. Wycinał więc fragment zaczynający
 * się w środku zdania — na ekranie renderowało się osierocone `". Utrzymanie
 * Ruchu: …`, dodatkowo owinięte w cudzysłowy dokładane przez renderer.
 *
 * NAPRAWA: klasa treści wyklucza WSZYSTKIE znaki cudzysłowu, więc dopasowanie
 * nie może przeskoczyć przez cudzysłów otwierający. Skan jest lewostronny, bez
 * zagnieżdżeń i bez nawrotów wykładniczych — cudzysłowy nieparzyste po prostu
 * nie dają dopasowania zamiast wywracać funkcję albo ją zapętlać.
 */

/** Minimalna i maksymalna długość treści cytatu (kontrakt zachowany z 044567ea02). */
export const QUOTE_MIN_LENGTH = 16;
export const QUOTE_MAX_LENGTH = 220;

/**
 * Cudzysłów OTWIERAJĄCY: „ (U+201E, polski), “ (U+201C, angielski), " (ASCII).
 * Cudzysłów ZAMYKAJĄCY: " (ASCII), ” (U+201D).
 * Treść: cokolwiek poza znakiem cudzysłowu i końcem linii — to wykluczenie
 * jest istotą naprawy, bo uniemożliwia sparowanie „przez" inny cudzysłów.
 */
const INLINE_QUOTE_PATTERN = /[„“"]([^"„“”\n]{16,220})["”]/g;

/** Cytat blokowy markdown: linia zaczynająca się od `>`. */
const BLOCK_QUOTE_PATTERN = /(^>\s?.+$)/gm;

/**
 * Zwraca treści cytatów w kolejności: najpierw cytaty blokowe (markdown `>`),
 * potem cytaty w linii — bez deduplikacji i bez przycinania listy. Zwracane
 * fragmenty NIE zawierają otaczających cudzysłowów, więc renderer może
 * bezpiecznie dokleić własne.
 */
export function extractQuotedFragments(content?: string): string[] {
  if (!content) return [];

  const blockQuotes = Array.from(content.matchAll(BLOCK_QUOTE_PATTERN)).map((match) =>
    String(match[1] || '')
      .replace(/^>\s?/, '')
      .trim()
  );

  const inlineQuotes = Array.from(content.matchAll(INLINE_QUOTE_PATTERN)).map((match) =>
    String(match[1] || '').trim()
  );

  return [...blockQuotes, ...inlineQuotes];
}
