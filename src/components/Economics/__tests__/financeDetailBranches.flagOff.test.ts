import { describe, expect, it } from 'vitest';

import { resolveFinanceDetailBranches } from '../FinanceHub';
import type { FinanceKind, PredictionType } from '../financeTypes';

const flags = { baseline: false, prediction: false, analysis: false, valuation: false };
const rows: [FinanceKind, PredictionType | undefined, object][] = [
  [
    'statements',
    undefined,
    {
      isBudgetPrediction: false,
      openStatement: true,
      isModelWorkspace: false,
      openAnalysis: false,
      openValuation: false,
      openV3Baseline: false,
      openV3Prediction: false,
      openV3Analysis: false,
      openV3Valuation: false,
      openFinanceV3: false,
      needsFullHeight: true,
    },
  ],
  [
    'models',
    undefined,
    {
      isBudgetPrediction: false,
      openStatement: false,
      isModelWorkspace: true,
      openAnalysis: false,
      openValuation: false,
      openV3Baseline: false,
      openV3Prediction: false,
      openV3Analysis: false,
      openV3Valuation: false,
      openFinanceV3: false,
      needsFullHeight: true,
    },
  ],
  [
    'analysis',
    undefined,
    {
      isBudgetPrediction: false,
      openStatement: false,
      isModelWorkspace: false,
      openAnalysis: true,
      openValuation: false,
      openV3Baseline: false,
      openV3Prediction: false,
      openV3Analysis: false,
      openV3Valuation: false,
      openFinanceV3: false,
      needsFullHeight: true,
    },
  ],
  [
    'prediction',
    'model',
    {
      isBudgetPrediction: false,
      openStatement: false,
      isModelWorkspace: true,
      openAnalysis: false,
      openValuation: false,
      openV3Baseline: false,
      openV3Prediction: false,
      openV3Analysis: false,
      openV3Valuation: false,
      openFinanceV3: false,
      needsFullHeight: true,
    },
  ],
  [
    'prediction',
    'budget',
    {
      isBudgetPrediction: true,
      openStatement: false,
      isModelWorkspace: false,
      openAnalysis: false,
      openValuation: false,
      openV3Baseline: false,
      openV3Prediction: false,
      openV3Analysis: false,
      openV3Valuation: false,
      openFinanceV3: false,
      needsFullHeight: true,
    },
  ],
  [
    'valuation',
    undefined,
    {
      isBudgetPrediction: false,
      openStatement: false,
      isModelWorkspace: false,
      openAnalysis: false,
      openValuation: true,
      openV3Baseline: false,
      openV3Prediction: false,
      openV3Analysis: false,
      openV3Valuation: false,
      openFinanceV3: false,
      needsFullHeight: true,
    },
  ],
];

describe('Finance detail branches with every cutover flag OFF', () => {
  it.each(rows)('preserves legacy kind=%s predictionType=%s', (kind, predictionType, expected) => {
    expect(resolveFinanceDetailBranches(kind, predictionType, flags)).toEqual(expected);
  });
});
