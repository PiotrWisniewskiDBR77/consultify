import { describe, expect, it } from 'vitest';

import { DRD_STRUCTURE } from '../../../data/drdStructure.js';
import { computeDrdScoring, type EvidenceRecord } from '../drdEvidenceScoring.js';

const areas = Object.fromEntries(
  DRD_STRUCTURE.flatMap((axis) =>
    axis.areas.map((area) => [area.id, { achievedLevel: 1, targetLevel: 2 }])
  )
);

function evidenceForAxis(index: number): EvidenceRecord {
  const axis = DRD_STRUCTURE[index];
  return {
    id: `evidence-${axis.id}`,
    organizationId: 'org-i04',
    assessmentId: 'assessment-i04',
    axisId: String(axis.id),
    areaId: axis.areas[0].id,
    evidenceType: 'note',
    title: `Evidence ${axis.id}`,
    description: null,
    url: null,
    createdBy: 'reviewer-i04',
    createdAt: '2026-08-08T00:00:00.000Z',
  };
}

describe('canonical DRD seven-axis quality gate scoring', () => {
  it('projects all 39 answered areas across exactly seven canonical axes', () => {
    const scoring = computeDrdScoring(
      areas,
      DRD_STRUCTURE.map((_, index) => evidenceForAxis(index))
    );

    expect(Object.keys(areas)).toHaveLength(39);
    expect(scoring.completionPercent).toBe(100);
    expect(scoring.axes).toHaveLength(7);
    expect(scoring.axes.reduce((sum, axis) => sum + axis.areaCount, 0)).toBe(39);
    expect(scoring.axes.reduce((sum, axis) => sum + axis.answeredAreas, 0)).toBe(39);
    expect(scoring.axesMissingEvidence).toEqual([]);
    expect(scoring.evidenceCoverage).toBe(100);
  });

  it('reports the exact missing canonical axis for a six-of-seven evidence set', () => {
    const scoring = computeDrdScoring(
      areas,
      DRD_STRUCTURE.slice(0, 6).map((_, index) => evidenceForAxis(index))
    );

    expect(scoring.completionPercent).toBe(100);
    expect(scoring.axesMissingEvidence).toEqual([String(DRD_STRUCTURE[6].id)]);
    expect(scoring.evidenceCoverage).toBe(86);
  });
});
