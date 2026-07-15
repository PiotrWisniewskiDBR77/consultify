import { describe, expect, it } from 'vitest';

import {
  AI_DEEPENING_LADDER,
  AI_DISCOVERY_QUESTION_BANK,
  AI_DISCOVERY_QUESTION_ROOT_ID,
  AI_LADDER_RUNG_ORDER,
  AI_PHASES,
  AI_PROPOSAL_BANK,
  buildAiDiscoveryConclusionPrompt,
  buildAiDiscoveryDeepenPrompt,
  buildAiDiscoveryQuestionBankPromptRules,
  buildW2MoveSequence,
  computeBaseline,
  detectDiscoveryGaps,
  getAiDiscoveryQuestion,
  getNextAiDiscoveryQuestionId,
  isForcedLoopAiDiscoveryQuestion,
  localizeLadder,
  localizeMove,
  rankPhases,
  synthesizeDiscoveryPlan,
  toDiscoverySession,
  validateW2Move,
  type AiUseCase,
  type DiscoveryMoveItem,
  type DiscoverySession,
} from '../../src/config/aidiscovery';

const uc = (id: string, overrides: Partial<AiUseCase> = {}): AiUseCase => ({
  id,
  dataReadiness: 'ready',
  annualValue: 100,
  hasOwner: true,
  feasibility: 'medium',
  measured: true,
  ...overrides,
});

const move = (id: string, overrides: Partial<DiscoveryMoveItem> = {}): DiscoveryMoveItem => ({
  id,
  phase: 'discover',
  impact: 'medium',
  effort: 'medium',
  evidence: [],
  ...overrides,
});

const session = (overrides: Partial<DiscoverySession> = {}): DiscoverySession => ({
  useCases: [],
  moves: [],
  ...overrides,
});

