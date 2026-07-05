import { describe, expect, it } from 'vitest';

import {
  buildPorterStaircasePromptRules,
  requiresDriver,
  validatePorterStaircase,
} from '@/config/porter/porterInsightStaircase';

const fullStaircase = {
  fact: 'Top rival holds 34% share vs our 12%; price spread across credible offers is 18%.',
  factRefs: ['signal-1'],
  interpretation: 'A 3x share gap lets the leader set the price we react to, capping our margin.',
  implication: 'We cannot win on price — the response must be a differentiated position, not a discount.',
};

describe('porterInsightStaircase — K1/K2/K3 discipline', () => {
  it('accepts a complete staircase for a low-intensity force with no drivers', () => {
    const issues = validatePorterStaircase({
      force: 'rivalry',
      intensity: 'low',
      staircase: fullStaircase,
      drivers: [],
      evidenceStatus: 'confirmed',
    });
    expect(issues).toEqual([]);
  });

  it('flags missing fact / interpretation / implication', () => {
    const issues = validatePorterStaircase({
      force: 'rivalry',
      staircase: { fact: '', factRefs: [], interpretation: '', implication: '' },
    });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('missing-fact');
    expect(codes).toContain('missing-interpretation');
    expect(codes).toContain('missing-implication');
  });

  it('flags a confirmed force with no session evidence refs', () => {
    const issues = validatePorterStaircase({
      force: 'buyerPower',
      intensity: 'low',
      staircase: { ...fullStaircase, factRefs: [] },
      evidenceStatus: 'confirmed',
    });
    expect(issues.map((i) => i.code)).toContain('missing-fact-refs');
  });

  it('does not require refs for a declared force', () => {
    const issues = validatePorterStaircase({
      force: 'buyerPower',
      intensity: 'low',
      staircase: { ...fullStaircase, factRefs: [] },
      evidenceStatus: 'declared',
    });
    expect(issues.map((i) => i.code)).not.toContain('missing-fact-refs');
  });

  it('flags an interpretation that merely restates the fact', () => {
    const issues = validatePorterStaircase({
      force: 'rivalry',
      intensity: 'low',
      staircase: {
        fact: 'The market is fragmented with many small players competing on price',
        factRefs: ['s1'],
        interpretation: 'the market is fragmented with many small players competing on price',
        implication: 'we should differentiate',
      },
    });
    expect(issues.map((i) => i.code)).toContain('interpretation-is-restatement');
  });
});

describe('porterInsightStaircase — intensity requires a structural driver', () => {
  it('requires a driver for a high force and rejects when none is named', () => {
    expect(requiresDriver('high')).toBe(true);
    expect(requiresDriver('medium')).toBe(true);
    expect(requiresDriver('low')).toBe(false);

    const issues = validatePorterStaircase({
      force: 'supplierPower',
      intensity: 'high',
      staircase: fullStaircase,
      drivers: [],
    });
    expect(issues.map((i) => i.code)).toContain('intensity-without-driver');
  });

  it('accepts a high force when a dominant driver is named', () => {
    const issues = validatePorterStaircase({
      force: 'supplierPower',
      intensity: 'high',
      staircase: fullStaircase,
      drivers: [{ dimension: 'concentration', finding: 'Single certified supplier for 40% of COGS.' }],
      evidenceStatus: 'confirmed',
    });
    expect(issues).toEqual([]);
  });
});

describe('porterInsightStaircase — prompt rules', () => {
  it('produces distinct bilingual staircase rules mentioning drivers', () => {
    const en = buildPorterStaircasePromptRules('en');
    const pl = buildPorterStaircasePromptRules('pl');
    expect(en).toContain('drivers');
    expect(en).toContain('concentration|switching-costs|barriers|scale-economics');
    expect(pl).toContain('sterownik');
    expect(en).not.toEqual(pl);
  });
});
