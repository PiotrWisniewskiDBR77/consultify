import { describe, expect, it } from 'vitest';
import {
  buildSiriUnits,
  compileSiriPack,
  SIRI_QBANK_V1_COVERAGE,
} from '../compileSiriPack';
import {
  SIRI_PM_ENGINE_VERIFICATION,
  SIRI_PM_PLANNING_HORIZON_WEIGHTS,
  siriAdapter,
} from '../siriAdapter';
import {
  SIRI_BUILDING_BLOCKS,
  SIRI_DIMENSIONS,
  SIRI_PRIORITISATION_AREAS,
} from '@/services/siriStructure';
import type { AggregationInput, PrioritisationInput, ScoringInput } from '../../../contracts';

describe('SIRI Method Pack — 16 Dimensions as source of truth', () => {
  // -------------------------------------------------------------------
  // 1. pack has exactly 16 units, each levelScale = [0..5]
  // -------------------------------------------------------------------
  it('1) compiles exactly 16 units, each with levelScale [0,1,2,3,4,5]', () => {
    const units = buildSiriUnits();
    expect(units).toHaveLength(16);
    const ids = new Set(units.map((u) => u.unitId));
    expect(ids.size).toBe(16); // all unique

    for (const unit of units) {
      expect(unit.levelScale).toEqual([0, 1, 2, 3, 4, 5]);
    }

    // Matches the canonical 16 SIRI_PRIORITISATION_AREAS ids 1:1.
    expect([...ids].sort()).toEqual(SIRI_PRIORITISATION_AREAS.map((a) => a.id).sort());
  });

  // -------------------------------------------------------------------
  // 2. 16 units -> 8 pillars -> 3 building blocks, no orphan unit
  // -------------------------------------------------------------------
  it('2) every unit maps to one of the 8 pillars, every pillar to one of the 3 building blocks', () => {
    const units = buildSiriUnits();
    const pillarIds = new Set(SIRI_DIMENSIONS.map((d) => d.id));
    expect(pillarIds.size).toBe(8);

    const usedPillars = new Set<string>();
    for (const unit of units) {
      expect(unit.parentId).not.toBeNull();
      expect(pillarIds.has(unit.parentId as string)).toBe(true); // no orphan
      usedPillars.add(unit.parentId as string);
    }
    // All 8 pillars are actually referenced by at least one of the 16 units.
    expect(usedPillars.size).toBe(8);

    const buildingBlockIds = new Set(Object.keys(SIRI_BUILDING_BLOCKS));
    expect(buildingBlockIds.size).toBe(3);
    for (const pillar of SIRI_DIMENSIONS) {
      expect(buildingBlockIds.has(pillar.buildingBlock)).toBe(true); // no orphan pillar
    }
  });

  // -------------------------------------------------------------------
  // 3. no-leapfrog: Band 4 without Band 2 -> blocked
  // -------------------------------------------------------------------
  it('3) no-leapfrog: confirming Band 4 without Band 2 leaves the unit blocked at Band 1', () => {
    const result = siriAdapter.resolveOpenLevels({
      unitId: 'vertical_integration',
      confirmedLevels: [0, 1, 3, 4], // Band 2 skipped
      evidenceByLevel: { 0: 'E2', 1: 'E2', 3: 'E2', 4: 'E2' },
    });

    expect(result.currentLevel).toBe(1); // stops at last CONTIGUOUS confirmed band
    expect(result.blockedAtLevel).toBe(2); // Band 2 is the gap
    expect(result.openLevels).toEqual([0, 1, 2]); // Band 4 is NOT open
    expect(result.openLevels).not.toContain(4);
    expect(result.aboveGapLevels).toEqual([3, 4]); // recorded, visible, not counted
  });

  // -------------------------------------------------------------------
  // 4. 16D does NOT inherit the parent pillar's score (regression on the
  //    obsoleted compute16DScores() defect in siriStructure.ts)
  // -------------------------------------------------------------------
  it('4) a unit with no evidence of its own scores as needs_evidence/null — never a parent/sibling value', () => {
    // Sibling unit in the SAME pillar ("operations") is fully scored at Band 3.
    const scoredSibling: ScoringInput = {
      unitId: 'vertical_integration',
      answers: {
        '0': { satisfied: 1, total: 1 },
        '1': { satisfied: 5, total: 5 },
        '2': { satisfied: 4, total: 4 },
        '3': { satisfied: 4, total: 5 },
      },
      evidence: { '0': 'E2', '1': 'E2', '2': 'E2', '3': 'E2' },
    };
    const siblingResult = siriAdapter.computeScore(scoredSibling);
    expect(siblingResult.proposedLevel).toBe(3);

    // The unit under test has NO answers of its own at all.
    const unscoredUnit: ScoringInput = {
      unitId: 'horizontal_integration', // different unit, same pillar ("operations")
      answers: {},
      evidence: {},
    };
    const unscoredResult = siriAdapter.computeScore(unscoredUnit);

    expect(unscoredResult.proposedLevel).toBeNull(); // NOT 3 (the sibling's/parent's value)
    expect(unscoredResult.verdict).toBe('needs_evidence'); // "unknown", not a silent zero
  });

  // -------------------------------------------------------------------
  // 5. aggregation returns explicit mappingVersion + rule; unknown -> excluded
  // -------------------------------------------------------------------
  it('5) aggregate() returns an explicit versioned rule and excludes unknown units', () => {
    const unitLevels: Record<string, number | null> = {};
    for (const area of SIRI_PRIORITISATION_AREAS) {
      unitLevels[area.id] = 3; // give every unit a score...
    }
    // "operations" pillar has exactly ONE unit (vertical_integration) — excluding
    // it should null out the whole group, proving exclusion isn't silently
    // imputed. "automation" has THREE units — excluding one of them should
    // still yield a mean from the other two, proving partial exclusion works.
    unitLevels.vertical_integration = null;
    unitLevels.shop_floor_automation = null;

    const input: AggregationInput = { unitLevels, mappingVersion: 'siri-16to8-unweighted-mean-v1-PENDING-OWNER-APPROVAL' };
    const result = siriAdapter.aggregate(input);

    expect(typeof result.mappingVersion).toBe('string');
    expect(result.mappingVersion.length).toBeGreaterThan(0);
    expect(typeof result.rule).toBe('string');
    expect(result.rule).toMatch(/PENDING|owner|approval/i); // not a silent unversioned mean

    expect(result.excluded.vertical_integration).toBe('unknown');
    expect(result.excluded.shop_floor_automation).toBe('unknown');
    expect(Object.keys(result.excluded)).toHaveLength(2);

    // operations' only unit was excluded -> whole group is null, not imputed.
    expect(result.byGroup.operations).toBeNull();
    // automation still has 2 of 3 units scored at 3 -> mean is 3.
    expect(result.byGroup.automation).toBe(3);
  });

  // -------------------------------------------------------------------
  // 6. prioritise() with unfrozen data -> REJECTED
  // -------------------------------------------------------------------
  it('6) prioritise() throws when the input is not an explicitly frozen snapshot', () => {
    const frozenUnitLevels: Record<string, number> = {};
    SIRI_PRIORITISATION_AREAS.forEach((area, i) => {
      frozenUnitLevels[area.id] = i % 6;
    });

    const notFrozen: PrioritisationInput = {
      frozenUnitLevels,
      parameters: { sessionState: 'active', planningHorizon: 'tactical' }, // not frozen
    };
    expect(() => siriAdapter.prioritise!(notFrozen)).toThrow();

    const missingSnapshotId: PrioritisationInput = {
      frozenUnitLevels,
      parameters: { sessionState: 'frozen', planningHorizon: 'tactical' }, // no frozenSnapshotId
    };
    expect(() => siriAdapter.prioritise!(missingSnapshotId)).toThrow();
  });

  // -------------------------------------------------------------------
  // 7. prioritise() guarantees >=1 focus dimension per building block
  // -------------------------------------------------------------------
  it('7) prioritise() selects at least one focus dimension per building block (>=3 total)', () => {
    const frozenUnitLevels: Record<string, number> = {};
    SIRI_PRIORITISATION_AREAS.forEach((area, i) => {
      frozenUnitLevels[area.id] = i % 6;
    });

    const input: PrioritisationInput = {
      frozenUnitLevels,
      parameters: {
        sessionState: 'frozen',
        frozenSnapshotId: 'snap-test-001',
        planningHorizon: 'strategic',
      },
    };

    const result = siriAdapter.prioritise!(input);
    expect(result.rankedUnitIds).toHaveLength(16);

    const focusIds = Object.entries(result.rationaleByUnitId)
      .filter(([, rationale]) => rationale.startsWith('SELECTED_FOCUS'))
      .map(([id]) => id);

    expect(focusIds.length).toBeGreaterThanOrEqual(3); // >= 1 per block, plus the Step-8b bonus

    const buildingBlockByAreaId = new Map(SIRI_PRIORITISATION_AREAS.map((a) => [a.id, a.buildingBlock]));
    const focusBlocks = new Set(focusIds.map((id) => buildingBlockByAreaId.get(id)));
    expect(focusBlocks.has('PROCESS')).toBe(true);
    expect(focusBlocks.has('TECHNOLOGY')).toBe(true);
    expect(focusBlocks.has('ORGANIZATION')).toBe(true);
  });

  // -------------------------------------------------------------------
  // 8. determinism: same input twice -> identical result
  // -------------------------------------------------------------------
  it('8) prioritise() is deterministic — identical input twice gives an identical result', () => {
    const frozenUnitLevels: Record<string, number> = {};
    SIRI_PRIORITISATION_AREAS.forEach((area, i) => {
      frozenUnitLevels[area.id] = (i * 3) % 6;
    });

    const input: PrioritisationInput = {
      frozenUnitLevels,
      parameters: {
        sessionState: 'frozen',
        frozenSnapshotId: 'snap-test-002',
        planningHorizon: 'operational',
      },
    };

    const first = siriAdapter.prioritise!(input);
    const second = siriAdapter.prioritise!(input);
    expect(second).toEqual(first);
  });

  // -------------------------------------------------------------------
  // Additional evidence backing the mission's DoD (not part of the 8
  // required cases, but assert the measured facts so they can't silently
  // drift without a failing test).
  // -------------------------------------------------------------------
  describe('measured evidence (DoD facts)', () => {
    it('QBank v1 has zero per-dimension question coverage (0/16)', () => {
      expect(SIRI_QBANK_V1_COVERAGE.totalDimensions).toBe(16);
      expect(SIRI_QBANK_V1_COVERAGE.dimensionsWithDedicatedQuestions).toBe(0);
      expect(compileSiriPack().pack.questions).toHaveLength(0);
    });

    it('the Impact Value formula structurally matches the whitepaper, but two implementation gaps are confirmed', () => {
      expect(SIRI_PM_ENGINE_VERIFICATION.formulaStructureMatchesWhitepaper).toBe(true);
      expect(SIRI_PM_ENGINE_VERIFICATION.normalisationStepImplemented).toBe(false);
      expect(SIRI_PM_ENGINE_VERIFICATION.defaultWeightsMatchAnyPlanningHorizonPreset).toBe(false);
      expect(SIRI_PM_ENGINE_VERIFICATION.engineOperatesOnDimensionCount).toBe(16);

      const presetSums = Object.values(SIRI_PM_PLANNING_HORIZON_WEIGHTS).map(
        (w) => w.cost + w.kpi + w.proximity
      );
      for (const sum of presetSums) {
        expect(sum).toBeCloseTo(1, 10);
      }
    });

    it('the compiled pack readiness is honestly "draft" (cannot start a production session)', () => {
      const { pack } = compileSiriPack();
      expect(pack.manifest.readiness).toBe('draft');
    });
  });
});
