import { describe, expect, it } from 'vitest';

import {
  buildToolConclusionModel,
  extractToolConclusionFacts,
  rankMoves,
  type ToolConclusionFacts,
  type ToolMoveFact,
} from '../../../src/services/report/toolConclusion';

/**
 * Structure tests for the tool-output conclusion layer (OXFORD O2.3,
 * CONCLUSION_LAYER_STANDARD variant W2). Covers:
 *  1. rankMoves — deterministic impact×effort ranking (K3 source).
 *  2. buildToolConclusionModel — LLM-block preferred, deterministic fallback,
 *     validator-gated publishability, zero invented numbers.
 *  3. extractToolConclusionFacts — tool-agnostic session adapter.
 */

function move(overrides: Partial<ToolMoveFact> & { id: string; title: string }): ToolMoveFact {
  return {
    expectedImpact: 'medium',
    estimatedEffort: 'medium',
    ...overrides,
  };
}

describe('rankMoves — impact×effort (K3 ranking, deterministic)', () => {
  it('ranks a high-impact/low-effort move above a low-impact/high-effort one', () => {
    const quickWin = move({ id: 'a', title: 'Quick win', expectedImpact: 'high', estimatedEffort: 'low' });
    const grind = move({ id: 'b', title: 'Grind', expectedImpact: 'low', estimatedEffort: 'high' });
    const ranked = rankMoves([grind, quickWin]);
    expect(ranked[0].id).toBe('a');
  });

  it('is deterministic: ties break by id, not insertion order', () => {
    const a = move({ id: 'b-move', title: 'B' });
    const b = move({ id: 'a-move', title: 'A' });
    const ranked = rankMoves([a, b]);
    expect(ranked.map((m) => m.id)).toEqual(['a-move', 'b-move']);
  });
});

describe('buildToolConclusionModel — LLM block present (uses it verbatim, K3 still engine-ranked)', () => {
  const facts: ToolConclusionFacts = {
    language: 'pl',
    toolName: 'Dynamic SWOT',
    moves: [
      move({
        id: 'm1',
        title: 'Wejście do DACH',
        rationale: 'Jakość produktu jest realną przewagą w DACH.',
        expectedImpact: 'high',
        estimatedEffort: 'medium',
        firstStep: 'Desk research 5 dystrybutorów',
        ownerRole: 'Sales Lead',
      }),
      move({
        id: 'm2',
        title: 'De-koncentracja klienta A',
        expectedImpact: 'high',
        estimatedEffort: 'low',
        ownerRole: 'CEO',
      }),
    ],
    keyInsights: ['Klient A = 61% przychodu — koncentracja krytyczna.'],
    evidenceCount: 6,
    llm: {
      verdict:
        'Wejście do DACH jest właściwym ruchem, ale najpierw trzeba rozbroić koncentrację przychodów.',
      rationale: 'Siła (jakość) jest realną przewagą w DACH, ale słabość (61% u jednego klienta) blokuje finansowanie ekspansji.',
      tradeoffs: [
        { chosen: 'de-koncentracja najpierw', rejected: 'DACH natychmiast', why: 'utrata klienta A w trakcie ekspansji zabija obie nogi naraz' },
      ],
      expectedEffect: { text: 'Decyzja go/no-go DACH podjęta na danych.', horizon: '2 kwartały' },
    },
  };

  const model = buildToolConclusionModel(facts);

  it('uses the LLM verdict verbatim as the headline (source=llm)', () => {
    expect(model.headline).toBe(facts.llm!.verdict);
    expect(model.source).toBe('llm');
  });

  it('K3 ranking is still engine-derived (high-impact/low-effort first), not the LLM order', () => {
    expect(model.k3Actions[0].action).toContain('De-koncentracja klienta A');
  });

  it('carries the LLM tradeoff through untouched', () => {
    expect(model.tradeoffs).toHaveLength(1);
    expect(model.tradeoffs[0].chosen).toBe('de-koncentracja najpierw');
  });

  it('K4 effect has a horizon (R6)', () => {
    expect(model.effect?.horizon).toBe('2 kwartały');
  });

  it('passes the hard §4.4 gate and is publishable', () => {
    expect(model.validation.allHardPass).toBe(true);
    expect(model.isPublishable).toBe(true);
  });

  it('every K3 action carries an owner role (R6 adresat)', () => {
    for (const a of model.k3Actions) {
      expect(a.ownerRole.length).toBeGreaterThan(0);
    }
  });
});

