import { describe, expect, it } from 'vitest';

import {
  DMS_DEEPENING_LADDER,
  DMS_LADDER_RUNG_ORDER,
  DMS_LAYERS,
  DMS_PROPOSAL_BANK,
  DMS_QUESTION_BANK,
  DMS_QUESTION_ROOT_ID,
  buildDmsConclusionPrompt,
  buildDmsDeepenPrompt,
  buildDmsQuestionBankPromptRules,
  buildW2MoveSequence,
  detectDmsGaps,
  getDmsQuestion,
  getNextDmsQuestionId,
  isForcedLoopDmsQuestion,
  localizeLadder,
  localizeMove,
  rankDmsLayers,
  synthesizeDmsPlan,
  toDmsSession,
  validateW2Move,
  type DmsSession,
  type EscalationRule,
  type KpiItem,
} from '../../src/config/dmsbuilder';

const kpi = (id: string, overrides: Partial<KpiItem> = {}): KpiItem => ({
  id,
  hasTarget: true,
  hasOwner: true,
  frequency: 'daily',
  ...overrides,
});

const rule = (id: string, overrides: Partial<EscalationRule> = {}): EscalationRule => ({
  id,
  hasTrigger: true,
  hasTargetLevel: true,
  hasResponse: true,
  verifiesEffect: true,
  ...overrides,
});

const session = (overrides: Partial<DmsSession> = {}): DmsSession => ({
  kpis: [],
  escalationRules: [],
  ...overrides,
});

