import { describe, expect, it } from 'vitest';

import { resolveFinanceDetailBranches, toFinanceResolveInput } from '../FinanceHub';
import type { FinanceKind, PredictionType } from '../financeTypes';

const on = { baseline: true, prediction: true, analysis: true, valuation: true };

const validRows = [
  ['statements', undefined, 'STATEMENT_PACK', null],
  ['models', undefined, 'BASELINE_MODEL', 'openV3Baseline'],
  ['analysis', undefined, 'HISTORICAL_ANALYSIS', 'openV3Analysis'],
  ['prediction', 'model', 'PREDICTION_SCENARIO', 'openV3Prediction'],
  ['valuation', undefined, 'VALUATION_CASE', 'openV3Valuation'],
] as const;

describe('Finance detail identity gate', () => {
  it.each([
    [
      { canonicalArtifactType: 'BASELINE_MODEL', canonicalArtifactId: 'a' },
      'MISSING_BUSINESS_VERSION_ID',
    ],
    [
      { canonicalArtifactType: 'BASELINE_MODEL', canonicalBusinessVersionId: 'v' },
      'MISSING_ARTIFACT_ID',
    ],
    [{ canonicalArtifactId: 'a', canonicalBusinessVersionId: 'v' }, 'UNKNOWN_ARTIFACT_TYPE'],
  ] as const)('preserves partial row identity for fail-closed resolution %#', (row, expected) => {
    const identity = toFinanceResolveInput(row);
    expect(identity).toBeDefined();
    expect(resolveFinanceDetailBranches('models', undefined, on, identity).resolutionError).toBe(
      expected
    );
  });

  it('keeps a row with no canonical signal on the legacy path', () => {
    expect(toFinanceResolveInput({ id: 'legacy-1' })).toBeUndefined();
  });

  it.each(validRows)(
    'permits matching %s / %s identity',
    (kind, predictionType, artifactType, branch) => {
      const result = resolveFinanceDetailBranches(kind, predictionType, on, {
        artifactId: 'artifact-1',
        businessVersionId: 'version-1',
        artifactType,
        legacyId: 'legacy-1',
      });

      expect(result.resolutionError).toBeNull();
      if (branch) expect(result[branch]).toBe(true);
    }
  );

  it.each([
    [
      { artifactId: '', businessVersionId: 'v', artifactType: 'BASELINE_MODEL' },
      'MISSING_ARTIFACT_ID',
    ],
    [
      { artifactId: 'a', businessVersionId: '', artifactType: 'BASELINE_MODEL' },
      'MISSING_BUSINESS_VERSION_ID',
    ],
    [
      { artifactId: 'same', businessVersionId: 'same', artifactType: 'BASELINE_MODEL' },
      'ID_COLLISION',
    ],
    [{ artifactId: 'a', businessVersionId: 'v', artifactType: 'ALIEN' }, 'UNKNOWN_ARTIFACT_TYPE'],
  ] as const)('blocks resolver error %#', (identity, expected) => {
    const result = resolveFinanceDetailBranches('models', undefined, on, identity);
    expect(result.resolutionError).toBe(expected);
    expect(result.openFinanceV3).toBe(false);
  });

  it.each([
    ['models', undefined, 'HISTORICAL_ANALYSIS'],
    ['analysis', undefined, 'VALUATION_CASE'],
    ['prediction', 'model', 'BASELINE_MODEL'],
    ['valuation', undefined, 'PREDICTION_SCENARIO'],
  ] as const)('blocks kind/type mismatch for %s', (kind, predictionType, artifactType) => {
    const result = resolveFinanceDetailBranches(
      kind as FinanceKind,
      predictionType as PredictionType | undefined,
      on,
      { artifactId: 'a', businessVersionId: 'v', artifactType }
    );
    expect(result.resolutionError).toBe('IDENTITY_MISMATCH');
    expect(result.openFinanceV3).toBe(false);
  });
});
