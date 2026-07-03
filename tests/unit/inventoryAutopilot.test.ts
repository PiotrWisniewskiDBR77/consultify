import { describe, expect, it } from 'vitest';

import {
  INVENTORY_DEEPENING_LADDER,
  INVENTORY_LADDER_RUNG_ORDER,
  INVENTORY_LEVERS,
  INVENTORY_PROPOSAL_BANK,
  buildInventoryConclusionPrompt,
  buildInventoryDeepenPrompt,
  buildW2MoveSequence,
  computeBaseline,
  localizeLadder,
  localizeMove,
  rankLevers,
  synthesizeInventoryPlan,
  toInventorySession,
  validateW2Move,
  type InventorySession,
  type PolicyMoveItem,
  type SkuSegment,
} from '../../src/config/inventoryautopilot';

const seg = (id: string, overrides: Partial<SkuSegment> = {}): SkuSegment => ({
  id,
  valueClass: 'A',
  variabilityClass: 'X',
  stockValue: 100,
  measured: true,
  ...overrides,
});

const move = (id: string, overrides: Partial<PolicyMoveItem> = {}): PolicyMoveItem => ({
  id,
  lever: 'classify',
  impact: 'medium',
  effort: 'medium',
  evidence: [],
  ...overrides,
});

const session = (overrides: Partial<InventorySession> = {}): InventorySession => ({
  segments: [],
  moves: [],
  ...overrides,
});

