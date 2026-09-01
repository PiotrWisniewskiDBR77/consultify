// Bezpiecznik pary zrzutów light/dark — DWUWYMIAROWY (po KSZTAŁCIE 19).
//
// Historia: odbiór dyżuru 233 (Finanse) — docs/program/funkcje/
// KSZTALT_19_PARA_ZGODNA_ROZNE_STANY.md. Istniejący bezpiecznik sprawdzał
// WYŁĄCZNIE różnicę średniej jasności (próg 150) i przepuszczał parę, w
// której light=sam formularz, dark=policzony wynik — obrazy różniły się
// jasnością > 200, ale przedstawiały DWA RÓŻNE STANY programu. Im większy
// defekt (wyścig klik→zrzut), tym łatwiej przechodził stary bezpiecznik.
//
// Ta wersja dodaje DRUGI, niezależny wymiar: obecność charakterystycznego
// elementu WYNIKU w DOM w obu wariantach w chwili przechwycenia zrzutu
// (nie w samym obrazie — obraz nie niesie tej informacji tanio; DOM tak).
// Para przechodzi tylko, gdy przechodzi OBA wymiary.
export const DEFAULT_LUMA_DIFF_THRESHOLD = 150;

/**
 * @param {object} input
 * @param {string} input.pairName
 * @param {number} input.lightMeanLuma
 * @param {number} input.darkMeanLuma
 * @param {boolean} [input.requiresResultMarker] Czy ta para MUSI pokazywać
 *   policzony wynik (np. panele "populated" z AutoRun) — dla par bez wyniku
 *   (np. stan pusty) pomijamy wymiar stanu.
 * @param {boolean} [input.lightHasResultMarker] Czy selektor wyniku był w DOM
 *   w wariancie light w chwili zrzutu.
 * @param {boolean} [input.darkHasResultMarker] jw. dla dark.
 * @param {number} [input.lumaDiffThreshold]
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function checkScreenshotPairState({
  pairName,
  lightMeanLuma,
  darkMeanLuma,
  requiresResultMarker = false,
  lightHasResultMarker = null,
  darkHasResultMarker = null,
  lumaDiffThreshold = DEFAULT_LUMA_DIFF_THRESHOLD,
}) {
  const reasons = [];

  // Wymiar 1 (istniejący): light i dark nie mogą być tym samym obrazem
  // pod dwiema nazwami (KSZTAŁT 13 — duplikat zamiast motywu).
  const lumaDiff = Math.abs(lightMeanLuma - darkMeanLuma);
  if (lumaDiff < lumaDiffThreshold) {
    reasons.push(
      `[ksztalt-13] ${pairName}: różnica jasności ${lumaDiff.toFixed(1)} < próg ${lumaDiffThreshold} — para wygląda jak duplikat.`
    );
  }

  // Wymiar 2 (NOWY): light i dark muszą przedstawiać TEN SAM, WŁAŚCIWY stan
  // programu (KSZTAŁT 19 — para zgodna, różne stany). Duża różnica jasności
  // NIE dowodzi zgodności stanu — to właśnie przeoczył stary bezpiecznik.
  // Celowo wymagamy OBECNOŚCI wyniku w OBU wariantach (nie tylko równości) —
  // sama równość przepuściłaby też parę, w której wyścig ubił WYNIK w OBU
  // wariantach naraz (dwa różne-ale-też-błędne stany wyglądające "zgodnie").
  if (requiresResultMarker) {
    if (lightHasResultMarker === null || darkHasResultMarker === null) {
      reasons.push(
        `[ksztalt-19] ${pairName}: brak pomiaru obecności wyniku w DOM dla jednego z wariantów — nie da się potwierdzić zgodności stanu.`
      );
    } else if (!lightHasResultMarker || !darkHasResultMarker) {
      reasons.push(
        `[ksztalt-19] ${pairName}: stany niezgodne lub niepełne — light ma wynik w DOM: ${lightHasResultMarker}, dark ma wynik w DOM: ${darkHasResultMarker}. Oba warianty muszą pokazywać POLICZONY wynik, nie sam formularz/przycisk.`
      );
    }
  }

  return { ok: reasons.length === 0, reasons };
}
