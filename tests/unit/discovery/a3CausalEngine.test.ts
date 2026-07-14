import { describe, expect, it } from 'vitest';

import {
  assessRootCause,
  buildCausalChain,
  buildCountermeasureConclusionPromptRules,
  validateCountermeasure,
  validateCountermeasureSet,
  type A3CausalLink,
} from '@/config/a3problemsolving/a3CausalEngine';

// A clean 3-link chain: symptom -> intermediate -> evidenced process root (60% of gap).
const CONFIRMED_CHAIN: A3CausalLink[] = [
  { id: 'w1', statement: 'Orders ship late', parentId: null },
  { id: 'w2', statement: 'Picking queue backs up at 3pm', parentId: 'w1', evidenceRefs: ['obs-1'] },
  {
    id: 'w3',
    statement: 'Replenishment runs once/shift, not on demand',
    parentId: 'w2',
    evidenceRefs: ['data-7'],
    dimension: 'process',
    gapShare: 0.6,
  },
];

describe('a3CausalEngine — causal chain (symptom vs root)', () => {
  it('orders links from symptom side (depth 0) to the deepest cause', () => {
    const chain = buildCausalChain(CONFIRMED_CHAIN);
    expect(chain.ordered.map((c) => c.id)).toEqual(['w1', 'w2', 'w3']);
    expect(chain.ordered.map((c) => c.depth)).toEqual([0, 1, 2]);
  });

  it('labels every link with a deeper "why" a SYMPTOM, not a root', () => {
    const chain = buildCausalChain(CONFIRMED_CHAIN);
    expect(chain.ordered[0].role).toBe('symptom');
    expect(chain.ordered[1].role).toBe('symptom');
  });

  it('confirms the terminal, evidenced, dimensioned, gap-dominant link as the ROOT', () => {
    const chain = buildCausalChain(CONFIRMED_CHAIN);
    expect(chain.root?.id).toBe('w3');
    expect(chain.root?.role).toBe('root');
    expect(chain.root?.dimension).toBe('process');
  });

  it('a terminal link with no dimension is a candidate-root, not a confirmed root', () => {
    const chain = buildCausalChain([
      { id: 'a', statement: 'Symptom', parentId: null },
      { id: 'b', statement: 'Terminal but unclassified', parentId: 'a', evidenceRefs: ['x'] },
    ]);
    expect(chain.root).toBeNull();
    expect(chain.candidateRoots.map((c) => c.id)).toEqual(['b']);
    expect(chain.ordered[1].role).toBe('candidate-root');
  });

  it('a terminal link with no evidence is a candidate-root (declared, unconfirmed)', () => {
    const chain = buildCausalChain([
      { id: 'a', statement: 'Symptom', parentId: null },
      { id: 'b', statement: 'Guessed root', parentId: 'a', dimension: 'skills' },
    ]);
    expect(chain.root).toBeNull();
    expect(chain.candidateRoots[0].role).toBe('candidate-root');
    expect(chain.candidateRoots[0].reasonEn).toContain('no evidence');
  });

  it('a terminal link explaining a minority of the gap is not a root (guards against cosmetic fixes)', () => {
    const chain = buildCausalChain([
      { id: 'a', statement: 'Symptom', parentId: null },
      {
        id: 'b',
        statement: 'Minor cause',
        parentId: 'a',
        evidenceRefs: ['x'],
        dimension: 'tools',
        gapShare: 0.1,
      },
    ]);
    expect(chain.root).toBeNull();
    expect(chain.candidateRoots[0].reasonEn).toContain('minority');
  });
});

describe('a3CausalEngine — structural integrity', () => {
  it('flags an empty chain', () => {
    const chain = buildCausalChain([]);
    expect(chain.issues.some((i) => i.code === 'empty')).toBe(true);
  });

  it('flags an orphan parent reference', () => {
    const chain = buildCausalChain([
      { id: 'a', statement: 'x', parentId: 'ghost', evidenceRefs: ['e'], dimension: 'process' },
    ]);
    expect(chain.issues.some((i) => i.code === 'orphan-parent')).toBe(true);
  });

  it('detects a cycle (no chain head)', () => {
    const chain = buildCausalChain([
      { id: 'a', statement: 'x', parentId: 'b' },
      { id: 'b', statement: 'y', parentId: 'a' },
    ]);
    expect(chain.issues.some((i) => i.code === 'cycle')).toBe(true);
  });

  it('flags multiple chain heads', () => {
    const chain = buildCausalChain([
      { id: 'a', statement: 'x', parentId: null },
      { id: 'b', statement: 'y', parentId: null },
    ]);
    expect(chain.issues.some((i) => i.code === 'multiple-heads')).toBe(true);
  });
});

