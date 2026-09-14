/**
 * [ODMROZENIE 04_ASSESSMENT DEC-496] Pokrycie oceny DRD — bramka przed
 * wydaniem raportu.
 *
 * ★ PO CO (zgłoszenie pilotażu P-P12 `b7ac5351`, 2026-09-14). Paweł odpowiedział
 * na JEDNO pytanie w sesji DRD `96e95dbe-…`, wszedł w zakładkę „Report",
 * kliknął pobranie DOCX i dostał kompletny dokument. Jego słowa: „even
 * completly empty raport is beeing generated and downloaded".
 *
 * ★ ZMIERZONE (kopia danych stagingu, stanowisko lokalne 2026-09-14):
 * `method_events` tej sesji ma 10 zdarzeń `ANSWER_CONFIRMED`, ale wszystkie
 * dotyczą JEDNEGO obszaru (`unit_id = '1A'`) — czyli 1 z 39 obszarów, 2,6 %.
 * Ekran warsztatu drukuje tę samą liczbę w nagłówku („0/39 units answered"
 * przed skopiowaniem zdarzeń, „1/39" po), więc bramka liczy DOKŁADNIE to,
 * co użytkownik widzi — nie drugą, własną miarę.
 *
 * ★ UCZCIWE SPROSTOWANIE. Powód podany w zgłoszeniu („Huge Waste of tokens")
 * nie jest prawdziwy dla tej trasy: `GET /api/method/sessions/:id/
 * assessment-report.docx` składa dokument deterministycznie
 * (`assessmentReportContractComposer` + `renderDocumentSchemaToDocxBuffer`),
 * nie woła modelu językowego. Realną szkodą jest wypuszczenie pustego
 * dokumentu, który wygląda na gotowy produkt dla klienta — i to blokujemy.
 *
 * ★ PRÓG. `DRD_REPORT_MIN_COVERAGE_PERCENT` = 80, wprost tak, jak poprosił
 * zgłaszający („80% for example"). To DECYZJA PRODUKTOWA zapisana jako jedna
 * stała — zmiana progu to zmiana tej liczby i niczego więcej.
 */
import DRD_STRUCTURE from '../../data/drdStructure.js';

/** Minimalny odsetek obszarów z potwierdzoną odpowiedzią, żeby wydać raport. */
export const DRD_REPORT_MIN_COVERAGE_PERCENT = 80;

/** Kod odmowy zwracany przez trasę eksportu, gdy pokrycie jest za małe. */
export const ASSESSMENT_REPORT_INSUFFICIENT_COVERAGE =
  'ASSESSMENT_REPORT_INSUFFICIENT_COVERAGE';

export interface AssessmentCoverageAxis {
  readonly axisId: number;
  readonly axisName: string;
  readonly axisNamePL: string | null;
  readonly answeredAreas: number;
  readonly totalAreas: number;
  /** Identyfikatory obszarów bez ani jednej potwierdzonej odpowiedzi. */
  readonly missingAreaIds: readonly string[];
}

export interface AssessmentReportCoverage {
  readonly answeredAreas: number;
  readonly totalAreas: number;
  /** 0-100, zaokrąglone — ta sama arytmetyka co `computeDrdCompletion`. */
  readonly percent: number;
  readonly minPercent: number;
  readonly sufficient: boolean;
  readonly axes: readonly AssessmentCoverageAxis[];
}

/**
 * @param answeredUnitIds identyfikatory obszarów (`method_events.unit_id`)
 *   z potwierdzoną odpowiedzią. Duplikaty i wartości spoza struktury DRD są
 *   ignorowane — liczymy obszary, nie zdarzenia.
 */
export function computeAssessmentReportCoverage(
  answeredUnitIds: readonly (string | null | undefined)[],
  minPercent: number = DRD_REPORT_MIN_COVERAGE_PERCENT
): AssessmentReportCoverage {
  const answered = new Set(
    answeredUnitIds
      .map((id) => (typeof id === 'string' ? id.trim() : ''))
      .filter((id) => id.length > 0)
  );

  const axes: AssessmentCoverageAxis[] = DRD_STRUCTURE.map((axis) => {
    const missingAreaIds = axis.areas.filter((area) => !answered.has(area.id)).map((a) => a.id);
    return {
      axisId: axis.id,
      axisName: axis.name,
      axisNamePL: axis.namePL ?? null,
      answeredAreas: axis.areas.length - missingAreaIds.length,
      totalAreas: axis.areas.length,
      missingAreaIds,
    };
  });

  const totalAreas = axes.reduce((sum, axis) => sum + axis.totalAreas, 0);
  const answeredAreas = axes.reduce((sum, axis) => sum + axis.answeredAreas, 0);
  const percent = totalAreas === 0 ? 0 : Math.round((answeredAreas / totalAreas) * 100);

  return {
    answeredAreas,
    totalAreas,
    percent,
    minPercent,
    // Ocena bez ANI JEDNEGO obszaru nigdy nie przechodzi, nawet gdyby ktoś
    // ustawił próg na 0 — pusty dokument nie jest produktem.
    sufficient: answeredAreas > 0 && percent >= minPercent,
    axes,
  };
}