describe('AI Discovery config — structure', () => {
  it('defines all four phases with a full 4-rung deepening ladder in canonical order', () => {
    expect(AI_PHASES).toEqual(['discover', 'feasibility', 'value', 'sequence']);
    expect(AI_LADDER_RUNG_ORDER).toEqual([
      'surface',
      'evidence',
      'quantification',
      'risk-capability',
    ]);

    AI_PHASES.forEach((phase) => {
      const rungs = AI_DEEPENING_LADDER[phase];
      expect(rungs).toHaveLength(4);
      expect(rungs.map((r) => r.id).sort()).toEqual([...AI_LADDER_RUNG_ORDER].sort());
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
    AI_PHASES.forEach((phase) => {
      const bank = AI_PROPOSAL_BANK[phase];
      expect(bank.length).toBeGreaterThanOrEqual(4);
      bank.forEach((proposal) => {
        expect(proposal.title.pl).not.toEqual(proposal.title.en);
        expect(proposal.explanation.pl.length).toBeGreaterThan(20);
        expect(proposal.explanation.en.length).toBeGreaterThan(20);
        expect(AI_LADDER_RUNG_ORDER).toContain(proposal.rung);
      });
    });
  });

  it('localizeLadder resolves to one language preserving rung order', () => {
    const pl = localizeLadder('feasibility', true);
    const en = localizeLadder('feasibility', false);
    expect(pl.map((r) => r.id)).toEqual(AI_LADDER_RUNG_ORDER);
    expect(en.map((r) => r.id)).toEqual(AI_LADDER_RUNG_ORDER);
    expect(pl[0].label).not.toEqual(en[0].label);
    expect(pl.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
  });
});

describe('AI Discovery engine — baseline & ranking', () => {
  it('computes value at stake, ready value, owner count and readiness ratio', () => {
    const baseline = computeBaseline(
      session({
        useCases: [
          uc('a', { dataReadiness: 'ready', annualValue: 500, hasOwner: true }),
          uc('b', { dataReadiness: 'partial', annualValue: 300, hasOwner: false }),
          uc('c', { dataReadiness: 'missing', annualValue: 200, hasOwner: false, measured: false }),
        ],
      })
    );
    expect(baseline.useCaseCount).toBe(3);
    expect(baseline.totalValueAtStake).toBe(1000);
    expect(baseline.readyValueAtStake).toBe(500);
    expect(baseline.ownedCount).toBe(1);
    // (1 + 0.5 + 0) / 3
    expect(baseline.dataReadinessRatio).toBe(0.5);
    // 2 of 3 measured
    expect(baseline.measuredRatio).toBe(0.7);
  });

  it('ranks empty session with no ordered phases and a helpful rationale', () => {
    const ranking = rankPhases(session({}));
    expect(ranking.ordered).toHaveLength(0);
    expect(ranking.rationale.en).toContain('No move candidates');
  });

  it('ranks a high-impact low-effort evidence-backed phase to the top', () => {
    const ranking = rankPhases(
      session({
        useCases: [uc('u1', { dataReadiness: 'ready', annualValue: 400 })],
        moves: [
          move('m1', { phase: 'sequence', impact: 'high', effort: 'low', evidence: ['ranking'] }),
          move('m2', { phase: 'value', impact: 'low', effort: 'high' }),
        ],
      })
    );
    expect(ranking.ordered[0]).toBe('sequence');
    const sequence = ranking.scores.find((s) => s.phase === 'sequence')!;
    const value = ranking.scores.find((s) => s.phase === 'value')!;
    expect(sequence.score).toBeGreaterThan(value.score);
  });

  it('excludes phases with no moves from ordering but reports them with score 0', () => {
    const ranking = rankPhases(session({ moves: [move('m1', { phase: 'discover' })] }));
    expect(ranking.ordered).toEqual(['discover']);
    const empties = ranking.scores.filter((s) => s.moveCount === 0);
    expect(empties).toHaveLength(3);
    empties.forEach((s) => expect(s.score).toBe(0));
  });
});

describe('AI Discovery engine — W2 move validator', () => {
  it('requires rationale, trade-off and rejected variant', () => {
    expect(validateW2Move({}).missing).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);
    const full = validateW2Move({
      rationale: 'Lead with the lighthouse because it buys credibility',
      tradeOff: 'At the cost of deferring higher-potential cases',
      rejectedVariant: 'We reject starting with a moonshot',
    });
    expect(full.valid).toBe(true);
  });

  it('every synthesized move passes its own W2 validation in both languages', () => {
    const sequence = buildW2MoveSequence(
      session({
        useCases: [uc('u1', { dataReadiness: 'ready', annualValue: 300 })],
        moves: [move('m1', { phase: 'sequence', impact: 'high', effort: 'low', evidence: ['x'] })],
      })
    );
    expect(sequence.length).toBeGreaterThan(0);
    sequence.forEach((m) => {
      expect(m.validation.valid).toBe(true);
      expect(m.rationale.pl.trim()).not.toEqual('');
      expect(m.tradeOff.en.trim()).not.toEqual('');
      expect(m.rejectedVariant.pl.trim()).not.toEqual('');
      const re = validateW2Move({
        rationale: m.rationale.en,
        tradeOff: m.tradeOff.en,
        rejectedVariant: m.rejectedVariant.en,
      });
      expect(re.valid).toBe(true);
    });
  });

  it('inserts a feasibility-first move when data readiness is thin', () => {
    const sequence = buildW2MoveSequence(
      session({
        useCases: [
          uc('u1', { dataReadiness: 'missing', annualValue: 400 }),
          uc('u2', { dataReadiness: 'missing', annualValue: 300 }),
        ],
        moves: [move('m1', { phase: 'value' })],
      })
    );
    expect(sequence[0].phase).toBe('feasibility');
    expect(sequence[0].title.en).toContain('feasibility');
  });

  it('always defers moonshots (value) behind an explicit trade-off', () => {
    const sequence = buildW2MoveSequence(
      session({
        useCases: [uc('u1', { dataReadiness: 'ready', annualValue: 500 })],
        moves: [move('m1', { phase: 'discover', impact: 'high', effort: 'low', evidence: ['x'] })],
      })
    );
    const value = sequence.find((m) => m.phase === 'value');
    expect(value).toBeTruthy();
    expect(value!.rejectedVariant.en.toLowerCase()).toContain('reject');
  });
});

describe('AI Discovery engine — bridges', () => {
  it('toDiscoverySession adapts operational sections defensively', () => {
    const s = toDiscoverySession({
      usecases: [
        { id: 'u1', threshold: 'ready', target: 500, owner: 'COO', impact: 'high' },
        { id: 'u2', threshold: 'missing', annualValue: 200 },
      ],
      moves: [{ id: 'm1', category: 'sequence', impact: 'high', effort: 'low', evidence: ['p'] }],
    });
    expect(s.useCases).toHaveLength(2);
    expect(s.useCases[0].dataReadiness).toBe('ready');
    expect(s.useCases[0].annualValue).toBe(500);
    expect(s.useCases[0].hasOwner).toBe(true);
    expect(s.useCases[0].measured).toBe(true);
    expect(s.useCases[1].dataReadiness).toBe('missing');
    expect(s.moves[0].phase).toBe('sequence');
  });

  it('localizeMove folds trade-off and rejected variant into the rationale', () => {
    const [m] = buildW2MoveSequence(
      session({
        useCases: [uc('u1', { dataReadiness: 'ready', annualValue: 300 })],
        moves: [move('m1', { phase: 'sequence', impact: 'high', effort: 'low', evidence: ['x'] })],
      })
    );
    const flat = localizeMove(m, false);
    expect(flat.rationale).toContain(m.tradeOff.en);
    expect(flat.rationale).toContain(m.rejectedVariant.en);
  });

  it('buildAiDiscoveryConclusionPrompt returns null for empty session and a grounded W2 prompt otherwise', () => {
    expect(buildAiDiscoveryConclusionPrompt(session({}), false)).toBeNull();
    const prompt = buildAiDiscoveryConclusionPrompt(
      session({
        useCases: [uc('u1', { dataReadiness: 'ready', annualValue: 500 })],
        moves: [move('m1', { phase: 'discover', impact: 'high', effort: 'low', evidence: ['x'] })],
      }),
      false
    )!;
    expect(prompt).toContain('DISCOVERY BASELINE');
    expect(prompt).toContain('W2 MOVE SEQUENCE');
    expect(prompt).toContain('rejected variant');
    expect(prompt).toContain('"verdict"');
    expect(prompt).toContain('"tradeoffs"');
    expect(prompt).toContain('"initiatives"');
  });

  it('buildAiDiscoveryDeepenPrompt returns the localized rung question + framing', () => {
    const pl = buildAiDiscoveryDeepenPrompt('feasibility', 'quantification', true)!;
    expect(pl).toContain('Kontekst konsultanta');
    expect(buildAiDiscoveryDeepenPrompt('feasibility', 'quantification', false)!).toContain(
      'Consultant framing'
    );
  });

  it('synthesizeDiscoveryPlan returns a consistent baseline + ranking + sequence', () => {
    const s = session({
      useCases: [uc('u1', { dataReadiness: 'ready', annualValue: 400 })],
      moves: [move('m1', { phase: 'sequence', impact: 'high', effort: 'low', evidence: ['x'] })],
    });
    const { baseline, ranking, sequence } = synthesizeDiscoveryPlan(s);
    expect(baseline.totalValueAtStake).toBe(400);
    expect(ranking.ordered[0]).toBe('sequence');
    expect(sequence.length).toBeGreaterThan(0);
  });
});

describe('AI Discovery engine — coverage gap detection (OXFORD O3)', () => {
  it('flags an empty portfolio', () => {
    const gaps = detectDiscoveryGaps(session({}));
    expect(gaps).toHaveLength(1);
    expect(gaps[0].kind).toBe('no-use-cases');
  });

  it('flags ready, valuable use cases with no named owner', () => {
    const gaps = detectDiscoveryGaps(
      session({ useCases: [uc('u1', { hasOwner: false, annualValue: 500 })] })
    );
    expect(gaps.some((g) => g.kind === 'unowned-ready-value')).toBe(true);
  });

  it('flags a phase that governs value but has zero move candidates', () => {
    const gaps = detectDiscoveryGaps(
      session({
        useCases: [uc('u1', { dataReadiness: 'partial', annualValue: 300 })],
        moves: [],
      })
    );
    expect(gaps.some((g) => g.kind === 'phase-empty-with-value' && g.phase === 'feasibility')).toBe(
      true
    );
  });

  it('reports no gaps for a fully owned, fully sequenced portfolio', () => {
    const gaps = detectDiscoveryGaps(
      session({
        useCases: [uc('u1', { hasOwner: true, dataReadiness: 'ready', annualValue: 200 })],
        moves: [
          move('m1', { phase: 'discover' }),
          move('m2', { phase: 'sequence' }),
          move('m3', { phase: 'value' }),
          move('m4', { phase: 'feasibility' }),
        ],
      })
    );
    expect(gaps).toHaveLength(0);
  });
});

describe('AI Discovery branching question bank (OXFORD O3)', () => {
  it('starts at the surface question and has 4 laddered levels', () => {
    const root = getAiDiscoveryQuestion(AI_DISCOVERY_QUESTION_ROOT_ID);
    expect(root).toBeTruthy();
    expect(root!.level).toBe(1);
    const levels = new Set(AI_DISCOVERY_QUESTION_BANK.map((q) => q.level));
    expect(levels).toEqual(new Set([1, 2, 3, 4]));
  });

  it('forces the data-proof loop until a real sample is named', () => {
    expect(isForcedLoopAiDiscoveryQuestion('aid-data-force')).toBe(true);
    expect(getNextAiDiscoveryQuestionId('aid-data-force', 'still-assumed')).toBe('aid-data-force');
    expect(getNextAiDiscoveryQuestionId('aid-data-force', 'sample-found')).toBe('aid-quantify');
  });

  it('every node has at least two answer options', () => {
    AI_DISCOVERY_QUESTION_BANK.forEach((node) => {
      expect(node.answerOptions.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('unknown answer keys fall back to defaultNextId', () => {
    expect(getNextAiDiscoveryQuestionId('aid-surface', 'unknown-key')).toBe(
      getAiDiscoveryQuestion('aid-surface')!.defaultNextId
    );
  });

  it('buildAiDiscoveryQuestionBankPromptRules mentions the forced-loop discipline in both languages', () => {
    expect(buildAiDiscoveryQuestionBankPromptRules('en')).toContain('aid-data-force');
    expect(buildAiDiscoveryQuestionBankPromptRules('pl')).toContain('aid-data-force');
  });
});
