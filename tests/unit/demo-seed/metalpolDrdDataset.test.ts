import { describe, expect, it } from 'vitest';

import DRD_STRUCTURE from '../../../server/src/data/drdStructure.js';
import { areaAverage } from '../../../server/src/services/assessment/assessmentDrdReportSchemaService.js';
import {
  EXPECTED_RADAR,
  METALPOL_DRD_AREAS,
} from '../../../scripts/demo-seed/metalpolDrdDataset.js';

describe('Metalpol DRD measured demo dataset', () => {
  it('matches the canonical DRD units and bounds for exactly 23 of 39 areas', () => {
    const canonical = new Map(
      DRD_STRUCTURE.flatMap((axis) => axis.areas.map((area) => [area.id, { axis, area }] as const))
    );
    expect(METALPOL_DRD_AREAS).toHaveLength(23);
    expect(new Set(METALPOL_DRD_AREAS.map((area) => area.unitId)).size).toBe(23);
    for (const measured of METALPOL_DRD_AREAS) {
      const entry = canonical.get(measured.unitId);
      expect(entry).toBeDefined();
      expect(measured.axisId).toBe(entry!.axis.id);
      expect(measured.namePL).toBe(entry!.area.namePL);
      expect(measured.currentLevel).toBeGreaterThanOrEqual(1);
      expect(measured.targetLevel).toBeLessThanOrEqual(entry!.axis.levelCount);
    }
    expect(canonical.size - METALPOL_DRD_AREAS.length).toBe(16);
  });

  it('pins all fourteen accepted radar percentages through the real mapper helper', () => {
    for (const axis of DRD_STRUCTURE) {
      const areas = METALPOL_DRD_AREAS.filter((area) => area.axisId === axis.id).map((area) => ({
        ...area,
        skipped: false,
      }));
      expect(areaAverage(areas as never, 'currentLevel', axis.levelCount)).toBe(
        EXPECTED_RADAR[axis.id as keyof typeof EXPECTED_RADAR].currentLevel
      );
      expect(areaAverage(areas as never, 'targetLevel', axis.levelCount)).toBe(
        EXPECTED_RADAR[axis.id as keyof typeof EXPECTED_RADAR].targetLevel
      );
    }
  });

  it('pins the evidence classification distribution at 14/3/6', () => {
    const counts = Object.fromEntries(
      ['evidenced', 'incomplete', 'declared'].map((kind) => [
        kind,
        METALPOL_DRD_AREAS.filter((area) => area.evidenceClass === kind).length,
      ])
    );
    expect(counts).toEqual({ evidenced: 14, incomplete: 3, declared: 6 });
  });
});
