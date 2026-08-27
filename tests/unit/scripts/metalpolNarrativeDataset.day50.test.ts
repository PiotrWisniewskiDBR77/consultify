import { describe, expect, it } from 'vitest';

import { METALPOL_DRD_AREAS } from '../../../scripts/demo-seed/metalpolDrdDataset.js';

describe('Day 50 Metalpol narrative dataset', () => {
  it('keeps the intended 23 assessed areas and their levels', () => {
    expect(METALPOL_DRD_AREAS).toHaveLength(23);
    expect(METALPOL_DRD_AREAS.find((area) => area.unitId === '1A')).toMatchObject({
      currentLevel: 3,
      targetLevel: 5,
    });
  });

  it('provides every frozen narrative source field for every assessed area', () => {
    for (const area of METALPOL_DRD_AREAS) {
      for (const field of [
        'businessMeaning',
        'recommendation',
        'rootCauseHypothesis',
        'riskOrOpportunity',
        'prerequisite',
        'expectedOutcome',
        'priorityRationale',
      ] as const) {
        expect(area[field].trim(), `${area.unitId}.${field}`).not.toBe('');
      }
    }
  });

  it('keeps technical demo lineage out of client-facing narrative fields', () => {
    const narrative = METALPOL_DRD_AREAS.map((area) => Object.values(area).join(' ')).join(' ');
    expect(narrative).not.toContain('[demo-seed]');
    expect(narrative).not.toContain('Treść merytoryczna nie pochodzi z bazy');
  });

  it('contains Metalpol-specific production context instead of generic digital filler', () => {
    const narrative = METALPOL_DRD_AREAS.map((area) => Object.values(area).join(' ')).join(' ');
    expect(narrative).toMatch(/ERP/);
    expect(narrative).toMatch(/MES/);
    expect(narrative).toMatch(/traceability/);
    expect(narrative).toMatch(/OT/);
  });
});