describe('DMS config — structure', () => {
  it('defines all four control-loop layers with a full 4-rung deepening ladder in canonical order', () => {
    expect(DMS_LAYERS).toEqual(['visibility', 'cadence', 'escalation', 'response']);
    expect(DMS_LADDER_RUNG_ORDER).toEqual([
      'surface',
      'evidence',
      'quantification',
      'risk-capability',
    ]);

    DMS_LAYERS.forEach((layer) => {
      const rungs = DMS_DEEPENING_LADDER[layer];
      expect(rungs).toHaveLength(4);
      expect(rungs.map((r) => r.id).sort()).toEqual([...DMS_LADDER_RUNG_ORDER].sort());
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

  it('has a partner-grade bilingual proposal bank for every layer', () => {
    DMS_LAYERS.forEach((layer) => {
      const bank = DMS_PROPOSAL_BANK[layer];
      expect(bank.length).toBeGreaterThanOrEqual(4);
      bank.forEach((proposal) => {
        expect(proposal.title.pl).not.toEqual(proposal.title.en);
        expect(proposal.explanation.pl.length).toBeGreaterThan(20);
        expect(proposal.explanation.en.length).toBeGreaterThan(20);
        expect(DMS_LADDER_RUNG_ORDER).toContain(proposal.rung);
      });
    });
  });

  it('localizeLadder resolves to one language preserving rung order', () => {
    const pl = localizeLadder('escalation', true);
    const en = localizeLadder('escalation', false);
    expect(pl.map((r) => r.id)).toEqual(DMS_LADDER_RUNG_ORDER);
    expect(en.map((r) => r.id)).toEqual(DMS_LADDER_RUNG_ORDER);
    expect(pl[0].label).not.toEqual(en[0].label);
    expect(pl.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
  });
});

describe('DMS engine — control-loop scoring & weakest-first ranking', () => {
  it('reports a broken loop when a downstream layer is absent, and ranks the weakest link first', () => {
    const ranking = rankDmsLayers(
      session({
        kpis: [kpi('k1'), kpi('k2'), kpi('k3')],
        escalationRules: [], // no escalation => loop broken at escalation
      })
    );
    expect(ranking.loopClosed).toBe(false);
    // weakest link is escalation or response (both absent), surfaced first
    expect(['escalation', 'response']).toContain(ranking.ordered[0]);
    expect(ranking.rationale.en.toLowerCase()).toContain('broken');
  });

  it('rewards a fully populated loop with higher maturity and reports it closed', () => {
    const ranking = rankDmsLayers(
      session({
        kpis: [kpi('k1'), kpi('k2'), kpi('k3'), kpi('k4')],
        escalationRules: [rule('r1'), rule('r2')],
      })
    );
    expect(ranking.loopClosed).toBe(true);
    expect(ranking.loopMaturity).toBeGreaterThan(1.5);
  });

  it('ranks the weakest layer first even when the loop is closed', () => {
    const ranking = rankDmsLayers(
      session({
        kpis: [kpi('k1'), kpi('k2'), kpi('k3')],
        // escalation present but thin (no trigger), response verified
        escalationRules: [rule('r1', { hasTrigger: false })],
      })
    );
    const escalation = ranking.scores.find((s) => s.layer === 'escalation')!;
    const visibility = ranking.scores.find((s) => s.layer === 'visibility')!;
    expect(escalation.maturity).toBeLessThan(visibility.maturity);
    expect(ranking.ordered.indexOf('escalation')).toBeLessThan(
      ranking.ordered.indexOf('visibility')
    );
  });
});

describe('DMS engine — W2 move validator', () => {
  it('requires rationale, trade-off and rejected variant', () => {
    expect(validateW2Move({}).missing).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);
    const full = validateW2Move({
      rationale: 'Fix escalation because a signal with no path upward is ignored',
      tradeOff: 'At the cost of senior time that must act on escalations',
      rejectedVariant: 'We reject raise-to-manager with no threshold or clock',
    });
    expect(full.valid).toBe(true);
  });

  it('every synthesized move passes its own W2 validation in both languages', () => {
    const sequence = buildW2MoveSequence(
      session({
        kpis: [kpi('k1'), kpi('k2'), kpi('k3')],
        escalationRules: [rule('r1', { hasTrigger: false, hasResponse: false, verifiesEffect: false })],
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

  it('sequences repair moves in loop order (visibility before escalation before response)', () => {
    const sequence = buildW2MoveSequence(
      session({
        // everything weak so all layers are candidates
        kpis: [kpi('k1', { hasTarget: false, hasOwner: false, frequency: undefined })],
        escalationRules: [rule('r1', { hasTrigger: false, hasTargetLevel: false, hasResponse: false, verifiesEffect: false })],
      })
    );
    const layers = sequence.map((m) => m.layer);
    const loopIndex = (l: string) => DMS_LAYERS.indexOf(l as (typeof DMS_LAYERS)[number]);
    for (let i = 1; i < layers.length; i += 1) {
      expect(loopIndex(layers[i])).toBeGreaterThan(loopIndex(layers[i - 1]));
    }
  });
});

describe('DMS engine — bridges', () => {
  it('toDmsSession adapts operational sections defensively', () => {
    const s = toDmsSession({
      kpis: [{ id: 'k1', target: '95%', owner: 'Line lead', frequency: 'daily' }],
      escalation: [
        { id: 'r1', threshold: '2 days off-target', target: 'Tier-2', description: 'countermeasure', frequency: 'verified' },
      ],
    });
    expect(s.kpis[0].hasTarget).toBe(true);
    expect(s.kpis[0].hasOwner).toBe(true);
    expect(s.escalationRules[0].hasTrigger).toBe(true);
    expect(s.escalationRules[0].hasTargetLevel).toBe(true);
    expect(s.escalationRules[0].hasResponse).toBe(true);
    expect(s.escalationRules[0].verifiesEffect).toBe(true);
  });

  it('localizeMove folds trade-off and rejected variant into the rationale', () => {
    const [move] = buildW2MoveSequence(
      session({
        kpis: [kpi('k1', { hasTarget: false })],
        escalationRules: [rule('r1', { hasResponse: false })],
      })
    );
    const flat = localizeMove(move, false);
    expect(flat.rationale).toContain(move.tradeOff.en);
    expect(flat.rationale).toContain(move.rejectedVariant.en);
  });

  it('buildDmsConclusionPrompt returns null for empty session and a grounded W2 prompt otherwise', () => {
    expect(buildDmsConclusionPrompt(session({}), false)).toBeNull();
    const prompt = buildDmsConclusionPrompt(
      session({
        kpis: [kpi('k1'), kpi('k2'), kpi('k3')],
        escalationRules: [rule('r1', { hasTrigger: false })],
      }),
      false
    )!;
    expect(prompt).toContain('CONTROL-LOOP STATE');
    expect(prompt).toContain('W2 MOVE SEQUENCE');
    expect(prompt).toContain('rejected variant');
    expect(prompt).toContain('"verdict"');
    expect(prompt).toContain('"tradeoffs"');
    expect(prompt).toContain('"initiatives"');
  });

  it('buildDmsDeepenPrompt returns the localized rung question + framing', () => {
    expect(buildDmsDeepenPrompt('escalation', 'quantification', true)!).toContain(
      'Kontekst konsultanta'
    );
    expect(buildDmsDeepenPrompt('escalation', 'quantification', false)!).toContain(
      'Consultant framing'
    );
  });

  it('synthesizeDmsPlan returns a consistent ranking + sequence', () => {
    const { ranking, sequence } = synthesizeDmsPlan(
      session({
        kpis: [kpi('k1'), kpi('k2'), kpi('k3')],
        escalationRules: [rule('r1', { hasTrigger: false })],
      })
    );
    expect(ranking.scores).toHaveLength(4);
    expect(sequence.length).toBeGreaterThan(0);
  });
});

describe('DMS engine — coverage gap detection (OXFORD O3)', () => {
  it('flags every layer as absent for an empty session', () => {
    const gaps = detectDmsGaps(session({}));
    expect(gaps).toHaveLength(4);
    gaps.forEach((g) => expect(g.kind).toBe('layer-absent'));
  });

  it('flags a weak-but-present layer distinctly from an absent one', () => {
    const gaps = detectDmsGaps(
      session({
        kpis: [kpi('k1', { hasTarget: false, hasOwner: false, frequency: undefined })],
        escalationRules: [],
      })
    );
    const visibility = gaps.find((g) => g.layer === 'visibility');
    expect(visibility).toBeTruthy();
    expect(visibility!.kind).toBe('layer-weak');
    expect(gaps.find((g) => g.layer === 'escalation')!.kind).toBe('layer-absent');
  });

  it('reports no gaps once every layer is mature', () => {
    const gaps = detectDmsGaps(
      session({
        kpis: [kpi('k1'), kpi('k2'), kpi('k3')],
        escalationRules: [rule('r1'), rule('r2')],
      })
    );
    expect(gaps).toHaveLength(0);
  });
});

describe('DMS branching question bank (OXFORD O3)', () => {
  it('starts at the surface question and has 4 laddered levels', () => {
    const root = getDmsQuestion(DMS_QUESTION_ROOT_ID);
    expect(root).toBeTruthy();
    expect(root!.level).toBe(1);
    const levels = new Set(DMS_QUESTION_BANK.map((q) => q.level));
    expect(levels).toEqual(new Set([1, 2, 3, 4]));
  });

  it('forces the cadence loop until a fixed rhythm is named', () => {
    expect(isForcedLoopDmsQuestion('dms-cadence-force')).toBe(true);
    expect(getNextDmsQuestionId('dms-cadence-force', 'still-no-rhythm')).toBe('dms-cadence-force');
    expect(getNextDmsQuestionId('dms-cadence-force', 'cadence-named')).toBe('dms-escalation');
  });

  it('every node has at least two answer options', () => {
    DMS_QUESTION_BANK.forEach((node) => {
      expect(node.answerOptions.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('unknown answer keys fall back to defaultNextId', () => {
    expect(getNextDmsQuestionId('dms-surface', 'unknown-key')).toBe(
      getDmsQuestion('dms-surface')!.defaultNextId
    );
  });

  it('buildDmsQuestionBankPromptRules mentions the forced-loop discipline in both languages', () => {
    expect(buildDmsQuestionBankPromptRules('en')).toContain('dms-cadence-force');
    expect(buildDmsQuestionBankPromptRules('pl')).toContain('dms-cadence-force');
  });
});
