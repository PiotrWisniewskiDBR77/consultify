import { describe, expect, it } from 'vitest';

import {
  AMBITION_DEEPENING_LADDER,
  AMBITION_LADDER_RUNG_ORDER,
  AMBITION_PROPOSAL_BANK,
  AMBITION_THEME_ARCHETYPES,
  buildAmbitionDecomposerConclusionPrompt,
  buildW2ThemeSequence,
  deriveArchetype,
  localizeLadder,
  rankThemes,
  synthesizeAmbition,
  validateW2Move,
  type AmbitionDecomposerData,
  type ThemeItem,
} from '../../src/config/ambitiondecomposer';

const theme = (id: string, overrides: Partial<ThemeItem> = {}): ThemeItem => ({
  id,
  title: `Theme ${id}`,
  targetMetric: 'metric',
  targetValue: '100',
  horizon: 'medium',
  importance: 'medium',
  evidence: [],
  ...overrides,
});

const buildData = (
  themes: ThemeItem[],
  ambitionStatement = 'Zostać liderem regionu w 3 lata'
): AmbitionDecomposerData => ({
  context: { ambitionStatement, scope: 'company' },
  themes,
});

describe('Ambition Decomposer config — structure', () => {
  it('defines all four theme archetypes with a full 4-rung deepening ladder in canonical order', () => {
    expect(AMBITION_THEME_ARCHETYPES).toHaveLength(4);
    expect(AMBITION_LADDER_RUNG_ORDER).toEqual([
      'surface',
      'evidence',
      'quantification',
      'risk-capability',
    ]);

    AMBITION_THEME_ARCHETYPES.forEach((archetype) => {
      const rungs = AMBITION_DEEPENING_LADDER[archetype];
      expect(rungs).toHaveLength(4);
      expect(rungs.map((r) => r.id).sort()).toEqual([...AMBITION_LADDER_RUNG_ORDER].sort());
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
    AMBITION_THEME_ARCHETYPES.forEach((archetype) => {
      const bank = AMBITION_PROPOSAL_BANK[archetype];
      expect(bank.length).toBeGreaterThanOrEqual(4);
      bank.forEach((proposal) => {
        expect(proposal.title.pl).not.toEqual(proposal.title.en);
        expect(proposal.explanation.pl.length).toBeGreaterThan(20);
        expect(proposal.explanation.en.length).toBeGreaterThan(20);
        expect(AMBITION_LADDER_RUNG_ORDER).toContain(proposal.rung);
      });
    });
  });

  it('localizeLadder resolves to one language preserving rung order', () => {
    const pl = localizeLadder('foundation', true);
    const en = localizeLadder('foundation', false);
    expect(pl.map((r) => r.id)).toEqual(AMBITION_LADDER_RUNG_ORDER);
    expect(en.map((r) => r.id)).toEqual(AMBITION_LADDER_RUNG_ORDER);
    expect(pl[0].label).not.toEqual(en[0].label);
    expect(pl.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
  });
});

describe('Ambition Decomposer engine — archetype verdict & sequencing', () => {
  it('derives archetype deterministically from importance and horizon', () => {
    expect(deriveArchetype(theme('a', { importance: 'high', horizon: 'short' }))).toBe('foundation');
    expect(deriveArchetype(theme('b', { importance: 'high', horizon: 'long' }))).toBe('bet');
    expect(deriveArchetype(theme('c', { importance: 'low', horizon: 'medium' }))).toBe('enabler');
    expect(deriveArchetype(theme('d', { importance: 'medium', horizon: 'medium' }))).toBe('accelerator');
    // explicit archetype wins
    expect(deriveArchetype(theme('e', { importance: 'low', archetype: 'bet' }))).toBe('bet');
  });

  it('sequences empty session with no ordered themes and a helpful rationale', () => {
    const ranking = rankThemes(buildData([]));
    expect(ranking.ordered).toHaveLength(0);
    expect(ranking.rationale.en).toContain('No themes yet');
  });

  it('sequences foundations before accelerators and bets (prerequisite-aware)', () => {
    const data = buildData([
      theme('bet1', { importance: 'high', horizon: 'long' }), // bet, rank 3
      theme('found1', { importance: 'high', horizon: 'short' }), // foundation, rank 0
      theme('acc1', { importance: 'medium', horizon: 'medium' }), // accelerator, rank 2
    ]);
    const ranking = rankThemes(data);
    expect(ranking.ordered[0]).toBe('found1');
    expect(ranking.ordered.indexOf('acc1')).toBeLessThan(ranking.ordered.indexOf('bet1'));
  });
});

describe('Ambition Decomposer engine — W2 move validator', () => {
  it('validates that a move must carry rationale, trade-off and rejected variant', () => {
    expect(validateW2Move({}).valid).toBe(false);
    expect(validateW2Move({}).missing).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);

    const full = validateW2Move({
      rationale: 'Lead with the foundation because it gates the rest',
      tradeOff: 'At the cost of visible progress on flashier themes',
      rejectedVariant: 'We reject starting with the flashiest theme first',
    });
    expect(full.valid).toBe(true);
  });

  it('every synthesized theme move passes its own W2 validation in both languages', () => {
    const data = buildData([
      theme('found1', { importance: 'high', horizon: 'short' }),
      theme('bet1', { importance: 'high', horizon: 'long' }),
    ]);
    const sequence = buildW2ThemeSequence(data);
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

  it('leads with the prerequisite and stages the last theme explicitly', () => {
    const data = buildData([
      theme('found1', { importance: 'high', horizon: 'short', evidence: ['x'] }),
      theme('bet1', { importance: 'high', horizon: 'long' }),
    ]);
    const sequence = buildW2ThemeSequence(data);
    expect(sequence[0].order).toBe(1);
    expect(sequence[0].themeId).toBe('found1');
    const staged = sequence.find((m) => m.title.en.startsWith('Stage last'));
    expect(staged).toBeTruthy();
    expect(staged!.themeId).toBe('bet1');
  });

  it('inserts a validate-first move when the lead theme is a bet', () => {
    const data = buildData([theme('bet1', { importance: 'high', horizon: 'long', archetype: 'bet' })]);
    const sequence = buildW2ThemeSequence(data);
    expect(sequence.some((m) => m.title.en.startsWith('Validate'))).toBe(true);
  });
});

describe('Ambition Decomposer engine — conclusion bridge', () => {
  it('returns null for empty session and a grounded W2 prompt otherwise', () => {
    expect(buildAmbitionDecomposerConclusionPrompt(buildData([]), false)).toBeNull();

    const prompt = buildAmbitionDecomposerConclusionPrompt(
      buildData([
        theme('found1', { importance: 'high', horizon: 'short' }),
        theme('bet1', { importance: 'high', horizon: 'long' }),
      ]),
      false
    )!;
    expect(prompt).toContain('THEME SEQUENCE');
    expect(prompt).toContain('W2 MOVE SEQUENCE');
    expect(prompt).toContain('rejected variant');
    expect(prompt).toContain('"tradeoffs"');
    expect(prompt).toContain('"rejectedVariant"');
  });

  it('synthesizeAmbition returns a consistent sequence + moves', () => {
    const data = buildData([
      theme('found1', { importance: 'high', horizon: 'short' }),
      theme('acc1', { importance: 'medium', horizon: 'medium' }),
    ]);
    const { ranking, sequence } = synthesizeAmbition(data);
    expect(ranking.ordered[0]).toBe(sequence[0].themeId);
  });
});
