/**
 * PASEK EDYCJI OBIEKTU dokowany w górnej listwie płótna (zgłoszenia właściciela
 * 2026-07-28).
 *
 * Słowa właściciela:
 *   • Mapa Myśli: „co byś powiedział na to, gdybyśmy otworzyli je w linii, tam
 *     gdzie jest AddNode, Auto Layout, AI Expand, Templates — dokładnie tutaj
 *     na środku tego menu".
 *   • Whiteboard: „zróbmy to tak jak w mapie myśli. menu kontekstowe, czyli
 *     ikony i to co będzie się otwierać na środku menu narzędzia. no brakuje
 *     nam czcionek (kolorów, wielkości, podkreśleń, bordów…)".
 *   • Process Flow: „Wybór obiektu powinien uruchamiać pasek kontekstowy z
 *     narzędziami do jego edycji, który z kolei powinien uruchamiać się w
 *     górnym menu. Jak w innych narzędziach."
 *   • „kolor linii oraz oddzielnie kolory i kształty okienek (nodów) tak aby
 *     można było robić też inne kształty oraz tła i ramki".
 *
 * DECYZJA PROJEKTOWA (nie drugi rząd!): pasek edycji PODMIENIA zawartość
 * listwy Menu 3 (`IdeaCanvasSecondBar` — dokładnie ta, gdzie stoją „Dodaj
 * węzeł · Auto-układ · AI rozwiń · Szablony"), a nie dokłada nowego rzędu.
 * Odznaczenie = powrót do normalnej listwy. Mechanizm portalowy 1:1 z
 * `whiteboardSessionInPanelFlag.ts` / `ideaTopBarOneLineFlag.ts`: listwa
 * wystawia slot DOM, narzędzie (Mapa/Tablica/Proces) portaluje do niego swój
 * model paska — zero prop-drillingu przez `IdeaMapWorkspace`.
 *
 * BEZPIECZNIK (identyczny w duchu co w `ideaTopBarOneLineFlag`): gdy flaga jest
 * ON, ale slotu NIE MA w DOM (np. `ff_ideaTopBarOneLine=1` chowa całe Menu 3,
 * albo narzędzie żyje poza powłoką), narzędzie renderuje swój dotychczasowy
 * PŁYWAJĄCY pasek nad zaznaczeniem — kontrolki nigdy nie znikają przez brak
 * celu portalu.
 *
 * Flaga bramkuje TAKŻE odczyt nowych pól stylu w rendererach węzłów
 * (`canvasObjectStyle.ts`). Powód: Mapa Myśli od dawna ZAPISUJE `fontSize` i
 * `bold` w `node.data`, a żaden renderer ich nie czytał (martwe pola) —
 * włączenie odczytu przy fladze OFF zmieniłoby wygląd istniejących map bez
 * akceptu właściciela (CLAUDE.md #7).
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_canvasObjectEditBar=0|1` — operator bypass.
 *   2. `localStorage["ff.canvas_object_edit_bar"]` — user/org override.
 *   3. `import.meta.env.VITE_CANVAS_OBJECT_EDIT_BAR` — build-time override.
 *   4. Default: OFF.
 */

const LS_KEY = 'ff.canvas_object_edit_bar';
const QUERY_KEY = 'ff_canvasObjectEditBar';
const ENV_KEY = 'VITE_CANVAS_OBJECT_EDIT_BAR';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const parsed = parseFlag(
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
    return parsed === null ? true : parsed;
  } catch {
    return true;
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

function resolveFlag(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

/**
 * Memoizacja: w odróżnieniu od pozostałych flag ta jest czytana także w
 * rendererze KAŻDEGO węzła płótna (mapa potrafi mieć setki węzłów, a react-flow
 * przerysowuje je przy każdym przesunięciu widoku). `URLSearchParams` +
 * `localStorage.getItem` w takiej pętli to zbędny koszt — wartość flagi i tak
 * nie zmienia się bez przeładowania strony. `resetCanvasObjectEditBarFlagCache`
 * istnieje dla testów, które podmieniają `window.location`/localStorage w locie.
 */
let cached: boolean | null = null;

// ★ 2026-07-28: DOMYŚLNIE WŁĄCZONE. Właściciel zaakceptował układ na prototypie,
// obejrzał realne ekrany i świadomie zdecydował o włączeniu wszystkich flag
// powłoki naraz (zgłosiłem ryzyko łamania reguły „nie włączaj wielu naraz",
// podtrzymał). Droga odwrotu bez wdrożenia: dopisz `?<QUERY_KEY>=0` do adresu —
// wyłącza TĘ JEDNĄ część, reszta działa dalej.
export function isCanvasObjectEditBarEnabled(): boolean {
  if (cached === null) cached = resolveFlag();
  return cached;
}

export function resetCanvasObjectEditBarFlagCache(): void {
  cached = null;
}

export const CANVAS_OBJECT_EDIT_BAR_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;

/**
 * DOM id celu portalu, renderowany na ŚRODKU `IdeaCanvasSecondBar`. Narzędzia
 * płótna portalują do niego `<ObjectEditBar>`; listwa sama wykrywa, że slot ma
 * treść, i chowa własne klastry (Dodaj/Auto-układ/… + Eksport) — stąd
 * „podmienia", a nie „dokłada rząd".
 */
export const CANVAS_OBJECT_EDIT_BAR_SLOT_ID = 'canvas-object-edit-bar-slot';
