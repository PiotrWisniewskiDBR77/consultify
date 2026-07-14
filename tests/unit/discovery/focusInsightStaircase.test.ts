import { describe, expect, it } from 'vitest';

import {
  buildFocusStaircasePromptRules,
  FOCUS_DRIVER_LABELS,
  requiresDriver,
  validateFocusStaircase,
} from '../../../src/config/focustradeoffs/focusInsightStaircase';

describe('Focus & Trade-offs insight staircase — validation', () => {
  it('flags a completely empty staircase with all three missing-* issues', () => {
    const issues = validateFocusStaircase({ priorityId: 'a' });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('missing-fact');
    expect(codes).toContain('missing-interpretation');
    expect(codes).toContain('missing-implication');
  });

  it('flags missing-fact-refs when marked confirmed but no signal ids are cited', () => {
    const issues = validateFocusStaircase({
      priorityId: 'a',
      evidenceStatus: 'confirmed',
      staircase: {
        fact: 'Three customers asked for this in the last quarter.',
        factRefs: [],
        interpretation: 'This is demand pressure we cannot ignore given our capacity.',
        implication: 'Pursue, but sequence after the current commitment clears.',
      },
    });
    expect(issues.map((i) => i.code)).toContain('missing-fact-refs');
  });

  it('does NOT flag missing-fact-refs for a "declared" (not yet confirmed) priority', () => {
    const issues = validateFocusStaircase({
      priorityId: 'a',
      evidenceStatus: 'declared',
      staircase: {
        fact: 'The owner believes this matters.',
        factRefs: [],
        interpretation: 'Not yet backed by data, but plausible given the market.',
        implication: 'Needs an experiment before it can be a real pursue.',
      },
    });
    expect(issues.map((i) => i.code)).not.toContain('missing-fact-refs');
  });

  it('flags an interpretation that merely restates the fact', () => {
    const issues = validateFocusStaircase({
      priorityId: 'a',
      staircase: {
        fact: 'Three customers asked for this feature.',
        factRefs: ['s1'],
        interpretation: 'Three customers asked for this feature.',
        implication: 'Pursue given the demand signal.',
      },
    });
    expect(issues.map((i) => i.code)).toContain('interpretation-is-restatement');
  });

  it('requires a driver decomposition for a "pursue" recommendation', () => {
    const issues = validateFocusStaircase({
      priorityId: 'a',
      recommendation: 'pursue',
      staircase: {
        fact: 'Signed commitment from the largest account.',
        factRefs: ['s1'],
        interpretation: 'This protects the largest revenue relationship.',
        implication: 'Commit now, ahead of smaller asks.',
      },
      drivers: [],
    });
    expect(issues.map((i) => i.code)).toContain('recommendation-without-driver');
  });

  it('requires a driver decomposition for a "drop" recommendation too', () => {
    const issues = validateFocusStaircase({
      priorityId: 'a',
      recommendation: 'drop',
      staircase: {
        fact: 'No customer has asked for this in 18 months.',
        factRefs: ['s2'],
        interpretation: 'Low strategic fit and no demand signal.',
        implication: 'Drop and free the resource for the top priority.',
      },
      drivers: [],
    });
    expect(issues.map((i) => i.code)).toContain('recommendation-without-driver');
  });

  it('does NOT require a driver for a neutral "defer" recommendation', () => {
    const issues = validateFocusStaircase({
      priorityId: 'a',
      recommendation: 'defer',
      staircase: {
        fact: 'Depends on a platform migration not yet scheduled.',
        factRefs: ['s3'],
        interpretation: 'Cannot be executed well until the dependency clears.',
        implication: 'Defer with a re-entry trigger tied to the migration date.',
      },
      drivers: [],
    });
    expect(issues.map((i) => i.code)).not.toContain('recommendation-without-driver');
  });

  it('passes clean when a pursue recommendation names a driver and a full staircase', () => {
    const issues = validateFocusStaircase({
      priorityId: 'a',
      recommendation: 'pursue',
      evidenceStatus: 'confirmed',
      staircase: {
        fact: 'Signed commitment worth 20% of pipeline.',
        factRefs: ['s1'],
        interpretation: 'This is the single largest lever on this quarter"s number.',
        implication: 'Commit immediately, ahead of anything unproven.',
      },
      drivers: [{ dimension: 'evidence-strength', finding: 'Signed contract, not a forecast.' }],
    });
    expect(issues).toEqual([]);
  });

  it('requiresDriver is true only for pursue/drop, false for defer/undefined', () => {
    expect(requiresDriver('pursue')).toBe(true);
    expect(requiresDriver('drop')).toBe(true);
    expect(requiresDriver('defer')).toBe(false);
    expect(requiresDriver(undefined)).toBe(false);
  });
});

describe('Focus & Trade-offs insight staircase — driver labels + prompt rules', () => {
  it('has bilingual labels for every driver dimension', () => {
    (Object.keys(FOCUS_DRIVER_LABELS) as (keyof typeof FOCUS_DRIVER_LABELS)[]).forEach((dim) => {
      expect(FOCUS_DRIVER_LABELS[dim].en.length).toBeGreaterThan(0);
      expect(FOCUS_DRIVER_LABELS[dim].pl.length).toBeGreaterThan(0);
    });
  });

  it('buildFocusStaircasePromptRules returns distinct, non-empty PL/EN guidance', () => {
    const en = buildFocusStaircasePromptRules('en');
    const pl = buildFocusStaircasePromptRules('pl');
    expect(en).toContain('staircase.fact');
    expect(pl).toContain('staircase.fact');
    expect(en).toContain('drivers');
    expect(en).not.toEqual(pl);
  });
});
