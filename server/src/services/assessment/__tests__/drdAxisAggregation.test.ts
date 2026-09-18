/**
 * RG-1 v3 / DEC-572 (Wpis 89) — arytmetyka osi DRD wydzielona z
 * `reportBuilderService.getSourceDataForReport` (:2483-2556 przed wydzieleniem)
 * do jednej czystej funkcji, której używa TAKŻE pisarz bliźniaka legacy
 * (`legacyTwinService.buildLegacyTwinSnapshotFromSession`). Ten plik dowodzi,
 * że wydzielone liczby są DOKŁADNIE te same, co wcześniej: średnie zaokrąglone
 * do jednego miejsca, `targetLevel || achievedLevel`, obszar bez
 * `achievedLevel` niesiony w `areas` ale poza średnią, `maxScore`/`fullMark` 7.
 *
 * Wartości w fixture to REALNE poziomy zamrożonej sesji DRD Northwind
 * `a9c8f477-8d8f-4d31-804d-a39700de4b0a` z kopii dumpu stagingu
 * (`method_outputs.current_json`/`target_json`, pomiar 2026-09-18): oś 1 =
 * 9 obszarów, suma obecnych 28, docelowych 40 → 3.1 / 4.4 / luka 1.3.
 *
 * DOWÓD MUTACYJNY: `round1` zmienione na `Math.round` (bez dziesiętnych) →
 * test „oś 1" RED (3 zamiast 3.1, 4 zamiast 4.4, 1 zamiast 1.3).
 */
import { describe, expect, it } from 'vitest';

import {
  buildDrdAxesData,
  deriveAssessmentScores,
  DRD_AXIS_MAX_SCORE,
  DRD_AXIS_NAMES,
} from '../drdAxisAggregation.js';

/** Oś 1 i oś 7 zamrożonej sesji NW — 1:1 z `method_outputs`. */
const NW_AXIS_1_CURRENT = { '1A': 4, '1B': 2, '1C': 3, '1D': 3, '1E': 4, '1F': 3, '1G': 3, '1H': 4, '1I': 2 };
const NW_AXIS_1_TARGET = { '1A': 5, '1B': 4, '1C': 4, '1D': 5, '1E': 5, '1F': 5, '1G': 4, '1H': 5, '1I': 3 };
const NW_AXIS_7_CURRENT = { '7A': 2, '7B': 2, '7C': 2, '7D': 2, '7E': 2 };
const NW_AXIS_7_TARGET = { '7A': 4, '7B': 3, '7C': 3, '7D': 4, '7E': 3 };

function answersFrom(areas: Record<string, unknown>) {
  return { drd: { areas } };
}

describe('drdAxisAggregation — buildDrdAxesData (Wpis 89)', () => {
  it('grupuje po prefiksie osi i liczy średnie z realnych poziomów sesji NW', () => {
    const areas: Record<string, unknown> = {};
    for (const [unit, level] of Object.entries(NW_AXIS_1_CURRENT)) {
      areas[unit] = { achievedLevel: level, targetLevel: NW_AXIS_1_TARGET[unit] };
    }
    for (const [unit, level] of Object.entries(NW_AXIS_7_CURRENT)) {
      areas[unit] = { achievedLevel: level, targetLevel: NW_AXIS_7_TARGET[unit] };
    }

    const axes = buildDrdAxesData(answersFrom(areas));
    expect(Object.keys(axes).sort()).toEqual(['1', '7']);
    expect(axes['1']).toMatchObject({
      axisName: DRD_AXIS_NAMES['1'],
      areaCount: 9,
      averageScore: 3.1,
      averageTarget: 4.4,
      gap: 1.3,
    });
    expect(axes['7']).toMatchObject({ areaCount: 5, averageScore: 2, averageTarget: 3.4, gap: 1.4 });
    expect(Object.keys(axes['1'].areas)).toHaveLength(9);
  });

  it('obszar bez targetLevel: docelowy = osiągnięty (luka 0) — zachowanie czytelnika raportu', () => {
    const axes = buildDrdAxesData(answersFrom({ '2A': { achievedLevel: 3 } }));
    expect(axes['2']).toMatchObject({ areaCount: 1, averageScore: 3, averageTarget: 3, gap: 0 });
  });

  it('obszar bez achievedLevel jest NIESIONY w areas, ale nie wchodzi do średniej', () => {
    const axes = buildDrdAxesData(
      answersFrom({ '3A': { achievedLevel: 4, targetLevel: 6 }, '3B': { targetLevel: 5 } })
    );
    expect(Object.keys(axes['3'].areas).sort()).toEqual(['3A', '3B']);
    expect(axes['3']).toMatchObject({ areaCount: 1, averageScore: 4, averageTarget: 6, gap: 2 });
  });

  it('poziom 0 wchodzi do średniej (historyczna semantyka `!= null`) — nie „brak pomiaru"', () => {
    const axes = buildDrdAxesData(
      answersFrom({ '4A': { achievedLevel: 0, targetLevel: 0 }, '4B': { achievedLevel: 4, targetLevel: 6 } })
    );
    expect(axes['4']).toMatchObject({ areaCount: 2, averageScore: 2, averageTarget: 3, gap: 1 });
  });

  it('pusty snapshot (stan v2) daje PUSTE osie — dokładnie defekt z Wpisu 89', () => {
    expect(buildDrdAxesData({})).toEqual({});
    expect(buildDrdAxesData(null)).toEqual({});
    expect(buildDrdAxesData({ drd: {} })).toEqual({});
    expect(buildDrdAxesData({ drd: { areas: {} } })).toEqual({});
  });
});

describe('drdAxisAggregation — deriveAssessmentScores (Wpis 89)', () => {
  it('zwraca null, gdy nie ma ani jednej osi (caller zostawia dotychczasową wartość)', () => {
    expect(deriveAssessmentScores({}, 'DRD')).toBeNull();
  });

  it('kształt legacy `scores`: osie 1-7, maxScore/fullMark 7, overallScore = średnia osi', () => {
    const areas: Record<string, unknown> = {};
    for (const [unit, level] of Object.entries(NW_AXIS_1_CURRENT)) {
      areas[unit] = { achievedLevel: level, targetLevel: NW_AXIS_1_TARGET[unit] };
    }
    for (const [unit, level] of Object.entries(NW_AXIS_7_CURRENT)) {
      areas[unit] = { achievedLevel: level, targetLevel: NW_AXIS_7_TARGET[unit] };
    }

    const scores = deriveAssessmentScores(buildDrdAxesData(answersFrom(areas)), 'DRD');
    expect(scores).not.toBeNull();
    expect(scores?.axes).toHaveLength(2);
    expect(scores?.axes[0]).toEqual({
      axisId: '1',
      axisName: 'Digital Processes',
      score: 3.1,
      maxScore: DRD_AXIS_MAX_SCORE,
      target: 4.4,
      gap: 1.3,
      fullMark: DRD_AXIS_MAX_SCORE,
    });
    // (3.1 + 2) / 2 = 2.55 → 2.6 (zaokrąglenie czytelnika raportu).
    expect(scores?.overallScore).toBe(2.6);
    expect(scores?.maxScore).toBe(DRD_AXIS_MAX_SCORE);
    expect(scores?.assessmentType).toBe('DRD');
  });
});
