import { describe, expect, it } from 'vitest';

import {
  CAPABILITY_DEEPENING_LADDER,
  CAPABILITY_LADDER_RUNG_ORDER,
  CAPABILITY_PROPOSAL_BANK,
  CAPABILITY_SOURCING_ARCHETYPES,
  buildCapabilityMapperConclusionPrompt,
  buildW2SourcingSequence,
  deriveSourcing,
  localizeLadder,
  rankCapabilities,
  synthesizeCapabilityMap,
  validateW2Move,
  type CapabilityItem,
  type CapabilityMapperData,
} from '../../src/config/capabilitymapper';

const cap = (id: string, overrides: Partial<CapabilityItem> = {}): CapabilityItem => ({
  id,
  name: `Capability ${id}`,
  domain: 'technology',
  currentMaturity: 2,
  targetMaturity: 4,
  importance: 'medium',
  evidence: [],
  ...overrides,
});

const buildData = (
  capabilities: CapabilityItem[],
  goal = 'Zbudować przewagę zdolności'
): CapabilityMapperData => ({
  context: { goal, scope: 'company' },
  capabilities,
});

describe('Capability Mapper config — structure', () => {
  it('defines all four sourcing archetypes with a full 4-rung deepening ladder in canonical order', () => {
    expect(CAPABILITY_SOURCING_ARCHETYPES).toHaveLength(4);
    expect(CAPABILITY_LADDER_RUNG_ORDER).toEqual([
      'surface',
      'evidence',
      'quantification',
      'risk-capability',
    ]);

    CAPABILITY_SOURCING_ARCHETYPES.forEach((archetype) => {
      const rungs = CAPABILITY_DEEPENING_LADDER[archetype];
      expect(rungs).toHaveLength(4);
      expect(rungs.map((r) => r.id).sort()).toEqual([...CAPABILITY_LADDER_RUNG_ORDER].sort());
      expect(rungs.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
      rungs.forEach((rung) => {
        expect(rung.label.pl.trim().length).toBeGreaterThan(0);
        expect(rung.label.en.trim().length).toBeGreaterThan(0);
        expect(rung.question.pl.trim().length).toBeGreaterThan(0);
        expect(rung.question.en.trim().length).toBeGreaterThan(0);
        expect(rung.rationale.pl.trim().length).toBeGreaterThan(0);
        expect(rung.rationale.en.trim().length).toBeGreaterThan(0);
      });
    });
  });

  it('has a partner-grade bilingual proposal bank for every archetype', () => {
    CAPABILITY_SOURCING_ARCHETYPES.forEach((archetype) => {
      const bank = CAPABILITY_PROPOSAL_BANK[archetype];
      expect(bank.length).toBeGreaterThanOrEqual(4);
      bank.forEach((proposal) => {
        expect(proposal.title.pl).not.toEqual(proposal.title.en);
        expect(proposal.explanation.pl.length).toBeGreaterThan(20);
        expect(proposal.explanation.en.length).toBeGreaterThan(20);
        expect(CAPABILITY_LADDER_RUNG_ORDER).toContain(proposal.rung);
      });
    });
  });

  it('localizeLadder resolves to one language preserving rung order', () => {
    const pl = localizeLadder('build', true);
    const en = localizeLadder('build', false);
    expect(pl.map((r) => r.id)).toEqual(CAPABILITY_LADDER_RUNG_ORDER);
    expect(en.map((r) => r.id)).toEqual(CAPABILITY_LADDER_RUNG_ORDER);
    expect(pl[0].label).not.toEqual(en[0].label);
    expect(pl.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
  });
});

describe('Capability Mapper engine — sourcing verdict & scoring', () => {
  it('derives sourcing deterministically from importance and gap', () => {
    expect(deriveSourcing(cap('a', { importance: 'high', currentMaturity: 2, targetMaturity: 5 }))).toBe('build');
    expect(deriveSourcing(cap('b', { importance: 'medium', currentMaturity: 2, targetMaturity: 4 }))).toBe('buy');
    expect(deriveSourcing(cap('c', { importance: 'low', currentMaturity: 2, targetMaturity: 4 }))).toBe('partner');
    expect(deriveSourcing(cap('d', { importance: 'high', currentMaturity: 4, targetMaturity: 4 }))).toBe('sustain');
    // explicit sourcing wins
    expect(deriveSourcing(cap('e', { importance: 'high', sourcing: 'partner' }))).toBe('partner');
  });

  it('ranks empty session with no ordered gaps and a helpful rationale', () => {
    const ranking = rankCapabilities(buildData([]));
    expect(ranking.ordered).toHaveLength(0);
    expect(ranking.rationale.en).toContain('No capability with a real gap');
  });

  it('ranks the largest importance-weighted gap first and excludes no-gap items', () => {
    const data = buildData([
      cap('big', { importance: 'high', currentMaturity: 1, targetMaturity: 5 }), // gap 4 x 3 = 12
      cap('small', { importance: 'low', currentMaturity: 3, targetMaturity: 4 }), // gap 1 x 1 = 1
      cap('done', { importance: 'high', currentMaturity: 5, targetMaturity: 5 }), // no gap -> sustain
    ]);
    const ranking = rankCapabilities(data);
    expect(ranking.ordered[0]).toBe('big');
    expect(ranking.ordered).not.toContain('done');
    const big = ranking.scores.find((s) => s.id === 'big')!;
    expect(big.priorityScore).toBeGreaterThan(0);
    expect(big.sourcing).toBe('build');
  });
});

describe('Capability Mapper engine — W2 move validator', () => {
  it('validates that a move must carry rationale, trade-off and rejected variant', () => {
    expect(validateW2Move({}).valid).toBe(false);
    expect(validateW2Move({}).missing).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);

    const full = validateW2Move({
      rationale: 'Build the differentiating capability in-house',
      tradeOff: 'At the cost of time locked in the build',
      rejectedVariant: 'We reject buying off-the-shelf here',
    });
    expect(full.valid).toBe(true);
  });

  it('every synthesized sourcing move passes its own W2 validation in both languages', () => {
    const data = buildData([
      cap('c1', { importance: 'high', currentMaturity: 1, targetMaturity: 5 }),
      cap('c2', { importance: 'low', currentMaturity: 3, targetMaturity: 4 }),
    ]);
    const sequence = buildW2SourcingSequence(data);
    expect(sequence.length).toBeGreaterThan(0);
    sequence.forEach((move) => {
      expect(move.validation.valid).toBe(true);
      expect(move.rationale.pl.trim()).not.toEqual('');
      expect(move.tradeOff.en.trim()).not.toEqual('');
      expect(move.rejectedVariant.pl.trim()).not.toEqual('');
      const revalidated = validateW2Move({
        rationale: move.rationale.en,
        tradeOff: move.tradeOff.en,
        rejectedVariant: move.rejectedVariant.en,
      });
      expect(revalidated.valid).toBe(true);
    });
  });

  it('leads with the top gap and explicitly defers the lowest-priority gap', () => {
    const data = buildData([
      cap('big', { importance: 'high', currentMaturity: 1, targetMaturity: 5, evidence: ['seed'] }),
      cap('small', { importance: 'low', currentMaturity: 3, targetMaturity: 4 }),
    ]);
    const sequence = buildW2SourcingSequence(data);
    expect(sequence[0].order).toBe(1);
    expect(sequence[0].capabilityId).toBe('big');
    const defer = sequence.find((m) => m.title.en.startsWith('Defer'));
    expect(defer).toBeTruthy();
    expect(defer!.capabilityId).toBe('small');
  });

  it('inserts a prove-the-seed move when the top build gap lacks evidence', () => {
    const data = buildData([
      cap('build1', { importance: 'high', currentMaturity: 1, targetMaturity: 5, evidence: [] }),
    ]);
    const sequence = buildW2SourcingSequence(data);
    expect(sequence.some((m) => m.title.en.startsWith('Prove'))).toBe(true);
  });

  it('does NOT insert prove-the-seed when the top build gap is evidenced', () => {
    const data = buildData([
      cap('build1', { importance: 'high', currentMaturity: 1, targetMaturity: 5, evidence: ['team'] }),
    ]);
    const sequence = buildW2SourcingSequence(data);
    expect(sequence.filter((m) => m.title.en.startsWith('Prove'))).toHaveLength(0);
  });
});

describe('Capability Mapper engine — conclusion bridge', () => {
  it('returns null for empty session and a grounded W2 prompt otherwise', () => {
    expect(buildCapabilityMapperConclusionPrompt(buildData([]), false)).toBeNull();

    const prompt = buildCapabilityMapperConclusionPrompt(
      buildData([
        cap('big', { importance: 'high', currentMaturity: 1, targetMaturity: 5 }),
        cap('small', { importance: 'low', currentMaturity: 3, targetMaturity: 4 }),
      ]),
      false
    )!;
    expect(prompt).toContain('SCORED CAPABILITY GAPS');
    expect(prompt).toContain('W2 SOURCING SEQUENCE');
    expect(prompt).toContain('rejected variant');
    expect(prompt).toContain('"tradeoffs"');
    expect(prompt).toContain('"initiatives"');
  });

  it('synthesizeCapabilityMap returns a consistent ranking + sequence', () => {
    const data = buildData([
      cap('big', { importance: 'high', currentMaturity: 1, targetMaturity: 5 }),
      cap('mid', { importance: 'medium', currentMaturity: 2, targetMaturity: 4 }),
    ]);
    const { ranking, sequence } = synthesizeCapabilityMap(data);
    expect(ranking.ordered[0]).toBe(sequence[0].capabilityId);
  });
});
