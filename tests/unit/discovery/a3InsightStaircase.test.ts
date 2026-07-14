import { describe, expect, it } from 'vitest';

import {
  buildA3StaircasePromptRules,
  detectA3UmbrellaClaim,
  requiresA3Decomposition,
  validateA3InsightStaircase,
} from '@/config/a3problemsolving/a3InsightStaircase';

describe('a3InsightStaircase — umbrella claim detection', () => {
  it('detects umbrella terms in PL and EN and returns bilingual labels', () => {
    expect(detectA3UmbrellaClaim('recurring quality issues on line 2')?.labelEn).toBe('quality');
    expect(detectA3UmbrellaClaim('problemy z jakością na linii 2')?.labelPl).toBe('jakość');
    expect(detectA3UmbrellaClaim('root cause is human error')?.labelEn).toBe('human error');
  });

  it('returns null for a concrete, decomposed claim', () => {
    expect(detectA3UmbrellaClaim('fixture bolt torque drifts below 12Nm after 200 cycles')).toBeNull();
  });

  it('requiresA3Decomposition mirrors detection', () => {
    expect(requiresA3Decomposition('low efficiency in packing')).toBe(true);
    expect(requiresA3Decomposition('conveyor speed set to 0.4 m/s')).toBe(false);
  });
});

describe('a3InsightStaircase — validation', () => {
  const goodStaircase = {
    fact: 'Cycle time on station 4 is 42s vs 30s standard, measured over 3 shifts',
    factRefs: ['data-4'],
    interpretation: 'The bottleneck is downstream of the fixture change, not operator pace',
    implication: 'The countermeasure must target the fixture change, not retrain the operator',
  };

  it('accepts a complete fact -> interpretation -> implication with fact refs', () => {
    expect(
      validateA3InsightStaircase({
        text: 'fixture change adds 12s per unit',
        staircase: goodStaircase,
        evidenceStatus: 'confirmed',
      })
    ).toEqual([]);
  });

  it('flags a missing fact, interpretation and implication', () => {
    const issues = validateA3InsightStaircase({ text: 'something is wrong' });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('missing-fact');
    expect(codes).toContain('missing-interpretation');
    expect(codes).toContain('missing-implication');
  });

  it('flags a confirmed element that references no session evidence', () => {
    const issues = validateA3InsightStaircase({
      text: 'concrete claim',
      staircase: { ...goodStaircase, factRefs: [] },
      evidenceStatus: 'confirmed',
    });
    expect(issues.some((i) => i.code === 'missing-fact-refs')).toBe(true);
  });

  it('allows a declared element to have zero fact refs', () => {
    const issues = validateA3InsightStaircase({
      text: 'concrete claim',
      staircase: { ...goodStaircase, factRefs: [] },
      evidenceStatus: 'declared',
    });
    expect(issues.some((i) => i.code === 'missing-fact-refs')).toBe(false);
  });

  it('flags an interpretation that merely restates the fact', () => {
    const issues = validateA3InsightStaircase({
      text: 'claim',
      staircase: {
        fact: 'the queue backs up at 3pm every day',
        factRefs: ['x'],
        interpretation: 'the queue backs up at 3pm every day',
        implication: 'fix the schedule',
      },
    });
    expect(issues.some((i) => i.code === 'interpretation-is-restatement')).toBe(true);
  });

  it('demands decomposition for an umbrella claim with no decomposition', () => {
    const issues = validateA3InsightStaircase({
      text: 'quality issues in final assembly',
      staircase: goodStaircase,
    });
    expect(issues.some((i) => i.code === 'needs-decomposition')).toBe(true);
  });

  it('accepts an umbrella claim once it is decomposed into a dimension', () => {
    const issues = validateA3InsightStaircase({
      text: 'quality issues in final assembly',
      staircase: goodStaircase,
      decomposition: [{ dimension: 'process', finding: 'no standard torque check step' }],
      evidenceStatus: 'confirmed',
    });
    expect(issues.some((i) => i.code === 'needs-decomposition')).toBe(false);
  });
});

describe('a3InsightStaircase — prompt rules', () => {
  it('teaches the K1/K2/K3 contract and decomposition, differing by language', () => {
    const en = buildA3StaircasePromptRules('en');
    const pl = buildA3StaircasePromptRules('pl');
    expect(en).toContain('staircase.fact');
    expect(en).toContain('decomposition');
    expect(pl).toContain('drabinę wniosku');
    expect(pl).not.toEqual(en);
  });
});
