import { describe, expect, it } from 'vitest';

import {
  AVOID_EXPOSURE_THRESHOLD,
  buildRiskMatrix,
  buildRiskMatrixPromptRules,
  classifyRiskZone,
  exposureBand,
  RISK_MATRIX_ZONES,
  RISK_ZONE_META,
  recommendedStrategy,
} from '../../src/config/riskuncertainty';
import type { RiskItem, RiskUncertaintyData } from '../../src/store/useToolStore';

const risk = (id: string, overrides: Partial<RiskItem> = {}): RiskItem => ({
  id,
  title: `Risk ${id}`,
  description: 'desc',
  probability: 3,
  impact: 3,
  mitigation: '',
  evidence: [],
  ...overrides,
});

const buildData = (parts: Partial<RiskUncertaintyData> = {}): RiskUncertaintyData =>
  ({
    context: { goal: 'g', scope: 'company', timeframe: 'medium', successSignal: 's' },
    signals: [],
    assumptions: parts.assumptions || [],
    risks: parts.risks || [],
    scenarios: parts.scenarios || [],
    recommendedMoves: [],
    outputCandidates: [],
  }) as RiskUncertaintyData;

describe('Risk matrix — 2x2 zone classification', () => {
  it('places each probability x impact pair in the canonical zone (midpoint = high)', () => {
    expect(classifyRiskZone(5, 5)).toBe('act-now');
    expect(classifyRiskZone(3, 3)).toBe('act-now'); // fence biases to attention
    expect(classifyRiskZone(1, 5)).toBe('contingency');
    expect(classifyRiskZone(5, 1)).toBe('manage');
    expect(classifyRiskZone(1, 1)).toBe('accept');
  });

  it('exposes all four zones with a default response strategy each', () => {
    expect(RISK_MATRIX_ZONES).toEqual(['act-now', 'contingency', 'manage', 'accept']);
    expect(RISK_ZONE_META['act-now'].defaultStrategy).toBe('mitigate');
    expect(RISK_ZONE_META.contingency.defaultStrategy).toBe('transfer');
    expect(RISK_ZONE_META.manage.defaultStrategy).toBe('mitigate');
    expect(RISK_ZONE_META.accept.defaultStrategy).toBe('accept');
  });

  it('escalates act-now from mitigate to avoid only at extreme exposure', () => {
    expect(recommendedStrategy('act-now', 12)).toBe('mitigate');
    expect(recommendedStrategy('act-now', AVOID_EXPOSURE_THRESHOLD)).toBe('avoid');
    expect(recommendedStrategy('act-now', 25)).toBe('avoid');
    // other zones never escalate on exposure
    expect(recommendedStrategy('contingency', 25)).toBe('transfer');
    expect(recommendedStrategy('accept', 1)).toBe('accept');
  });

  it('bands exposure into four severity levels', () => {
    expect(exposureBand(25)).toBe('critical');
    expect(exposureBand(15)).toBe('critical');
    expect(exposureBand(12)).toBe('high');
    expect(exposureBand(8)).toBe('high');
    expect(exposureBand(4)).toBe('medium');
    expect(exposureBand(2)).toBe('low');
  });
});

describe('Risk matrix — full build', () => {
  it('classifies accepted risks, ranks by exposure and groups into cells', () => {
    const matrix = buildRiskMatrix(
      buildData({
        risks: [
          risk('r1', { probability: 5, impact: 5, evidence: ['x'] }), // act-now, exp 25
          risk('r2', { probability: 1, impact: 5 }), // contingency, exp 5
          risk('r3', { probability: 5, impact: 1 }), // manage, exp 5
          risk('r4', { probability: 1, impact: 1 }), // accept, exp 1
          risk('r5', { probability: 3, impact: 5, proposalStatus: 'rejected' }), // excluded
        ],
      })
    );
    // r5 rejected → excluded
    expect(matrix.ranked.map((r) => r.id)).not.toContain('r5');
    // highest exposure first
    expect(matrix.ranked[0].id).toBe('r1');
    expect(matrix.cells['act-now'].map((r) => r.id)).toEqual(['r1']);
    expect(matrix.cells.contingency.map((r) => r.id)).toEqual(['r2']);
    expect(matrix.cells.manage.map((r) => r.id)).toEqual(['r3']);
    expect(matrix.cells.accept.map((r) => r.id)).toEqual(['r4']);
    // response map is one entry per classified risk
    expect(matrix.responseMap).toHaveLength(4);
    const top = matrix.responseMap[0];
    expect(top.riskId).toBe('r1');
    expect(top.recommendedStrategy).toBe('avoid'); // exposure 25 → escalated
  });

  it('counts a response gap only in urgent zones lacking a full response', () => {
    const matrix = buildRiskMatrix(
      buildData({
        risks: [
          // act-now, no owner/trigger → response gap
          risk('r1', { probability: 4, impact: 4, mitigation: 'plan' }),
          // act-now, fully responded → no gap
          risk('r2', {
            probability: 4,
            impact: 4,
            mitigation: 'plan',
            owner: 'Ops',
            trigger: 'lead time > 6w',
          }),
          // accept zone, no response → NOT a gap (low/low is fine to accept)
          risk('r3', { probability: 1, impact: 1 }),
        ],
      })
    );
    expect(matrix.responseGapCount).toBe(1);
    expect(matrix.responseMap.find((m) => m.riskId === 'r1')!.responseGap).toBe(true);
    expect(matrix.responseMap.find((m) => m.riskId === 'r2')!.responseGap).toBe(false);
    expect(matrix.responseMap.find((m) => m.riskId === 'r3')!.responseGap).toBe(false);
  });

  it('returns a helpful rationale for an empty session', () => {
    const matrix = buildRiskMatrix(buildData({}));
    expect(matrix.ranked).toHaveLength(0);
    expect(matrix.responseMap).toHaveLength(0);
    expect(matrix.rationale.en).toContain('No accepted risks');
    expect(matrix.rationale.pl).toContain('Brak zaakceptowanych ryzyk');
  });

  it('prompt rules name all four zones in both languages', () => {
    const en = buildRiskMatrixPromptRules('en');
    const pl = buildRiskMatrixPromptRules('pl');
    ['act-now', 'contingency', 'manage', 'accept'].forEach((z) => {
      expect(en).toContain(z);
      expect(pl).toContain(z);
    });
    expect(en).toContain('MITIGATE');
    expect(pl).toContain('ŁAGODŹ');
  });
});
