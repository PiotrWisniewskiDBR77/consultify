/**
 * Prawy pas artefaktu jako JEDNA FORMUŁA — flaga rolloutu (2026-08-30).
 *
 * Po co: w aplikacji jest JEDENAŚCIE prawych szyn (4 na kanonicznym
 * `ArtifactRightPanel`, 7 z własną budową), a miejsce Teresy jest inne
 * w każdej z nich — notatnik ma przycisk-wyjście „Open Teresa" w sekcji
 * Historii, idee mają sekcję akordeonu, czat oddaje jej cały pas, Word ma
 * ikonę szyny (jedyny poprawny wzorzec). SSOT analizy i decyzji:
 * `docs/program/grafika/ANALIZA_PRAWY_PANEL.md` §3/§4/§7 + uzupełnienie
 * „dokumenty". Zatwierdzone rozstrzygnięcie właściciela (2026-08-30):
 *
 *   „Teresa staje się jedną z ikon na stałej szynie prawego pasa — tak jak
 *   jest już w Wordzie. Rozciągamy wzorzec z Worda na całą strukturę."
 *
 * ★★★ ZASTĄPIONE 2026-09-01 — „JEDNA TERESA, W SWOIM OKNIE" ★★★
 * Właściciel odrzucił WŁAŚNIE ten wzorzec (tryb „Teresa" jako pełnowysokościowy
 * czat na szynie) przy odbiorze `-idea-teresa`/`-notatka-teresa`: „nie wiem
 * dlaczego teresa jest w oknie narzędzia skoro jest osobna teresa". Nowa
 * decyzja (docs/program/grafika/KANON_Z_ODBIOROW.md, wpis 2026-09-01):
 * czat NIE wchodzi na szynę w żadnej formie — panel artefaktu dostaje
 * wyłącznie przycisk-wejście do głównego okna Teresy. Ta flaga i tryb
 * `teresa` w `ArtifactRightRail.tsx` zostają jako ISTNIEJĄCY (nieużywany
 * docelowo) mechanizm — nowe powierzchnie NIE powinny go włączać; istniejące
 * (`NotebookRightRail`) czekają na przepisanie w kolejnej fali. Nowsza
 * decyzja wygrywa nad cytatem powyżej.
 *
 * Ta flaga włącza wspólną powłokę `src/components/standard/ArtifactRightRail.tsx`
 * na powierzchni, która ją zadeklaruje. Dziś zadeklarowana jest DOKŁADNIE
 * JEDNA: prawa szyna Notatnika (`NotebookRightRail`). Pozostałe dziesięć szyn
 * NIE jest ruszane — rozwożenie to osobny krok, po akcepcie zrzutów.
 *
 * ★ DOMYŚLNIE WYŁĄCZONA (CLAUDE.md #7 — właściciel nigdy nie jest pierwszym
 * testerem wizualnym; CLAUDE.md #9 — zakaz masowego włączania). Przy fladze
 * OFF renderuje się DOKŁADNIE dotychczasowa ścieżka, bez różnicy co do
 * piksela. Domyślną zmienia się dopiero po akcepcie właściciela na czystych
 * zrzutach, osobnym krokiem, jedna powierzchnia po drugiej.
 *
 * Kolejność rozstrzygania (wygrywa najwyższe):
 *   1. URL query `?ff_artifact_right_rail=0|1` — bypass dev / dev-render / odbiór.
 *   2. `localStorage["ff.artifact.right_rail"]` — override użytkownika / org.
 *   3. `import.meta.env.VITE_ARTIFACT_RIGHT_RAIL_ENABLED` — build-time.
 *   4. Default: OFF.
 *
 * Wzorzec pliku: `src/utils/exceleRightRailFlag.ts` (ta sama trójwarstwowa
 * kolejność i to samo `parseFlag`), z odwróconą domyślną.
 */

export const ENABLE_ARTIFACT_RIGHT_RAIL = false;

const LS_KEY = 'ff.artifact.right_rail';
const QUERY_KEY = 'ff_artifact_right_rail';
const ENV_KEY = 'VITE_ARTIFACT_RIGHT_RAIL_ENABLED';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
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

function readEnvFlag(): boolean | null {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    return parseFlag(meta?.env?.[ENV_KEY]);
  } catch {
    return null;
  }
}

/**
 * Czy powierzchnia ma renderować wspólną powłokę prawego pasa.
 * Wejście nieczytelne / środowisko bez `window` → `false` (fail-closed).
 */
export function isArtifactRightRailEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  const fromEnv = readEnvFlag();
  if (fromEnv !== null) return fromEnv;
  return ENABLE_ARTIFACT_RIGHT_RAIL;
}

export const ARTIFACT_RIGHT_RAIL_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
