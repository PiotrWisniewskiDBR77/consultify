/**
 * Conclusion-layer coverage for the three strategy tools whose finishing block
 * was shallow before OXFORD Round 3 #5: Porter (market-forces), Value Chain, and
 * Portfolio Priority. Each now has a grounded conclusionPrompts.ts producing a
 * full CONCLUSION_LAYER_STANDARD variant-W2 verdict (verdict / rationale /
 * tradeoffs / moves / expectedEffect / selfCheck), seeded from its deterministic
 * engine. These tests assert: (a) a scored session yields a non-empty W2 prompt,
 * (b) an empty session returns null (renderer falls through to the generic
 * summary), never a fabricated conclusion.
 */
import { describe, expect, it } from 'vitest';

import { buildPorterConclusionPrompt } from '../../src/config/porter/conclusionPrompts';
import { buildPortfolioConclusionPrompt } from '../../src/config/portfolio/conclusionPrompts';
import { buildSwotConclusionPrompt } from '../../src/config/swot/conclusionPrompts';
import { buildValueChainConclusionPrompt } from '../../src/config/valuechain/conclusionPrompts';
import type {
  ForceData,
  PortfolioItem,
  PortfolioPriorityData,
  SWOTItem,
  ValueActivity,
  ValueActivityId,
  ValueChainData,
} from '../../src/store/useToolStore';

// --- W2 contract assertion shared across the three tools ---------------------
const expectW2Prompt = (prompt: string | null) => {
  expect(prompt).toBeTruthy();
  const p = prompt as string;
  // The four W2 fields the standard requires in the JSON contract.
  expect(p).toContain('"verdict"');
  expect(p).toContain('"tradeoffs"');
  expect(p).toContain('"moves"');
  expect(p).toContain('"expectedEffect"');
  // Trade-off is mandatory in W2 (a recommendation without one is a list):
  // the tradeoffs[] field plus a per-move tradeOff.
  expect(p).toContain('tradeoffs');
  expect(p).toContain('tradeOff');
  // Each move must carry a first step + rejected variant.
  expect(p).toContain('firstStep');
  expect(p).toContain('rejectedVariant');
  // Self-check (adversarial DoD) is emitted.
  expect(p).toContain('selfCheck');
};

// ============================ Porter =========================================
const force = (
  name: string,
  overrides: Partial<ForceData> = {}
): ForceData => ({
  id: name,
  name,
  score: 3,
  trend: 'stable',
  drivers: [],
  ...overrides,
});

describe('Porter conclusion layer (market-forces, variant W2)', () => {
  it('produces a grounded W2 verdict when forces are scored', () => {
    const data = {
      forces: {
        rivalry: force('Rivalry', { score: 5, intensity: 'high', implication: 'Price war' }),
        newEntrants: force('New entrants', { score: 2, intensity: 'low' }),
        substitutes: force('Substitutes', { score: 3, intensity: 'medium' }),
        buyerPower: force('Buyer power', { score: 4, intensity: 'high' }),
        supplierPower: force('Supplier power', { score: 2, intensity: 'low' }),
      },
    };
    const prompt = buildPorterConclusionPrompt(data, false);
    expectW2Prompt(prompt);
    // Answer-first industry verdict from the engine is seeded into the prompt.
    expect(prompt as string).toContain('INDUSTRY PROFITABILITY');
  });

  it('returns null for an unscored session (no fabricated conclusion)', () => {
    expect(buildPorterConclusionPrompt(undefined, false)).toBeNull();
    expect(buildPorterConclusionPrompt({ forces: undefined }, false)).toBeNull();
    const empty = {
      forces: {
        rivalry: force('Rivalry', { score: 0 }),
        newEntrants: force('New entrants', { score: 0 }),
        substitutes: force('Substitutes', { score: 0 }),
        buyerPower: force('Buyer power', { score: 0 }),
        supplierPower: force('Supplier power', { score: 0 }),
      },
    };
    // No intensity, no positive score anywhere -> nothing to conclude on.
    empty.forces.rivalry.intensity = undefined;
    expect(buildPorterConclusionPrompt(empty, false)).toBeNull();
  });

  it('respects the session language (Polish diacritics -> Polish prompt)', () => {
    const data = {
      forces: {
        rivalry: force('Rivalry', { score: 5, intensity: 'high' }),
        newEntrants: force('New entrants', { score: 2, intensity: 'low' }),
        substitutes: force('Substitutes', { score: 3, intensity: 'medium' }),
        buyerPower: force('Buyer power', { score: 4, intensity: 'high' }),
        supplierPower: force('Supplier power', { score: 2, intensity: 'low' }),
      },
    };
    const prompt = buildPorterConclusionPrompt(data, true) as string;
    expect(prompt).toContain('Działaj jako partner');
  });
});

// ============================ Value Chain ====================================
const activity = (
  id: ValueActivityId,
  overrides: Partial<ValueActivity> = {}
): ValueActivity => ({
  id,
  name: id,
  kind: 'primary',
  costContribution: 'medium',
  valueContribution: 'medium',
  marginRole: 'neutral',
  drivers: [],
  ...overrides,
});

