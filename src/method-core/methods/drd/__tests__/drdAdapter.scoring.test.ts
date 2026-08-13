import { describe, expect, it } from 'vitest';

import type { ScoringInput } from '../../../contracts';
import { drdAdapter } from '../drdAdapter';

const L1Q = (n: 1 | 2 | 3) => `1A-L${1}-Q${n}`;
const levelQ = (level: number, n: 1 | 2 | 3) => `1A-L${level}-Q${n}`;

describe('drdAdapter.computeScore — deterministic, zero LLM', () => {
  it('no answers at all → needs_evidence, NEVER an automatic zero/null-as-score', () => {
    const result = drdAdapter.computeScore({ unitId: '1A', answers: {}, evidence: {} });
    expect(result.verdict).toBe('needs_evidence');
    expect(result.proposedLevel).toBeNull();
  });

  it('level 1 fully confirmed with sufficient evidence, level 2 unanswered → proposedLevel=1, verdict needs_evidence (not silently scored higher, not silently zero)', () => {
    const result = drdAdapter.computeScore({
      unitId: '1A',
      answers: {
        [L1Q(1)]: 'confirmed',
        [L1Q(2)]: 'confirmed',
        [L1Q(3)]: 'confirmed',
      },
      evidence: {
        [L1Q(1)]: 'E2',
        [L1Q(2)]: 'E2',
        [L1Q(3)]: 'E2',
      },
    });
    expect(result.proposedLevel).toBe(1);
    expect(result.verdict).toBe('needs_evidence');
    expect(result.satisfiedAttributes).toEqual([L1Q(1), L1Q(2), L1Q(3)]);
  });

  it('prerequisite skipped: only level 3 answered (level 1 & 2 untouched) → rejected, never jumps to 3', () => {
    const result = drdAdapter.computeScore({
      unitId: '1A',
      answers: {
        [levelQ(3, 1)]: 'confirmed',
        [levelQ(3, 2)]: 'confirmed',
        [levelQ(3, 3)]: 'confirmed',
      },
      evidence: {
        [levelQ(3, 1)]: 'E3',
        [levelQ(3, 2)]: 'E3',
        [levelQ(3, 3)]: 'E3',
      },
    });
    expect(result.proposedLevel).toBeNull();
    expect(result.proposedLevel).not.toBe(3);
    expect(result.verdict).toBe('needs_evidence');
  });

  it('evidence below the level minimum blocks the level (needs_evidence, not a lower score)', () => {
    const result = drdAdapter.computeScore({
      unitId: '1A',
      answers: {
        [L1Q(1)]: 'confirmed',
        [L1Q(2)]: 'confirmed',
        [L1Q(3)]: 'confirmed',
      },
      evidence: {
        [L1Q(1)]: 'E1', // below the E2 policy default
        [L1Q(2)]: 'E2',
        [L1Q(3)]: 'E2',
      },
    });
    expect(result.verdict).toBe('needs_evidence');
    expect(result.proposedLevel).toBeNull();
    expect(result.missingEvidence).toContain(L1Q(1));
  });

  it('an explicit "no" answer is a definite, evidenced non-satisfaction — not needs_evidence', () => {
    const result = drdAdapter.computeScore({
      unitId: '1A',
      answers: {
        [L1Q(1)]: 'no',
        [L1Q(2)]: 'confirmed',
        [L1Q(3)]: 'confirmed',
      },
      evidence: { [L1Q(2)]: 'E2', [L1Q(3)]: 'E2' },
    });
    expect(result.verdict).toBe('scored');
    expect(result.proposedLevel).toBeNull();
    expect(result.unsatisfiedAttributes).toContain(L1Q(1));
  });

  it('not_applicable without justification is flagged as a contradiction, not a silent pass', () => {
    const result = drdAdapter.computeScore({
      unitId: '1A',
      answers: {
        [L1Q(1)]: { state: 'not_applicable' },
        [L1Q(2)]: 'confirmed',
        [L1Q(3)]: 'confirmed',
      },
      evidence: { [L1Q(2)]: 'E2', [L1Q(3)]: 'E2' },
    });
    expect(result.contradictions.length).toBeGreaterThan(0);
    expect(result.verdict).toBe('needs_evidence');
  });

  it('not_applicable WITH justification for every question at a level yields verdict not_applicable', () => {
    const result = drdAdapter.computeScore({
      unitId: '1A',
      answers: {
        [L1Q(1)]: { state: 'not_applicable', justification: 'Nie dotyczy — brak działu sprzedaży.' },
        [L1Q(2)]: { state: 'not_applicable', justification: 'Nie dotyczy — brak działu sprzedaży.' },
        [L1Q(3)]: { state: 'not_applicable', justification: 'Nie dotyczy — brak działu sprzedaży.' },
      },
      evidence: {},
    });
    expect(result.verdict).toBe('not_applicable');
  });

  it('unknown unit id yields verdict unknown, never a fabricated score', () => {
    const result = drdAdapter.computeScore({ unitId: 'ZZ', answers: {}, evidence: {} });
    expect(result.verdict).toBe('unknown');
    expect(result.proposedLevel).toBeNull();
  });

  it('is deterministic — same input scored twice yields identical output (no LLM variance)', () => {
    const input: ScoringInput = {
      unitId: '1A',
      answers: { [L1Q(1)]: 'confirmed', [L1Q(2)]: 'confirmed', [L1Q(3)]: 'confirmed' },
      evidence: { [L1Q(1)]: 'E2', [L1Q(2)]: 'E2', [L1Q(3)]: 'E2' },
    };
    const a = drdAdapter.computeScore(input);
    const b = drdAdapter.computeScore(input);
    expect(a).toEqual(b);
  });
});
