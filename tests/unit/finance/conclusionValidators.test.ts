/**
 * conclusionValidators — unit tests for the 12 §4.4 machine validators.
 * Exercises the backend copy (server/src/services/conclusionValidators.ts);
 * the frontend twin (src/services/report/conclusionValidators.ts) shares the
 * same contract and is covered by tests/unit/services/toolConclusion.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  validateConclusion,
  type ValidatableConclusion,
} from '../../../server/src/services/conclusionValidators.js';

function baseInput(overrides: Partial<ValidatableConclusion> = {}): ValidatableConclusion {
  return {
    headline: 'Płynność formalnie w normie, ale trend zjada bufor — próg za ~3 kwartały.',
    k1Text: 'Current ratio: 1,2 x (próg 1,0); spada przez 4 kwartały (-0,4).',
    k1FactRefs: ['current_ratio'],
    k2Text:
      'Formalnie w normie, ale trend zjada bufor. Driver: zobowiązania krótkoterminowe +38% r/r — to napędza kierunek wskaźnika.',
    k2FactRefs: ['current_ratio', 'current_ratio:driver'],
    k3Actions: [
      {
        action: 'Zaatakuj driver „zobowiązania krótkoterminowe" — działanie u źródła',
        whyFirst: 'Najwyższa dźwignia: ten składnik odpowiada za największą zmianę wskaźnika.',
        ownerRole: 'CFO',
      },
    ],
    k4Text: 'Zatrzymanie erozji i current ratio ≥ 1,3 w 2 kwartały.',
    k4Horizon: '2 kwartały',
    confidence: 'confirmed',
    language: 'pl',
    facts: { value: 1.2, threshold: 1.0, delta: -0.4, driverPct: 38 },
    ...overrides,
  };
}

describe('validateConclusion — happy path', () => {
  it('passes every hard validator for a well-formed W3-style conclusion', () => {
    const report = validateConclusion(baseInput());
    expect(report.allHardPass).toBe(true);
    expect(report.failures).toEqual([]);
  });
});

describe('k_complete', () => {
  it('fails when K3 (recommendations) is empty', () => {
    const report = validateConclusion(baseInput({ k3Actions: [] }));
    expect(report.k_complete).toBe('fail');
    expect(report.allHardPass).toBe(false);
  });

  it('fails when K4 (effect) is blank', () => {
    const report = validateConclusion(baseInput({ k4Text: '' }));
    expect(report.k_complete).toBe('fail');
  });
});

describe('k3_max3', () => {
  it('fails with more than 3 actions', () => {
    const action = { action: 'x', whyFirst: 'y', ownerRole: 'CFO' };
    const report = validateConclusion(
      baseInput({ k3Actions: [action, action, action, action] })
    );
    expect(report.k3_max3).toBe('fail');
  });

  it('fails when an action has no owner role', () => {
    const report = validateConclusion(
      baseInput({ k3Actions: [{ action: 'do X', whyFirst: 'because Y', ownerRole: '' }] })
    );
    expect(report.k3_max3).toBe('fail');
  });
});

describe('k4_horizon', () => {
  it('fails when there is no time horizon anywhere', () => {
    const report = validateConclusion(
      baseInput({ k4Text: 'Wskaźnik się poprawi.', k4Horizon: '' })
    );
    expect(report.k4_horizon).toBe('fail');
  });

  it('passes when the horizon is embedded in k4Text even without an explicit horizon field', () => {
    const report = validateConclusion(
      baseInput({ k4Text: 'Poprawa widoczna w 6 miesięcy.', k4Horizon: '' })
    );
    expect(report.k4_horizon).toBe('pass');
  });
});

describe('evidence_link', () => {
  it('fails when K2 has zero fact references (no causal chain, R2)', () => {
    const report = validateConclusion(baseInput({ k2FactRefs: [] }));
    expect(report.evidence_link).toBe('fail');
  });
});

describe('no_filler (R1)', () => {
  it('fails on a canonical filler phrase', () => {
    const report = validateConclusion(
      baseInput({ k2Text: 'Należy rozważyć optymalizację procesów w organizacji.' })
    );
    expect(report.no_filler).toBe('fail');
    expect(report.allHardPass).toBe(false);
  });

  it('passes concrete, client-specific prose', () => {
    const report = validateConclusion(baseInput());
    expect(report.no_filler).toBe('pass');
  });
});

describe('numbers_from_engine (R5)', () => {
  it('fails when the prose cites a number absent from facts (fabrication)', () => {
    const report = validateConclusion(
      baseInput({ k1Text: 'Current ratio: 1,2 x; branża rośnie o 999% rocznie (niepowiązany fakt).' })
    );
    expect(report.numbers_from_engine).toBe('fail');
  });

  it('tolerates a deterministically-derived nudge (±25%) of a real fact', () => {
    // 1.2 * 1.08 ≈ 1.30 — a "target ≥ 1.3" derived from value 1.2, still grounded.
    const report = validateConclusion(
      baseInput({ k4Text: 'Zatrzymanie erozji i current ratio ≥ 1,3 w 2 kwartały.' })
    );
    expect(report.numbers_from_engine).toBe('pass');
  });

  it('ignores small ordinals used for enumeration (not treated as facts)', () => {
    const report = validateConclusion(
      baseInput({ k3Actions: [{ action: '3 kroki do wdrożenia', whyFirst: 'y', ownerRole: 'CFO' }] })
    );
    // "3" is a small ordinal, not flagged even though it is not literally in facts.
    expect(report.numbers_from_engine).toBe('pass');
  });
});

describe('confidence_honest', () => {
  it('fails a "declared" confidence conclusion with no hedge language', () => {
    const report = validateConclusion(
      baseInput({
        confidence: 'declared',
        k1Text: 'Current ratio: 1,2 x.',
        k2Text: 'Wskaźnik w normie.',
      })
    );
    expect(report.confidence_honest).toBe('fail');
  });

  it('passes a "declared" confidence conclusion that names the hedge', () => {
    const report = validateConclusion(
      baseInput({
        confidence: 'declared',
        k2Text: 'Wg deklaracji zespołu, do potwierdzenia w kolejnej sesji.',
      })
    );
    expect(report.confidence_honest).toBe('pass');
  });
});

describe('tradeoff_present (W2)', () => {
  it('is skipped when tradeoffs is not part of the variant', () => {
    const report = validateConclusion(baseInput());
    expect(report.tradeoff_present).toBe('skip');
  });

  it('fails with zero tradeoffs when the field is present', () => {
    const report = validateConclusion(baseInput({ tradeoffs: [] }));
    expect(report.tradeoff_present).toBe('fail');
    expect(report.allHardPass).toBe(false);
  });

  it('passes with a well-formed chosen/rejected/why tradeoff', () => {
    const report = validateConclusion(
      baseInput({
        tradeoffs: [{ chosen: 'wejście do DACH za 2 kwartały', rejected: 'DACH natychmiast', why: 'ryzyko koncentracji klienta' }],
      })
    );
    expect(report.tradeoff_present).toBe('pass');
  });
});

describe('chain_complete (W3)', () => {
  it('is skipped when chain is not part of the variant', () => {
    const report = validateConclusion(baseInput());
    expect(report.chain_complete).toBe('skip');
  });

  it('fails when the driver leg is blank', () => {
    const report = validateConclusion(
      baseInput({
        chain: { indicator: 'x', trend: 'y', driver: '', forecast: null, recommendation: 'z' },
      })
    );
    expect(report.chain_complete).toBe('fail');
  });

  it('passes with forecast=null (engine cannot project — honest, not a failure)', () => {
    const report = validateConclusion(
      baseInput({
        chain: { indicator: 'x', trend: 'y', driver: 'z', forecast: null, recommendation: 'w' },
      })
    );
    expect(report.chain_complete).toBe('pass');
  });
});

describe('len_limits (R4)', () => {
  it('fails a K3 action far beyond the ~25-word guidance', () => {
    const longAction = new Array(40).fill('słowo').join(' ');
    const report = validateConclusion(
      baseInput({ k3Actions: [{ action: longAction, whyFirst: 'y', ownerRole: 'CFO' }] })
    );
    expect(report.len_limits).toBe('fail');
  });
});
