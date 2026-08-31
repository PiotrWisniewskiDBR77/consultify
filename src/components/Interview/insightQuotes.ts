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
 * Para cudzysłowów OTACZAJĄCYCH cały fragment (z opcjonalną kropką/przecinkiem
 * za zamykającym) — do zdjęcia z cytatu blokowego.
 *
 * DEFEKT, KTÓRY TO NAPRAWIA (M03, zrzut `insight-artifact`, 2026-08-31):
 * ten sam cytat renderował się DWA RAZY, raz z poczwórnym cudzysłowem:
 *
 *     ""We have good projects, but not yet a good portfolio story.""
 *     "We have good projects, but not yet a good portfolio story."
 *
 * Źródło w treści wniosku to markdownowy cytat blokowy, który NIESIE WŁASNE
 * cudzysłowy: `> "We have good projects…"`. Ścieżka blokowa zdejmowała tylko
 * `> ` i zwracała fragment RAZEM z cudzysłowami, a renderer (`"{quote}"` /
 * `&ldquo;{quote}&rdquo;`) doklejał drugą parę — stąd cztery znaki. Ta sama
 * linia trafiała RÓWNOLEGLE w `INLINE_QUOTE_PATTERN`, który cudzysłowy zdejmuje
 * poprawnie, więc powstawały DWA różne łańcuchy i `uniqueNonEmpty` w
 * `InsightViewer` nie miał ich jak zdeduplikować — cytat pojawiał się dwukrotnie.
 *
 * Zdjęcie pary u ŹRÓDŁA naprawia oba objawy naraz: cudzysłów robi się
 * pojedynczy (dokłada go wyłącznie renderer, zgodnie z kontraktem niżej),
 * a oba warianty stają się identyczne, więc deduplikacja je skleja w jeden.
 *
 * Klasa treści wyklucza WSZYSTKIE znaki cudzysłowu — dokładnie z tego powodu,
 * co w `INLINE_QUOTE_PATTERN`. Dzięki temu linia z DWIEMA parami
 * (`> "A" oraz "B"`) nie da dopasowania i zostaje nietknięta, zamiast zostać
 * sklejona w jeden fragment `A" oraz "B`.
 */
const WRAPPING_QUOTE_PATTERN = /^[„“"]([^"„“”\n]*)["”][.,;:!?]?$/;

/**
 * Zwraca treści cytatów w kolejności: najpierw cytaty blokowe (markdown `>`),
 * potem cytaty w linii — bez deduplikacji i bez przycinania listy. Zwracane
 * fragmenty NIE zawierają otaczających cudzysłowów, więc renderer może
 * bezpiecznie dokleić własne.
 */
export function extractQuotedFragments(content?: string): string[] {
  if (!content) return [];

  const blockQuotes = Array.from(content.matchAll(BLOCK_QUOTE_PATTERN)).map((match) => {
    const body = String(match[1] || '')
      .replace(/^>\s?/, '')
      .trim();
    // Cytat blokowy bardzo często niesie WŁASNE cudzysłowy (`> "…"`). Renderer
    // dokleja swoje, więc para z treści musi tu zniknąć — inaczej na ekranie
    // stoi `""…""`. Zdejmujemy WYŁĄCZNIE parę otaczającą całość; cudzysłowy
    // wewnątrz zdania zostają nietknięte.
    const unwrapped = body.match(WRAPPING_QUOTE_PATTERN);
    return unwrapped ? String(unwrapped[1]).trim() : body;
  });

  const inlineQuotes = Array.from(content.matchAll(INLINE_QUOTE_PATTERN)).map((match) =>
    String(match[1] || '').trim()
  );

  return [...blockQuotes, ...inlineQuotes];
}
