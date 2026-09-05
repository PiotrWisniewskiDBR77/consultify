/**
 * FAZA B1 (2026-07-27) — „Z AI" bez formularza: Teresa z boku zamiast intake.
 *
 * Właściciel (Harvard/wdrozenie-100/_NAGRANIE_PIOTRA_WIZJA_MATERIALY_2026-07-27.md,
 * N11-N13) skreślił formularz intake (Description/Type/Density/Goal/Audience)
 * z przepływu „Z AI": „nie, że musimy ileś rzeczy wyklikiwać, powpisywać,
 * jakieś dajesz mi tabelę, jakieś wybory. To jest zupełnie do niczego
 * niepotrzebne." (N12). Kanoniczny przepływ (N11): Dodaj nowe → który z 3
 * dokumentów → Czysto/Z AI/Z template'u → BANG. „Z AI" ma otwierać dokument
 * z oknem AI (czatem) Z BOKU, a nie formularz.
 *
 * Ta flaga bramkuje WYŁĄCZNIE nową ścieżkę wejścia `docEntryMode === 'ai'`
 * w `DocumentStudioView` (`/document-studio?entry=ai` — Materiały wspólny
 * launcher, KROK 2 tablicy „Dodaj nowe"):
 *   OFF (domyślnie) → renderuje się DOTYCHCZASOWY `DocumentStudioIntakeForm`
 *                     BAJT-IDENTYCZNIE jak przed tą falą, zero regresji.
 *   ON              → renderuje się `DocumentStudioAiEntryPanel` (dokument +
 *                     Teresa z boku, pierwsza wiadomość uruchamia generację).
 *
 * `?entry=blank` (Czysto) i `?entry=template` (Z szablonu) NIE są bramkowane
 * tą flagą — obie ścieżki zostają jak dziś niezależnie od stanu flagi.
 *
 * Mirrors `src/utils/workbookTemplatesFlag.ts`'s reveal-flag pattern — kanon
 * „Piotr nigdy nie jest pierwszym testerem wizualnym" (CLAUDE.md #7): ta
 * zmiana wizualna wymaga akceptu właściciela na czystym zrzucie PRZED wejściem
 * na demo, więc default jest OFF, nie ON.
 *
 * Kolejność (wygrywa najwyższe):
 *   1. URL query `?ff_zai_teresa=0|1` — bypass operatora / dev / dev-render.
 *   2. `localStorage["ff.zaiTeresa"]` — override user / org.
 *   3. `import.meta.env.VITE_ZAI_TERESA_ENABLED` — build-time.
 *   4. Default: OFF (prawda o stanie: NIEZAAKCEPTOWANE wizualnie przez Piotra).
 */

const LS_KEY = 'ff.zaiTeresa';
const QUERY_KEY = 'ff_zai_teresa';
const ENV_KEY = 'VITE_ZAI_TERESA_ENABLED';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

/**
 * ★ ODCZYT MUSI BYĆ STATYCZNY — ZMIERZONE 05.09 (odbiór na żywo, różnica #7).
 *
 * Objaw: `VITE_ZAI_TERESA_ENABLED=true` w `.env.local`, a ścieżka „Z AI" i tak
 * wchodziła w stary formularz; działało wyłącznie `?ff_zai_teresa=1`.
 *
 * Przyczyna (zmierzona, nie wywnioskowana — dwa pomiary):
 *  1. `vite build`: podstawienie zmiennych to TEKSTOWE zastąpienie wyrażenia
 *     `import.meta.env.KLUCZ`. Zapis `const meta = import.meta; meta?.env?.[K]`
 *     nie zawiera tego wyrażenia, więc nic się nie podstawia, a w gotowym
 *     bundlu natywne `import.meta` NIE MA własności `env` → `undefined`.
 *     (Pomiar: mini-projekt, `dist/assets/index-*.js` — funkcja statyczna
 *     zwraca `"true"`, dynamiczna zwraca `meta?.env?.[ENV_KEY]`.)
 *  2. `vite dev`: obiekt `import.meta.env` JEST wstrzykiwany w preambule
 *     modułu, ale TYLKO wtedy, gdy kod modułu (po transformacji, czyli już bez
 *     komentarzy) zawiera dosłowny napis `import.meta.env`. Ten plik go nie
 *     zawierał — pobrany z serwera dev `/src/utils/zaiTeresaFlag.ts` przyszedł
 *     BEZ preambuły, więc `import.meta.env` było `undefined` także lokalnie.
 *
 * Innymi słowy: dynamiczny odczyt nie działał NIGDZIE — ani w buildzie, ani w
 * devie. Warstwa `import.meta.env` była martwa od początku, a nie „wyłączona".
 * Dlatego poniżej stoi dosłowne `import.meta.env.VITE_ZAI_TERESA_ENABLED`;
 * `ENV_KEY` zostaje wyłącznie jako etykieta eksportowana w
 * `ZAI_TERESA_FLAG_KEYS` (dokumentacja/diagnostyka), NIE jako indeks odczytu.
 * Ten sam wzorzec ma już `src/utils/dynamicSwotSevenStagesFlag.ts`.
 *
 * ⚠️ RODZINA: ten defekt nie jest lokalny — w `src/utils/` jest ~112 modułów
 * flag z identycznym dynamicznym odczytem. Masowa naprawa oznaczałaby
 * jednoczesne WŁĄCZENIE kilkudziesięciu flag wizualnych na żywo, czego
 * zabrania CLAUDE.md §9 („zakaz masowego włączania"). Naprawiona jest tylko ta
 * jedna flaga, w zakresie zlecenia; skala rodziny idzie do raportu i do decyzji
 * właściciela.
 */
function readEnvFlag(): boolean {
  try {
    const parsed = parseFlag(import.meta.env.VITE_ZAI_TERESA_ENABLED);
    return parsed === null ? false : parsed;
  } catch {
    return false;
  }
}

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorage(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(LS_KEY));
  } catch {
    return null;
  }
}

export function isZaiTeresaEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ZAI_TERESA_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
