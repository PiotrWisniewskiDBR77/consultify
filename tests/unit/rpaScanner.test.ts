import { describe, expect, it } from 'vitest';

import {
  RPA_DEEPENING_LADDER,
  RPA_GATES,
  RPA_LADDER_RUNG_ORDER,
  RPA_PROPOSAL_BANK,
  buildRpaConclusionPrompt,
  buildRpaDeepenPrompt,
  buildW2MoveSequence,
  computeBaseline,
  localizeLadder,
  localizeMove,
  rankRpaGates,
  synthesizeRpaScan,
  toRpaSession,
  validateW2Move,
  type AutomationIdea,
  type ProcessCandidate,
  type RpaSession,
} from '../../src/config/rpascanner';

const cand = (id: string, overrides: Partial<ProcessCandidate> = {}): ProcessCandidate => ({
  id,
  gate: 'quantify',
  standardization: 'medium',
  volumePerMonth: 100,
  handlingMinutes: 10,
  exceptionRate: 0,
  techTier: 'rpa',
  measured: true,
  evidence: [],
  ...overrides,
});

const idea = (id: string, overrides: Partial<AutomationIdea> = {}): AutomationIdea => ({
  id,
  gate: 'feasibility',
  impact: 'medium',
  effort: 'medium',
  evidence: [],
  ...overrides,
});

const session = (overrides: Partial<RpaSession> = {}): RpaSession => ({
  candidates: [],
  ideas: [],
  ...overrides,
});

