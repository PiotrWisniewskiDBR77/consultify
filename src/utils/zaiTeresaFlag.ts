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

function readEnvFlag(): boolean {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const parsed = parseFlag(meta?.env?.[ENV_KEY]);
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
