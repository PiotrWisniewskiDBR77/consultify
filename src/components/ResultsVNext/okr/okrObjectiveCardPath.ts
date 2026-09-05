/**
 * Czteropoziomowa formuła OKR — jeden plik z definicją ŚCIEŻKI POZIOMU.
 *
 * POWÓD (odrzucenie właściciela 2026-09-05, cytat):
 *   „Zatwierdzona wersja, czyli karta KPI, jest OK. I teraz nad kartą jest ich
 *    zestawienie. To jest trzypoziomowe menu. (…) Tutaj mamy tabelę, pod nią
 *    kartę, piętro niżej – zbiór kart, a poniżej kolejna karta. To jest inna,
 *    trzypoziomowa formuła."
 *
 * Poziomy (dokładny odpowiednik `../kpiTool/kpiCardSetPath.ts`, tyle że dla
 * rodziny OKR):
 *   1. `/results/okr`                                     — rejestr (StandardTable)
 *   2. `/results/okr/:objectiveId`                        — KARTA CELU (NModeShell)
 *   3. `/results/okr/:objectiveId/rezultaty`              — ZBIÓR kart KR
 *   4. `/results/okr/:objectiveId/rezultaty/:keyResultId` — kolejna karta (KR)
 *
 * DLACZEGO POZIOM 4 SIEDZI W ŚCIEŻCE, A NIE W QUERYSTRINGU (różnica wobec KPI):
 * w rodzinie KPI poziom 2 i poziom 4 to TEN SAM byt (wskaźnik), więc ścieżkę
 * poziomów trzeba było dołożyć w querystringu, żeby breadcrumb wiedział, skąd
 * przyszliśmy. Tutaj poziom 4 to INNY byt (Kluczowy Rezultat, nie cel), a
 * `keyResultId` jest strukturalnie podrzędny wobec `objectiveId`
 * (`OkrKeyResultDto.objectiveId`) — więc pełna ścieżka poziomów wynika wprost
 * z adresu. Przeżywa odświeżenie i daje się podlinkować bez ani jednego
 * parametru zapytania.
 *
 * UCZCIWOŚĆ DANYCH (zmierzone na realnym backendzie, nie założone):
 * „zbiorem kart" poziomu 3 są REALNE Kluczowe Rezultaty tego celu —
 * `GET /vnext/results/okr/objectives/:objectiveId` zwraca je ZAGNIEŻDŻONE
 * (`OkrObjectiveWithKeyResultsDto.keyResults`); osobnej trasy
 * „lista KR dla celu" w backendzie NIE MA (nagłówek `okrObjectiveApi.ts`,
 * zweryfikowane grepem po `okr.routes.ts`). Nie udajemy więc żadnej relacji
 * cel↔cel ani zestawu, którego nie ma.
 */

// Nośnik trybu danych pokazowych jest JEDEN dla całych Wyników — importujemy
// go, zamiast pisać drugą kopię tej samej funkcji (SSOT, kanon „jeden atom,
// wiele powierzchni").
export { withOwnerSampleData } from '../kpiTool/kpiCardSetPath';

/** Poziom 2 — karta celu OKR. */
export function okrObjectiveCardPath(objectiveId: string): string {
  return `/results/okr/${encodeURIComponent(objectiveId)}`;
}

/** Poziom 3 — zbiór kart Kluczowych Rezultatów tego celu. */
export function okrKeyResultSetPath(objectiveId: string): string {
  return `${okrObjectiveCardPath(objectiveId)}/rezultaty`;
}

/** Poziom 4 — jedna karta Kluczowego Rezultatu, z zachowaną ścieżką poziomów. */
export function okrKeyResultCardPath(objectiveId: string, keyResultId: string): string {
  return `${okrKeyResultSetPath(objectiveId)}/${encodeURIComponent(keyResultId)}`;
}
