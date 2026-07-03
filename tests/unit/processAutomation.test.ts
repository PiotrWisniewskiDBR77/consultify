import { describe, expect, it } from 'vitest';

import {
  AUTOMATION_DEEPENING_LADDER,
  AUTOMATION_LADDER_RUNG_ORDER,
  AUTOMATION_PHASES,
  AUTOMATION_PROPOSAL_BANK,
  buildProcessAutomationConclusionPrompt,
  buildProcessAutomationDeepenPrompt,
  buildW2MoveSequence,
  computeBaseline,
  localizeLadder,
  localizeMove,
  rankAutomationPhases,
  synthesizeAutomationPlan,
  toAutomationSession,
  validateW2Move,
  type AutomationCandidate,
  type AutomationSession,
} from '../../src/config/processautomation';

const cand = (id: string, overrides: Partial<AutomationCandidate> = {}): AutomationCandidate => ({
  id,
  phase: 'automate',
  impact: 'medium',
  effort: 'medium',
  evidence: [],
  ...overrides,
});

const session = (overrides: Partial<AutomationSession> = {}): AutomationSession => ({
  candidates: [],
  baseline: {},
  ...overrides,
});

describe('Process Automation config — structure', () => {
  it('defines all four automation phases with a full 4-rung deepening ladder in canonical order', () => {
    expect(AUTOMATION_PHASES).toEqual(['map', 'standardize', 'automate', 'sustain']);
    expect(AUTOMATION_LADDER_RUNG_ORDER).toEqual([
      'surface',
      'evidence',
      'quantification',
      'risk-capability',
    ]);

    AUTOMATION_PHASES.forEach((phase) => {
      const rungs = AUTOMATION_DEEPENING_LADDER[phase];
      expect(rungs).toHaveLength(4);
      expect(rungs.map((r) => r.id).sort()).toEqual([...AUTOMATION_LADDER_RUNG_ORDER].sort());
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
    AUTOMATION_PHASES.forEach((phase) => {
      const bank = AUTOMATION_PROPOSAL_BANK[phase];
      expect(bank.length).toBeGreaterThanOrEqual(2);
      bank.forEach((proposal) => {
        expect(proposal.title.pl).not.toEqual(proposal.title.en);
        expect(proposal.explanation.pl.length).toBeGreaterThan(20);
        expect(proposal.explanation.en.length).toBeGreaterThan(20);
        expect(AUTOMATION_LADDER_RUNG_ORDER).toContain(proposal.rung);
      });
    });
  });

  it('localizeLadder resolves to one language preserving rung order', () => {
    const pl = localizeLadder('automate', true);
    const en = localizeLadder('automate', false);
    expect(pl.map((r) => r.id)).toEqual(AUTOMATION_LADDER_RUNG_ORDER);
    expect(en.map((r) => r.id)).toEqual(AUTOMATION_LADDER_RUNG_ORDER);
    expect(pl[0].label).not.toEqual(en[0].label);
    expect(pl.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
  });
});

describe('Process Automation engine — baseline & ranking', () => {
  it('computes annualized hours, savings and error-points-removed from the quantitative baseline', () => {
    const baseline = computeBaseline(
      session({
        baseline: {
          volumePerWeek: 10,
          baselineMinutesPerCycle: 30,
          targetMinutesPerCycle: 12,
          errorRateBaselinePct: 8,
          errorRateTargetPct: 2,
        },
      })
    );
    // 10 runs/wk × 52 × 30 min / 60 = 260 h/yr
    expect(baseline.annualBaselineHours).toBe(260);
    // saved: 10 × 52 × 18 / 60 = 156 h/yr
    expect(baseline.minutesSavedPerCycle).toBe(18);
    expect(baseline.annualSavedHours).toBe(156);
    expect(baseline.errorPointsRemoved).toBe(6);
    expect(baseline.quantified).toBe(true);
  });

  it('marks the baseline unquantified when volume or cycle time is missing', () => {
    expect(computeBaseline(session({ baseline: {} })).quantified).toBe(false);
    expect(
      computeBaseline(session({ baseline: { volumePerWeek: 5 } })).quantified
    ).toBe(false);
  });

  it('ranks empty session with no ordered phases and a helpful rationale', () => {
    const ranking = rankAutomationPhases(session({}));
    expect(ranking.ordered).toHaveLength(0);
    expect(ranking.rationale.en).toContain('No automation candidates');
  });

  it('ranks a high-impact low-effort evidence-backed phase to the top', () => {
    const ranking = rankAutomationPhases(
      session({
        candidates: [
          cand('c1', { phase: 'automate', impact: 'high', effort: 'low', evidence: ['pilot'] }),
          cand('c2', { phase: 'sustain', impact: 'low', effort: 'high' }),
        ],
      })
    );
    expect(ranking.ordered[0]).toBe('automate');
    const automate = ranking.scores.find((s) => s.phase === 'automate')!;
    const sustain = ranking.scores.find((s) => s.phase === 'sustain')!;
    expect(automate.score).toBeGreaterThan(sustain.score);
  });

  it('excludes phases with no candidates from ordering but reports them with score 0', () => {
    const ranking = rankAutomationPhases(
      session({ candidates: [cand('c1', { phase: 'map' })] })
    );
    expect(ranking.ordered).toEqual(['map']);
    const empties = ranking.scores.filter((s) => s.candidateCount === 0);
    expect(empties).toHaveLength(3);
    empties.forEach((s) => expect(s.score).toBe(0));
  });
});

describe('Process Automation engine — W2 move validator', () => {
  it('requires rationale, trade-off and rejected variant', () => {
    expect(validateW2Move({}).missing).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);
    const full = validateW2Move({
      rationale: 'Standardize the process before automating the variation',
      tradeOff: 'At the cost of time to agree a single standard flow',
      rejectedVariant: 'We reject automating each variant separately',
    });
    expect(full.valid).toBe(true);
  });

  it('every synthesized move passes its own W2 validation in both languages', () => {
    const sequence = buildW2MoveSequence(
      session({
        baseline: { volumePerWeek: 10, baselineMinutesPerCycle: 30, targetMinutesPerCycle: 10 },
        candidates: [
          cand('c1', { phase: 'automate', impact: 'high', effort: 'low', evidence: ['x'] }),
        ],
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

  it('inserts a map-and-measure move when the baseline is unquantified', () => {
    const sequence = buildW2MoveSequence(
      session({
        baseline: {},
        candidates: [cand('c1', { phase: 'automate' })],
      })
    );
    expect(sequence[0].phase).toBe('map');
    expect(sequence[0].title.en.toLowerCase()).toContain('measure');
  });

  it('always defers sustain behind an explicit trade-off', () => {
    const sequence = buildW2MoveSequence(
      session({
        baseline: { volumePerWeek: 10, baselineMinutesPerCycle: 30, targetMinutesPerCycle: 10 },
        candidates: [
          cand('c1', { phase: 'automate', impact: 'high', effort: 'low', evidence: ['x'] }),
        ],
      })
    );
    const sustain = sequence.find((m) => m.phase === 'sustain');
    expect(sustain).toBeTruthy();
    expect(sustain!.rejectedVariant.en.toLowerCase()).toContain('reject');
  });

  it('surfaces a standardize-before-automate move when standardize has scope', () => {
    const sequence = buildW2MoveSequence(
      session({
        baseline: { volumePerWeek: 10, baselineMinutesPerCycle: 30, targetMinutesPerCycle: 10 },
        candidates: [
          cand('c1', { phase: 'automate', impact: 'high', effort: 'low', evidence: ['x'] }),
          cand('c2', { phase: 'standardize', impact: 'medium', effort: 'low', evidence: ['y'] }),
        ],
      })
    );
    const std = sequence.find((m) => m.phase === 'standardize');
    expect(std).toBeTruthy();
    expect(std!.title.en.toLowerCase()).toContain('standardize');
  });
});

describe('Process Automation engine — bridges', () => {
  it('toAutomationSession adapts operational sections + flow baseline defensively', () => {
    const s = toAutomationSession(
      {
        redesign: [
          { id: 'c1', category: 'automate', impact: 'high', effort: 'low', evidence: ['p'], minutesSaved: 8 },
          { id: 'c2', category: 'nonsense', impact: 'low' },
        ],
        're-estimation': [{ id: 'c3', category: 'standardize', durationMinutes: 5 }],
      },
      { volumePerWeek: 12, baselineMinutesPerCycle: 20, targetMinutesPerCycle: 8 }
    );
    expect(s.candidates).toHaveLength(3);
    expect(s.candidates[0].phase).toBe('automate');
    expect(s.candidates[0].minutesSaved).toBe(8);
    // unknown category → undefined phase, not a throw
    expect(s.candidates[1].phase).toBeUndefined();
    // durationMinutes falls back to minutesSaved
    expect(s.candidates[2].minutesSaved).toBe(5);
    expect(s.baseline.volumePerWeek).toBe(12);
  });

  it('localizeMove folds trade-off and rejected variant into the rationale', () => {
    const [move] = buildW2MoveSequence(
      session({
        baseline: { volumePerWeek: 10, baselineMinutesPerCycle: 30, targetMinutesPerCycle: 10 },
        candidates: [
          cand('c1', { phase: 'automate', impact: 'high', effort: 'low', evidence: ['x'] }),
        ],
      })
    );
    const flat = localizeMove(move, false);
    expect(flat.rationale).toContain(move.tradeOff.en);
    expect(flat.rationale).toContain(move.rejectedVariant.en);
  });

  it('buildProcessAutomationConclusionPrompt returns null for empty session and a grounded W2 prompt otherwise', () => {
    expect(buildProcessAutomationConclusionPrompt(session({}), false)).toBeNull();
    const prompt = buildProcessAutomationConclusionPrompt(
      session({
        baseline: {
          volumePerWeek: 10,
          baselineMinutesPerCycle: 30,
          targetMinutesPerCycle: 10,
          errorRateBaselinePct: 5,
          errorRateTargetPct: 1,
        },
        candidates: [
          cand('c1', { phase: 'automate', impact: 'high', effort: 'low', evidence: ['x'] }),
        ],
      }),
      false
    )!;
    expect(prompt).toContain('PROCESS BASELINE');
    expect(prompt).toContain('W2 MOVE SEQUENCE');
    expect(prompt).toContain('rejected variant');
    expect(prompt).toContain('"tradeOff"');
    expect(prompt).toContain('"rejectedVariant"');
  });

  it('conclusion prompt flags an unquantified baseline honestly', () => {
    const prompt = buildProcessAutomationConclusionPrompt(
      session({ baseline: {}, candidates: [cand('c1', { phase: 'automate' })] }),
      false
    )!;
    expect(prompt).toContain('NOT QUANTIFIED');
  });

  it('buildProcessAutomationDeepenPrompt returns the localized rung question + framing', () => {
    const pl = buildProcessAutomationDeepenPrompt('automate', 'quantification', true)!;
    expect(pl).toContain('Kontekst konsultanta');
    expect(buildProcessAutomationDeepenPrompt('automate', 'quantification', false)!).toContain(
      'Consultant framing'
    );
  });

  it('synthesizeAutomationPlan returns a consistent baseline + ranking + sequence', () => {
    const s = session({
      baseline: { volumePerWeek: 10, baselineMinutesPerCycle: 30, targetMinutesPerCycle: 10 },
      candidates: [cand('c1', { phase: 'automate', impact: 'high', effort: 'low', evidence: ['x'] })],
    });
    const { baseline, ranking, sequence } = synthesizeAutomationPlan(s);
    expect(baseline.quantified).toBe(true);
    expect(ranking.ordered[0]).toBe('automate');
    expect(sequence.length).toBeGreaterThan(0);
  });
});
