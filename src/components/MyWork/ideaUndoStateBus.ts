/**
 * ideaUndoStateBus — JEDEN kanał stanu Cofnij/Ponów dla wszystkich narzędzi Idei.
 *
 * PROBLEM, KTÓRY TO ROZWIĄZUJE (2026-07-28):
 * Lewy pasek (`CanvasLeftToolbar`) dostawał `canUndo`/`canRedo` z `IdeaMapWorkspace`,
 * a workspace nasłuchiwał WYŁĄCZNIE dwóch kanałów: `mm-undo-state` (Mapa myśli) i
 * `tbl-undo-state` (Tabela). Tablica i Przepływ nigdy nie nadawały swojego stanu, więc
 * przyciski Cofnij/Ponów w lewym pasku były na tych dwóch narzędziach TRWALE wygaszone
 * (odbiorniki akcji `wb_undo`/`wb_redo`/`pf_undo`/`pf_redo` działały — po prostu nie
 * dało się kliknąć).
 *
 * DLACZEGO JEDEN KANAŁ, A NIE CZTERY:
 * cztery narzędzia × własny kanał = piąte narzędzie zapomni się podpiąć (dokładnie ten
 * bug). Tu jest jedno zdarzenie `idea-undo-state` z polem `tool`, więc workspace może
 * dodatkowo ODFILTROWAĆ stan narzędzia, które nie jest aktywne (wcześniej stan Mapy
 * zostawał na pasku po przełączeniu na inne narzędzie).
 *
 * MOST DLA STARYCH KANAŁÓW:
 * `mm-undo-state` (IdeaRecommendationMap.tsx) i `tbl-undo-state` (IdeaTableTool.tsx)
 * zostają nadawane po staremu — te dwa pliki są w tym momencie w rękach innych sesji,
 * więc subskrypcja normalizuje je tutaj do wspólnego kształtu. Gdy pliki będą wolne,
 * wystarczy zamienić ich `dispatchEvent` na `emitIdeaUndoState()` i usunąć mapę
 * `LEGACY_EVENTS` — reszta kodu się nie zmienia.
 */
import type { CanvasToolType } from './ideaSelectionTypes';

export const IDEA_UNDO_STATE_EVENT = 'idea-undo-state';

export interface IdeaUndoState {
  tool: CanvasToolType;
  canUndo: boolean;
  canRedo: boolean;
}

/** Stare, per-narzędziowe kanały → narzędzie, którego dotyczą (do usunięcia, patrz nagłówek). */
const LEGACY_EVENTS: Record<string, CanvasToolType> = {
  'mm-undo-state': 'mindmap',
  'tbl-undo-state': 'table',
};

/** Nadaj stan Cofnij/Ponów swojego narzędzia. Wołaj przy KAŻDEJ zmianie stosu undo. */
export function emitIdeaUndoState(tool: CanvasToolType, canUndo: boolean, canRedo: boolean): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<IdeaUndoState>(IDEA_UNDO_STATE_EVENT, {
      detail: { tool, canUndo: Boolean(canUndo), canRedo: Boolean(canRedo) },
    })
  );
}

/** Subskrybuj stan wszystkich narzędzi (nowy kanał + most dla dwóch starych). */
export function subscribeIdeaUndoState(listener: (state: IdeaUndoState) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const onUnified = (e: Event) => {
    const detail = (e as CustomEvent<Partial<IdeaUndoState>>).detail;
    if (!detail?.tool) return;
    listener({
      tool: detail.tool,
      canUndo: Boolean(detail.canUndo),
      canRedo: Boolean(detail.canRedo),
    });
  };
  window.addEventListener(IDEA_UNDO_STATE_EVENT, onUnified);

  const legacyHandlers = Object.entries(LEGACY_EVENTS).map(([eventName, tool]) => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      listener({ tool, canUndo: Boolean(detail.canUndo), canRedo: Boolean(detail.canRedo) });
    };
    window.addEventListener(eventName, handler);
    return [eventName, handler] as const;
  });

  return () => {
    window.removeEventListener(IDEA_UNDO_STATE_EVENT, onUnified);
    legacyHandlers.forEach(([eventName, handler]) =>
      window.removeEventListener(eventName, handler)
    );
  };
}
