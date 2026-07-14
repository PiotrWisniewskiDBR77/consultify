import { describe, expect, it } from 'vitest';

import {
  assessRiskEvidence,
  buildRiskStaircasePromptRules,
  classifyEpistemicType,
  epistemicGuidance,
  RISK_STAIRCASE_RUNGS,
  RISK_INSIGHT_STAIRCASE,
  textMakesQuantifiedClaim,
  textSignalsDeepUncertainty,
  validateAssumptionEvidence,
  validateRiskEvidence,
} from '../../src/config/riskuncertainty';
import type { RiskAssumption, RiskItem, RiskUncertaintyData } from '../../src/store/useToolStore';

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

const assumption = (id: string, overrides: Partial<RiskAssumption> = {}): RiskAssumption => ({
  id,
  text: `Assumption ${id}`,
  confidence: 3,
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

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

describe('Risk insight staircase — structure', () => {
  it('defines a fact -> interpretation -> implication staircase, bilingual', () => {
    expect(RISK_STAIRCASE_RUNGS).toEqual(['fact', 'interpretation', 'implication']);
    expect(RISK_INSIGHT_STAIRCASE.map((r) => r.id)).toEqual(RISK_STAIRCASE_RUNGS);
    RISK_INSIGHT_STAIRCASE.forEach((rung) => {
      expect(rung.label.pl).not.toEqual(rung.label.en);
      expect(rung.prompt.pl.trim().length).toBeGreaterThan(0);
      expect(rung.prompt.en.trim().length).toBeGreaterThan(0);
    });
  });
});

describe('Risk vs uncertainty — Knight distinction', () => {
  it('classifies an evidenced, nameable event as a known-unknown', () => {
    expect(classifyEpistemicType({ text: 'Anchor supplier fails in Q3', evidence: ['data'] })).toBe(
      'known-unknown'
    );
  });

  it('classifies unevidenced deep-uncertainty language as an unknown-unknown', () => {
    expect(textSignalsDeepUncertainty('an unprecedented, first-of-its-kind regulatory shift')).toBe(
      true
    );
    expect(classifyEpistemicType({ text: 'an unprecedented regulatory shift', evidence: [] })).toBe(
      'unknown-unknown'
    );
  });

  it('treats unevidenced low-confidence guesses as unknown-unknowns', () => {
    expect(
      classifyEpistemicType({ text: 'demand may collapse', evidence: [], confidence: 1 })
    ).toBe('unknown-unknown');
  });

  it('honours an explicit declaredType override', () => {
    expect(
      classifyEpistemicType({ text: 'anything', evidence: [], declaredType: 'known-unknown' })
    ).toBe('known-unknown');
  });

  it('gives opposite guidance for the two types', () => {
    expect(epistemicGuidance('known-unknown').en).toContain('probability');
    expect(epistemicGuidance('unknown-unknown').en).toContain('robustness');
  });
});

describe('Invented-number guard — per risk', () => {
  it('flags a high-exposure score that rests on no evidence', () => {
    const issues = validateRiskEvidence(
      risk('r1', { probability: 4, impact: 2, description: 'Supplier delay', evidence: [] })
    ); // exposure 8, no evidence, not framed as assumption
    expect(codes(issues)).toContain('score-without-evidence');
  });

  it('does NOT flag a score that carries evidence', () => {
    const issues = validateRiskEvidence(
      risk('r1', {
        probability: 5,
        impact: 5,
        description: 'Anchor supplier fails',
        evidence: ['interview'],
        trigger: 'lead time > 6w',
      })
    );
    expect(codes(issues)).not.toContain('score-without-evidence');
    expect(codes(issues)).not.toContain('invented-number');
  });

  it('does NOT flag an unbacked score explicitly framed as an assumption', () => {
    const issues = validateRiskEvidence(
      risk('r1', {
        probability: 4,
        impact: 2,
        description: 'We assume the supplier holds',
        evidence: [],
      })
    );
    expect(codes(issues)).not.toContain('score-without-evidence');
  });

  it('flags a quantified claim in the text with no source', () => {
    const issues = validateRiskEvidence(
      risk('r1', { probability: 2, impact: 2, description: 'could cost us €2M', evidence: [] })
    );
    expect(codes(issues)).toContain('invented-number');
  });

  it('flags false precision: a deep-uncertainty item carrying a high probability', () => {
    const issues = validateRiskEvidence(
      risk('r1', {
        probability: 4,
        impact: 1, // exposure 4 → isolates false-precision from score-without-evidence
        description: 'an unprecedented, first-of-its-kind market shock',
        evidence: [],
      })
    );
    expect(codes(issues)).toContain('false-precision-uncertainty');
    expect(codes(issues)).not.toContain('score-without-evidence');
  });

  it('flags a high-exposure risk with no early-warning trigger', () => {
    const issues = validateRiskEvidence(
      risk('r1', { probability: 4, impact: 4, evidence: ['x'] }) // exposure 16, no trigger
    );
    expect(codes(issues)).toContain('missing-trigger-high-exposure');
  });
});

describe('Evidence discipline — assumptions & rollup', () => {
  it('flags a fragile assumption with no evidence and no validation method', () => {
    const issues = validateAssumptionEvidence(assumption('a1', { confidence: 1 }));
    expect(codes(issues)).toContain('no-validation-fragile-assumption');
  });

  it('does not flag a fragile assumption that names a validation method', () => {
    const issues = validateAssumptionEvidence(
      assumption('a1', { confidence: 1, validationMethod: 'paid pilot with 3 accounts' })
    );
    expect(issues).toHaveLength(0);
  });

  it('rolls up counts and excludes rejected items', () => {
    const report = assessRiskEvidence(
      buildData({
        risks: [
          risk('r1', { probability: 4, impact: 2, description: 'Supplier delay', evidence: [] }), // unbacked
          risk('r2', {
            probability: 4,
            impact: 1,
            description: 'unprecedented black swan',
            evidence: [],
          }), // unknown-unknown, false precision
          risk('r3', { probability: 5, impact: 5, evidence: ['x'], proposalStatus: 'rejected' }), // excluded
        ],
      })
    );
    expect(report.unbackedScores).toBeGreaterThanOrEqual(1);
    expect(report.falsePrecision).toBeGreaterThanOrEqual(1);
    expect(report.unknownUnknowns).toBeGreaterThanOrEqual(1);
    expect(report.knownUnknowns).toBeGreaterThanOrEqual(1);
    // rejected r3 never contributes an issue
    expect(report.issues.every((i) => i.itemId !== 'r3')).toBe(true);
    expect(report.ok).toBe(false);
  });

  it('reports ok for a clean, fully-evidenced session', () => {
    const report = assessRiskEvidence(
      buildData({
        risks: [
          risk('r1', {
            probability: 3,
            impact: 3,
            description: 'Anchor supplier fails',
            evidence: ['interview'],
            trigger: 'lead time > 6w',
          }),
        ],
        assumptions: [assumption('a1', { confidence: 4 })],
      })
    );
    expect(report.ok).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it('quantified-claim + deep-uncertainty detectors behave', () => {
    expect(textMakesQuantifiedClaim('50% chance of a €2M loss')).toBe(true);
    expect(textMakesQuantifiedClaim('a supplier delay')).toBe(false);
    expect(buildRiskStaircasePromptRules('pl')).toContain('FAKT');
    expect(buildRiskStaircasePromptRules('en')).toContain('FACT');
  });
});
