import { describe, expect, it } from 'vitest';

import {
  buildCanonicalFinanceSearchParams,
  clearCanonicalFinanceSearchParams,
  hasAnyCanonicalFinanceQuery,
  isCanonicalFinanceTypeEnabled,
  resolveCanonicalFinanceQueryOutcome,
  resolveFinanceDetailBranches,
  toFinanceResolveInput,
} from '../FinanceHub';
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
    ['STATEMENT_PACK', 'statementPack'],
    ['BASELINE_MODEL', 'baseline'],
    ['HISTORICAL_ANALYSIS', 'analysis'],
    ['PREDICTION_SCENARIO', 'prediction'],
    ['VALUATION_CASE', 'valuation'],
  ] as const)('routes complete %s identity by its own cutover flag', (artifactType, flag) => {
    const off = {
      statementPack: false,
      baseline: false,
      analysis: false,
      prediction: false,
      valuation: false,
    };
    expect(isCanonicalFinanceTypeEnabled(artifactType, off)).toBe(false);
    expect(isCanonicalFinanceTypeEnabled(artifactType, { ...off, [flag]: true })).toBe(true);
  });

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

  it('clears stale canonical query keys before composing a partial row identity', () => {
    const stale = new URLSearchParams(
      'canonicalArtifactType=VALUATION_CASE&canonicalArtifactId=old-a&canonicalBusinessVersionId=old-v'
    );
    const next = buildCanonicalFinanceSearchParams(stale, {
      artifactType: 'BASELINE_MODEL',
      artifactId: 'new-a',
      businessVersionId: undefined,
    });
    expect(next.toString()).toBe('canonicalArtifactType=BASELINE_MODEL&canonicalArtifactId=new-a');
  });

  it('clears every stale canonical key before a complete flag-off row opens legacy', () => {
    const stale = new URLSearchParams(
      'tab=models&canonicalArtifactType=VALUATION_CASE&canonicalArtifactId=old-a&canonicalBusinessVersionId=old-v'
    );
    expect(clearCanonicalFinanceSearchParams(stale).toString()).toBe('tab=models');
  });

  it.each([
    'canonicalArtifactType=BASELINE_MODEL&canonicalArtifactId=a',
    'canonicalArtifactType=BASELINE_MODEL&canonicalBusinessVersionId=v',
    'canonicalArtifactId=a&canonicalBusinessVersionId=v',
    'canonicalArtifactType=ALIEN&canonicalArtifactId=a&canonicalBusinessVersionId=v',
  ])('selects the fail-closed full view for any canonical query signal: %s', (query) => {
    expect(hasAnyCanonicalFinanceQuery(new URLSearchParams(query))).toBe(true);
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

  // FIX-4 (2026-08-25 odbiór dnia 4): a COMPLETE, recognized canonical*
  // identity whose own v3 flag is OFF used to fall through `fullView` to
  // `if (!activeDocumentId || !activeDocument) return null` — a blank
  // screen, because a canonical-only deep link never has a legacy
  // activeDocument. `resolveCanonicalFinanceQueryOutcome` is the extracted
  // decision this render branch is built on now; `clear-stale` is the new
  // outcome the caller uses to skip `fullView` and fall through to the
  // list instead (see the `useEffect` next to it in FinanceHub.tsx that
  // strips the stale query so the URL matches what's on screen).
  describe('resolveCanonicalFinanceQueryOutcome (FIX-4)', () => {
    const allOff = {
      statementPack: false,
      baseline: false,
      analysis: false,
      prediction: false,
      valuation: false,
    };

    it('is "none" when no canonical query is present', () => {
      expect(resolveCanonicalFinanceQueryOutcome(new URLSearchParams('tab=models'), allOff)).toEqual(
        { kind: 'none' }
      );
    });

    it('is "clear-stale" for a complete, recognized identity whose flag is OFF', () => {
      const params = new URLSearchParams(
        'canonicalArtifactType=BASELINE_MODEL&canonicalArtifactId=a&canonicalBusinessVersionId=v'
      );
      expect(resolveCanonicalFinanceQueryOutcome(params, allOff)).toEqual({ kind: 'clear-stale' });
    });

    it('is "direct-workspace" for the same complete identity once its flag is ON', () => {
      const params = new URLSearchParams(
        'canonicalArtifactType=BASELINE_MODEL&canonicalArtifactId=a&canonicalBusinessVersionId=v'
      );
      expect(resolveCanonicalFinanceQueryOutcome(params, { ...allOff, baseline: true })).toEqual({
        kind: 'direct-workspace',
        artifactId: 'a',
        businessVersionId: 'v',
        artifactType: 'BASELINE_MODEL',
      });
    });

    it.each([
      ['canonicalArtifactType=BASELINE_MODEL&canonicalArtifactId=a', 'incomplete (missing version)'],
      [
        'canonicalArtifactType=ALIEN&canonicalArtifactId=a&canonicalBusinessVersionId=v',
        'unrecognized type',
      ],
    ])('is still "direct-workspace" (never a blank screen) when %s: %s', (query) => {
      const outcome = resolveCanonicalFinanceQueryOutcome(new URLSearchParams(query), allOff);
      expect(outcome.kind).toBe('direct-workspace');
    });
  });

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
