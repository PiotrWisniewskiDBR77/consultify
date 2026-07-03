import { describe, expect, it } from 'vitest';

import {
  RISK_DEEPENING_LADDER,
  RISK_DIMENSIONS,
  RISK_LADDER_RUNG_ORDER,
  RISK_PROPOSAL_BANK,
  RISK_RAID_SOURCE_TYPE,
  buildRaidSourceRef,
  buildRiskConclusionPrompt,
  buildW2MoveSequence,
  localizeLadder,
  rankRisks,
  scoreToRaidLevel,
  synthesizeRisk,
  toInitiativeRaidItems,
  toRiskMove,
  validateW2Move,
} from '../../src/config/riskuncertainty';
import type {
  RiskAssumption,
  RiskItem,
  RiskUncertaintyData,
  ScenarioItem,
} from '../../src/store/useToolStore';

const risk = (id: string, overrides: Partial<RiskItem> = {}): RiskItem => ({
  id,
  title: `Risk ${id}`,
  description: 'desc',
  probability: 3,
  impact: 3,
  mitigation: '',
  evidence: [],
  ...overrides,
});

const assumption = (id: string, overrides: Partial<RiskAssumption> = {}): RiskAssumption => ({
  id,
  text: `Assumption ${id}`,
  confidence: 3,
  evidence: [],
  ...overrides,
});

const scenario = (id: string, overrides: Partial<ScenarioItem> = {}): ScenarioItem => ({
  id,
  title: `Scenario ${id}`,
  likelihood: 3,
  notes: '',
  posture: 'base',
  ...overrides,
});

const buildData = (
  parts: Partial<RiskUncertaintyData> = {},
  goal = 'Decyzja o wejściu w nowy rynek'
): RiskUncertaintyData =>
  ({
    context: { goal, scope: 'company', timeframe: 'medium', successSignal: 'decyzja podjęta' },
    signals: [],
    assumptions: parts.assumptions || [],
    risks: parts.risks || [],
    scenarios: parts.scenarios || [],
    recommendedMoves: [],
    outputCandidates: [],
  }) as RiskUncertaintyData;

