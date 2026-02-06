import { describe, expect, it } from 'vitest';

import {
  detectPatterns,
  pairwiseCompareDeepThinking,
  scoreRubricV2,
} from '../../../../src/services/ai/deepThinkingEvaluationService.js';

describe('DeepThinkingEvaluationService', () => {
  it('detects negative patterns for shallow output', () => {
    const shallow = `
Executive Summary
Do X.

Options
- Only one

Next actions
- Do stuff
`;
    const p = detectPatterns(shallow, 'en');
    expect(p.negative).toContain('N1'); // no framing / no if-do-nothing
    expect(p.negative).toContain('N2'); // single path
    expect(p.negative).toContain('N3'); // no trade-offs
  });

  it('detects positive patterns for decision-grade output', () => {
    const good = `
Executive Summary
We recommend A because it balances speed vs risk. If we do nothing, the status quo cost compounds.

Problem Framing
Horizon: 90 days. If we do nothing: churn risk increases.

Options
1. A
2. B

Recommendation + boundary conditions
Choose A unless budget is cut by >20% (then pick B). When it fails: if the team cannot sustain ops load.

Risks & Blind spots
Assumption: stable demand. Gap: missing baseline for cycle time.

Next actions
- Confirm baseline metrics
- Run pilot
Early signals: monitor defects and lead time.
`;
    const p = detectPatterns(good, 'en');
    expect(p.positive).toContain('P1');
    expect(p.positive).toContain('P2');
    expect(p.positive).toContain('P3');
    expect(p.positive).toContain('P4');
    expect(p.positive).toContain('P5');
    expect(p.positive).toContain('P6');
  });

  it('scores rubric V2 in range 0..14', () => {
    const s = scoreRubricV2('Executive Summary\nX\n', 'en');
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(14);
  });

  it('pairwise prefers DoD pass and higher rubric (not length)', () => {
    const a = `
Executive Summary
We recommend A because it balances speed vs risk. If we do nothing, the status quo cost compounds.

Problem Framing
If we do nothing: churn risk increases.

Options
1. A
2. B

Recommendation
Choose A unless budget is cut.

Risks
Assumption: stable demand. Gap: no baseline.

Next actions
- Step 1
- Step 2
Early signals: monitor defects.
`;
    const b = `Executive Summary\nJust do it.\n`; // shorter but worse
    const r = pairwiseCompareDeepThinking({ a, b, language: 'en' });
    expect(r.winner).toBe('A');
  });
});
