import { describe, expect, it } from 'vitest';

import {
  PAIN_DEEPENING_LADDER,
  PAIN_LADDER_RUNG_ORDER,
  PAIN_PROPOSAL_BANK,
  PAIN_STAGES,
  buildPainConclusionPrompt,
  buildPainDeepenPrompt,
  buildW2MoveSequence,
  computeBaseline,
  localizeLadder,
  localizeMove,
  rankPainStages,
  synthesizePainPlan,
  toPainSession,
  validateW2Move,
  type PainPoint,
  type PainSession,
  type SolutionCandidate,
} from '../../src/config/painexplorer';

const pain = (id: string, overrides: Partial<PainPoint> = {}): PainPoint => ({
  id,
  stage: 'measure',
  severity: 'medium',
  frequency: 'medium',
  reach: 1,
  minutesPerOccurrence: 10,
  occurrencesPerYear: 100,
  nature: 'root',
  measured: true,
  evidence: [],
  ...overrides,
});

const sol = (id: string, overrides: Partial<SolutionCandidate> = {}): SolutionCandidate => ({
  id,
  stage: 'diagnose',
  impact: 'medium',
  effort: 'medium',
  evidence: [],
  ...overrides,
});

const session = (overrides: Partial<PainSession> = {}): PainSession => ({
  pains: [],
  solutions: [],
  ...overrides,
});

