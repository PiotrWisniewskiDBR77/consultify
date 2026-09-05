/**
 * Trzypoziomowa formuła KPI — jeden plik z definicją ŚCIEŻKI POZIOMU.
 *
 * POWÓD (odrzucenie właściciela 2026-09-05, cytat): „nad kartą jest ich
 * zestawienie. To jest trzypoziomowe menu (…) mamy tabelę, pod nią kartę KPI,
 * piętro niżej – zbiór kart KPI, a poniżej kolejna karta KPI."
 *
 * Poziomy:
 *   1. `/results/kpi`                                  — rejestr (StandardTable)
 *   2. `/results/kpi/:kpiId`                           — karta KPI (NModeShell)
 *   3. `/results/kpi/:kpiId/zestawienie/:scorecardId`  — ZBIÓR kart KPI
 *   4. `/results/kpi/:childKpiId?zbior=…&zKarty=…`     — kolejna karta KPI
 *
 * Poziom 4 to DOKŁADNIE ten sam komponent co poziom 2 (`KpiToolPage`) — różni
 * je wyłącznie ścieżka w breadcrumbie, przenoszona w querystringu (a nie w
 * `location.state`), żeby przetrwała odświeżenie i dała się podlinkować.
 *
 * UCZCIWOŚĆ DANYCH: relacja „zbiór" to REALNE `rvn_kpi_scorecard_items`
 * (`GET /vnext/results/kpi/scorecards/:id/items`). W całym backendzie NIE MA
 * relacji rodzic→dziecko między samymi KPI (`parentKpiId`/`children` —
 * zero trafień w `server/src`), więc hierarchii nie udajemy: piętrem niżej
 * jest zestawienie, którego ten wskaźnik jest członkiem.
 */

/** Nazwa parametru niosącego id zestawienia (poziom 3), z którego przyszliśmy. */
export const KPI_CARD_SET_PARAM = 'zbior';
/** Nazwa parametru niosącego id karty KPI (poziom 2), od której zaczęła się ścieżka. */
export const KPI_CARD_SET_FROM_PARAM = 'zKarty';

/** Poziom 3 — zbiór kart KPI otwarty z karty `fromKpiId`. */
export function kpiCardSetPath(fromKpiId: string, scorecardId: string): string {
  return `/results/kpi/${encodeURIComponent(fromKpiId)}/zestawienie/${encodeURIComponent(scorecardId)}`;
}

/** Poziom 4 — kolejna karta KPI, z zachowaną ścieżką poziomów. */
export function kpiCardFromSetPath(
  childKpiId: string,
  scorecardId: string,
  fromKpiId: string
): string {
  const qs = new URLSearchParams();
  qs.set(KPI_CARD_SET_PARAM, scorecardId);
  qs.set(KPI_CARD_SET_FROM_PARAM, fromKpiId);
  return `/results/kpi/${encodeURIComponent(childKpiId)}?${qs.toString()}`;
}

/**
 * Przenosi opt-in tryb danych pokazowych (`?sampleData=results-vnext`, bramka
 * `shouldUseResultsVNextOwnerSampleData`) na kolejny poziom, gdy jest aktywny.
 * Poza tym trybem zwraca ścieżkę bez zmian — zero wpływu na realnego
 * użytkownika (i na testy, które nie ustawiają `window.location`).
 */
export function withOwnerSampleData(path: string): string {
  if (typeof window === 'undefined') return path;
  const value = new URLSearchParams(window.location.search).get('sampleData');
  if (!value) return path;
  return `${path}${path.includes('?') ? '&' : '?'}sampleData=${encodeURIComponent(value)}`;
}
