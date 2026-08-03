/**
 * Z1 (analogiczność) — tryb kursora płótna, wspólny dla trzech reprezentacji
 * Idei (Mapa myśli · Tablica · Przepływ).
 *
 * Standard: `docs/standards/idea-workspace/06_LEWY_RAIL.md` §3, tier „góra":
 *   „Whiteboard i Process Flow muszą REALNIE sterować trybem kursora płótna".
 *
 * Do 2026-07-23 pstryczek Zaznaczanie/Przesuwanie na lewym railu zmieniał w
 * Tablicy i Przepływie wyłącznie WŁASNĄ ikonę — płótno (ReactFlow) nie czytało
 * `interactionMode` w ogóle. Ten moduł jest jedynym miejscem, które tłumaczy
 * tryb kursora na propsy ReactFlow, żeby wszystkie trzy płótna zachowywały się
 * identycznie (Z1), a nie każde po swojemu.
 *
 * KONTRAKT ZACHOWANIA (świadomie wąski, żeby nie cofnąć Z10):
 *  - `select` → ZERO nadpisań. Płótno działa dokładnie tak, jak dziś:
 *    lewy przeciąg po pustym tle PRZESUWA widok (Z10 „grab to pan", zgłoszenie
 *    #1 właściciela), węzły przeciągalne, zaznaczanie działa.
 *  - `pan` → płótno wyłącznie do NAWIGACJI: nie da się przypadkiem ruszyć ani
 *    zaznaczyć treści (odpowiednik narzędzia „rączka" w Figmie/Miro).
 *  - `draw` (tylko Tablica) → obsługiwany przez `locked` warstwy rysowania,
 *    tu nie wymaga nadpisań.
 */

export type IdeaCanvasCursorMode = 'select' | 'pan' | 'draw';

/**
 * Nadpisania propsów ReactFlow dla danego trybu kursora. Spread PO
 * `getIdeasToolInteractionProps(...)`, żeby wygrywały z domyślnymi.
 */
export interface IdeaCanvasCursorProps {
  panOnDrag?: number[];
  selectionOnDrag?: boolean;
  nodesDraggable?: boolean;
  nodesConnectable?: boolean;
  elementsSelectable?: boolean;
  edgesFocusable?: boolean;
}

export function getIdeaCanvasCursorProps(mode: IdeaCanvasCursorMode): IdeaCanvasCursorProps {
  if (mode !== 'pan') return {};
  return {
    // Rączka: przeciąg dowolnym przyciskiem przesuwa widok…
    panOnDrag: [0, 1, 2] as number[],
    selectionOnDrag: false,
    // …i nic pod kursorem nie daje się ruszyć ani zaznaczyć.
    nodesDraggable: false,
    nodesConnectable: false,
    elementsSelectable: false,
    edgesFocusable: false,
  };
}

/** Klasa kursora dla kontenera płótna (rączka widoczna od razu, przed kliknięciem). */
export function getIdeaCanvasCursorClass(mode: IdeaCanvasCursorMode): string {
  if (mode === 'pan') return 'cursor-grab active:cursor-grabbing';
  return '';
}

/**
 * Rozgłoszenie realnego trybu płótna DO GÓRY, do lewego raila.
 *
 * Rail dostaje `interactionMode` propsem z `IdeaMapWorkspace` (stan Mapy myśli),
 * więc sam z siebie nie wie nic o trybie „Rysuj" Tablicy — pokazywałby SEL,
 * gdy płótno jest w trybie rysowania. To zdarzenie zamyka pętlę: reprezentacja
 * mówi railowi, w jakim trybie NAPRAWDĘ jest.
 */
export const IDEA_CANVAS_CURSOR_MODE_EVENT = 'idea-canvas-cursor-mode';

export interface IdeaCanvasCursorModeDetail {
  tool: 'whiteboard' | 'process_flow';
  mode: IdeaCanvasCursorMode;
}

export function publishIdeaCanvasCursorMode(
  tool: IdeaCanvasCursorModeDetail['tool'],
  mode: IdeaCanvasCursorMode
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(IDEA_CANVAS_CURSOR_MODE_EVENT, { detail: { tool, mode } }));
}
