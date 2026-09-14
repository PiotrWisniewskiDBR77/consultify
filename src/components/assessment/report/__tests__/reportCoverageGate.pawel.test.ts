/**
 * [ODMROZENIE 04_ASSESSMENT DEC-496] P-P12 (`b7ac5351`) — strona ekranowa
 * bramki pokrycia.
 */
import { describe, expect, it } from 'vitest';

import type { AssessmentReportCoverage } from '@/method-core/api/methodCoreApi';

import { bramkaPokryciaRaportu, MAX_WYMIENIONYCH_OSI } from '../reportCoverageGate';

function pokrycie(over: Partial<AssessmentReportCoverage> = {}): AssessmentReportCoverage {
  return {
    answeredAreas: 1,
    totalAreas: 39,
    percent: 3,
    minPercent: 80,
    sufficient: false,
    axes: [
      { axisId: 1, axisName: 'Digital Processes', axisNamePL: 'Procesy Cyfrowe', answeredAreas: 1, totalAreas: 9, missingAreaIds: ['1B', '1C', '1D', '1E', '1F', '1G', '1H', '1I'] },
      { axisId: 2, axisName: 'Digital Products', axisNamePL: 'Produkty Cyfrowe', answeredAreas: 0, totalAreas: 5, missingAreaIds: ['2A', '2B', '2C', '2D', '2E'] },
      { axisId: 3, axisName: 'Business Models', axisNamePL: null, answeredAreas: 0, totalAreas: 5, missingAreaIds: ['3A', '3B', '3C', '3D', '3E'] },
      { axisId: 4, axisName: 'Data', axisNamePL: null, answeredAreas: 0, totalAreas: 7, missingAreaIds: ['4A', '4B', '4C', '4D', '4E', '4F', '4G'] },
      { axisId: 5, axisName: 'Culture', axisNamePL: null, answeredAreas: 5, totalAreas: 5, missingAreaIds: [] },
    ],
    ...over,
  };
}

describe('bramkaPokryciaRaportu', () => {
  it('brak pomiaru NIE tworzy blokady', () => {
    expect(bramkaPokryciaRaportu(null)).toBeNull();
    expect(bramkaPokryciaRaportu(undefined)).toBeNull();
  });

  it('P-P12: sesja Pawła jest zablokowana i wskazuje osie z największymi brakami', () => {
    const gate = bramkaPokryciaRaportu(pokrycie())!;

    expect(gate.blocked).toBe(true);
    expect(gate.answeredAreas).toBe(1);
    expect(gate.totalAreas).toBe(39);
    expect(gate.percent).toBe(3);
    expect(gate.minPercent).toBe(80);
    expect(gate.topMissingAxes).toHaveLength(MAX_WYMIENIONYCH_OSI);
    // Kolejność: najwięcej braków najpierw (1 → 8, 4 → 7, potem 2 i 3 po 5,
    // rozstrzygane numerem osi).
    expect(gate.topMissingAxes.map((a) => a.axisId)).toEqual([1, 4, 2]);
    expect(gate.moreMissingAxes).toBe(1);
    // Oś bez braków nie jest w ogóle wymieniana.
    expect(gate.topMissingAxes.some((a) => a.axisId === 5)).toBe(false);
  });

  it('pokrycie wystarczające nie blokuje i nie wymienia osi', () => {
    const gate = bramkaPokryciaRaportu(
      pokrycie({
        answeredAreas: 39,
        percent: 100,
        sufficient: true,
        axes: [
          { axisId: 1, axisName: 'Digital Processes', axisNamePL: 'Procesy Cyfrowe', answeredAreas: 9, totalAreas: 9, missingAreaIds: [] },
        ],
      })
    )!;

    expect(gate.blocked).toBe(false);
    expect(gate.topMissingAxes).toHaveLength(0);
    expect(gate.moreMissingAxes).toBe(0);
  });
});
