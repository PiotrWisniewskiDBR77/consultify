/**
 * Głęboki link do KARTY CELU bez kontekstu raportu.
 *
 * ── DLACZEGO TEN PLIK SCHUDŁ (P7K część A, 05.09) ─────────────────────────
 * Do 05.09 rodzina OKR miała CZTERY poziomy: rejestr → karta celu → zbiór
 * kart kluczowych rezultatów → karta kluczowego rezultatu. SSOT właściciela
 * (`docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md` §1) rozstrzyga
 * inaczej: poziomy są TRZY, a kluczowy rezultat jest SEKCJĄ karty celu, nie
 * własnym ekranem. Korekta P7K §4/§6: „usunąć trasy i strony
 * OkrKeyResultSetPage, OkrKeyResultCardPage". Obie strony i obie ścieżki
 * (`okrKeyResultSetPath`, `okrKeyResultCardPath`) zniknęły razem z nimi;
 * stare adresy `.../rezultaty[/…]` przekierowują na kartę celu
 * (`AppRoutes.tsx`), więc zapisany link nie kończy się pustką.
 *
 * Kanoniczne ścieżki trzech poziomów są w `p7k/okrReportPaths.ts`. Ten plik
 * zostaje dla JEDNEGO przypadku, którego tamten nie obsługuje: linku do celu,
 * gdy nie znamy jego raportu (np. wyrównanie do celu z innego zestawu).
 * Trasa `/results/okr/objectives/:objectiveId` sama dociąga `setId` z celu.
 */

// Nośnik trybu danych pokazowych jest JEDEN dla całych Wyników — importujemy
// go, zamiast pisać drugą kopię tej samej funkcji (SSOT, kanon „jeden atom,
// wiele powierzchni").
export { withOwnerSampleData } from '../kpiTool/kpiCardSetPath';

/** Karta celu bez kontekstu raportu — okruszek dociąga raport z `setId` celu. */
export function okrObjectiveCardPath(objectiveId: string): string {
  return `/results/okr/objectives/${encodeURIComponent(objectiveId)}`;
}
