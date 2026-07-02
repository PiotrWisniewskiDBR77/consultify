import { describe, expect, it } from 'vitest';

import {
  deterministicIndicatorNarrator,
  deriveTrend,
  periodsToThreshold,
  weakestConfidence,
  type IndicatorFacts,
} from '../../../server/src/services/financeConclusionService.ts';

const org = { name: 'Testowa Sp. z o.o.', industrySegment: 'produkcja', sizeBand: 'SME' };

// Current-ratio-style indicator: within threshold but deteriorating.
const crDeteriorating: IndicatorFacts = {
  code: 'current_ratio',
  name: 'Current ratio',
  value: 1.2,
  threshold: 1.0,
  benchmark: [1.5, 2.0],
  history: [1.6, 1.5, 1.35, 1.2],
  periodLabel: 'kwartał',
  higherIsBetter: true,
  drivers: [
    { name: 'zobowiązania krótkoterminowe', changePct: 38 },
    { name: 'aktywa obrotowe', changePct: 2 },
  ],
  confidence: 'confirmed',
};

describe('deriveTrend', () => {
  it('detects a falling, adverse trend for a higher-is-better metric', () => {
    const t = deriveTrend(crDeteriorating);
    expect(t).not.toBeNull();
    expect(t!.direction).toBe('down');
    expect(t!.improving).toBe(false);
    expect(t!.periods).toBe(4);
    expect(Math.round(t!.delta * 100) / 100).toBe(-0.4);
  });

  it('marks a falling lower-is-better metric (e.g. DSO) as improving', () => {
    const dso: IndicatorFacts = {
      code: 'dso',
      name: 'DSO',
      value: 40,
      history: [55, 50, 45, 40],
      higherIsBetter: false,
    };
    const t = deriveTrend(dso)!;
    expect(t.direction).toBe('down');
    expect(t.improving).toBe(true);
  });

  it('returns null with fewer than 2 observations', () => {
    expect(deriveTrend({ code: 'x', name: 'X', value: 1, history: [1] })).toBeNull();
    expect(deriveTrend({ code: 'x', name: 'X', value: 1 })).toBeNull();
  });
});

describe('periodsToThreshold', () => {
  it('extrapolates periods to threshold when heading toward it', () => {
    const t = deriveTrend(crDeteriorating);
    // delta -0.4 over 3 steps → -0.1333/period; distance 1.0-1.2 = -0.2 → ~1.5 periods
    const p = periodsToThreshold(crDeteriorating, t);
    expect(p).not.toBeNull();
    expect(p!).toBeGreaterThan(1);
    expect(p!).toBeLessThan(2);
  });

  it('returns null when the trend moves away from the threshold', () => {
    const improving: IndicatorFacts = {
      ...crDeteriorating,
      value: 1.2,
      threshold: 1.0,
      history: [1.0, 1.05, 1.1, 1.2], // rising, away from 1.0 floor
    };
    const t = deriveTrend(improving);
    expect(periodsToThreshold(improving, t)).toBeNull();
  });

  it('returns null without a threshold', () => {
    const noThr = { ...crDeteriorating, threshold: undefined };
    expect(periodsToThreshold(noThr, deriveTrend(noThr))).toBeNull();
  });
});

describe('weakestConfidence', () => {
  it('is confirmed only when all facts are confirmed', () => {
    expect(weakestConfidence(['confirmed', 'confirmed'])).toBe('confirmed');
  });
  it('is mixed when some confirmed + some weak', () => {
    expect(weakestConfidence(['confirmed', 'declared'])).toBe('mixed');
  });
  it('is declared when nothing is confirmed', () => {
    expect(weakestConfidence(['declared', 'missing'])).toBe('declared');
  });
  it('defaults to confirmed on empty input', () => {
    expect(weakestConfidence([])).toBe('confirmed');
  });
});

describe('deterministicIndicatorNarrator (W3 chain)', () => {
  const out = deterministicIndicatorNarrator({ language: 'pl', org, indicator: crDeteriorating });

  it('produces a complete K1..K4 chain', () => {
    expect(out.headline.length).toBeGreaterThan(0);
    expect(out.k1Fact.text).toContain('Current ratio');
    expect(out.k2Meaning.text.length).toBeGreaterThan(0);
    expect(out.k3Actions.length).toBeGreaterThanOrEqual(1);
    expect(out.k3Actions.length).toBeLessThanOrEqual(3);
    expect(out.k4Effect.horizon.length).toBeGreaterThan(0);
  });

  it('surfaces the W3 chain fields (indicator→trend→driver→forecast→recommendation)', () => {
    expect(out.chain.indicator).toContain('Current ratio');
    expect(out.chain.trend).toContain('spada');
    expect(out.chain.driver).toContain('zobowiązania krótkoterminowe');
    expect(out.chain.forecast).not.toBeNull(); // heading toward threshold → numeric forecast
    expect(out.chain.recommendation.length).toBeGreaterThan(0);
  });

  it('leads the K2 meaning with the "trend eats the buffer" thesis, not "within range"', () => {
    expect(out.k2Meaning.text).toContain('trend zjada bufor');
  });

  it('names the top driver as the leading action (highest leverage first)', () => {
    expect(out.k3Actions[0].action).toContain('zobowiązania krótkoterminowe');
    expect(out.k3Actions[0].ownerRole).toBe('CFO');
    expect(out.k3Actions[0].whyFirst.length).toBeGreaterThan(0);
  });

  it('every K3 action carries an owner role and a why-first rationale (R6)', () => {
    for (const a of out.k3Actions) {
      expect(a.ownerRole.length).toBeGreaterThan(0);
      expect(a.whyFirst.length).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(a.impact);
      expect(['high', 'medium', 'low']).toContain(a.effort);
    }
  });

  it('carries engine-grounded evidence refs (numbers-from-engine provenance)', () => {
    expect(out.evidence.some((e) => e.type === 'ratio' && e.ref === 'current_ratio')).toBe(true);
    expect(out.evidence.some((e) => e.type === 'driver')).toBe(true);
    expect(out.k2Meaning.factRefs.length).toBeGreaterThan(0);
    expect(out.narrative).toBe('deterministic');
    expect(out.aiGenerated).toBe(false);
  });

  it('omits a numeric forecast when the engine cannot extrapolate to a threshold', () => {
    const noThreshold: IndicatorFacts = { ...crDeteriorating, threshold: undefined, benchmark: undefined };
    const r = deterministicIndicatorNarrator({ language: 'pl', org, indicator: noThreshold });
    expect(r.chain.forecast).toBeNull();
  });

  it('renders an EN variant with no leaked PL prose in the headline', () => {
    const en = deterministicIndicatorNarrator({ language: 'en', org, indicator: crDeteriorating });
    expect(en.headline).toMatch(/threshold|buffer|control|source/i);
    expect(en.headline).not.toContain('próg');
  });
});