describe('Risk & Uncertainty config — structure', () => {
  it('defines all three dimensions with a full 4-rung deepening ladder in canonical order', () => {
    expect(RISK_DIMENSIONS).toEqual(['assumption', 'risk', 'scenario']);
    expect(RISK_LADDER_RUNG_ORDER).toEqual([
      'surface',
      'evidence',
      'quantification',
      'response-capability',
    ]);

    RISK_DIMENSIONS.forEach((dimension) => {
      const rungs = RISK_DEEPENING_LADDER[dimension];
      expect(rungs).toHaveLength(4);
      expect(rungs.map((r) => r.id).sort()).toEqual([...RISK_LADDER_RUNG_ORDER].sort());
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

  it('has a partner-grade bilingual proposal bank for every dimension', () => {
    RISK_DIMENSIONS.forEach((dimension) => {
      const bank = RISK_PROPOSAL_BANK[dimension];
      expect(bank.length).toBeGreaterThanOrEqual(4);
      bank.forEach((proposal) => {
        expect(proposal.title.pl).not.toEqual(proposal.title.en);
        expect(proposal.explanation.pl.length).toBeGreaterThan(20);
        expect(proposal.explanation.en.length).toBeGreaterThan(20);
        expect(RISK_LADDER_RUNG_ORDER).toContain(proposal.rung);
      });
    });
  });

  it('localizeLadder resolves to one language preserving rung order', () => {
    const pl = localizeLadder('risk', true);
    const en = localizeLadder('risk', false);
    expect(pl.map((r) => r.id)).toEqual(RISK_LADDER_RUNG_ORDER);
    expect(en.map((r) => r.id)).toEqual(RISK_LADDER_RUNG_ORDER);
    expect(pl[0].label).not.toEqual(en[0].label);
    expect(pl.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
  });
});

describe('Risk & Uncertainty engine — scoring & ranking', () => {
  it('ranks empty session with no ordered ids and a helpful rationale', () => {
    const ranking = rankRisks(buildData({}));
    expect(ranking.orderedRiskIds).toHaveLength(0);
    expect(ranking.orderedAssumptionIds).toHaveLength(0);
    expect(ranking.rationale.en).toContain('No accepted risks or assumptions');
  });

  it('orders risks by probability × impact exposure, highest first', () => {
    const data = buildData({
      risks: [
        risk('r1', { probability: 2, impact: 2 }), // exposure 4
        risk('r2', { probability: 5, impact: 5, evidence: ['data'] }), // exposure 25
        risk('r3', { probability: 3, impact: 4 }), // exposure 12
      ],
    });
    const ranking = rankRisks(data);
    expect(ranking.orderedRiskIds[0]).toBe('r2');
    expect(ranking.orderedRiskIds[ranking.orderedRiskIds.length - 1]).toBe('r1');
    expect(ranking.topExposure).toBe(25);
  });

  it('counts high-exposure risks that lack a full response', () => {
    const data = buildData({
      risks: [
        risk('r1', { probability: 4, impact: 4 }), // exp 16, no response
        risk('r2', {
          probability: 5,
          impact: 3, // exp 15
          mitigation: 'stand up a fallback supplier',
          owner: 'Ops lead',
          trigger: 'lead time > 6 weeks',
        }), // fully responded
      ],
    });
    const ranking = rankRisks(data);
    expect(ranking.unmitigatedHigh).toBe(1);
  });

  it('scores assumption fragility inversely to confidence', () => {
    const data = buildData({
      assumptions: [
        assumption('a1', { confidence: 1, consequenceIfWrong: 'plan collapses' }),
        assumption('a2', { confidence: 5 }),
      ],
    });
    const ranking = rankRisks(data);
    expect(ranking.orderedAssumptionIds[0]).toBe('a1');
    const a1 = ranking.assumptions.find((a) => a.id === 'a1')!;
    const a2 = ranking.assumptions.find((a) => a.id === 'a2')!;
    expect(a1.fragility).toBeGreaterThan(a2.fragility);
  });

  it('excludes rejected / rethinking items from the ranking', () => {
    const data = buildData({
      risks: [
        risk('r1', { probability: 5, impact: 5, proposalStatus: 'rejected' }),
        risk('r2', { probability: 2, impact: 2 }),
      ],
    });
    const ranking = rankRisks(data);
    expect(ranking.orderedRiskIds).toEqual(['r2']);
  });
});

describe('Risk & Uncertainty engine — W2 move validator', () => {
  it('validates that a move must carry rationale, trade-off and rejected variant', () => {
    expect(validateW2Move({}).valid).toBe(false);
    expect(validateW2Move({}).missing).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);

    const thin = validateW2Move({ rationale: 'ok', tradeOff: 'ok', rejectedVariant: 'ok' });
    expect(thin.valid).toBe(false);
    expect(thin.weak).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);

    const full = validateW2Move({
      rationale: 'Validate the fragile assumption because the plan rests on it',
      tradeOff: 'At the cost of one cycle of delay before scale',
      rejectedVariant: 'We reject assuming it holds without a test',
    });
    expect(full.valid).toBe(true);
  });

  it('every synthesized move passes its own W2 validation in both languages', () => {
    const data = buildData({
      assumptions: [assumption('a1', { confidence: 1, consequenceIfWrong: 'plan collapses' })],
      risks: [risk('r1', { probability: 5, impact: 5 })],
      scenarios: [scenario('s1', { posture: 'stress' })],
    });
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

  it('validates the most fragile assumption first, then mitigates the top risk', () => {
    const data = buildData({
      assumptions: [assumption('a1', { confidence: 1, consequenceIfWrong: 'plan collapses' })],
      risks: [risk('r1', { probability: 5, impact: 5 })],
    });
    const sequence = buildW2MoveSequence(data);
    expect(sequence[0].category).toBe('validate');
    expect(sequence[0].linkedAssumptionIds).toEqual(['a1']);
    const mitigate = sequence.find((m) => m.category === 'mitigate');
    expect(mitigate).toBeTruthy();
    expect(mitigate!.linkedRiskIds).toEqual(['r1']);
  });

  it('sets a monitor move for a downside/stress scenario tail', () => {
    const data = buildData({
      risks: [risk('r1', { probability: 4, impact: 4 })],
      scenarios: [scenario('s1', { posture: 'stress', title: 'Supply shock' })],
    });
    const sequence = buildW2MoveSequence(data);
    expect(sequence.some((m) => m.category === 'monitor')).toBe(true);
  });

  it('toRiskMove folds trade-off and rejected variant into the store rationale field', () => {
    const [move] = buildW2MoveSequence(
      buildData({ risks: [risk('r1', { probability: 5, impact: 5 })] })
    );
    const riskMove = toRiskMove(move, false, 'move-1');
    expect(riskMove.id).toBe('move-1');
    expect(riskMove.rationale).toContain(move.rationale.en);
    expect(riskMove.rationale).toContain(move.tradeOff.en);
    expect(riskMove.rationale).toContain(move.rejectedVariant.en);
    expect(riskMove.proposalStatus).toBe('ai-proposed');
  });
});

describe('Risk & Uncertainty engine — bridges', () => {
  it('buildRiskConclusionPrompt returns null for empty session and a grounded prompt otherwise', () => {
    expect(buildRiskConclusionPrompt(buildData({}), false)).toBeNull();

    const prompt = buildRiskConclusionPrompt(
      buildData({
        assumptions: [assumption('a1', { confidence: 1, consequenceIfWrong: 'plan collapses' })],
        risks: [risk('r1', { probability: 5, impact: 5, evidence: ['x'] })],
      }),
      false
    )!;
    expect(prompt).toContain('RISK EXPOSURE');
    expect(prompt).toContain('ASSUMPTION FRAGILITY');
    expect(prompt).toContain('W2 RESILIENCE MOVE SEQUENCE');
    expect(prompt).toContain('"tradeOff"');
    expect(prompt).toContain('"rejectedVariant"');
    // exposure math surfaced in the grounded facts
    expect(prompt).toContain('25/25');
  });

  it('synthesizeRisk returns a consistent ranking + sequence', () => {
    const data = buildData({
      assumptions: [assumption('a1', { confidence: 1, consequenceIfWrong: 'x' })],
      risks: [risk('r1', { probability: 5, impact: 5 })],
    });
    const { ranking, sequence } = synthesizeRisk(data);
    expect(ranking.orderedRiskIds[0]).toBe('r1');
    expect(sequence.length).toBeGreaterThan(0);
  });
});

describe('Risk & Uncertainty → Initiative RAID handoff', () => {
  it('maps accepted risks and assumptions into RAID items with tool-session provenance', () => {
    const data = buildData({
      risks: [
        risk('r1', {
          probability: 5,
          impact: 5,
          mitigation: 'dual-source the component',
          owner: 'Ops',
          trigger: 'lead time > 6w',
          description: 'Anchor supplier fails',
        }),
      ],
      assumptions: [
        assumption('a1', {
          confidence: 1,
          consequenceIfWrong: 'entire GTM plan voids',
          validationMethod: 'paid pilot with 3 accounts',
        }),
      ],
    });

    const handed = toInitiativeRaidItems(data, {
      sessionId: 'sess-123',
      sessionTitle: 'Market entry risk',
      createdBy: 'user-9',
    });

    // one risk + one assumption
    expect(handed).toHaveLength(2);

    const riskItem = handed.find((h) => h.item.type === 'risk')!;
    const assumptionItem = handed.find((h) => h.item.type === 'assumption')!;
    expect(riskItem).toBeTruthy();
    expect(assumptionItem).toBeTruthy();

    // provenance carries the canonical tool-session source type + session id (back-reference)
    expect(RISK_RAID_SOURCE_TYPE).toBe('tool_session');
    handed.forEach((h) => {
      expect(h.provenance.sourceType).toBe('tool_session');
      expect(h.provenance.sourceId).toBe('sess-123');
      expect(h.provenance.createdBy).toBe('user-9');
      // human-readable back-reference survives on the flat RaidItem too
      expect(h.item.source).toBe(buildRaidSourceRef('sess-123', 'Market entry risk'));
      expect(h.item.source).toContain('tool_session:sess-123');
    });

    // risk mapping detail: P5×I5 → critical bands, mitigation preserved, response strategy inferred
    expect(riskItem.item.probability).toBe('critical');
    expect(riskItem.item.impact).toBe('critical');
    expect(riskItem.item.mitigation).toBe('dual-source the component');
    expect(riskItem.item.owner).toBe('Ops');
    expect(riskItem.item.responseStrategy).toBe('mitigate');
    expect(riskItem.item.proposedAction).toContain('lead time > 6w');

    // assumption mapping detail: low confidence → high fragility band, validation surfaced
    expect(assumptionItem.item.description).toContain('entire GTM plan voids');
    expect(assumptionItem.item.proposedAction).toContain('paid pilot with 3 accounts');
    expect(['high', 'critical']).toContain(assumptionItem.item.impact);
  });

  it('excludes rejected items from the handoff by default and does not map scenarios', () => {
    const data = buildData({
      risks: [
        risk('r1', { proposalStatus: 'rejected' }),
        risk('r2', { probability: 3, impact: 3 }),
      ],
      scenarios: [scenario('s1', { posture: 'stress' })],
    });
    const handed = toInitiativeRaidItems(data, { sessionId: 'sess-1' });
    // only the accepted risk; scenario is analysis context, never a RAID line
    expect(handed).toHaveLength(1);
    expect(handed[0].item.id).toBe('raid-risk-r2');
    expect(handed.every((h) => h.item.type !== 'issue' && h.item.type !== 'dependency')).toBe(true);
  });

  it('scoreToRaidLevel collapses the 1..5 scale into the 4-band RaidLevel', () => {
    expect(scoreToRaidLevel(1)).toBe('low');
    expect(scoreToRaidLevel(2)).toBe('medium');
    expect(scoreToRaidLevel(4)).toBe('high');
    expect(scoreToRaidLevel(5)).toBe('critical');
  });
});
