import { describe, expect, it } from 'vitest';

import {
  NARRATIVE_BANDS,
  NARRATIVE_DEEPENING_LADDER,
  NARRATIVE_LADDER_RUNG_ORDER,
  NARRATIVE_PROPOSAL_BANK,
  buildNarrativeConclusionPrompt,
  buildW2MoveSequence,
  localizeLadder,
  rankPillars,
  synthesizeNarrative,
  toNarrativeMove,
  validateW2Move,
} from '../../src/config/narrativeengine';
import type { NarrativeEngineData, NarrativePillar } from '../../src/store/useToolStore';

const pillar = (id: string, overrides: Partial<NarrativePillar> = {}): NarrativePillar => ({
  id,
  title: `Pillar ${id}`,
  message: 'claim',
  proofPoints: [],
  audienceResonance: 'medium',
  drivers: [],
  evidence: [],
  ...overrides,
});

const buildData = (
  pillars: NarrativePillar[],
  goal = 'Persuade the board to fund the plan'
): NarrativeEngineData =>
  ({
    context: {
      audience: 'board',
      coreMessage: 'fund the plan',
      goal,
      scope: 'company',
      timeframe: 'medium',
      successSignal: 'approval',
    },
    signals: [],
    pillars,
    threads: [],
    recommendedMoves: [],
    outputCandidates: [],
  }) as NarrativeEngineData;

