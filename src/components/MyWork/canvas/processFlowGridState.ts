/**
 * Stan siatki Przepływu (pokazywanie kratki + przyciąganie) rozgłaszany DO GÓRY,
 * do lewego raila narzędzi.
 *
 * Skąd to się wzięło (2026-07-28, zgłoszenie właściciela „nie wiem co to są te
 * dwa przyciski w ogóle"): oba pstryczki wisiały jako bezpodpisowa nakładka
 * `absolute top-2 left-2` NAD płótnem. Dwa problemy naraz:
 *  1. nie miały etykiety — sama ikona kratki i magnesu nic nie mówi;
 *  2. zasłaniały pstryczek zwijania PIERWSZEGO toru (zmierzone: 58/225 punktów
 *     pstryczka klikalnych, `elementFromPoint` w jego środku zwracał nakładkę),
 *     więc tor praktycznie nie dawał się zwinąć.
 *
 * Decyzja właściciela: funkcja zostaje, miejsce się zmienia — obie pozycje
 * wędrują do wspólnego lewego raila (`CanvasLeftToolbar`), z czytelnymi
 * podpowiedziami, i tylko w Przepływie (mechanizm `liveIn`).
 *
 * Rail nie ma dostępu do stanu Przepływu (mieszka w portalu, poziom wyżej), a
 * pstryczek bez pokazanego stanu włączenia jest ślepy — użytkownik nie wie, czy
 * siatka jest włączona. Ten moduł zamyka pętlę dokładnie tak, jak
 * `ideaCanvasCursorMode` robi to dla trybu kursora: reprezentacja mówi railowi,
 * w jakim stanie NAPRAWDĘ jest, a rail tylko odsyła akcję w dół.
 */

export const PROCESS_FLOW_GRID_STATE_EVENT = 'process-flow-grid-state';

export interface ProcessFlowGridStateDetail {
  /** Czy kratka jest rysowana na płótnie (ReactFlow `<Background>`). */
  showGrid: boolean;
  /** Czy przeciągane kroki równają się do siatki (ReactFlow `snapToGrid`). */
  snap: boolean;
}

export function publishProcessFlowGridState(detail: ProcessFlowGridStateDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PROCESS_FLOW_GRID_STATE_EVENT, { detail }));
}