describe('a3CausalEngine — root verdict', () => {
  it('a clean confirmed chain is signable', () => {
    const verdict = assessRootCause(CONFIRMED_CHAIN);
    expect(verdict.hasConfirmedRoot).toBe(true);
    expect(verdict.root?.id).toBe('w3');
    expect(verdict.verdictEn).toContain('Confirmed root cause');
  });

  it('a chain with only a candidate root is not signable', () => {
    const verdict = assessRootCause([
      { id: 'a', statement: 'Symptom', parentId: null },
      { id: 'b', statement: 'Guess', parentId: 'a', dimension: 'skills' },
    ]);
    expect(verdict.hasConfirmedRoot).toBe(false);
    expect(verdict.root).toBeNull();
  });
});

describe('a3CausalEngine — W2 countermeasure validator', () => {
  const session = { causeIds: new Set(['w3']) };
  const validMove = {
    rationale: 'Removes the once-per-shift replenishment root that drives the 3pm queue.',
    linkedCauseIds: ['w3'],
    tradeoff: {
      chosen: 'Demand-triggered replenishment',
      deferred: 'A full WMS upgrade',
      cost: 'Higher touch labor short-term',
    },
    rejectedAlternative: { option: 'Add a second shift', reason: 'Treats the symptom, not the cause' },
  };

  it('accepts a countermeasure with rationale + linked cause + full trade-off + rejected alternative', () => {
    expect(validateCountermeasure(validMove, session)).toEqual([]);
  });

  it('rejects a countermeasure with no trade-off (a list, not a decision)', () => {
    const { tradeoff, ...noTradeoff } = validMove;
    const issues = validateCountermeasure(noTradeoff, session);
    expect(issues.some((i) => i.code === 'missing-tradeoff')).toBe(true);
  });

  it('rejects an incomplete trade-off (missing the cost)', () => {
    const issues = validateCountermeasure(
      { ...validMove, tradeoff: { chosen: 'x', deferred: 'y', cost: '' } },
      session
    );
    expect(issues.some((i) => i.code === 'incomplete-tradeoff')).toBe(true);
  });

  it('rejects a countermeasure with no rejected alternative', () => {
    const { rejectedAlternative, ...noAlt } = validMove;
    const issues = validateCountermeasure(noAlt, session);
    expect(issues.some((i) => i.code === 'missing-rejected-alternative')).toBe(true);
  });

  it('rejects a countermeasure linked to no cause (masks a symptom)', () => {
    const issues = validateCountermeasure({ ...validMove, linkedCauseIds: [] }, session);
    expect(issues.some((i) => i.code === 'unlinked-rationale')).toBe(true);
  });

  it('flags a countermeasure referencing a cause absent from the session', () => {
    const issues = validateCountermeasure({ ...validMove, linkedCauseIds: ['nope'] }, session);
    expect(issues.some((i) => i.code === 'dangling-links')).toBe(true);
  });

  it('rejects a countermeasure with no rationale', () => {
    const issues = validateCountermeasure({ ...validMove, rationale: '  ' }, session);
    expect(issues.some((i) => i.code === 'missing-rationale')).toBe(true);
  });

  it('validateCountermeasureSet passes only when every non-rejected move is W2-complete', () => {
    const verdict = validateCountermeasureSet(
      [
        { title: 'Good', ...validMove },
        { title: 'Rejected junk', rationale: '', proposalStatus: 'rejected' },
      ],
      ['w3']
    );
    expect(verdict.ok).toBe(true); // the rejected one is skipped
    expect(verdict.perMove).toHaveLength(1);
  });

  it('the W2 prompt rules differ by language and name the mandatory trade-off', () => {
    const en = buildCountermeasureConclusionPromptRules('en');
    const pl = buildCountermeasureConclusionPromptRules('pl');
    expect(en).toContain('MANDATORY');
    expect(pl).toContain('OBOWIĄZKOWY');
    expect(pl).not.toEqual(en);
  });
});
