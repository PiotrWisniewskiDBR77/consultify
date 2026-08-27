import { describe, expect, it } from 'vitest';

import DRD_STRUCTURE from '../../../data/drdStructure.js';
import { resolveDrdLevelLabelPL } from '../assessmentDrdReportSchemaService.js';

describe('Day 32 — Polish DRD scale labels', () => {
  it('pins complete, non-empty, unique labels only on homogeneous axes', () => {
    const labeled = DRD_STRUCTURE.filter((axis) => axis.levelLabelsPL);
    expect(labeled.map((axis) => axis.id)).toEqual([1, 2]);
    for (const axis of labeled) {
      expect(axis.levelLabelsPL).toHaveLength(axis.levelCount);
      expect(axis.levelLabelsPL?.every((label) => label.trim().length > 0)).toBe(true);
      expect(new Set(axis.levelLabelsPL).size).toBe(axis.levelCount);
    }
  });

  it('uses Polish labels for axes 1-2 and honest English fallback elsewhere', () => {
    expect(resolveDrdLevelLabelPL(1, 1)).toBe('Rejestracja danych');
    expect(resolveDrdLevelLabelPL(2, 2)).toBe('Średniozaawansowany');
    expect(resolveDrdLevelLabelPL(3, 1)).toBe(DRD_STRUCTURE[2].areas[0].levels[0].title);
    expect(() => resolveDrdLevelLabelPL(99, 1)).not.toThrow();
  });
});
