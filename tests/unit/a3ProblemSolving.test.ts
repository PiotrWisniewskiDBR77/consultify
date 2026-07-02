import { describe, expect, it } from 'vitest';

import {
  A3_DEEPENING_LADDER,
  A3_LADDER_RUNG_ORDER,
  A3_PROPOSAL_BANK,
  A3_SECTIONS,
  assessA3,
  buildA3ConclusionPrompt,
  buildW2MoveSequence,
  localizeLadder,
  synthesizeA3,
  toOperationalItem,
  validateW2Move,
  type A3SectionId,
} from '../../src/config/a3problemsolving';
import type { OperationalItem, OperationalToolData } from '../../src/store/useToolStore';

const item = (id: string, overrides: Partial<OperationalItem> = {}): OperationalItem => ({
  id,
  title: `Item ${id}`,
  description: 'desc',
  impact: 'medium',
  effort: 'medium',
  ...overrides,
});

const buildData = (
  sections: Partial<Record<A3SectionId, OperationalItem[]>>,
  goal = 'Reduce defect rate'
): OperationalToolData =>
  ({
    context: { goal, scope: 'line 3', successSignal: 'defect rate < 1%' } as any,
    sections: {
      problem: sections.problem || [],
      'root-cause': sections['root-cause'] || [],
      countermeasures: sections.countermeasures || [],
    },
  }) as OperationalToolData;

