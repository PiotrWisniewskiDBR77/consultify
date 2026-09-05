/**
 * canvasAnalysisSlot — rejestr JEDNEGO miejsca, w którym warsztat Pomysłów
 * pokazuje karty „Analiza płótna" (`IdeaAINudgeStrip`).
 *
 * ★ POWÓD ISTNIENIA (decyzja CTO 2026-09-05, zgłoszenie właściciela: „nie
 * jesteś w stanie poradzić sobie z panelami"). Karty analizy płótna były
 * PŁYWAJĄCYMI kaflami nad płótnem (`absolute bottom-4 left-1/2`) — zasłaniały
 * mapę i konkurowały z prawym panelem. Decyzja: analiza płótna wchodzi do
 * JEDNEGO prawego panelu (sekcja „Akcje"), nad płótnem nie pływa nic poza
 * menu kontekstowym węzła.
 *
 * DLACZEGO REJESTR, A NIE PRZEKAZANIE PROPSA: pasek jest montowany GŁĘBOKO w
 * trzech narzędziach (`IdeaRecommendationMap`, `IdeaProcessFlowTool`,
 * `IdeaTableTool`), każde z własnym kompletem uchwytów akcji. Przeciąganie
 * węzła DOM panelu przez te trzy drzewa to trzy nowe propsy i trzy okazje do
 * rozjazdu; rejestr daje jedno źródło i portal.
 *
 * DLACZEGO NIE `document.getElementById`: panel montuje się i znika (zamknięcie
 * panelu, przełączenie zakładki Element↔Teresa), a odpytywanie DOM w czasie
 * renderu nie odświeża konsumenta. Tu węzeł publikuje się sam przez `ref`.
 *
 * `host` mówi, czy warsztat Pomysłów (gospodarz panelu) jest w ogóle na
 * ekranie. Rozróżnienie jest istotne:
 *   • host = true,  slot = węzeł → renderuj W PANELU (portal),
 *   • host = true,  slot = null  → panel zamknięty → NIE renderuj (płótno
 *     zostaje czyste; użytkownik wraca przyciskiem „Pokaż panel"),
 *   • host = false               → pasek użyty poza warsztatem → zachowanie
 *     dotychczasowe (pływające kafle), zero regresji u innych konsumentów.
 */
import { useEffect, useState } from 'react';

export interface CanvasAnalysisSlotState {
  host: boolean;
  slot: HTMLElement | null;
}

let stan: CanvasAnalysisSlotState = { host: false, slot: null };
const sluchacze = new Set<(s: CanvasAnalysisSlotState) => void>();

const rozeslij = () => {
  for (const f of sluchacze) f(stan);
};

/** Warsztat Pomysłów melduje, że to ON jest gospodarzem panelu (mount/unmount). */
export function setCanvasAnalysisHost(host: boolean): void {
  if (stan.host === host) return;
  stan = { ...stan, host };
  rozeslij();
}

/** Panel publikuje swój węzeł-gniazdo (ref callback); `null` przy odmontowaniu. */
export function setCanvasAnalysisSlot(slot: HTMLElement | null): void {
  if (stan.slot === slot) return;
  stan = { ...stan, slot };
  rozeslij();
}

export function getCanvasAnalysisSlotState(): CanvasAnalysisSlotState {
  return stan;
}

/** Wyłącznie do testów — czyści rejestr między przypadkami. */
export function resetCanvasAnalysisSlot(): void {
  stan = { host: false, slot: null };
  rozeslij();
}

export function useCanvasAnalysisSlot(): CanvasAnalysisSlotState {
  const [lokalny, setLokalny] = useState<CanvasAnalysisSlotState>(stan);
  useEffect(() => {
    setLokalny(stan);
    sluchacze.add(setLokalny);
    return () => {
      sluchacze.delete(setLokalny);
    };
  }, []);
  return lokalny;
}