describe('Narrative Engine config — structure', () => {
  it('defines all three bands with a full 4-rung deepening ladder in canonical order', () => {
    expect(NARRATIVE_BANDS).toHaveLength(3);
    expect(NARRATIVE_LADDER_RUNG_ORDER).toEqual([
      'surface',
      'evidence',
      'quantification',
      'risk-capability',
    ]);

    NARRATIVE_BANDS.forEach((band) => {
      const rungs = NARRATIVE_DEEPENING_LADDER[band];
      expect(rungs).toHaveLength(4);
      expect(rungs.map((r) => r.id).sort()).toEqual([...NARRATIVE_LADDER_RUNG_ORDER].sort());
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

  it('has a partner-grade bilingual proposal bank for every band', () => {
    NARRATIVE_BANDS.forEach((band) => {
      const bank = NARRATIVE_PROPOSAL_BANK[band];
      expect(bank.length).toBeGreaterThanOrEqual(4);
      bank.forEach((proposal) => {
        expect(proposal.title.pl).not.toEqual(proposal.title.en);
        expect(proposal.explanation.pl.length).toBeGreaterThan(20);
        expect(proposal.explanation.en.length).toBeGreaterThan(20);
        expect(NARRATIVE_LADDER_RUNG_ORDER).toContain(proposal.rung);
      });
    });
  });

  it('localizeLadder resolves to one language preserving rung order', () => {
    const pl = localizeLadder('high', true);
    const en = localizeLadder('high', false);
    expect(pl.map((r) => r.id)).toEqual(NARRATIVE_LADDER_RUNG_ORDER);
    expect(en.map((r) => r.id)).toEqual(NARRATIVE_LADDER_RUNG_ORDER);
    expect(pl[0].label).not.toEqual(en[0].label);
    expect(pl.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
  });
});

describe('Narrative Engine engine — scoring & ranking', () => {
  it('ranks empty session with no ordered pillars and a helpful rationale', () => {
    const ranking = rankPillars(buildData([]));
    expect(ranking.ordered).toHaveLength(0);
    expect(ranking.rationale.en).toContain('No active pillars');
  });

  it('ranks high-resonance well-proven pillar above low-resonance unproven', () => {
    const data = buildData([
      pillar('a', { audienceResonance: 'high', proofPoints: ['stat', 'case'] }),
      pillar('b', { audienceResonance: 'low', proofPoints: [] }),
    ]);
    const ranking = rankPillars(data);
    expect(ranking.ordered[0]).toBe('a');
    expect(ranking.ordered[ranking.ordered.length - 1]).toBe('b');

    const a = ranking.scores.find((s) => s.id === 'a')!;
    const b = ranking.scores.find((s) => s.id === 'b')!;
    expect(a.score).toBeGreaterThan(b.score);
  });

  it('excludes rejected pillars from ranking', () => {
    const data = buildData([
      pillar('a', { audienceResonance: 'high', proofPoints: ['x'] }),
      pillar('b', { proposalStatus: 'rejected' }),
    ]);
    const ranking = rankPillars(data);
    expect(ranking.ordered).toEqual(['a']);
  });
});

describe('Narrative Engine engine — W2 move validator', () => {
  it('validates that a move must carry rationale, trade-off and rejected variant', () => {
    expect(validateW2Move({}).valid).toBe(false);
    expect(validateW2Move({}).missing).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);

    const full = validateW2Move({
      rationale: 'Open with this pillar because it earns attention fastest',
      tradeOff: 'At the cost of a slow dramatic build-up',
      rejectedVariant: 'We reject opening with context and background',
    });
    expect(full.valid).toBe(true);
  });

  it('every synthesized move passes its own W2 validation', () => {
    const data = buildData([
      pillar('a', { audienceResonance: 'high', proofPoints: ['x'] }),
      pillar('b', { audienceResonance: 'low', proofPoints: [] }),
    ]);
    const sequence = buildW2MoveSequence(data);
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

  it('opens with the strongest pillar and explicitly cuts the weakest', () => {
    const data = buildData([
      pillar('a', { audienceResonance: 'high', proofPoints: ['a', 'b'] }),
      pillar('b', { audienceResonance: 'low', proofPoints: [] }),
    ]);
    const sequence = buildW2MoveSequence(data);
    const lead = sequence[0];
    expect(lead.order).toBe(1);
    expect(lead.category).toBe('open');
    expect(lead.pillarId).toBe('a');

    const cut = sequence.find((m) => m.title.en.startsWith('Cut'));
    expect(cut).toBeTruthy();
    expect(cut!.pillarId).toBe('b');
  });

  it('inserts a prove move when the lead pillar lacks proof points', () => {
    const data = buildData([pillar('a', { audienceResonance: 'high', proofPoints: [] })]);
    const sequence = buildW2MoveSequence(data);
    expect(sequence.some((m) => m.category === 'prove')).toBe(true);
  });

  it('does NOT insert prove when the lead pillar is well-proven', () => {
    const data = buildData([pillar('a', { audienceResonance: 'high', proofPoints: ['a', 'b'] })]);
    const sequence = buildW2MoveSequence(data);
    expect(sequence.filter((m) => m.category === 'prove')).toHaveLength(0);
  });
});

describe('Narrative Engine engine — bridges', () => {
  it('toNarrativeMove folds trade-off and rejected variant into the store rationale field', () => {
    const [move] = buildW2MoveSequence(
      buildData([pillar('a', { audienceResonance: 'high', proofPoints: ['a'] })])
    );
    const narrativeMove = toNarrativeMove(move, false, 'move-1');
    expect(narrativeMove.id).toBe('move-1');
    expect(narrativeMove.linkedPillarIds).toEqual(['a']);
    expect(narrativeMove.rationale).toContain(move.rationale.en);
    expect(narrativeMove.rationale).toContain(move.tradeOff.en);
    expect(narrativeMove.rationale).toContain(move.rejectedVariant.en);
    expect(narrativeMove.proposalStatus).toBe('ai-proposed');
  });

  it('buildNarrativeConclusionPrompt returns null for empty session and a grounded prompt otherwise', () => {
    expect(buildNarrativeConclusionPrompt(buildData([]), false)).toBeNull();

    const prompt = buildNarrativeConclusionPrompt(
      buildData([
        pillar('a', { audienceResonance: 'high', proofPoints: ['a'] }),
        pillar('b', { audienceResonance: 'low', proofPoints: [] }),
      ]),
      false
    )!;
    expect(prompt).toContain('SCORED PILLARS');
    expect(prompt).toContain('W2 MOVE SEQUENCE');
    expect(prompt).toContain('rejected variant');
    expect(prompt).toContain('"threads"');
    expect(prompt).toContain('"initiatives"');
  });

  it('synthesizeNarrative returns a consistent ranking + sequence', () => {
    const data = buildData([
      pillar('a', { audienceResonance: 'high', proofPoints: ['a'] }),
      pillar('b', { audienceResonance: 'medium', proofPoints: ['b'] }),
    ]);
    const { ranking, sequence } = synthesizeNarrative(data);
    expect(ranking.ordered[0]).toBe(sequence[0].pillarId);
  });
});
