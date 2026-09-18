/**
 * RG-1 v3 / DEC-572 (Wpis 89) — JEDYNA arytmetyka osi DRD z odpowiedzi legacy.
 *
 * ★ PO CO TO ISTNIEJE. Grupowanie `answers.drd.areas` po osiach i liczenie
 * średnich żyło dotąd wyłącznie wewnątrz `reportBuilderService.
 * getSourceDataForReport` (:2483-2556 przed wydzieleniem) jako kod lokalny,
 * uruchamiany DOPIERO przy generowaniu sekcji. Bliźniak legacy tworzony przez
 * `legacyTwinService` musiałby tę samą arytmetykę przepisać — a dwie kopie
 * jednego wzoru to dokładnie ten rodzaj rozjazdu, przez który raport i karta
 * oceny potrafią pokazać różne liczby. Dlatego wzór jest wydzielony 1:1 (bez
 * zmiany choćby jednej stałej czy zaokrąglenia) do czystej funkcji bez I/O,
 * której używają OBA miejsca: czytelnik raportu i pisarz bliźniaka.
 *
 * Kształt wejściowy (zmierzony, nie zgadnięty) — `assessments.answers_json`:
 *   `{ drd: { areas: { '1A': { achievedLevel: 4, targetLevel: 5 }, … } } }`
 * Kształt wyjściowy `scores` — dokładnie ten, który `reportGenerationService`
 * wkłada do promptów (`summary`/`matrix`/`list`) i do deterministycznej sekcji
 * `matrix` (`assessment_matrix.axes[]`).
 */

/** Nazwy siedmiu osi DRD używane w kontekście AI i w sekcji `matrix`. */
export const DRD_AXIS_NAMES: Record<string, string> = {
  '1': 'Digital Processes',
  '2': 'Digital Products & Services',
  '3': 'Digital Business Models',
  '4': 'Data & Analytics',
  '5': 'Organizational Culture',
  '6': 'Cybersecurity & Risk',
  '7': 'AI & Machine Learning',
};

/** Skala DRD w `scores.axes[]` — stała historyczna czytelnika raportu. */
export const DRD_AXIS_MAX_SCORE = 7;

export interface DrdAxisAggregate {
  areas: Record<string, unknown>;
  axisName: string;
  areaCount: number;
  averageScore: number;
  averageTarget: number;
  gap: number;
}

export interface DrdScoresSummary {
  axes: Array<{
    axisId: string;
    axisName: string;
    score: number;
    maxScore: number;
    target: number;
    gap: number;
    fullMark: number;
  }>;
  overallScore: number;
  maxScore: number;
  assessmentType: string | undefined;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Grupuje obszary `answers.drd.areas` po prefiksie osi (1..7) i liczy średnią
 * osiągniętą/docelową oraz lukę. Obszary bez `achievedLevel` są niesione w
 * `areas` (raport je pokaże), ale NIE wchodzą do średnich — `areaCount` ich nie
 * liczy, więc jeden niezmierzony obszar nie zaniża osi.
 */
export function buildDrdAxesData(answers: unknown): Record<string, DrdAxisAggregate> {
  const axesData: Record<string, DrdAxisAggregate> = {};
  const drdAnswers =
    ((answers as { drd?: { areas?: Record<string, unknown> } } | null)?.drd?.areas as Record<
      string,
      unknown
    >) || {};

  for (let i = 1; i <= 7; i++) {
    const axisKey = String(i);
    const axisAreas: Record<string, unknown> = {};
    let totalAchieved = 0;
    let totalTarget = 0;
    let areaCount = 0;

    for (const [areaId, areaData] of Object.entries(drdAnswers)) {
      if (areaId.startsWith(axisKey)) {
        axisAreas[areaId] = areaData;
        const area = areaData as { achievedLevel?: number | null; targetLevel?: number | null };
        if (area?.achievedLevel != null) {
          totalAchieved += area.achievedLevel;
          totalTarget += area.targetLevel || area.achievedLevel;
          areaCount++;
        }
      }
    }

    if (Object.keys(axisAreas).length > 0) {
      axesData[axisKey] = {
        areas: axisAreas,
        axisName: DRD_AXIS_NAMES[axisKey] || `Axis ${axisKey}`,
        areaCount,
        averageScore: areaCount > 0 ? round1(totalAchieved / areaCount) : 0,
        averageTarget: areaCount > 0 ? round1(totalTarget / areaCount) : 0,
        gap: areaCount > 0 ? round1((totalTarget - totalAchieved) / areaCount) : 0,
      };
    }
  }

  return axesData;
}

/**
 * `scores` w kształcie legacy z samych średnich osi. `null` = nie ma ani jednej
 * osi z obszarami, więc caller zostawia dotychczasową wartość (czytelnik
 * raportu) albo pisze `{}` (pisarz bliźniaka) — nigdy nie wymyśla zer.
 */
export function deriveAssessmentScores(
  axesData: Record<string, DrdAxisAggregate>,
  assessmentType: string | undefined
): DrdScoresSummary | null {
  const axes = Object.entries(axesData).map(([axisKey, axisInfo]) => ({
    axisId: axisKey,
    axisName: axisInfo.axisName,
    score: axisInfo.averageScore,
    maxScore: DRD_AXIS_MAX_SCORE,
    target: axisInfo.averageTarget,
    gap: axisInfo.gap,
    fullMark: DRD_AXIS_MAX_SCORE,
  }));
  if (axes.length === 0) return null;

  const overallAvg = axes.reduce((sum, axis) => sum + axis.score, 0) / axes.length;
  return {
    axes,
    overallScore: round1(overallAvg),
    maxScore: DRD_AXIS_MAX_SCORE,
    assessmentType,
  };
}
