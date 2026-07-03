import { describe, expect, it } from 'vitest';

import {
  SMED_DEEPENING_LADDER,
  SMED_LADDER_RUNG_ORDER,
  SMED_PHASES,
  SMED_PROPOSAL_BANK,
  buildSmedConclusionPrompt,
  buildSmedDeepenPrompt,
  buildW2MoveSequence,
  computeBaseline,
  localizeLadder,
  localizeMove,
  rankSmedPhases,
  synthesizeSmedPlan,
  toSmedSession,
  validateW2Move,
  type ChangeoverStep,
  type ImprovementItem,
  type SmedSession,
} from '../../src/config/smedplanner';

const step = (id: string, overrides: Partial<ChangeoverStep> = {}): ChangeoverStep => ({
  id,
  kind: 'internal',
  durationMinutes: 10,
  measured: true,
  ...overrides,
});

const imp = (id: string, overrides: Partial<ImprovementItem> = {}): ImprovementItem => ({
  id,
  phase: 'convert',
  impact: 'medium',
  effort: 'medium',
  evidence: [],
  ...overrides,
});

const session = (overrides: Partial<SmedSession> = {}): SmedSession => ({
  steps: [],
  improvements: [],
  ...overrides,
});

describe('SMED config — structure', () => {
  it('defines all four SMED phases with a full 4-rung deepening ladder in canonical order', () => {
    expect(SMED_PHASES).toEqual(['separate', 'convert', 'streamline', 'standardize']);
    expect(SMED_LADDER_RUNG_ORDER).toEqual([
      'surface',
      'evidence',
      'quantification',
      'risk-capability',
    ]);

    SMED_PHASES.forEach((phase) => {
      const rungs = SMED_DEEPENING_LADDER[phase];
      expect(rungs).toHaveLength(4);
      expect(rungs.map((r) => r.id).sort()).toEqual([...SMED_LADDER_RUNG_ORDER].sort());
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

  it('has a partner-grade bilingual proposal bank for every phase', () => {
    SMED_PHASES.forEach((phase) => {
      const bank = SMED_PROPOSAL_BANK[phase];
      expect(bank.length).toBeGreaterThanOrEqual(4);
      bank.forEach((proposal) => {
        expect(proposal.title.pl).not.toEqual(proposal.title.en);
        expect(proposal.explanation.pl.length).toBeGreaterThan(20);
        expect(proposal.explanation.en.length).toBeGreaterThan(20);
        expect(SMED_LADDER_RUNG_ORDER).toContain(proposal.rung);
      });
    });
  });

  it('localizeLadder resolves to one language preserving rung order', () => {
    const pl = localizeLadder('convert', true);
    const en = localizeLadder('convert', false);
    expect(pl.map((r) => r.id)).toEqual(SMED_LADDER_RUNG_ORDER);
    expect(en.map((r) => r.id)).toEqual(SMED_LADDER_RUNG_ORDER);
    expect(pl[0].label).not.toEqual(en[0].label);
    expect(pl.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
  });
});

describe('SMED engine — baseline & ranking', () => {
  it('computes internal/external/convertible minutes and measured ratio', () => {
    const baseline = computeBaseline(
      session({
        steps: [
          step('a', { kind: 'internal', durationMinutes: 20, potential: 'convertible' }),
          step('b', { kind: 'internal', durationMinutes: 10, measured: false }),
          step('c', { kind: 'external', durationMinutes: 5 }),
        ],
      })
    );
    expect(baseline.internalMinutes).toBe(30);
    expect(baseline.externalMinutes).toBe(5);
    expect(baseline.totalMinutes).toBe(35);
    expect(baseline.convertibleMinutes).toBe(20);
    // 1 of 2 internal steps measured
    expect(baseline.measuredRatio).toBe(0.5);
  });

  it('ranks empty session with no ordered phases and a helpful rationale', () => {
    const ranking = rankSmedPhases(session({}));
    expect(ranking.ordered).toHaveLength(0);
    expect(ranking.rationale.en).toContain('No improvement candidates');
  });

  it('ranks a high-impact low-effort evidence-backed phase to the top', () => {
    const ranking = rankSmedPhases(
      session({
        steps: [step('s1', { potential: 'convertible', durationMinutes: 30 })],
        improvements: [
          imp('i1', { phase: 'convert', impact: 'high', effort: 'low', evidence: ['pilot'] }),
          imp('i2', { phase: 'streamline', impact: 'low', effort: 'high' }),
        ],
      })
    );
    expect(ranking.ordered[0]).toBe('convert');
    const convert = ranking.scores.find((s) => s.phase === 'convert')!;
    const streamline = ranking.scores.find((s) => s.phase === 'streamline')!;
    expect(convert.score).toBeGreaterThan(streamline.score);
  });

  it('excludes phases with no improvements from ordering but reports them with score 0', () => {
    const ranking = rankSmedPhases(session({ improvements: [imp('i1', { phase: 'separate' })] }));
    expect(ranking.ordered).toEqual(['separate']);
    const empties = ranking.scores.filter((s) => s.improvementCount === 0);
    expect(empties).toHaveLength(3);
    empties.forEach((s) => expect(s.score).toBe(0));
  });
});

describe('SMED engine — W2 move validator', () => {
  it('requires rationale, trade-off and rejected variant', () => {
    expect(validateW2Move({}).missing).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);
    const full = validateW2Move({
      rationale: 'Lead with convert because it recovers downtime cheapest',
      tradeOff: 'At the cost of a second tooling set this quarter',
      rejectedVariant: 'We reject shortening before moving work out of the stop',
    });
    expect(full.valid).toBe(true);
  });

  it('every synthesized move passes its own W2 validation in both languages', () => {
    const sequence = buildW2MoveSequence(
      session({
        steps: [step('s1', { potential: 'convertible', durationMinutes: 20 })],
        improvements: [imp('i1', { phase: 'convert', impact: 'high', effort: 'low', evidence: ['x'] })],
      })
    );
    expect(sequence.length).toBeGreaterThan(0);
    sequence.forEach((move) => {
      expect(move.validation.valid).toBe(true);
      expect(move.rationale.pl.trim()).not.toEqual('');
      expect(move.tradeOff.en.trim()).not.toEqual('');
      expect(move.rejectedVariant.pl.trim()).not.toEqual('');
      const re = validateW2Move({
        rationale: move.rationale.en,
        tradeOff: move.tradeOff.en,
        rejectedVariant: move.rejectedVariant.en,
      });
      expect(re.valid).toBe(true);
    });
  });

  it('inserts a measure-first move when the baseline is under-measured', () => {
    const sequence = buildW2MoveSequence(
      session({
        steps: [
          step('s1', { measured: false, durationMinutes: 0, potential: 'convertible' }),
          step('s2', { measured: false, durationMinutes: 0 }),
        ],
        improvements: [imp('i1', { phase: 'convert' })],
      })
    );
    expect(sequence[0].title.en).toContain('Measure');
  });

  it('always defers standardize behind an explicit trade-off', () => {
    const sequence = buildW2MoveSequence(
      session({
        steps: [step('s1', { potential: 'convertible', durationMinutes: 20 })],
        improvements: [imp('i1', { phase: 'convert', impact: 'high', effort: 'low', evidence: ['x'] })],
      })
    );
    const std = sequence.find((m) => m.phase === 'standardize');
    expect(std).toBeTruthy();
    expect(std!.rejectedVariant.en.toLowerCase()).toContain('reject');
  });
});

describe('SMED engine — bridges', () => {
  it('toSmedSession adapts operational sections defensively', () => {
    const s = toSmedSession({
      'changeover-steps': [
        { id: 's1', category: 'internal', durationMinutes: 12, threshold: 'convertible' },
        { id: 's2', category: 'external', durationMinutes: 4 },
      ],
      improvements: [{ id: 'i1', category: 'convert', impact: 'high', effort: 'low', evidence: ['p'] }],
    });
    expect(s.steps).toHaveLength(2);
    expect(s.steps[0].kind).toBe('internal');
    expect(s.steps[0].potential).toBe('convertible');
    expect(s.steps[0].measured).toBe(true);
    expect(s.improvements[0].phase).toBe('convert');
  });

  it('localizeMove folds trade-off and rejected variant into the rationale', () => {
    const [move] = buildW2MoveSequence(
      session({
        steps: [step('s1', { potential: 'convertible', durationMinutes: 20 })],
        improvements: [imp('i1', { phase: 'convert', impact: 'high', effort: 'low', evidence: ['x'] })],
      })
    );
    const flat = localizeMove(move, false);
    expect(flat.rationale).toContain(move.tradeOff.en);
    expect(flat.rationale).toContain(move.rejectedVariant.en);
  });

  it('buildSmedConclusionPrompt returns null for empty session and a grounded W2 prompt otherwise', () => {
    expect(buildSmedConclusionPrompt(session({}), false)).toBeNull();
    const prompt = buildSmedConclusionPrompt(
      session({
        steps: [step('s1', { potential: 'convertible', durationMinutes: 20 })],
        improvements: [imp('i1', { phase: 'convert', impact: 'high', effort: 'low', evidence: ['x'] })],
      }),
      false
    )!;
    expect(prompt).toContain('CHANGEOVER BASELINE');
    expect(prompt).toContain('W2 MOVE SEQUENCE');
    expect(prompt).toContain('rejected variant');
    expect(prompt).toContain('"tradeOff"');
    expect(prompt).toContain('"rejectedVariant"');
  });

  it('buildSmedDeepenPrompt returns the localized rung question + framing', () => {
    const pl = buildSmedDeepenPrompt('convert', 'quantification', true)!;
    expect(pl).toContain('Kontekst konsultanta');
    expect(buildSmedDeepenPrompt('convert', 'quantification', false)!).toContain(
      'Consultant framing'
    );
  });

  it('synthesizeSmedPlan returns a consistent baseline + ranking + sequence', () => {
    const s = session({
      steps: [step('s1', { potential: 'convertible', durationMinutes: 20 })],
      improvements: [imp('i1', { phase: 'convert', impact: 'high', effort: 'low', evidence: ['x'] })],
    });
    const { baseline, ranking, sequence } = synthesizeSmedPlan(s);
    expect(baseline.internalMinutes).toBe(20);
    expect(ranking.ordered[0]).toBe('convert');
    expect(sequence.length).toBeGreaterThan(0);
  });
});
