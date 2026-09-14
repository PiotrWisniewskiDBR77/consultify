/**
 * [ODMROZENIE 04_ASSESSMENT DEC-496] Zgłoszenie pilotażu P-P12 (`b7ac5351`):
 * „Assessment pozwala wygenerować raport mimo pustych pól".
 *
 * Liczby w teście to pomiar z sesji Pawła `96e95dbe-4190-4799-8017-847484bcdacf`
 * (kopia danych stagingu, 2026-09-14): 10 zdarzeń `ANSWER_CONFIRMED`, jeden
 * obszar (`1A`), 39 obszarów w metodyce.
 */
import { describe, expect, it } from 'vitest';

import DRD_STRUCTURE from '../../../data/drdStructure.js';
import {
  computeAssessmentReportCoverage,
  DRD_REPORT_MIN_COVERAGE_PERCENT,
} from '../assessmentReportCoverage.js';

const WSZYSTKIE_OBSZARY = DRD_STRUCTURE.flatMap((axis) => axis.areas.map((area) => area.id));

describe('computeAssessmentReportCoverage', () => {
  it('P-P12: sesja Pawła (jeden obszar z 39) NIE przechodzi bramki', () => {
    // Dziesięć zdarzeń, ale wszystkie o tym samym obszarze — liczymy obszary.
    const coverage = computeAssessmentReportCoverage(Array.from({ length: 10 }, () => '1A'));

    expect(coverage.totalAreas).toBe(39);
    expect(coverage.answeredAreas).toBe(1);
    expect(coverage.percent).toBe(3);
    expect(coverage.minPercent).toBe(DRD_REPORT_MIN_COVERAGE_PERCENT);
    expect(coverage.sufficient).toBe(false);
  });

  it('pusta ocena nie przechodzi i wypisuje brakujące obszary per oś', () => {
    const coverage = computeAssessmentReportCoverage([]);

    expect(coverage.answeredAreas).toBe(0);
    expect(coverage.percent).toBe(0);
    expect(coverage.sufficient).toBe(false);
    expect(coverage.axes).toHaveLength(7);
    expect(coverage.axes.reduce((sum, a) => sum + a.missingAreaIds.length, 0)).toBe(39);
  });

  it('ocena wypełniona w całości przechodzi', () => {
    const coverage = computeAssessmentReportCoverage(WSZYSTKIE_OBSZARY);

    expect(coverage.answeredAreas).toBe(39);
    expect(coverage.percent).toBe(100);
    expect(coverage.sufficient).toBe(true);
    expect(coverage.axes.every((a) => a.missingAreaIds.length === 0)).toBe(true);
  });

  it('próg 80 %: 31/39 (79 %) nie przechodzi, 32/39 (82 %) przechodzi', () => {
    expect(computeAssessmentReportCoverage(WSZYSTKIE_OBSZARY.slice(0, 31)).percent).toBe(79);
    expect(computeAssessmentReportCoverage(WSZYSTKIE_OBSZARY.slice(0, 31)).sufficient).toBe(false);
    expect(computeAssessmentReportCoverage(WSZYSTKIE_OBSZARY.slice(0, 32)).percent).toBe(82);
    expect(computeAssessmentReportCoverage(WSZYSTKIE_OBSZARY.slice(0, 32)).sufficient).toBe(true);
  });

  it('pusty obszar bez ani jednej odpowiedzi nie przechodzi nawet przy progu 0', () => {
    expect(computeAssessmentReportCoverage([], 0).sufficient).toBe(false);
  });

  it('identyfikatory spoza metodyki i duplikaty są ignorowane', () => {
    const coverage = computeAssessmentReportCoverage(['1A', '1A', ' ', null, undefined, 'ZZ-nope']);
    expect(coverage.answeredAreas).toBe(1);
  });
});
