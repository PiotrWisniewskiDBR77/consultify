/**
 * P7K część A — ŚCIEŻKA TRZECH POZIOMÓW OKR.
 *
 * Właściciel, 05.09: „Tutaj mamy tabelę, pod nią kartę". Dla OKR poziomy są
 * TRZY, nie cztery (SSOT §1, korekta P7K §4/§6):
 *
 *   1. `/results/okr`                                  — tabela raportów
 *   2. `/results/okr/:setId`                           — raport (tabela KR)
 *   3. `/results/okr/:setId/objectives/:objectiveId`   — karta celu
 *
 * Kluczowy rezultat NIE MA własnego poziomu — mieszka jako sekcja w karcie
 * celu. Stara trasa `.../rezultaty` przekierowuje na kartę celu, żeby
 * zapisane linki nie kończyły się pustką (patrz `AppRoutes.tsx`).
 *
 * Ten plik jest JEDYNYM miejscem, które składa te adresy — test poziomów
 * (`tests/unit/results-okr/okrTrzyPoziomy.test.tsx`) opiera się na nim, więc
 * zmiana kolejności poziomów wywraca test, a nie tylko wygląd.
 */

/** Poziom 1 — tabela raportów OKR. */
export const OKR_REPORT_REGISTRY_PATH = '/results/okr';

/** Poziom 2 — raport OKR (tabela kluczowych rezultatów zestawu). */
export function okrReportPath(setId: string): string {
  return `${OKR_REPORT_REGISTRY_PATH}/${encodeURIComponent(setId)}`;
}

/** Poziom 3 — karta celu wewnątrz raportu. */
export function okrObjectiveCardInReportPath(setId: string, objectiveId: string): string {
  return `${okrReportPath(setId)}/objectives/${encodeURIComponent(objectiveId)}`;
}

/**
 * Kotwica sekcji karty celu — klik w wiersz kluczowego rezultatu otwiera
 * kartę celu PRZEWINIĘTĄ do sekcji „Kluczowe rezultaty” i podświetla ten
 * rezultat. To jest cała „nawigacja do KR”, jakiej wymaga korekta §13:
 * osobnej strony rezultatu nie ma i nie będzie.
 */
export function okrObjectiveCardKeyResultPath(
  setId: string,
  objectiveId: string,
  keyResultId: string
): string {
  return `${okrObjectiveCardInReportPath(setId, objectiveId)}?sekcja=kluczowe-rezultaty&rezultat=${encodeURIComponent(keyResultId)}`;
}