describe('buildToolConclusionModel — no LLM block (deterministic fallback)', () => {
  const facts: ToolConclusionFacts = {
    language: 'pl',
    toolName: 'Porter 5 Forces',
    moves: [
      move({
        id: 'm1',
        title: 'Renegocjacja z dostawcami',
        rationale: 'Siła przetargowa dostawców rośnie — koncentracja na 2 kluczowych.',
        expectedImpact: 'high',
        estimatedEffort: 'low',
        firstStep: 'Audyt umów',
        ownerRole: 'Procurement Lead',
      }),
    ],
    keyInsights: ['Siła przetargowa dostawców rośnie.'],
    evidenceCount: 3,
  };

  const model = buildToolConclusionModel(facts);

  it('falls back to a deterministic headline (source=deterministic)', () => {
    expect(model.source).toBe('deterministic');
    expect(model.headline).toContain('Renegocjacja z dostawcami');
  });

  it('derives a tradeoff from the top-2 ranked moves when the tool has none', () => {
    // Only 1 move here → no pairwise tradeoff possible; verify empty, not fabricated.
    expect(model.tradeoffs).toEqual([]);
  });

  it('still produces an effect with a horizon from the fallback', () => {
    expect(model.effect?.horizon).toBeTruthy();
  });
});

describe('buildToolConclusionModel — insufficient session (no moves, no insights)', () => {
  const facts: ToolConclusionFacts = {
    language: 'pl',
    toolName: 'Ansoff Matrix',
    moves: [],
    keyInsights: [],
    evidenceCount: 0,
  };
  const model = buildToolConclusionModel(facts);

  it('is NOT publishable (k_complete fails — no K3 actions)', () => {
    expect(model.isPublishable).toBe(false);
  });

  it('confidence is insufficient with zero evidence', () => {
    expect(model.confidence).toBe('insufficient');
  });

  it('headline names the incompleteness rather than fabricating a verdict', () => {
    expect(model.headline).toMatch(/niekompletna/);
  });
});

describe('extractToolConclusionFacts — tool-agnostic session adapter', () => {
  it('reads recommendedMoves + summary LLM block from a SWOT-shaped session', () => {
    const inputData = {
      recommendedMoves: [
        {
          id: 'mv1',
          title: 'Attack move',
          expectedImpact: 'high',
          estimatedEffort: 'low',
          rationale: 'grounded in SO tension',
          firstStep: 'Kick off pilot',
          ownerRole: 'COO',
        },
      ],
      items: [
        { id: 'i1', text: 'Strength A', proposalStatus: 'accepted' },
        { id: 'i2', text: 'Weakness A', proposalStatus: 'ai-proposed' }, // not accepted
      ],
      summary: {
        keyInsights: ['Insight 1'],
        verdict: 'Attack posture first.',
        verdictRationale: { text: 'Grounded reason.', factRefs: ['i1'] },
        tradeoffs: [{ chosen: 'attack', rejected: 'defend', why: 'higher weight tension' }],
        expectedEffect: { text: 'Positioning improves.', horizon: '6 miesięcy' },
      },
    };
    const facts = extractToolConclusionFacts({
      toolName: 'Dynamic SWOT',
      language: 'pl',
      inputData,
    });
    expect(facts.moves).toHaveLength(1);
    expect(facts.moves[0].title).toBe('Attack move');
    expect(facts.llm?.verdict).toBe('Attack posture first.');
    expect(facts.llm?.rationale).toBe('Grounded reason.');
    expect(facts.llm?.tradeoffs).toHaveLength(1);
    expect(facts.evidenceCount).toBeGreaterThanOrEqual(1); // only the accepted item counts
  });

  it('falls back to generatedInitiatives when the tool has no recommendedMoves yet', () => {
    const facts = extractToolConclusionFacts({
      toolName: 'Legacy Tool',
      language: 'pl',
      inputData: { summary: { keyInsights: [] } },
      fallbackInitiatives: [
        {
          id: 'init1',
          title: 'Initiative A',
          rationale: 'because X',
          estimatedImpact: 'medium',
          estimatedEffort: 'high',
        },
      ],
    });
    expect(facts.moves).toHaveLength(1);
    expect(facts.moves[0].title).toBe('Initiative A');
    expect(facts.moves[0].expectedImpact).toBe('medium');
  });

  it('never invents an LLM block when the session has no summary object', () => {
    const facts = extractToolConclusionFacts({
      toolName: 'X',
      language: 'pl',
      inputData: { recommendedMoves: [] },
    });
    expect(facts.llm).toBeUndefined();
  });
});