describe('Value Chain conclusion layer (variant W2)', () => {
  it('produces a grounded W2 verdict seeded from the margin map', () => {
    const data = {
      activities: {
        operations: activity('operations', {
          costContribution: 'high',
          marginRole: 'drain',
          maturity: 'weak',
        }),
        marketingSales: activity('marketingSales', {
          valueContribution: 'high',
          marginRole: 'creator',
          maturity: 'weak',
        }),
      },
      positioningVerdict: { positioning: 'stuck-in-the-middle', summary: 'no clear edge' },
    } as unknown as ValueChainData;
    const prompt = buildValueChainConclusionPrompt(data, false);
    expectW2Prompt(prompt);
    expect(prompt as string).toContain('MARGIN MAP');
    expect(prompt as string).toContain('LEVER CANDIDATES');
  });

  it('returns null when no activity is scored', () => {
    expect(buildValueChainConclusionPrompt(undefined, false)).toBeNull();
    const unscored = {
      activities: { operations: activity('operations') },
    } as unknown as ValueChainData;
    // All-neutral, no drivers -> not scored -> nothing to conclude on.
    expect(buildValueChainConclusionPrompt(unscored, false)).toBeNull();
  });
});

// ============================ Portfolio ======================================
const item = (
  id: string,
  overrides: Partial<PortfolioItem> = {}
): PortfolioItem => ({
  id,
  title: `Item ${id}`,
  description: 'desc',
  marketGrowth: 4,
  marketShare: 3,
  investmentLevel: 2,
  category: 'star',
  ...overrides,
});

describe('Portfolio conclusion layer (variant W2)', () => {
  it('produces a grounded W2 verdict seeded from the 2x2 + funding sequence', () => {
    const data = {
      initiatives: [
        item('a', { marketGrowth: 5, investmentLevel: 1 }), // quick-win
        item('b', { marketGrowth: 5, investmentLevel: 5 }), // big-bet
        item('c', { marketGrowth: 1, investmentLevel: 5 }), // money-pit
      ],
    } as unknown as PortfolioPriorityData;
    const prompt = buildPortfolioConclusionPrompt(data, false);
    expectW2Prompt(prompt);
    expect(prompt as string).toContain('2x2 CLASSIFICATION');
    expect(prompt as string).toContain('FUNDING SEQUENCE');
  });

  it('returns null when there are no accepted items', () => {
    expect(buildPortfolioConclusionPrompt(undefined, false)).toBeNull();
    const rejected = {
      initiatives: [item('a', { proposalStatus: 'rejected' })],
    } as unknown as PortfolioPriorityData;
    expect(buildPortfolioConclusionPrompt(rejected, false)).toBeNull();
  });
});

// ============================ Dynamic SWOT ===================================
const swotItem = (
  id: string,
  quadrant: SWOTItem['quadrant'],
  overrides: Partial<SWOTItem> = {}
): SWOTItem => ({
  id,
  text: `${quadrant} item ${id}`,
  impact: 'medium',
  quadrant,
  proposalStatus: 'accepted',
  ...overrides,
});

describe('Dynamic SWOT conclusion layer (variant W2)', () => {
  it('produces a grounded W2 verdict seeded from engine-derived tensions', () => {
    // One accepted item per quadrant -> all four SO/WO/ST/WT tensions formable.
    const data = {
      items: [
        swotItem('s1', 'strengths', { impact: 'high', evidenceStatus: 'confirmed' }),
        swotItem('w1', 'weaknesses', { impact: 'high' }),
        swotItem('o1', 'opportunities', { impact: 'medium' }),
        swotItem('t1', 'threats', { impact: 'low', evidenceStatus: 'declared' }),
      ],
      tensions: [],
    };
    const prompt = buildSwotConclusionPrompt(data, false);
    // W2 contract fields present.
    expect(prompt).toBeTruthy();
    const p = prompt as string;
    expect(p).toContain('"verdict"');
    expect(p).toContain('"tradeoffs"');
    expect(p).toContain('"moves"');
    expect(p).toContain('"expectedEffect"');
    expect(p).toContain('selfCheck');
    // SWOT engine-grounded blocks and W2 per-move contract (engine naming).
    expect(p).toContain('SWOT TENSIONS');
    expect(p).toContain('TENSION COVERAGE');
    expect(p).toContain('tradeoff'); // per-move mandatory trade-off (chosen/deferred/cost)
    expect(p).toContain('rejectedAlternative'); // per-move mandatory rejected variant
    expect(p).toContain('firstStep');
    // Real accepted item text is seeded (numbers/facts from engine, not invented).
    expect(p).toContain('strengths item s1');
    // The four tension types are derivable and appear as pairings.
    expect(p).toContain('[SO');
    expect(p).toContain('[WT');
  });

  it('returns null when nothing is accepted (no fabricated conclusion)', () => {
    expect(buildSwotConclusionPrompt(undefined, false)).toBeNull();
    expect(buildSwotConclusionPrompt({ items: [] }, false)).toBeNull();
    // Items exist but none accepted (all rejected) -> nothing to conclude on.
    const rejected = {
      items: [swotItem('s1', 'strengths', { proposalStatus: 'rejected' })],
    };
    expect(buildSwotConclusionPrompt(rejected, false)).toBeNull();
    // Accepted items exist but never pair (only one quadrant populated) -> no tension.
    const oneQuadrant = {
      items: [
        swotItem('s1', 'strengths'),
        swotItem('s2', 'strengths'),
      ],
    };
    expect(buildSwotConclusionPrompt(oneQuadrant, false)).toBeNull();
  });

  it('respects the session language (Polish -> Polish prompt)', () => {
    const data = {
      items: [
        swotItem('s1', 'strengths', { impact: 'high' }),
        swotItem('o1', 'opportunities', { impact: 'high' }),
      ],
    };
    const prompt = buildSwotConclusionPrompt(data, true) as string;
    expect(prompt).toContain('Działaj jako partner');
    expect(prompt).toContain('siła × szansa');
  });
});
