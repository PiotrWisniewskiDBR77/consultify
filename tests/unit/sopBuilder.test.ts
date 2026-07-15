import { describe, expect, it } from 'vitest';

import {
  SOP_DEEPENING_LADDER,
  SOP_LADDER_RUNG_ORDER,
  SOP_PROPOSAL_BANK,
  SOP_QUESTION_BANK,
  SOP_QUESTION_ROOT_ID,
  SOP_SECTIONS,
  assessSop,
  buildSopConclusionPrompt,
  buildSopQuestionBankPromptRules,
  buildW2MoveSequence,
  detectSopGaps,
  getNextSopQuestionId,
  getSopQuestion,
  isForcedLoopSopQuestion,
  localizeLadder,
  synthesizeSop,
  toOperationalItem,
  validateW2Move,
  type SopSectionId,
} from '../../src/config/sopbuilder';
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
  sections: Partial<Record<SopSectionId, OperationalItem[]>>,
  goal = 'Standardize changeover'
): OperationalToolData =>
  ({
    context: { goal, scope: 'assembly', successSignal: 'zero skipped steps' } as any,
    sections: {
      standards: sections.standards || [],
      checklists: sections.checklists || [],
    },
  }) as OperationalToolData;

describe('SOP config — structure', () => {
  it('defines both sections with a full 4-rung deepening ladder in canonical order', () => {
    expect(SOP_SECTIONS).toEqual(['standards', 'checklists']);
    expect(SOP_LADDER_RUNG_ORDER).toEqual(['surface', 'evidence', 'quantification', 'risk-capability']);

    SOP_SECTIONS.forEach((section) => {
      const rungs = SOP_DEEPENING_LADDER[section];
      expect(rungs).toHaveLength(4);
      expect(rungs.map((r) => r.id).sort()).toEqual([...SOP_LADDER_RUNG_ORDER].sort());
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
    SOP_SECTIONS.forEach((section) => {
      const bank = SOP_PROPOSAL_BANK[section];
      expect(bank.length).toBeGreaterThanOrEqual(4);
      bank.forEach((proposal) => {
        expect(proposal.title.pl).not.toEqual(proposal.title.en);
        expect(proposal.explanation.pl.length).toBeGreaterThan(20);
        expect(proposal.explanation.en.length).toBeGreaterThan(20);
        expect(SOP_LADDER_RUNG_ORDER).toContain(proposal.rung);
      });
    });
  });

  it('localizeLadder resolves to one language preserving rung order', () => {
    const pl = localizeLadder('standards', true);
    const en = localizeLadder('standards', false);
    expect(pl.map((r) => r.id)).toEqual(SOP_LADDER_RUNG_ORDER);
    expect(en.map((r) => r.id)).toEqual(SOP_LADDER_RUNG_ORDER);
    expect(pl[0].question).not.toEqual(en[0].question);
    expect(pl.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
  });
});

describe('SOP engine — enforceability assessment', () => {
  it('flags an empty SOP with no enforceable verdict', () => {
    const r = assessSop(buildData({}));
    expect(r.enforceable).toBe(false);
    expect(r.verdict.en).toContain('empty');
  });

  it('flags standards without checklists as a compliance fiction', () => {
    const r = assessSop(buildData({ standards: [item('s1', { threshold: '2 mm' })] }));
    expect(r.enforceable).toBe(false);
    expect(r.weakestSection).toBe('checklists');
    expect(r.verdict.en.toLowerCase()).toContain('checklist');
  });

  it('flags unmeasurable standards as not enforceable', () => {
    const r = assessSop(
      buildData({
        standards: [item('s1', { impact: 'high' }), item('s2', { impact: 'high' })],
        checklists: [item('c1', { threshold: 'pass/fail' })],
      })
    );
    expect(r.unmeasurableStandards).toBe(2);
    expect(r.enforceable).toBe(false);
    expect(r.verdict.en.toLowerCase()).toContain('threshold');
  });

  it('marks an SOP enforceable when standards are measurable and covered', () => {
    const r = assessSop(
      buildData({
        standards: [item('s1', { threshold: '2 mm' }), item('s2', { target: '60-65C' })],
        checklists: [item('c1', { threshold: 'ok' }), item('c2', { threshold: 'ok' })],
      })
    );
    expect(r.enforceable).toBe(true);
    expect(r.coverageGap).toBe(false);
  });
});

describe('SOP engine — W2 move validator', () => {
  it('validates that a move must carry rationale, trade-off and rejected variant', () => {
    expect(validateW2Move({}).missing).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);
    const full = validateW2Move({
      rationale: 'Quantify the standard because it is judged by eye today',
      tradeOff: 'At the cost of time to agree the thresholds now',
      rejectedVariant: 'We reject refining it later in practice, which entrenches divergence',
    });
    expect(full.valid).toBe(true);
  });

  it('returns no moves until a standard exists', () => {
    expect(buildW2MoveSequence(buildData({}))).toHaveLength(0);
    expect(buildW2MoveSequence(buildData({ checklists: [item('c1')] }))).toHaveLength(0);
  });

  it('leads with quantify-standard when standards are judged by eye, all moves W2-valid', () => {
    const seq = buildW2MoveSequence(
      buildData({ standards: [item('s1', { impact: 'high' }), item('s2', { impact: 'high' })] })
    );
    expect(seq.length).toBeGreaterThan(0);
    expect(seq[0].category).toBe('quantify-standard');
    expect(seq.some((m) => m.category === 'cover-with-checklist')).toBe(true);
    expect(seq.some((m) => m.category === 'validate-first')).toBe(true);
    seq.forEach((m) => {
      expect(m.validation.valid).toBe(true);
      const revalidated = validateW2Move({
        rationale: m.rationale.en,
        tradeOff: m.tradeOff.en,
        rejectedVariant: m.rejectedVariant.en,
      });
      expect(revalidated.valid).toBe(true);
    });
  });

  it('closes the loop with an owner move when the SOP is already enforceable', () => {
    const seq = buildW2MoveSequence(
      buildData({
        standards: [item('s1', { threshold: '2 mm' }), item('s2', { target: '60-65C' })],
        checklists: [item('c1', { threshold: 'ok' }), item('c2', { threshold: 'ok' })],
      })
    );
    expect(seq.some((m) => m.category === 'quantify-standard')).toBe(false);
    expect(seq.some((m) => m.category === 'assign-owner')).toBe(true);
  });
});

describe('SOP engine — bridges', () => {
  it('toOperationalItem folds trade-off and rejected variant into the description', () => {
    const [move] = buildW2MoveSequence(buildData({ standards: [item('s1', { impact: 'high' })] }));
    const opItem = toOperationalItem(move, false, 'move-1');
    expect(opItem.id).toBe('move-1');
    expect(opItem.description).toContain(move.rationale.en);
    expect(opItem.description).toContain(move.tradeOff.en);
    expect(opItem.description).toContain(move.rejectedVariant.en);
  });

  it('buildSopConclusionPrompt returns null for empty SOP and a grounded W2 prompt otherwise', () => {
    expect(buildSopConclusionPrompt(buildData({}), false)).toBeNull();
    const prompt = buildSopConclusionPrompt(
      buildData({
        standards: [item('s1', { threshold: '2 mm' })],
        checklists: [item('c1', { threshold: 'ok' })],
      }),
      false
    )!;
    expect(prompt).toContain('SOP ENFORCEABILITY');
    expect(prompt).toContain('W2 ROLLOUT SEQUENCE');
    expect(prompt).toContain('rejected variant');
    expect(prompt).toContain('"initiatives"');
    expect(prompt).toContain('"verdict"');
    expect(prompt).toContain('"tradeoffs"');
  });

  it('synthesizeSop returns a consistent readiness + sequence', () => {
    const data = buildData({ standards: [item('s1', { impact: 'high' })] });
    const { readiness, sequence } = synthesizeSop(data);
    expect(readiness.scores).toHaveLength(2);
    expect(sequence[0].category).toBe('quantify-standard');
  });
});

describe('SOP engine — coverage gap detection (OXFORD O3)', () => {
  it('flags an empty SOP as no-standards and stops there', () => {
    const gaps = detectSopGaps(buildData({}));
    expect(gaps).toHaveLength(1);
    expect(gaps[0].kind).toBe('no-standards');
  });

  it('flags standards with zero checklists', () => {
    const gaps = detectSopGaps(buildData({ standards: [item('s1', { threshold: '2mm' })] }));
    expect(gaps.some((g) => g.kind === 'no-checklists')).toBe(true);
  });

  it('flags unmeasurable standards and partial checklist coverage', () => {
    const gaps = detectSopGaps(
      buildData({
        standards: [item('s1', {}), item('s2', { threshold: '2mm' })],
        checklists: [item('c1', {})],
      })
    );
    expect(gaps.some((g) => g.kind === 'unmeasurable-standards')).toBe(true);
    expect(gaps.some((g) => g.kind === 'coverage-gap')).toBe(true);
  });

  it('reports no gaps for a fully measurable, fully covered SOP', () => {
    const gaps = detectSopGaps(
      buildData({
        standards: [item('s1', { threshold: '2mm' })],
        checklists: [item('c1', { threshold: 'ok' })],
      })
    );
    expect(gaps).toHaveLength(0);
  });
});

describe('SOP branching question bank (OXFORD O3)', () => {
  it('starts at the surface question and has 4 laddered levels', () => {
    const root = getSopQuestion(SOP_QUESTION_ROOT_ID);
    expect(root).toBeTruthy();
    expect(root!.level).toBe(1);
    const levels = new Set(SOP_QUESTION_BANK.map((q) => q.level));
    expect(levels).toEqual(new Set([1, 2, 3, 4]));
  });

  it('forces the measurement loop until a threshold is set', () => {
    expect(isForcedLoopSopQuestion('sop-measure-force')).toBe(true);
    expect(getNextSopQuestionId('sop-measure-force', 'still-by-eye')).toBe('sop-measure-force');
    expect(getNextSopQuestionId('sop-measure-force', 'threshold-set')).toBe('sop-verify');
  });

  it('every node has at least two answer options', () => {
    SOP_QUESTION_BANK.forEach((node) => {
      expect(node.answerOptions.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('unknown answer keys fall back to defaultNextId', () => {
    expect(getNextSopQuestionId('sop-surface', 'unknown-key')).toBe(
      getSopQuestion('sop-surface')!.defaultNextId
    );
  });

  it('buildSopQuestionBankPromptRules mentions the forced-loop discipline in both languages', () => {
    expect(buildSopQuestionBankPromptRules('en')).toContain('sop-measure-force');
    expect(buildSopQuestionBankPromptRules('pl')).toContain('sop-measure-force');
  });
});