describe('Pain Explorer config — structure', () => {
  it('defines all four discovery stages with a full 4-rung deepening ladder in canonical order', () => {
    expect(PAIN_STAGES).toEqual(['detect', 'qualify', 'measure', 'diagnose']);
    expect(PAIN_LADDER_RUNG_ORDER).toEqual([
      'surface',
      'evidence',
      'quantification',
      'risk-capability',
    ]);

    PAIN_STAGES.forEach((stage) => {
      const rungs = PAIN_DEEPENING_LADDER[stage];
      expect(rungs).toHaveLength(4);
      expect(rungs.map((r) => r.id).sort()).toEqual([...PAIN_LADDER_RUNG_ORDER].sort());
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

  it('has a partner-grade bilingual proposal bank for every stage with branching rungs', () => {
    PAIN_STAGES.forEach((stage) => {
      const bank = PAIN_PROPOSAL_BANK[stage];
      expect(bank.length).toBeGreaterThanOrEqual(4);
      // every proposal maps to a distinct ladder rung (the branching)
      expect(new Set(bank.map((p) => p.rung)).size).toBe(bank.length);
      bank.forEach((proposal) => {
        expect(proposal.title.pl).not.toEqual(proposal.title.en);
        expect(proposal.explanation.pl.length).toBeGreaterThan(20);
        expect(proposal.explanation.en.length).toBeGreaterThan(20);
        expect(PAIN_LADDER_RUNG_ORDER).toContain(proposal.rung);
      });
    });
  });

  it('localizeLadder resolves to one language preserving rung order', () => {
    const pl = localizeLadder('measure', true);
    const en = localizeLadder('measure', false);
    expect(pl.map((r) => r.id)).toEqual(PAIN_LADDER_RUNG_ORDER);
    expect(en.map((r) => r.id)).toEqual(PAIN_LADDER_RUNG_ORDER);
    expect(pl[0].label).not.toEqual(en[0].label);
    expect(pl.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
  });
});

describe('Pain Explorer engine — baseline & ranking', () => {
  it('computes annualized minutes, root count, evidence and measured ratios', () => {
    const baseline = computeBaseline(
      session({
        pains: [
          pain('a', { minutesPerOccurrence: 10, occurrencesPerYear: 100, reach: 2, evidence: ['log'] }),
          pain('b', { minutesPerOccurrence: 5, occurrencesPerYear: 10, reach: 1, nature: 'symptom', measured: false }),
        ],
      })
    );
    // a: 10*100*2 = 2000 ; b: 5*10*1 = 50
    expect(baseline.annualMinutesLost).toBe(2050);
    expect(baseline.topPainMinutes).toBe(2000);
    expect(baseline.rootCount).toBe(1);
    expect(baseline.evidenceRatio).toBe(0.5);
    expect(baseline.measuredRatio).toBe(0.5);
  });

  it('ranks empty session with no ordered stages and a helpful rationale', () => {
    const ranking = rankPainStages(session({}));
    expect(ranking.ordered).toHaveLength(0);
    expect(ranking.rationale.en).toContain('No solution candidates');
  });

  it('ranks a high-impact low-effort evidence-backed stage to the top', () => {
    const ranking = rankPainStages(
      session({
        pains: [pain('p1', { stage: 'diagnose', minutesPerOccurrence: 20, occurrencesPerYear: 50 })],
        solutions: [
          sol('s1', { stage: 'diagnose', impact: 'high', effort: 'low', evidence: ['5whys'] }),
          sol('s2', { stage: 'detect', impact: 'low', effort: 'high' }),
        ],
      })
    );
    expect(ranking.ordered[0]).toBe('diagnose');
    const diagnose = ranking.scores.find((s) => s.stage === 'diagnose')!;
    const detect = ranking.scores.find((s) => s.stage === 'detect')!;
    expect(diagnose.score).toBeGreaterThan(detect.score);
  });

  it('excludes stages with no solutions from ordering but reports them with score 0', () => {
    const ranking = rankPainStages(session({ solutions: [sol('s1', { stage: 'qualify' })] }));
    expect(ranking.ordered).toEqual(['qualify']);
    const empties = ranking.scores.filter((s) => s.solutionCount === 0);
    expect(empties).toHaveLength(3);
    empties.forEach((s) => expect(s.score).toBe(0));
  });
});

describe('Pain Explorer engine — W2 move validator', () => {
  it('requires rationale, trade-off and rejected variant', () => {
    expect(validateW2Move({}).missing).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);
    const full = validateW2Move({
      rationale: 'Lead with measure because cost ranking is guesswork otherwise',
      tradeOff: 'At the cost of a cycle of delay to fixes',
      rejectedVariant: 'We reject fixing the loudest pain before measuring it',
    });
    expect(full.valid).toBe(true);
  });

  it('every synthesized move passes its own W2 validation in both languages', () => {
    const sequence = buildW2MoveSequence(
      session({
        pains: [pain('p1', { stage: 'diagnose', minutesPerOccurrence: 20, occurrencesPerYear: 50 })],
        solutions: [sol('s1', { stage: 'diagnose', impact: 'high', effort: 'low', evidence: ['x'] })],
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
        pains: [
          pain('p1', { stage: 'detect', measured: false }),
          pain('p2', { stage: 'detect', measured: false }),
        ],
        solutions: [sol('s1', { stage: 'detect' })],
      })
    );
    expect(sequence[0].title.en).toContain('Measure');
  });

  it('always ends by diagnosing to a removable root behind an explicit trade-off', () => {
    const sequence = buildW2MoveSequence(
      session({
        pains: [pain('p1', { stage: 'qualify', minutesPerOccurrence: 20, occurrencesPerYear: 50 })],
        solutions: [sol('s1', { stage: 'qualify', impact: 'high', effort: 'low', evidence: ['x'] })],
      })
    );
    const diag = sequence.find((m) => m.stage === 'diagnose');
    expect(diag).toBeTruthy();
    expect(diag!.rejectedVariant.en.toLowerCase()).toContain('reject');
  });
});

describe('Pain Explorer engine — bridges', () => {
  it('toPainSession adapts operational sections defensively', () => {
    const s = toPainSession({
      'pain-points': [
        { id: 'p1', category: 'measure', impact: 'high', durationMinutes: 12, target: 200, threshold: 'root', reach: 4, evidence: ['log'] },
        { id: 'p2', category: 'nonsense' },
      ],
      solutions: [{ id: 's1', category: 'diagnose', impact: 'high', effort: 'low', evidence: ['p'] }],
    });
    expect(s.pains).toHaveLength(2);
    expect(s.pains[0].stage).toBe('measure');
    expect(s.pains[0].nature).toBe('root');
    expect(s.pains[0].measured).toBe(true);
    expect(s.pains[0].minutesPerOccurrence).toBe(12);
    expect(s.pains[1].stage).toBeUndefined();
    expect(s.solutions[0].stage).toBe('diagnose');
  });

  it('localizeMove folds trade-off and rejected variant into the rationale', () => {
    const [move] = buildW2MoveSequence(
      session({
        pains: [pain('p1', { stage: 'diagnose', minutesPerOccurrence: 20, occurrencesPerYear: 50 })],
        solutions: [sol('s1', { stage: 'diagnose', impact: 'high', effort: 'low', evidence: ['x'] })],
      })
    );
    const flat = localizeMove(move, false);
    expect(flat.rationale).toContain(move.tradeOff.en);
    expect(flat.rationale).toContain(move.rejectedVariant.en);
  });

  it('buildPainConclusionPrompt returns null for empty session and a grounded W2 prompt otherwise', () => {
    expect(buildPainConclusionPrompt(session({}), false)).toBeNull();
    const prompt = buildPainConclusionPrompt(
      session({
        pains: [pain('p1', { stage: 'diagnose', minutesPerOccurrence: 20, occurrencesPerYear: 50 })],
        solutions: [sol('s1', { stage: 'diagnose', impact: 'high', effort: 'low', evidence: ['x'] })],
      }),
      false
    )!;
    expect(prompt).toContain('PAIN PORTFOLIO');
    expect(prompt).toContain('W2 MOVE SEQUENCE');
    expect(prompt).toContain('rejected variant');
    expect(prompt).toContain('"tradeOff"');
    expect(prompt).toContain('"rejectedVariant"');
  });

  it('buildPainDeepenPrompt returns the localized rung question + framing', () => {
    const pl = buildPainDeepenPrompt('measure', 'quantification', true)!;
    expect(pl).toContain('Kontekst konsultanta');
    expect(buildPainDeepenPrompt('measure', 'quantification', false)!).toContain('Consultant framing');
  });

  it('synthesizePainPlan returns a consistent baseline + ranking + sequence', () => {
    const s = session({
      pains: [pain('p1', { stage: 'diagnose', minutesPerOccurrence: 20, occurrencesPerYear: 50, reach: 1 })],
      solutions: [sol('s1', { stage: 'diagnose', impact: 'high', effort: 'low', evidence: ['x'] })],
    });
    const { baseline, ranking, sequence } = synthesizePainPlan(s);
    expect(baseline.annualMinutesLost).toBe(1000);
    expect(ranking.ordered[0]).toBe('diagnose');
    expect(sequence.length).toBeGreaterThan(0);
  });
});
