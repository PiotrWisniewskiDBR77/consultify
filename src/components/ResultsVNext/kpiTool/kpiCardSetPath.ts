/**
 * Trzypoziomowa formuła KPI — jeden plik z definicją ŚCIEŻKI POZIOMU.
 *
 * POWÓD (odrzucenie właściciela 2026-09-05, cytat dosłowny):
 *   „To nie jest, niestety, to, co wcześniej zgłosiliśmy i omawialiśmy.
 *    Omawialiśmy tabelę; z poziomu tabeli otwiera się lista. Lista ma opis
 *    KPI, kilka pozycji, a każdy KPI ma swoją kartę typu N. Tego tu nie mamy
 *    teraz."
 *
 * Poziomy (dokładnie TRZY — nie cztery):
 *   1. `/results/kpi`                            — TABELA ZESTAWIEŃ
 *      (rejestr grup wskaźników: nazwa · opis · liczba wskaźników ·
 *      właściciel · status · aktualizacja), `StandardTable` + `StandardPreview`.
 *   2. `/results/kpi/scorecards/:scorecardId`     — RAPORT: nagłówek raportu
 *      + TABELA mierników grupowana po obszarze, z parą CEL/Rezultat na każdy
 *      okres, YTD i STANEM (P7K, SSOT §6). Wcześniejsza siatka kafelków na
 *      osobnym, starym adresie została usunięta — raport jest tabelą.
 *   3. `/results/kpi/:kpiId?zbior=<scorecardId>`  — KARTA N wskaźnika
 *      (`KpiToolPage`), ścieżka „Rejestr KPI › <zestawienie> › <wskaźnik>".
 *
 * POPRZEDNIA (ODRZUCONA) FORMUŁA — czterostopniowa „tabela KPI → karta KPI →
 * zbiór kart → kolejna karta" — miała zestawienie SCHOWANE wewnątrz karty
 * wskaźnika. Właściciel odrzucił ją 05.09: zestawienie jest POZIOMEM WYŻEJ
 * niż wskaźnik, nie sekcją w nim. Trasa `/results/kpi/:kpiId/zestawienie/:id`
 * i parametr `zKarty` zniknęły razem z nią (żyły jeden dzień, nigdy nie
 * odebrane).
 *
 * UCZCIWOŚĆ DANYCH: „zestawienie" to REALNE `rvn_kpi_scorecards` +
 * `rvn_kpi_scorecard_items` (`GET /vnext/results/kpi/scorecards`,
 * `.../:id/items`). W backendzie NIE MA relacji rodzic→dziecko między samymi
 * KPI (`parentKpiId`/`children` — zero trafień w `server/src`), więc żadnej
 * hierarchii nie udajemy.
 */

/** Nazwa parametru niosącego id zestawienia (poziom 2), z którego przyszliśmy. */
export const KPI_CARD_SET_PARAM = 'zbior';

/**
 * ZESTAWIENIE SYSTEMOWE „Bez zestawienia" — wskaźniki, które nie należą do
 * żadnego zestawienia. Poziom 1 pokazuje je jako osobny wiersz, żeby przejście
 * na tabelę zestawień NICZEGO nie ukryło: każdy widoczny KPI ma swoją drogę
 * z poziomu 1. To NIE jest rekord w bazie (nie ma `scorecardId`), tylko
 * wyliczenie po stronie klienta — dlatego id jest czytelnym słowem, nie UUID,
 * i nigdy nie trafia do żadnego wywołania API.
 */
export const UNASSIGNED_CARD_SET_ID = 'bez-zestawienia';

export function isUnassignedCardSetId(id: string | null | undefined): boolean {
  return id === UNASSIGNED_CARD_SET_ID;
}

/**
 * Poziom 2 — RAPORT KPI. Od P7K (2026-09-05) poziom 2 to tabela mierników
 * raportu pod `/results/kpi/scorecards/:scorecardId`
 * (`ResultsKpiScorecardDetailPage`). Osobna strona-siatka kafelków pod
 * starym adresie ZOSTAŁA USUNIĘTA: raport jest TABELĄ, nie siatką kart
 * (SSOT §6, korekta P7K §4). Stary adres
 * przekierowuje tu trwale (`AppRoutes.tsx`, `RESULTS_KPI.CARD_SET_REDIRECT`).
 */
export function kpiReportPath(scorecardId: string): string {
  return `/results/kpi/scorecards/${encodeURIComponent(scorecardId)}`;
}

/** Poziom 3 — karta N miernika, z zapamiętanym raportem w ścieżce. */
export function kpiCardFromSetPath(kpiId: string, scorecardId: string): string {
  const qs = new URLSearchParams();
  qs.set(KPI_CARD_SET_PARAM, scorecardId);
  return `/results/kpi/${encodeURIComponent(kpiId)}?${qs.toString()}`;
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