describe('Inventory Autopilot config — structure', () => {
  it('defines all four levers with a full 4-rung deepening ladder in canonical order', () => {
    expect(INVENTORY_LEVERS).toEqual(['classify', 'service', 'replenish', 'deadstock']);
    expect(INVENTORY_LADDER_RUNG_ORDER).toEqual([
      'surface',
      'evidence',
      'quantification',
      'risk-capability',
    ]);

    INVENTORY_LEVERS.forEach((lever) => {
      const rungs = INVENTORY_DEEPENING_LADDER[lever];
      expect(rungs).toHaveLength(4);
      expect(rungs.map((r) => r.id).sort()).toEqual([...INVENTORY_LADDER_RUNG_ORDER].sort());
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

  it('has a partner-grade bilingual proposal bank for every lever', () => {
    INVENTORY_LEVERS.forEach((lever) => {
      const bank = INVENTORY_PROPOSAL_BANK[lever];
      expect(bank.length).toBeGreaterThanOrEqual(4);
      bank.forEach((proposal) => {
        expect(proposal.title.pl).not.toEqual(proposal.title.en);
        expect(proposal.explanation.pl.length).toBeGreaterThan(20);
        expect(proposal.explanation.en.length).toBeGreaterThan(20);
        expect(INVENTORY_LADDER_RUNG_ORDER).toContain(proposal.rung);
      });
    });
  });

  it('localizeLadder resolves to one language preserving rung order', () => {
    const pl = localizeLadder('service', true);
    const en = localizeLadder('service', false);
    expect(pl.map((r) => r.id)).toEqual(INVENTORY_LADDER_RUNG_ORDER);
    expect(en.map((r) => r.id)).toEqual(INVENTORY_LADDER_RUNG_ORDER);
    expect(pl[0].label).not.toEqual(en[0].label);
    expect(pl.map((r) => r.depth)).toEqual([1, 2, 3, 4]);
  });
});

describe('Inventory Autopilot engine — baseline & ranking', () => {
  it('computes total/tail/dead capital, below-service count and measured ratio', () => {
    const baseline = computeBaseline(
      session({
        segments: [
          seg('a', { valueClass: 'A', stockValue: 500 }),
          seg('b', { valueClass: 'C', stockValue: 300, belowService: true }),
          seg('c', { valueClass: 'C', stockValue: 200, dead: true, measured: false }),
        ],
      })
    );
    expect(baseline.totalStockValue).toBe(1000);
    expect(baseline.tailStockValue).toBe(500); // both class C
    expect(baseline.deadStockValue).toBe(200);
    expect(baseline.belowServiceCount).toBe(1);
    expect(baseline.tailShare).toBe(0.5);
    // 2 of 3 measured
    expect(baseline.measuredRatio).toBe(0.7);
  });

  it('ranks empty session with no ordered levers and a helpful rationale', () => {
    const ranking = rankLevers(session({}));
    expect(ranking.ordered).toHaveLength(0);
    expect(ranking.rationale.en).toContain('No move candidates');
  });

  it('ranks a high-impact low-effort evidence-backed lever to the top', () => {
    const ranking = rankLevers(
      session({
        segments: [seg('s1', { valueClass: 'C', stockValue: 400, dead: true })],
        moves: [
          move('m1', { lever: 'deadstock', impact: 'high', effort: 'low', evidence: ['analysis'] }),
          move('m2', { lever: 'service', impact: 'low', effort: 'high' }),
        ],
      })
    );
    expect(ranking.ordered[0]).toBe('deadstock');
    const dead = ranking.scores.find((s) => s.lever === 'deadstock')!;
    const service = ranking.scores.find((s) => s.lever === 'service')!;
    expect(dead.score).toBeGreaterThan(service.score);
  });

  it('excludes levers with no moves from ordering but reports them with score 0', () => {
    const ranking = rankLevers(session({ moves: [move('m1', { lever: 'classify' })] }));
    expect(ranking.ordered).toEqual(['classify']);
    const empties = ranking.scores.filter((s) => s.moveCount === 0);
    expect(empties).toHaveLength(3);
    empties.forEach((s) => expect(s.score).toBe(0));
  });
});

describe('Inventory Autopilot engine — W2 move validator', () => {
  it('requires rationale, trade-off and rejected variant', () => {
    expect(validateW2Move({}).missing).toEqual(['rationale', 'tradeOff', 'rejectedVariant']);
    const full = validateW2Move({
      rationale: 'Lead with dead stock because it releases cash fastest',
      tradeOff: 'At the cost of clearance discount this quarter',
      rejectedVariant: 'We reject writing everything off wholesale',
    });
    expect(full.valid).toBe(true);
  });

  it('every synthesized move passes its own W2 validation in both languages', () => {
    const sequence = buildW2MoveSequence(
      session({
        segments: [seg('s1', { valueClass: 'C', stockValue: 300, dead: true })],
        moves: [move('m1', { lever: 'deadstock', impact: 'high', effort: 'low', evidence: ['x'] })],
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

  it('inserts a classify/measure-first move when the book is under-measured', () => {
    const sequence = buildW2MoveSequence(
      session({
        segments: [
          seg('s1', { measured: false, stockValue: undefined }),
          seg('s2', { measured: false, stockValue: undefined }),
        ],
        moves: [move('m1', { lever: 'service' })],
      })
    );
    expect(sequence[0].lever).toBe('classify');
    expect(sequence[0].title.en).toContain('Classify');
  });

  it('always defers the replenishment autopilot behind an explicit trade-off', () => {
    const sequence = buildW2MoveSequence(
      session({
        segments: [seg('s1', { valueClass: 'A', stockValue: 500 })],
        moves: [move('m1', { lever: 'classify', impact: 'high', effort: 'low', evidence: ['x'] })],
      })
    );
    const replenish = sequence.find((m) => m.lever === 'replenish');
    expect(replenish).toBeTruthy();
    expect(replenish!.rejectedVariant.en.toLowerCase()).toContain('reject');
  });
});

describe('Inventory Autopilot engine — bridges', () => {
  it('toInventorySession adapts operational sections defensively', () => {
    const s = toInventorySession({
      skus: [
        { id: 's1', category: 'A', threshold: 'X', stockValue: 500 },
        { id: 's2', category: 'C', threshold: 'Z', target: 200, dead: true },
      ],
      moves: [{ id: 'm1', category: 'deadstock', impact: 'high', effort: 'low', evidence: ['p'] }],
    });
    expect(s.segments).toHaveLength(2);
    expect(s.segments[0].valueClass).toBe('A');
    expect(s.segments[0].variabilityClass).toBe('X');
    expect(s.segments[0].stockValue).toBe(500);
    expect(s.segments[0].measured).toBe(true);
    expect(s.segments[1].dead).toBe(true);
    expect(s.moves[0].lever).toBe('deadstock');
  });

  it('localizeMove folds trade-off and rejected variant into the rationale', () => {
    const [m] = buildW2MoveSequence(
      session({
        segments: [seg('s1', { valueClass: 'C', stockValue: 300, dead: true })],
        moves: [move('m1', { lever: 'deadstock', impact: 'high', effort: 'low', evidence: ['x'] })],
      })
    );
    const flat = localizeMove(m, false);
    expect(flat.rationale).toContain(m.tradeOff.en);
    expect(flat.rationale).toContain(m.rejectedVariant.en);
  });

  it('buildInventoryConclusionPrompt returns null for empty session and a grounded W2 prompt otherwise', () => {
    expect(buildInventoryConclusionPrompt(session({}), false)).toBeNull();
    const prompt = buildInventoryConclusionPrompt(
      session({
        segments: [seg('s1', { valueClass: 'A', stockValue: 500 })],
        moves: [move('m1', { lever: 'classify', impact: 'high', effort: 'low', evidence: ['x'] })],
      }),
      false
    )!;
    expect(prompt).toContain('INVENTORY BASELINE');
    expect(prompt).toContain('W2 MOVE SEQUENCE');
    expect(prompt).toContain('rejected variant');
    expect(prompt).toContain('"tradeOff"');
    expect(prompt).toContain('"rejectedVariant"');
  });

  it('buildInventoryDeepenPrompt returns the localized rung question + framing', () => {
    const pl = buildInventoryDeepenPrompt('service', 'quantification', true)!;
    expect(pl).toContain('Kontekst konsultanta');
    expect(buildInventoryDeepenPrompt('service', 'quantification', false)!).toContain(
      'Consultant framing'
    );
  });

  it('synthesizeInventoryPlan returns a consistent baseline + ranking + sequence', () => {
    const s = session({
      segments: [seg('s1', { valueClass: 'C', stockValue: 400, dead: true })],
      moves: [move('m1', { lever: 'deadstock', impact: 'high', effort: 'low', evidence: ['x'] })],
    });
    const { baseline, ranking, sequence } = synthesizeInventoryPlan(s);
    expect(baseline.deadStockValue).toBe(400);
    expect(ranking.ordered[0]).toBe('deadstock');
    expect(sequence.length).toBeGreaterThan(0);
  });
});
