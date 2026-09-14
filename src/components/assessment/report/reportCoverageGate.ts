/**
 * [ODMROZENIE 04_ASSESSMENT DEC-496] P-P12 — co ekran ma powiedzieć, gdy
 * ocena nie ma dość odpowiedzi, żeby wydać raport.
 *
 * Czysta funkcja, bo komunikat jest treścią produktu, a nie ozdobą przycisku:
 * ma dać się sprawdzić bez montowania widoku. Nic tu nie jest liczone od nowa
 * — pomiar przychodzi z serwera (`server/src/services/assessment/
 * assessmentReportCoverage.ts`), tutaj rozstrzygamy tylko, KTÓRE osie warto
 * wymienić z nazwy, żeby użytkownik wiedział, gdzie wrócić.
 */
import type { AssessmentReportCoverage } from '@/method-core/api/methodCoreApi';

/** Ile osi wymieniamy z nazwy, zanim przejdziemy na „i N kolejnych". */
export const MAX_WYMIENIONYCH_OSI = 3;

export interface BrakujacaOs {
  readonly axisId: number;
  readonly axisName: string;
  readonly axisNamePL: string | null;
  readonly missing: number;
  readonly totalAreas: number;
}

export interface BramkaPokrycia {
  readonly blocked: boolean;
  readonly answeredAreas: number;
  readonly totalAreas: number;
  readonly percent: number;
  readonly minPercent: number;
  /** Osie z największą liczbą braków, najpierw. Puste, gdy nic nie brakuje. */
  readonly topMissingAxes: readonly BrakujacaOs[];
  /** Ile osi z brakami NIE zmieściło się w `topMissingAxes`. */
  readonly moreMissingAxes: number;
}

export function bramkaPokryciaRaportu(
  coverage: AssessmentReportCoverage | null | undefined
): BramkaPokrycia | null {
  // Brak pomiaru to NIE jest „pokrycie zerowe" i nie wolno z niego zrobić
  // blokady — źródła bez zdarzeń odpowiedzi (magazyn zastany) po prostu nic
  // o pokryciu nie wiedzą. Patrz: „Brak pomiaru nie jest wynikiem".
  if (!coverage) return null;

  const zBrakami = coverage.axes
    .map((axis) => ({
      axisId: axis.axisId,
      axisName: axis.axisName,
      axisNamePL: axis.axisNamePL,
      missing: axis.missingAreaIds.length,
      totalAreas: axis.totalAreas,
    }))
    .filter((axis) => axis.missing > 0)
    .sort((a, b) => b.missing - a.missing || a.axisId - b.axisId);

  return {
    blocked: !coverage.sufficient,
    answeredAreas: coverage.answeredAreas,
    totalAreas: coverage.totalAreas,
    percent: coverage.percent,
    minPercent: coverage.minPercent,
    topMissingAxes: zBrakami.slice(0, MAX_WYMIENIONYCH_OSI),
    moreMissingAxes: Math.max(0, zBrakami.length - MAX_WYMIENIONYCH_OSI),
  };
}
