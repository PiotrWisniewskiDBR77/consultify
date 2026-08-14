import { describe, expect, it } from 'vitest';

import { DRD_STRUCTURE } from '@/services/drdStructure';

import { compileDrdPack } from '../compileDrdPack';

describe('compileDrdPack — structure coverage', () => {
  it('covers all 39 areas with a unit and the correct level scale for its own axis', () => {
    const { pack } = compileDrdPack();
    expect(pack.units).toHaveLength(39);

    for (const axis of DRD_STRUCTURE) {
      for (const area of axis.areas) {
        const unit = pack.units.find((u) => u.unitId === area.id);
        expect(unit, `missing unit for area ${area.id}`).toBeDefined();
        expect(unit!.levelScale).toEqual(area.levels.map((l) => l.level).sort((a, b) => a - b));
        expect(unit!.parentId).toBe(`axis-${axis.id}`);
      }
    }
  });

  it('axis 1 has 9 areas of scale 1-7; axis 7 has 5 areas of scale 1-5', () => {
    const { pack } = compileDrdPack();

    const axis1Units = pack.units.filter((u) => u.parentId === 'axis-1');
    expect(axis1Units).toHaveLength(9);
    for (const u of axis1Units) expect(u.levelScale).toEqual([1, 2, 3, 4, 5, 6, 7]);

    const axis7Units = pack.units.filter((u) => u.parentId === 'axis-7');
    expect(axis7Units).toHaveLength(5);
    for (const u of axis7Units) expect(u.levelScale).toEqual([1, 2, 3, 4, 5]);
  });

  it('axis 2/3 use scale 1-5, axis 4 uses 1-7, axis 5/6 use 1-6 (per-axis, not global)', () => {
    const { pack } = compileDrdPack();
    const scaleForAxis = (axisId: number) =>
      pack.units.find((u) => u.parentId === `axis-${axisId}`)!.levelScale;

    expect(scaleForAxis(2)).toEqual([1, 2, 3, 4, 5]);
    expect(scaleForAxis(3)).toEqual([1, 2, 3, 4, 5]);
    expect(scaleForAxis(4)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(scaleForAxis(5)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(scaleForAxis(6)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('has exactly one MethodLevel per area#level pair (233 total) and 3 questions each (699 total)', () => {
    const { pack, report } = compileDrdPack();
    expect(report.coverage.unitLevelPairsTotal).toBe(233);
    expect(pack.levels).toHaveLength(233);
    expect(pack.questions).toHaveLength(699);
  });

  it('reports 100% override coverage (measured, not assumed) for all 233 area#level pairs', () => {
    const { report } = compileDrdPack();
    expect(report.coverage.areasTotal).toBe(39);
    expect(report.coverage.areasWithFullLevelCoverage).toBe(39);
    expect(report.coverage.areaIdsMissingSomeLevelCoverage).toEqual([]);
    expect(report.coverage.unitLevelPairsWithOverrideContent).toBe(233);
    expect(report.coverage.questionsTotal).toBe(699);
  });

  it('honestly reports empty canon-required fields instead of inventing content', () => {
    const { report } = compileDrdPack();
    expect(report.fieldGaps.levelsTotal).toBe(233);
    expect(report.fieldGaps.emptyMisScoringTraps).toBe(233);
    expect(report.fieldGaps.emptyDistinctionFromNext).toBe(233);
    expect(report.fieldGaps.emptyDistinctionFromPrevious).toBe(233);
    expect(report.fieldGaps.emptyNegativeEvidence).toBe(233);
    expect(report.fieldGaps.emptyExamples).toBe(233);
    // expectedEvidence IS populated from QBank "Dowód" text for every level.
    expect(report.fieldGaps.emptyExpectedEvidence).toBe(0);
  });

  it('sets an honest, non-releasable readiness given the field gaps', () => {
    const { pack } = compileDrdPack();
    expect(pack.manifest.readiness).toBe('methodology_review');
    expect(pack.manifest.readiness).not.toBe('released');
    expect(pack.manifest.readiness).not.toBe('pilot');
  });

  it('every MethodLevel has non-empty canonical fields sourced from drdStructure.ts', () => {
    const { pack } = compileDrdPack();
    for (const level of pack.levels) {
      expect(level.title.length).toBeGreaterThan(0);
      expect(level.canonicalDefinition.length).toBeGreaterThan(0);
      expect(level.technologyExamples.length).toBeGreaterThan(0);
      expect(level.expectedEvidence.length).toBeGreaterThan(0);
    }
  });

  it('carries at least one scoring fixture of each kind', () => {
    const { pack } = compileDrdPack();
    const kinds = new Set(pack.scoringFixtures.map((f) => f.kind));
    expect(kinds.has('valid')).toBe(true);
    expect(kinds.has('boundary')).toBe(true);
    expect(kinds.has('invalid')).toBe(true);
  });

  it('is deterministic — compiling twice yields identical output', () => {
    const first = compileDrdPack();
    const second = compileDrdPack();
    expect(JSON.stringify(second.pack)).toBe(JSON.stringify(first.pack));
  });
});