describe('RPA Scanner config — structure', () => {
  it('defines all four assessment gates with a full 4-rung deepening ladder in canonical order', () => {
    expect(RPA_GATES).toEqual(['identify', 'standardize', 'quantify', 'feasibility']);
    expect(RPA_LADDER_RUNG_ORDER).toEqual([
      'surface',
      'evidence',
      'quantification',
      'risk-capability',
    ]);

    RPA_GATES.forEach((gate) => {
      const rungs = RPA_DEEPENING_LADDER[gate];
      expect(rungs).toHaveLength(4);
      expect(rungs.map((r) => r.id).sort()).toEqual([...RPA_LADDER_RUNG_ORDER].sort());
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

  it('has a partner-grade bilingual proposal bank for every gate with branching rungs', () => {
    RPA_GATES.forEach((gate) => {
      const bank = RPA_PROPOSAL_BANK[gate];
      expect(bank.length).toBeGreaterThanOrEqual(4);
      expect(new Set(bank.map((p) => p.rung)).size).toBe(bank.length);
      bank.forEach((proposal) => {
        expect(proposal.title.pl).not.toEqual(proposal.title.en);
        expect(proposal.explanation.pl.length).toBeGreaterThan(20);
        expect(proposal.explanation.en.length).toBeGreaterThan(20);
        expect(RPA_LADDER_RUNG_ORDER).toContain(proposal.rung);
      });
    });
  });

  it('localizeLadder resolves to one language preserving rung order', () => {
    const pl = localizeLadder('quantify', true);
    const en = localizeLadder('quantify', false);
    expect(pl.map((r) => r.id)).toEqual(RPA_LADDER_RUNG_ORDER);
    expect(en.map((r) => r.id)).toEqual(RPA_LADDER_RUNG_ORDER);
    expect(pl[0].label).not.toEqual(en[0].label);
    expect(pl.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
  });
});

describe('RPA Scanner engine — baseline & ranking', () => {
  it('computes annualized automatable minutes discounting the exception share', () => {
    const baseline = computeBaseline(
      session({
        candidates: [
          cand('a', { volumePerMonth: 100, handlingMinutes: 10, exceptionRate: 0.2, standardization: 'high', evidence: ['log'] }),
          cand('b', { volumePerMonth: 10, handlingMinutes: 5, exceptionRate: 0, standardization: 'low', measured: false }),
        ],
      })
    );
    // a: 100*12*10*0.8 = 9600 ; b: 10*12*5*1 = 600
    expect(baseline.annualAutomatableMinutes).toBe(10200);
    expect(baseline.topCandidateMinutes).toBe(9600);
    expect(baseline.ruleBasedCount).toBe(1);
    expect(baseline.evidenceRatio).toBe(0.5);
    expect(baseline.measuredRatio).toBe(0.5);
  });

  it('ranks empty session with no ordered gates and a helpful rationale', () => {
    const ranking = rankRpaGates(session({}));
    expect(ranking.ordered).toHaveLength(0);
    expect(ranking.rationale.en).toContain('No automation ideas');
  });

  it('ranks a high-impact low-effort evidence-backed gate to the top', () => {
    const ranking = rankRpaGates(
      session({
        candidates: [cand('c1', { gate: 'feasibility', standardization: 'high' })],
        ideas: [
          idea('i1', { gate: 'feasibility', impact: 'high', effort: 'low', evidence: ['poc'] }),
          idea('i2', { gate: 'identify', impact: 'low', effort: 'high' }),
        ],
      })
    );
    expect(ranking.ordered[0]).toBe('feasibility');
    const feas = ranking.scores.find((s) => s.gate === 'feasibility')!;
    const ident = ranking.scores.find((s) => s.gate === 'identify')!;
    expect(feas.score).toBeGreaterThan(ident.score);
  });

  it('excludes gates with no ideas from ordering but reports them with score 0', () => {
    const ranking = rankRpaGates(session({ ideas: [idea('i1', { gate: 'standardize' })] }));
    expect(ranking.ordered).toEqual(['standardize']);
    const empties = ranking.scores.filter((s) => s.ideaCount === 0);
    expect(empties).toHaveLength(3);
    empties.forEach((s) => expect(s.score).toBe(0));
  });
});

describe('RPA Scanner engine — W2 move validator', () => {
  it('requires rationale, trade-off and rejected variant', () => {
    expect(validateW2Move({}).missing).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);
    const full = validateW2Move({
      rationale: 'Lead with quantify because ROI ranking is guesswork otherwise',
      tradeOff: 'At the cost of a cycle of delay to the build',
      rejectedVariant: 'We reject automating the loudest process before measuring it',
    });
    expect(full.valid).toBe(true);
  });

  it('every synthesized move passes its own W2 validation in both languages', () => {
    const sequence = buildW2MoveSequence(
      session({
        candidates: [cand('c1', { gate: 'feasibility', standardization: 'high' })],
        ideas: [idea('i1', { gate: 'feasibility', impact: 'high', effort: 'low', evidence: ['x'] })],
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

  it('inserts a measure-first move when the portfolio is under-measured', () => {
    const sequence = buildW2MoveSequence(
      session({
        candidates: [
          cand('c1', { gate: 'identify', measured: false }),
          cand('c2', { gate: 'identify', measured: false }),
        ],
        ideas: [idea('i1', { gate: 'identify' })],
      })
    );
    expect(sequence[0].title.en).toContain('Measure');
  });

  it('always ends by proving feasibility behind an explicit trade-off', () => {
    const sequence = buildW2MoveSequence(
      session({
        candidates: [cand('c1', { gate: 'standardize', standardization: 'high' })],
        ideas: [idea('i1', { gate: 'standardize', impact: 'high', effort: 'low', evidence: ['x'] })],
      })
    );
    const feas = sequence.find((m) => m.gate === 'feasibility');
    expect(feas).toBeTruthy();
    expect(feas!.rejectedVariant.en.toLowerCase()).toContain('reject');
  });
});

describe('RPA Scanner engine — bridges', () => {
  it('toRpaSession adapts operational sections defensively, coercing the exception rate', () => {
    const s = toRpaSession({
      'process-candidates': [
        { id: 'c1', category: 'quantify', standardization: 'high', durationMinutes: 8, target: 500, frequency: 20, threshold: 'api', evidence: ['log'] },
        { id: 'c2', category: 'nonsense' },
      ],
      'automation-ideas': [{ id: 'i1', category: 'feasibility', impact: 'high', effort: 'low', evidence: ['poc'] }],
    });
    expect(s.candidates).toHaveLength(2);
    expect(s.candidates[0].gate).toBe('quantify');
    expect(s.candidates[0].standardization).toBe('high');
    expect(s.candidates[0].techTier).toBe('api');
    // frequency 20 read as a percentage -> 0.2 fraction
    expect(s.candidates[0].exceptionRate).toBe(0.2);
    expect(s.candidates[0].measured).toBe(true);
    expect(s.candidates[1].gate).toBeUndefined();
    expect(s.ideas[0].gate).toBe('feasibility');
  });

  it('localizeMove folds trade-off and rejected variant into the rationale', () => {
    const [move] = buildW2MoveSequence(
      session({
        candidates: [cand('c1', { gate: 'feasibility', standardization: 'high' })],
        ideas: [idea('i1', { gate: 'feasibility', impact: 'high', effort: 'low', evidence: ['x'] })],
      })
    );
    const flat = localizeMove(move, false);
    expect(flat.rationale).toContain(move.tradeOff.en);
    expect(flat.rationale).toContain(move.rejectedVariant.en);
  });

  it('buildRpaConclusionPrompt returns null for empty session and a grounded W2 prompt otherwise', () => {
    expect(buildRpaConclusionPrompt(session({}), false)).toBeNull();
    const prompt = buildRpaConclusionPrompt(
      session({
        candidates: [cand('c1', { gate: 'feasibility', standardization: 'high' })],
        ideas: [idea('i1', { gate: 'feasibility', impact: 'high', effort: 'low', evidence: ['x'] })],
      }),
      false
    )!;
    expect(prompt).toContain('AUTOMATION PORTFOLIO');
    expect(prompt).toContain('W2 MOVE SEQUENCE');
    expect(prompt).toContain('rejected variant');
    expect(prompt).toContain('"tradeOff"');
    expect(prompt).toContain('"rejectedVariant"');
  });

  it('buildRpaDeepenPrompt returns the localized rung question + framing', () => {
    const pl = buildRpaDeepenPrompt('quantify', 'quantification', true)!;
    expect(pl).toContain('Kontekst konsultanta');
    expect(buildRpaDeepenPrompt('quantify', 'quantification', false)!).toContain('Consultant framing');
  });

  it('synthesizeRpaScan returns a consistent baseline + ranking + sequence', () => {
    const s = session({
      candidates: [cand('c1', { gate: 'feasibility', standardization: 'high', volumePerMonth: 100, handlingMinutes: 10, exceptionRate: 0 })],
      ideas: [idea('i1', { gate: 'feasibility', impact: 'high', effort: 'low', evidence: ['x'] })],
    });
    const { baseline, ranking, sequence } = synthesizeRpaScan(s);
    // 100*12*10*1 = 12000
    expect(baseline.annualAutomatableMinutes).toBe(12000);
    expect(ranking.ordered[0]).toBe('feasibility');
    expect(sequence.length).toBeGreaterThan(0);
  });
});