describe('A3 config — structure', () => {
  it('defines all three sections with a full 4-rung deepening ladder in canonical order', () => {
    expect(A3_SECTIONS).toEqual(['problem', 'root-cause', 'countermeasures']);
    expect(A3_LADDER_RUNG_ORDER).toEqual(['surface', 'evidence', 'quantification', 'risk-capability']);

    A3_SECTIONS.forEach((section) => {
      const rungs = A3_DEEPENING_LADDER[section];
      expect(rungs).toHaveLength(4);
      expect(rungs.map((r) => r.id).sort()).toEqual([...A3_LADDER_RUNG_ORDER].sort());
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

  it('has a partner-grade bilingual proposal bank for every section', () => {
    A3_SECTIONS.forEach((section) => {
      const bank = A3_PROPOSAL_BANK[section];
      expect(bank.length).toBeGreaterThanOrEqual(4);
      bank.forEach((proposal) => {
        expect(proposal.title.pl).not.toEqual(proposal.title.en);
        expect(proposal.explanation.pl.length).toBeGreaterThan(20);
        expect(proposal.explanation.en.length).toBeGreaterThan(20);
        expect(A3_LADDER_RUNG_ORDER).toContain(proposal.rung);
      });
    });
  });

  it('localizeLadder resolves to one language preserving rung order', () => {
    const pl = localizeLadder('root-cause', true);
    const en = localizeLadder('root-cause', false);
    expect(pl.map((r) => r.id)).toEqual(A3_LADDER_RUNG_ORDER);
    expect(en.map((r) => r.id)).toEqual(A3_LADDER_RUNG_ORDER);
    expect(pl[0].question).not.toEqual(en[0].question);
    expect(pl.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
  });
});

describe('A3 engine — readiness assessment (insight staircase)', () => {
  it('flags an empty A3 with no signable verdict', () => {
    const r = assessA3(buildData({}));
    expect(r.staircaseComplete).toBe(false);
    expect(r.verdict.en).toContain('empty');
  });

  it('flags an incomplete staircase and names the missing section', () => {
    const r = assessA3(buildData({ problem: [item('p1', { impact: 'high' })] }));
    expect(r.staircaseComplete).toBe(false);
    expect(r.weakestSection).toBe('root-cause');
    expect(r.verdict.en.toLowerCase()).toContain('root cause');
  });

  it('marks the staircase complete and names the weakest evidenced link', () => {
    const r = assessA3(
      buildData({
        problem: [item('p1', { impact: 'high', target: '< 1% defects' })],
        'root-cause': [item('rc1', { impact: 'high', threshold: '80% of gap' })],
        countermeasures: [item('cm1', { impact: 'medium' })],
      })
    );
    expect(r.staircaseComplete).toBe(true);
    // countermeasures item carries no measurable anchor -> weakest link
    expect(r.weakestSection).toBe('countermeasures');
  });
});

describe('A3 engine — W2 move validator', () => {
  it('validates that a move must carry rationale, trade-off and rejected variant', () => {
    expect(validateW2Move({}).missing).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);
    const thin = validateW2Move({ rationale: 'ok', tradeOff: 'ok', rejectedVariant: 'ok' });
    expect(thin.valid).toBe(false);
    expect(thin.weak).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);
    const full = validateW2Move({
      rationale: 'Contain the effect because the defect still reaches the customer',
      tradeOff: 'At the cost of extra manual work this cycle',
      rejectedVariant: 'We reject waiting for the full fix while the effect is live',
    });
    expect(full.valid).toBe(true);
  });

  it('returns no moves until a problem is stated', () => {
    expect(buildW2MoveSequence(buildData({}))).toHaveLength(0);
    expect(buildW2MoveSequence(buildData({ 'root-cause': [item('rc1')] }))).toHaveLength(0);
  });

  it('leads with contain and inserts validate-first when the root cause is thin', () => {
    const seq = buildW2MoveSequence(buildData({ problem: [item('p1', { impact: 'high' })] }));
    expect(seq.length).toBeGreaterThan(0);
    expect(seq[0].category).toBe('contain');
    expect(seq.some((m) => m.category === 'validate-first')).toBe(true);
    seq.forEach((m) => {
      expect(m.validation.valid).toBe(true);
      expect(m.rationale.pl.trim()).not.toEqual('');
      expect(m.tradeOff.en.trim()).not.toEqual('');
      expect(m.rejectedVariant.pl.trim()).not.toEqual('');
      const revalidated = validateW2Move({
        rationale: m.rationale.en,
        tradeOff: m.tradeOff.en,
        rejectedVariant: m.rejectedVariant.en,
      });
      expect(revalidated.valid).toBe(true);
    });
  });

  it('does NOT insert validate-first when the root cause is well-evidenced, and standardizes when complete', () => {
    const seq = buildW2MoveSequence(
      buildData({
        problem: [item('p1', { impact: 'high', target: '< 1%' })],
        'root-cause': [
          item('rc1', { impact: 'high', threshold: '60% of gap' }),
          item('rc2', { impact: 'high', target: 'process step 4' }),
        ],
        countermeasures: [item('cm1', { impact: 'high', durationMinutes: 30 })],
      })
    );
    expect(seq.some((m) => m.category === 'validate-first')).toBe(false);
    expect(seq.some((m) => m.category === 'eliminate-root')).toBe(true);
    expect(seq.some((m) => m.category === 'standardize')).toBe(true);
  });
});

describe('A3 engine — bridges', () => {
  it('toOperationalItem folds trade-off and rejected variant into the description', () => {
    const [move] = buildW2MoveSequence(buildData({ problem: [item('p1', { impact: 'high' })] }));
    const opItem = toOperationalItem(move, false, 'move-1');
    expect(opItem.id).toBe('move-1');
    expect(opItem.description).toContain(move.rationale.en);
    expect(opItem.description).toContain(move.tradeOff.en);
    expect(opItem.description).toContain(move.rejectedVariant.en);
  });

  it('buildA3ConclusionPrompt returns null for empty A3 and a grounded W2 prompt otherwise', () => {
    expect(buildA3ConclusionPrompt(buildData({}), false)).toBeNull();
    const prompt = buildA3ConclusionPrompt(
      buildData({
        problem: [item('p1', { impact: 'high', target: '< 1%' })],
        'root-cause': [item('rc1', { impact: 'high' })],
        countermeasures: [item('cm1', { impact: 'high' })],
      }),
      false
    )!;
    expect(prompt).toContain('A3 READINESS');
    expect(prompt).toContain('W2 COUNTERMEASURE SEQUENCE');
    expect(prompt).toContain('rejected variant');
    expect(prompt).toContain('"rejectedVariant"');
    expect(prompt).toContain('"tradeOff"');
  });

  it('synthesizeA3 returns a consistent readiness + sequence', () => {
    const data = buildData({
      problem: [item('p1', { impact: 'high' })],
      'root-cause': [item('rc1', { impact: 'high' })],
    });
    const { readiness, sequence } = synthesizeA3(data);
    expect(readiness.scores).toHaveLength(3);
    expect(sequence[0].category).toBe('contain');
  });
});
