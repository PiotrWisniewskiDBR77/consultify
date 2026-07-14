import { describe, expect, it } from 'vitest';

import {
  FOCUS_DEEPENING_LADDER,
  FOCUS_LADDER_RUNG_ORDER,
  FOCUS_LANES,
  FOCUS_PROPOSAL_BANK,
  buildFocusConclusionPrompt,
  buildW2MoveSequence,
  localizeLadder,
  rankPriorities,
  synthesizeFocusTradeoffs,
  toFocusMove,
  validateW2Move,
} from '../../src/config/focustradeoffs';
import type { FocusPriority, FocusTradeoffData } from '../../src/store/useToolStore';

const prio = (id: string, overrides: Partial<FocusPriority> = {}): FocusPriority => ({
  id,
  title: `Priority ${id}`,
  description: 'desc',
  valueScore: 3,
  effortScore: 3,
  strategicFit: 3,
  recommendation: 'pursue',
  drivers: [],
  evidence: [],
  ...overrides,
});

const buildData = (
  priorities: FocusPriority[],
  goal = 'Choose where to focus this quarter'
): FocusTradeoffData =>
  ({
    context: {
      competingPriorities: 'many',
      decisionCriteria: 'value/effort/fit',
      goal,
      scope: 'company',
      timeframe: 'medium',
      successSignal: 'agreed focus',
    },
    signals: [],
    priorities,
    tradeoffs: [],
    recommendedMoves: [],
    outputCandidates: [],
  }) as FocusTradeoffData;

