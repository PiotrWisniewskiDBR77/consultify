/**
 * `resolveFinanceDetailBranches` — AP_MOUNT §B pure branch-selection logic.
 *
 * `FinanceHub.tsx`'s detail view (`fullView` useMemo) is a page-level React
 * component with a large provider/hook dependency graph (routing, app store,
 * policy context, V8FinanceApi, translations, ...) that has NO existing test
 * harness in this repo (`find src/components/Economics -iname
 * '*FinanceHub*test*'` returns nothing). Rather than build a fragile,
 * expensive full-mount test to prove the branch-selection logic, that logic
 * was extracted into this pure function — the JSX destructures its return
 * value directly (not a parallel re-implementation), so this test exercises
 * the ACTUAL decision logic FinanceHub renders from.
 *
 * Proves the AP_MOUNT §B requirement "flaga OFF daje dokładnie dotychczasowy
 * runtime": with all four v3 flags OFF (the real production default), every
 * field this function returns is IDENTICAL to what the pre-AP_MOUNT inline
 * boolean block computed (verified against the literal pre-change source,
 * reproduced in the `LEGACY_EXPECTED` table below) — for every `FinanceKind`,
 * not just a sample. Also proves each flag independently controls only its
 * own kind (flipping the Baseline flag does not affect the Valuation branch
 * for a `valuation` row, etc.).
 */
import { describe, expect, it } from 'vitest';

import { resolveFinanceDetailBranches, type FinanceDetailBranchFlags } from '../FinanceHub';
import type { FinanceKind, PredictionType } from '../financeTypes';

const ALL_FLAGS_OFF: FinanceDetailBranchFlags = {
  baseline: false,
  prediction: false,
  analysis: false,
  valuation: false,
};

// Reproduces EXACTLY the boolean block that existed in `FinanceHub.tsx`
// before AP_MOUNT §B (git blame: `fullView` useMemo, pre `resolveFinanceDetailBranches`).
function legacyExpected(kind: FinanceKind, predictionType: PredictionType | undefined) {
  const isBudgetPrediction = kind === 'prediction' && predictionType === 'budget';
  const openStatement = kind === 'statements';
  const isModelWorkspace = kind === 'models' || (kind === 'prediction' && predictionType === 'model');
  const openAnalysis = kind === 'analysis' || kind === 'investment';
  const openValuation = kind === 'valuation';
  const needsFullHeight = openStatement || isModelWorkspace || openAnalysis || isBudgetPrediction || openValuation;
  return { isBudgetPrediction, openStatement, isModelWorkspace, openAnalysis, openValuation, needsFullHeight };
}

const ALL_KINDS: { kind: FinanceKind; predictionType?: PredictionType }[] = [
  { kind: 'statements' },
  { kind: 'models' },
  { kind: 'analysis' },
  { kind: 'investment' },
  { kind: 'prediction', predictionType: 'model' },
  { kind: 'prediction', predictionType: 'budget' },
  { kind: 'valuation' },
];

describe('resolveFinanceDetailBranches — AP_MOUNT §B', () => {
  describe('flags all OFF (real production default) — byte-identical to pre-AP_MOUNT legacy logic', () => {
    it.each(ALL_KINDS)('kind=$kind predictionType=$predictionType', ({ kind, predictionType }) => {
      const result = resolveFinanceDetailBranches(kind, predictionType, ALL_FLAGS_OFF);
      const legacy = legacyExpected(kind, predictionType);

      expect(result.isBudgetPrediction).toBe(legacy.isBudgetPrediction);
      expect(result.openStatement).toBe(legacy.openStatement);
      expect(result.isModelWorkspace).toBe(legacy.isModelWorkspace);
      expect(result.openAnalysis).toBe(legacy.openAnalysis);
      expect(result.openValuation).toBe(legacy.openValuation);
      expect(result.needsFullHeight).toBe(legacy.needsFullHeight);

      // The four NEW fields must all be false at OFF — this is what makes
      // FinanceHub's ternary chain fall through to the legacy branches.
      expect(result.openV3Baseline).toBe(false);
      expect(result.openV3Prediction).toBe(false);
      expect(result.openV3Analysis).toBe(false);
      expect(result.openV3Valuation).toBe(false);
      expect(result.openFinanceV3).toBe(false);
    });
  });

  describe('each flag ON only affects its own kind (no cross-talk)', () => {
    it('Baseline flag ON + kind=models -> openV3Baseline true, others still false', () => {
      const r = resolveFinanceDetailBranches('models', undefined, { ...ALL_FLAGS_OFF, baseline: true });
      expect(r.openV3Baseline).toBe(true);
      expect(r.openFinanceV3).toBe(true);
      expect(r.openV3Prediction).toBe(false);
      expect(r.openV3Analysis).toBe(false);
      expect(r.openV3Valuation).toBe(false);
    });

    it('Baseline flag ON + kind=valuation -> no v3 branch active (flag only gates its own kind)', () => {
      const r = resolveFinanceDetailBranches('valuation', undefined, { ...ALL_FLAGS_OFF, baseline: true });
      expect(r.openV3Baseline).toBe(false);
      expect(r.openFinanceV3).toBe(false);
      expect(r.openValuation).toBe(true); // legacy valuation branch still selected
    });

    it('Prediction flag ON + kind=prediction, predictionType=model -> openV3Prediction true', () => {
      const r = resolveFinanceDetailBranches('prediction', 'model', { ...ALL_FLAGS_OFF, prediction: true });
      expect(r.openV3Prediction).toBe(true);
      expect(r.openFinanceV3).toBe(true);
    });

    it('Prediction flag ON + kind=prediction, predictionType=budget -> v3 does NOT hijack the budget branch', () => {
      const r = resolveFinanceDetailBranches('prediction', 'budget', { ...ALL_FLAGS_OFF, prediction: true });
      expect(r.openV3Prediction).toBe(false);
      expect(r.isBudgetPrediction).toBe(true);
      expect(r.openFinanceV3).toBe(false);
    });

    it('Analysis flag ON + kind=analysis -> openV3Analysis true', () => {
      const r = resolveFinanceDetailBranches('analysis', undefined, { ...ALL_FLAGS_OFF, analysis: true });
      expect(r.openV3Analysis).toBe(true);
      expect(r.openFinanceV3).toBe(true);
    });

    it('Analysis flag ON + kind=investment -> openV3Analysis true (investment shares the analysis branch)', () => {
      const r = resolveFinanceDetailBranches('investment', undefined, { ...ALL_FLAGS_OFF, analysis: true });
      expect(r.openV3Analysis).toBe(true);
    });

    it('Valuation flag ON + kind=valuation -> openV3Valuation true', () => {
      const r = resolveFinanceDetailBranches('valuation', undefined, { ...ALL_FLAGS_OFF, valuation: true });
      expect(r.openV3Valuation).toBe(true);
      expect(r.openFinanceV3).toBe(true);
    });
  });

  it('KONTROLA NEGATYWNA: this test file actually distinguishes v3-on from v3-off (sanity — a vacuously-true assertion would pass both ways)', () => {
    const off = resolveFinanceDetailBranches('models', undefined, ALL_FLAGS_OFF);
    const on = resolveFinanceDetailBranches('models', undefined, { ...ALL_FLAGS_OFF, baseline: true });
    expect(off.openV3Baseline).not.toBe(on.openV3Baseline);
  });
});
