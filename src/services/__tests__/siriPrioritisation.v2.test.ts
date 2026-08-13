/**
 * COORD-08 — SIRI PM v2 (siri_pm_v2) vs legacy_v1.
 *
 * Fixtures below use exact fractions (e.g. raw shares 90/4/6 out of 100) so
 * expected Impact Values can be derived analytically by hand and cross-checked
 * against the implementation — not just "call the function twice and compare
 * to itself". See inline comments for the derivation of each expected number.
 *
 * Source: knowledge/SIRI/SIRI-PM Whitepaper.pdf pp.35-37 (Step 4 negative
 * proximity clamp, Step 6 normalisation, Step 7 weighted sum) and p.29
 * Figure 12 (planning-horizon weight presets).
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  calculateImpactValue,
  DEFAULT_SIRI_PM_WEIGHTS,
  rankByImpactValue,
  rankByImpactValueV2,
  SIRI_PM_WEIGHT_PRESETS,
  type SIRIPrioritisationInput,
} from '@/services/siriPrioritisation';
import { siriAdapter } from '@/method-core/methods/siri/siriAdapter';
import { SIRI_PRIORITISATION_AREAS } from '@/services/siriStructure';
import { SIRI_PM_V2_FLAG_KEYS } from '@/utils/siriPmV2Flag';
import type { PrioritisationInput } from '@/method-core/contracts';

// Real SIRI area ids, used so `name` resolution in the engine is exercised too.
const AREA_1 = 'vertical_integration';
const AREA_2 = 'horizontal_integration';
const AREA_3 = 'integrated_product_lifecycle';

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('SIRI PM engine — legacy_v1 vs siri_pm_v2 (COORD-08)', () => {
  // -----------------------------------------------------------------------
  // 1. Normalisation (Step 6): each of the 3 normalised columns sums to 1.
  // -----------------------------------------------------------------------
  // Consequence: since Wcost+Wkpi+Wproximity = 1 for every preset, and each
  // of the 3 normalised columns independently sums to 1 across the batch,
  // the sum of the (unrounded) Impact Values across the batch must also be
  // 1. This is a direct, implementation-independent proof that Step 6 ran
  // BEFORE Step 7 — it would not hold if weights were applied to raw terms.
  it('1) v2 normalises each factor column to sum to 1 — batch Impact Values sum to ~1; v1 gives a different ranking on the same skewed data', () => {
    // Fixture reused from test 2: a huge costProfile outlier vs a smaller,
    // proximity-heavy item.
    const p: SIRIPrioritisationInput = {
      areaId: AREA_1,
      ams: 1,
      bic: 4, // gap = 3
      costRelevance: 1,
      costProfile: 1,
      kpiRelevance: 1,
      kpiImportance: 1,
    };
    const q: SIRIPrioritisationInput = {
      areaId: AREA_2,
      ams: 2,
      bic: 3, // gap = 1
      costRelevance: 1,
      costProfile: 3.5,
      kpiRelevance: 1,
      kpiImportance: 0,
    };

    for (const horizon of Object.keys(SIRI_PM_WEIGHT_PRESETS) as Array<
      keyof typeof SIRI_PM_WEIGHT_PRESETS
    >) {
      const v2 = rankByImpactValueV2([p, q], horizon);
      const sum = v2.reduce((acc, r) => acc + r.impactValue, 0);
      // Tolerance accounts for 2-decimal rounding per item (2 items => up to
      // ~0.02 drift), not for a missing normalisation step (which would be
      // off by an order of magnitude given costProfile=1 vs 3.5).
      expect(sum).toBeCloseTo(1, 1);
    }

    // v1 (legacy, unnormalised) ranks P first at this scale (see test 2 for
    // the full derivation) — the ranking differs from v2 at the SAME scale
    // whenever the weight preset does not happen to coincide with
    // DEFAULT_SIRI_PM_WEIGHTS.
    const v1 = rankByImpactValue([p, q]);
    const v2Operational = rankByImpactValueV2([p, q], 'operational');
    expect(v1.map((r) => r.areaId)).not.toEqual(v2Operational.map((r) => r.areaId));
  });

  // -----------------------------------------------------------------------
  // 2. Cost-scale invariance (v2) vs scale sensitivity (v1, regression).
  // -----------------------------------------------------------------------
  // Fixture engineered so that doubling costProfile for ALL areas flips the
  // v1 ranking (defect) but leaves the v2 ranking untouched (fix), because
  // v2's cost column is a per-item SHARE of the column total — invariant
  // under a uniform scalar multiplier applied to every item in that column.
  it('2) v2: doubling costProfile for all areas does not change ranking; v1: it flips the ranking (regression proof)', () => {
    const pBase: SIRIPrioritisationInput = {
      areaId: AREA_1,
      ams: 1,
      bic: 4, // gap = 3
      costRelevance: 1,
      costProfile: 1,
      kpiRelevance: 1,
      kpiImportance: 1,
    };
    const qBase: SIRIPrioritisationInput = {
      areaId: AREA_2,
      ams: 2,
      bic: 3, // gap = 1
      costRelevance: 1,
      costProfile: 3.5,
      kpiRelevance: 1,
      kpiImportance: 0,
    };

    // --- v1 (legacy_v1, DEFAULT_SIRI_PM_WEIGHTS 0.3/0.3/0.4) ---
    // base:    P = 0.3*1   + 0.3*1 + 0.4*3 = 1.8   Q = 0.3*3.5 + 0   + 0.4*1 = 1.45  -> P > Q
    // doubled: P = 0.3*2   + 0.3*1 + 0.4*3 = 2.1   Q = 0.3*7   + 0   + 0.4*1 = 2.5   -> Q > P  (FLIP)
    const v1Base = rankByImpactValue([pBase, qBase]);
    expect(v1Base.map((r) => r.areaId)).toEqual([AREA_1, AREA_2]);
    expect(v1Base[0].impactValue).toBeCloseTo(1.8, 5);
    expect(v1Base[1].impactValue).toBeCloseTo(1.45, 5);

    const pDoubled = { ...pBase, costProfile: pBase.costProfile * 2 };
    const qDoubled = { ...qBase, costProfile: qBase.costProfile * 2 };
    const v1Doubled = rankByImpactValue([pDoubled, qDoubled]);
    expect(v1Doubled.map((r) => r.areaId)).toEqual([AREA_2, AREA_1]); // flipped
    expect(v1Doubled[0].impactValue).toBeCloseTo(2.5, 5);
    expect(v1Doubled[1].impactValue).toBeCloseTo(2.1, 5);

    // --- v2 ('operational' preset — arbitrary, invariance holds for any) ---
    const v2Base = rankByImpactValueV2([pBase, qBase], 'operational');
    const v2Doubled = rankByImpactValueV2([pDoubled, qDoubled], 'operational');
    expect(v2Doubled.map((r) => r.areaId)).toEqual(v2Base.map((r) => r.areaId));
    // Impact Values themselves are unchanged too (not just the order),
    // because the cost column's per-item SHARE is scale-invariant and the
    // kpi/proximity columns were not touched by the doubling.
    for (let i = 0; i < v2Base.length; i++) {
      expect(v2Doubled[i].impactValue).toBeCloseTo(v2Base[i].impactValue, 5);
    }
  });

  // -----------------------------------------------------------------------
  // 3. Negative proximity clamp (Step 4).
  // -----------------------------------------------------------------------
  it('3) v2 clamps a negative BIC-AMS gap to 0 (proximity term never drags Impact Value negative); v1 does not', () => {
    const better: SIRIPrioritisationInput = {
      // Mirrors the existing defect probe in siriAdapter's __tests__: a
      // company that is AHEAD of the Best-in-Class benchmark (BIC < AMS).
      areaId: AREA_1,
      ams: 5,
      bic: 1, // gap = -4
      costRelevance: 0,
      costProfile: 0,
      kpiRelevance: 0,
      kpiImportance: 0,
    };
    const filler: SIRIPrioritisationInput = {
      // Non-zero raw terms so the normalisation totals aren't all 0 —
      // otherwise the clamp-to-0 guard for division-by-zero would also
      // mask whether the *negative-gap* clamp specifically works.
      areaId: AREA_2,
      ams: 1,
      bic: 3, // gap = 2, contributes to the proximity Total
      costRelevance: 1,
      costProfile: 1,
      kpiRelevance: 1,
      kpiImportance: 1,
    };

    // v1: raw, unclamped — proximity term goes negative, IV goes negative.
    const legacyIv = calculateImpactValue(better, DEFAULT_SIRI_PM_WEIGHTS);
    expect(legacyIv).toBeLessThan(0);

    // v2: clamped — `better`'s own proximity contribution is 0/Total = 0,
    // and its cost/kpi raw terms are 0 too (by construction), so its
    // Impact Value is exactly 0 — never negative.
    const v2 = rankByImpactValueV2([better, filler], 'strategic');
    const betterResult = v2.find((r) => r.areaId === AREA_1)!;
    expect(betterResult.impactValue).toBe(0);
    expect(betterResult.impactValue).toBeGreaterThanOrEqual(0);

    // General property: siri_pm_v2 Impact Values are always in [0, 1] since
    // they are a weighted average (weights sum to 1) of three factors each
    // in [0, 1] — so no v2 result can ever be negative, for ANY input.
    for (const r of v2) {
      expect(r.impactValue).toBeGreaterThanOrEqual(0);
    }
  });

  // -----------------------------------------------------------------------
  // 4. All three planning-horizon presets: sum to 1, each ranks the fixture
  //    differently (a fixture where each area dominates exactly one factor).
  // -----------------------------------------------------------------------
  it('4) all 3 weight presets sum to 1 and produce 3 pairwise-different rankings on a fixture with divergent factors', () => {
    for (const weights of Object.values(SIRI_PM_WEIGHT_PRESETS)) {
      expect(weights.cost + weights.kpi + weights.proximity).toBeCloseTo(1, 10);
    }

    // Raw factor shares (out of 100) per area — CW dominates cost, KW
    // dominates kpi, PW dominates proximity; off-diagonals are unequal
    // (4 vs 6) so operational's Wkpi===Wproximity (0.20===0.20) tie does
    // NOT translate into a tied Impact Value.
    //   cost: CW=90 KW=4  PW=6   (sum 100)
    //   kpi:  CW=4  KW=90 PW=6   (sum 100)
    //   prox: CW=6  KW=4  PW=90  (sum 100, via bic-ams = 0.06/0.04/0.90 * ~5)
    const costWinner: SIRIPrioritisationInput = {
      areaId: AREA_1,
      ams: 0,
      bic: 0.06,
      costRelevance: 1,
      costProfile: 90,
      kpiRelevance: 1,
      kpiImportance: 4,
    };
    const kpiWinner: SIRIPrioritisationInput = {
      areaId: AREA_2,
      ams: 0,
      bic: 0.04,
      costRelevance: 1,
      costProfile: 4,
      kpiRelevance: 1,
      kpiImportance: 90,
    };
    const proxWinner: SIRIPrioritisationInput = {
      areaId: AREA_3,
      ams: 0,
      bic: 0.9,
      costRelevance: 1,
      costProfile: 6,
      kpiRelevance: 1,
      kpiImportance: 6,
    };
    const fixture = [costWinner, kpiWinner, proxWinner];

    const strategic = rankByImpactValueV2(fixture, 'strategic'); // Wkpi=0.40 is max -> KW top
    const tactical = rankByImpactValueV2(fixture, 'tactical'); // Wcost=0.45 is max -> CW top
    const operational = rankByImpactValueV2(fixture, 'operational'); // Wcost=0.60 is max -> CW top

    expect(strategic.map((r) => r.areaId)).toEqual([AREA_2, AREA_3, AREA_1]); // KW, PW, CW
    expect(tactical.map((r) => r.areaId)).toEqual([AREA_1, AREA_2, AREA_3]); // CW, KW, PW
    expect(operational.map((r) => r.areaId)).toEqual([AREA_1, AREA_3, AREA_2]); // CW, PW, KW

    // All three pairwise different — not just "some" difference.
    const orders = [strategic, tactical, operational].map((r) => r.map((x) => x.areaId).join(','));
    expect(new Set(orders).size).toBe(3);

    // Each preset's Impact Values still sum to ~1 (Step 6 normalisation).
    for (const ranked of [strategic, tactical, operational]) {
      const sum = ranked.reduce((acc, r) => acc + r.impactValue, 0);
      expect(sum).toBeCloseTo(1, 1);
    }
  });

  // -----------------------------------------------------------------------
  // 5. legacy_v1 reproduces pre-COORD-08 numbers exactly (golden values).
  // -----------------------------------------------------------------------
  it('5) legacy_v1 returns EXACTLY the same numbers the engine produced before COORD-08 (frozen golden fixture)', () => {
    const item1: SIRIPrioritisationInput = {
      areaId: AREA_1,
      ams: 1,
      bic: 4,
      costRelevance: 1,
      costProfile: 2,
      kpiRelevance: 1,
      kpiImportance: 3,
    };
    const item2: SIRIPrioritisationInput = {
      areaId: AREA_2,
      ams: 3,
      bic: 2,
      costRelevance: 0.5,
      costProfile: 4,
      kpiRelevance: 1,
      kpiImportance: 1,
    };
    const item3: SIRIPrioritisationInput = {
      areaId: AREA_3,
      ams: 0,
      bic: 5,
      costRelevance: 1,
      costProfile: 1,
      kpiRelevance: 1,
      kpiImportance: 1,
    };

    // Hand-derived with DEFAULT_SIRI_PM_WEIGHTS (0.3/0.3/0.4):
    //   item1: 0.3*(1*2) + 0.3*(1*3) + 0.4*(4-1) = 0.6 + 0.9 + 1.2 = 2.7
    //   item2: 0.3*(0.5*4) + 0.3*(1*1) + 0.4*(2-3) = 0.6 + 0.3 - 0.4 = 0.5
    //   item3: 0.3*(1*1) + 0.3*(1*1) + 0.4*(5-0) = 0.3 + 0.3 + 2.0 = 2.6
    expect(calculateImpactValue(item1)).toBe(2.7);
    expect(calculateImpactValue(item2)).toBe(0.5);
    expect(calculateImpactValue(item3)).toBe(2.6);

    const ranked = rankByImpactValue([item1, item2, item3]);
    expect(ranked).toEqual([
      {
        areaId: AREA_1,
        name: SIRI_PRIORITISATION_AREAS.find((a) => a.id === AREA_1)!.name,
        impactValue: 2.7,
        rank: 1,
        gapToBIC: 3,
        calculationVersion: 'legacy_v1',
        planningHorizon: null,
      },
      {
        areaId: AREA_3,
        name: SIRI_PRIORITISATION_AREAS.find((a) => a.id === AREA_3)!.name,
        impactValue: 2.6,
        rank: 2,
        gapToBIC: 5,
        calculationVersion: 'legacy_v1',
        planningHorizon: null,
      },
      {
        areaId: AREA_2,
        name: SIRI_PRIORITISATION_AREAS.find((a) => a.id === AREA_2)!.name,
        impactValue: 0.5,
        rank: 3,
        gapToBIC: -1,
        calculationVersion: 'legacy_v1',
        planningHorizon: null,
      },
    ]);
  });

  // -----------------------------------------------------------------------
  // 6. Determinism.
  // -----------------------------------------------------------------------
  it('6) same input twice gives an identical result, for both legacy_v1 and siri_pm_v2', () => {
    const inputs: SIRIPrioritisationInput[] = [
      { areaId: AREA_1, ams: 1, bic: 4, costRelevance: 1, costProfile: 2, kpiRelevance: 1, kpiImportance: 3 },
      { areaId: AREA_2, ams: 3, bic: 2, costRelevance: 0.5, costProfile: 4, kpiRelevance: 1, kpiImportance: 1 },
      { areaId: AREA_3, ams: 0, bic: 5, costRelevance: 1, costProfile: 1, kpiRelevance: 1, kpiImportance: 1 },
    ];

    expect(rankByImpactValue(inputs)).toEqual(rankByImpactValue(inputs));
    expect(rankByImpactValueV2(inputs, 'tactical')).toEqual(rankByImpactValueV2(inputs, 'tactical'));
  });

  // -----------------------------------------------------------------------
  // 7. No input mutation.
  // -----------------------------------------------------------------------
  it('7) neither calculateImpactValue, rankByImpactValue, nor rankByImpactValueV2 mutate their input', () => {
    const inputs: SIRIPrioritisationInput[] = [
      { areaId: AREA_1, ams: 1, bic: 4, costRelevance: 1, costProfile: 2, kpiRelevance: 1, kpiImportance: 3 },
      { areaId: AREA_2, ams: 3, bic: 2, costRelevance: 0.5, costProfile: 4, kpiRelevance: 1, kpiImportance: 1 },
    ];
    const before = deepClone(inputs);

    calculateImpactValue(inputs[0]);
    rankByImpactValue(deepClone(inputs));
    rankByImpactValueV2(deepClone(inputs), 'strategic');
    // Also exercise the actual `inputs` array/objects directly (not a
    // clone) through both ranking functions, to catch mutation of the
    // exact objects the caller passed in.
    rankByImpactValue(inputs);
    rankByImpactValueV2(inputs, 'operational');

    expect(inputs).toEqual(before);
  });

  // -----------------------------------------------------------------------
  // 8. Traceability.
  // -----------------------------------------------------------------------
  it('8) every result carries calculationVersion; v2 results never claim legacy_v1 and vice versa', () => {
    const inputs: SIRIPrioritisationInput[] = [
      { areaId: AREA_1, ams: 1, bic: 4, costRelevance: 1, costProfile: 2, kpiRelevance: 1, kpiImportance: 3 },
      { areaId: AREA_2, ams: 3, bic: 2, costRelevance: 0.5, costProfile: 4, kpiRelevance: 1, kpiImportance: 1 },
    ];

    const legacy = rankByImpactValue(inputs);
    for (const r of legacy) {
      expect(r.calculationVersion).toBe('legacy_v1');
      expect(r.calculationVersion).not.toBe('siri_pm_v2');
      expect(r.planningHorizon).toBeNull();
    }

    for (const horizon of Object.keys(SIRI_PM_WEIGHT_PRESETS) as Array<
      keyof typeof SIRI_PM_WEIGHT_PRESETS
    >) {
      const v2 = rankByImpactValueV2(inputs, horizon);
      for (const r of v2) {
        expect(r.calculationVersion).toBe('siri_pm_v2');
        expect(r.calculationVersion).not.toBe('legacy_v1');
        expect(r.planningHorizon).toBe(horizon);
      }
    }
  });

  // -----------------------------------------------------------------------
  // 9. Default path (no explicit version, no flag) = legacy_v1.
  //    (ZAKAZ CICHEJ ZMIANY — asserted at the adapter level, the only place
  //    the SIRI_PM_V2 flag is actually read.)
  // -----------------------------------------------------------------------
  describe('adapter default (no flag, no explicit calculationVersion)', () => {
    afterEach(() => {
      window.localStorage.removeItem(SIRI_PM_V2_FLAG_KEYS.localStorage);
    });

    function frozenInput(planningHorizon: string): PrioritisationInput {
      const frozenUnitLevels: Record<string, number> = {};
      SIRI_PRIORITISATION_AREAS.forEach((area, i) => {
        frozenUnitLevels[area.id] = i % 6;
      });
      return {
        frozenUnitLevels,
        parameters: {
          sessionState: 'frozen',
          frozenSnapshotId: 'snap-coord08-v2-test',
          planningHorizon,
        },
      };
    }

    it('9) prioritise() defaults to legacy_v1 when the flag is untouched and no calculationVersion is passed', () => {
      window.localStorage.removeItem(SIRI_PM_V2_FLAG_KEYS.localStorage);
      const result = siriAdapter.prioritise!(frozenInput('strategic'));
      expect(result.calculationVersion).toBe('legacy_v1');
      expect(result.parametersVersion).toBe('siri-pm-v1:strategic');
    });

    it('flipping the SIRI_PM_V2 localStorage flag ON switches the default to siri_pm_v2', () => {
      window.localStorage.setItem(SIRI_PM_V2_FLAG_KEYS.localStorage, '1');
      const result = siriAdapter.prioritise!(frozenInput('tactical'));
      expect(result.calculationVersion).toBe('siri_pm_v2');
      expect(result.parametersVersion).toBe('siri-pm-v2:tactical');
    });

    it('an explicit calculationVersion always overrides the flag', () => {
      window.localStorage.setItem(SIRI_PM_V2_FLAG_KEYS.localStorage, '1');
      const result = siriAdapter.prioritise!({
        ...frozenInput('operational'),
        parameters: {
          ...frozenInput('operational').parameters,
          calculationVersion: 'legacy_v1',
        },
      });
      expect(result.calculationVersion).toBe('legacy_v1');
    });
  });

  // -----------------------------------------------------------------------
  // 10. Step 8 — siri_pm_v2 still guarantees >=1 focus per building block
  //     (3) + 1 bonus from the remaining 13 = 4 total, via the adapter.
  // -----------------------------------------------------------------------
  it('10) siri_pm_v2 prioritise() selects exactly one focus per building block plus one bonus (3 + 1 = 4)', () => {
    const frozenUnitLevels: Record<string, number> = {};
    SIRI_PRIORITISATION_AREAS.forEach((area, i) => {
      frozenUnitLevels[area.id] = (i * 2) % 6;
    });

    const input: PrioritisationInput = {
      frozenUnitLevels,
      parameters: {
        sessionState: 'frozen',
        frozenSnapshotId: 'snap-coord08-step8',
        planningHorizon: 'strategic',
        calculationVersion: 'siri_pm_v2',
      },
    };

    const result = siriAdapter.prioritise!(input);
    expect(result.calculationVersion).toBe('siri_pm_v2');
    expect(result.rankedUnitIds).toHaveLength(16);

    const focusIds = Object.entries(result.rationaleByUnitId)
      .filter(([, rationale]) => rationale.startsWith('SELECTED_FOCUS'))
      .map(([id]) => id);

    expect(focusIds).toHaveLength(4); // 1 per building block (3) + 1 bonus

    const buildingBlockByAreaId = new Map(
      SIRI_PRIORITISATION_AREAS.map((a) => [a.id, a.buildingBlock])
    );
    const focusBlocks = new Set(focusIds.map((id) => buildingBlockByAreaId.get(id)));
    expect(focusBlocks.has('PROCESS')).toBe(true);
    expect(focusBlocks.has('TECHNOLOGY')).toBe(true);
    expect(focusBlocks.has('ORGANIZATION')).toBe(true);
  });
});