describe('Focus & Trade-offs config — structure', () => {
  it('defines all three lanes with a full 4-rung deepening ladder in canonical order', () => {
    expect(FOCUS_LANES).toHaveLength(3);
    expect(FOCUS_LADDER_RUNG_ORDER).toEqual([
      'surface',
      'evidence',
      'quantification',
      'risk-capability',
    ]);

    FOCUS_LANES.forEach((lane) => {
      const rungs = FOCUS_DEEPENING_LADDER[lane];
      expect(rungs).toHaveLength(4);
      expect(rungs.map((r) => r.id).sort()).toEqual([...FOCUS_LADDER_RUNG_ORDER].sort());
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

  it('has a partner-grade bilingual proposal bank for every lane', () => {
    FOCUS_LANES.forEach((lane) => {
      const bank = FOCUS_PROPOSAL_BANK[lane];
      expect(bank.length).toBeGreaterThanOrEqual(4);
      bank.forEach((proposal) => {
        expect(proposal.title.pl).not.toEqual(proposal.title.en);
        expect(proposal.explanation.pl.length).toBeGreaterThan(20);
        expect(proposal.explanation.en.length).toBeGreaterThan(20);
        expect(FOCUS_LADDER_RUNG_ORDER).toContain(proposal.rung);
      });
    });
  });

  it('localizeLadder resolves to one language preserving rung order', () => {
    const pl = localizeLadder('pursue', true);
    const en = localizeLadder('pursue', false);
    expect(pl.map((r) => r.id)).toEqual(FOCUS_LADDER_RUNG_ORDER);
    expect(en.map((r) => r.id)).toEqual(FOCUS_LADDER_RUNG_ORDER);
    expect(pl[0].label).not.toEqual(en[0].label);
    expect(pl.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
  });
});

describe('Focus & Trade-offs engine — scoring & ranking', () => {
  it('ranks empty session with no ordered priorities and a helpful rationale', () => {
    const ranking = rankPriorities(buildData([]));
    expect(ranking.ordered).toHaveLength(0);
    expect(ranking.rationale.en).toContain('No active priorities');
  });

  it('ranks high value + high fit + low effort above low value + high effort', () => {
    const data = buildData([
      prio('a', { valueScore: 5, strategicFit: 5, effortScore: 1, evidence: ['data'] }),
      prio('b', { valueScore: 2, strategicFit: 2, effortScore: 5 }),
    ]);
    const ranking = rankPriorities(data);
    expect(ranking.ordered[0]).toBe('a');
    expect(ranking.ordered[ranking.ordered.length - 1]).toBe('b');

    const a = ranking.scores.find((s) => s.id === 'a')!;
    const b = ranking.scores.find((s) => s.id === 'b')!;
    expect(a.score).toBeGreaterThan(b.score);
    expect(a.lane).toBe('pursue');
  });

  it('excludes rejected priorities from ranking', () => {
    const data = buildData([
      prio('a', { valueScore: 5, strategicFit: 5, effortScore: 1 }),
      prio('b', { proposalStatus: 'rejected' }),
    ]);
    const ranking = rankPriorities(data);
    expect(ranking.ordered).toEqual(['a']);
  });
});

describe('Focus & Trade-offs engine — W2 move validator', () => {
  it('validates that a move must carry rationale, trade-off and rejected variant', () => {
    expect(validateW2Move({}).valid).toBe(false);
    expect(validateW2Move({}).missing).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);

    const partial = validateW2Move({ rationale: 'This is a solid enough rationale' });
    expect(partial.missing).toEqual(['tradeOff', 'rejectedVariant']);

    const thin = validateW2Move({ rationale: 'ok', tradeOff: 'ok', rejectedVariant: 'ok' });
    expect(thin.valid).toBe(false);
    expect(thin.weak).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);

    const full = validateW2Move({
      rationale: 'Commit to this priority because it wins the value/effort arithmetic',
      tradeOff: 'At the cost of pace on the other priorities this cycle',
      rejectedVariant: 'We reject doing a bit of everything at once',
    });
    expect(full.valid).toBe(true);
  });

  it('every synthesized move passes its own W2 validation', () => {
    const data = buildData([
      prio('a', { valueScore: 5, strategicFit: 5, effortScore: 1, evidence: ['x'] }),
      prio('b', { valueScore: 2, strategicFit: 2, effortScore: 5 }),
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

  it('commits to the strongest priority and explicitly cuts the weakest', () => {
    const data = buildData([
      prio('a', { valueScore: 5, strategicFit: 5, effortScore: 1, evidence: ['a'] }),
      prio('b', { valueScore: 1, strategicFit: 1, effortScore: 5 }),
    ]);
    const sequence = buildW2MoveSequence(data);
    const lead = sequence[0];
    expect(lead.order).toBe(1);
    expect(lead.category).toBe('commit');
    expect(lead.priorityId).toBe('a');

    const cut = sequence.find((m) => m.category === 'cut');
    expect(cut).toBeTruthy();
    expect(cut!.priorityId).toBe('b');
  });

  it('inserts an experiment move when the committed priority lacks evidence', () => {
    const data = buildData([prio('a', { valueScore: 5, strategicFit: 5, effortScore: 1, evidence: [] })]);
    const sequence = buildW2MoveSequence(data);
    expect(sequence.some((m) => m.category === 'experiment')).toBe(true);
  });

  it('does NOT insert experiment when the committed priority is well-evidenced', () => {
    const data = buildData([prio('a', { valueScore: 5, strategicFit: 5, effortScore: 1, evidence: ['a'] })]);
    const sequence = buildW2MoveSequence(data);
    expect(sequence.filter((m) => m.category === 'experiment')).toHaveLength(0);
  });
});

describe('Focus & Trade-offs engine — bridges', () => {
  it('toFocusMove folds trade-off and rejected variant into the store rationale field', () => {
    const [move] = buildW2MoveSequence(
      buildData([prio('a', { valueScore: 5, strategicFit: 5, effortScore: 1, evidence: ['a'] })])
    );
    const focusMove = toFocusMove(move, false, 'move-1');
    expect(focusMove.id).toBe('move-1');
    expect(focusMove.linkedPriorityIds).toEqual(['a']);
    expect(focusMove.rationale).toContain(move.rationale.en);
    expect(focusMove.rationale).toContain(move.tradeOff.en);
    expect(focusMove.rationale).toContain(move.rejectedVariant.en);
    expect(focusMove.proposalStatus).toBe('ai-proposed');
  });

  it('buildFocusConclusionPrompt returns null for empty session and a grounded prompt otherwise', () => {
    expect(buildFocusConclusionPrompt(buildData([]), false)).toBeNull();

    const prompt = buildFocusConclusionPrompt(
      buildData([
        prio('a', { valueScore: 5, strategicFit: 5, effortScore: 1, evidence: ['a'] }),
        prio('b', { valueScore: 1, strategicFit: 1, effortScore: 5 }),
      ]),
      false
    )!;
    expect(prompt).toContain('SCORED PRIORITIES');
    expect(prompt).toContain('W2 MOVE SEQUENCE');
    expect(prompt).toContain('rejected variant');
    expect(prompt).toContain('"verdict"');
    expect(prompt).toContain('"initiatives"');
  });

  it('synthesizeFocusTradeoffs returns a consistent ranking + sequence', () => {
    const data = buildData([
      prio('a', { valueScore: 5, strategicFit: 5, effortScore: 1, evidence: ['a'] }),
      prio('b', { valueScore: 3, strategicFit: 3, effortScore: 3 }),
    ]);
    const { ranking, sequence } = synthesizeFocusTradeoffs(data);
    expect(ranking.ordered[0]).toBe(sequence[0].priorityId);
  });
});

describe('Focus & Trade-offs engine — O3 additions wired into the conclusion prompt', () => {
  it('includes the opportunity-cost matrix and the anti-focus check block', () => {
    const data = buildData([
      prio('a', { valueScore: 5, strategicFit: 5, effortScore: 1, evidence: ['a'] }),
      prio('b', { valueScore: 4, strategicFit: 4, effortScore: 2, evidence: ['b'] }),
    ]);
    const prompt = buildFocusConclusionPrompt(data, false)!;
    expect(prompt).toContain('OPPORTUNITY-COST MATRIX');
    expect(prompt).toContain('ANTI-FOCUS CHECK');
    expect(prompt).toContain('staircase.fact');
  });

  it('flags the anti-focus check in the prompt when every priority is pursue and none is rejected', () => {
    const data = buildData([
      prio('a', { valueScore: 5, strategicFit: 5, effortScore: 1, recommendation: 'pursue' }),
      prio('b', { valueScore: 4, strategicFit: 4, effortScore: 2, recommendation: 'pursue' }),
    ]);
    const prompt = buildFocusConclusionPrompt(data, false)!;
    expect(prompt).toContain('ANTI-FOCUS CHECK (FLAGGED)');
    expect(prompt).toContain('No-strategy flag');
  });

  it('shows the anti-focus check as clear when a priority is explicitly dropped', () => {
    const data = buildData([
      prio('a', { valueScore: 5, strategicFit: 5, effortScore: 1, recommendation: 'pursue' }),
      prio('b', { valueScore: 1, strategicFit: 1, effortScore: 5, recommendation: 'drop' }),
    ]);
    const prompt = buildFocusConclusionPrompt(data, false)!;
    expect(prompt).toContain('ANTI-FOCUS CHECK (clear)');
  });
});
