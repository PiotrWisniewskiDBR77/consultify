import { describe, it, expect } from 'vitest';

import {
  GATE_ORDER,
  nextGate,
  canAdvance,
  pipelineFunnel,
  type ValueCaptureGate,
  type Gate,
} from '../../../server/src/services/valueCapturePipelineService.js';

function mkGate(gate: Gate, valueEvidence: number | null = null): ValueCaptureGate {
  return {
    id: `id_${gate}_${Math.random().toString(36).slice(2)}`,
    organizationId: 'org1',
    initiativeId: 'init1',
    gate,
    status: 'pending',
    criteria: null,
    signedOffBy: null,
    signedOffAt: null,
    valueEvidence,
    createdAt: null,
    updatedAt: null,
  };
}

describe('GATE_ORDER', () => {
  it('is G0..G5 in canonical order', () => {
    expect(GATE_ORDER).toEqual(['G0', 'G1', 'G2', 'G3', 'G4', 'G5']);
  });
});

describe('nextGate', () => {
  it('returns the following gate', () => {
    expect(nextGate('G0')).toBe('G1');
    expect(nextGate('G3')).toBe('G4');
    expect(nextGate('G4')).toBe('G5');
  });

  it('returns null for the terminal gate G5', () => {
    expect(nextGate('G5')).toBeNull();
  });

  it('returns null for an unknown gate', () => {
    expect(nextGate('GX' as Gate)).toBeNull();
  });
});

describe('canAdvance', () => {
  it('blocks when neither criteria nor sign-off present', () => {
    const r = canAdvance('G0', false, false);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/criteria/i);
  });

  it('blocks when criteria met but no sign-off', () => {
    const r = canAdvance('G1', true, false);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/sign-off/i);
  });

  it('blocks when signed off but criteria not met', () => {
    const r = canAdvance('G1', false, true);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/criteria/i);
  });

  it('passes when criteria met AND signed off', () => {
    const r = canAdvance('G2', true, true);
    expect(r.ok).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  it('blocks advancing past the final gate even with both', () => {
    const r = canAdvance('G5', true, true);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/final gate/i);
  });

  it('blocks an unknown gate', () => {
    const r = canAdvance('GX' as Gate, true, true);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/unknown/i);
  });
});

describe('pipelineFunnel', () => {
  it('counts initiatives and sums value per gate', () => {
    const gates: ValueCaptureGate[] = [
      mkGate('G0', 100),
      mkGate('G0', 50),
      mkGate('G1', 200),
    ];
    const funnel = pipelineFunnel(gates);
    expect(funnel).toHaveLength(GATE_ORDER.length);

    const g0 = funnel.find((s) => s.gate === 'G0')!;
    expect(g0.count).toBe(2);
    expect(g0.totalValue).toBe(150);
    expect(g0.conversionFromPrev).toBe(1); // first gate always 1

    const g1 = funnel.find((s) => s.gate === 'G1')!;
    expect(g1.count).toBe(1);
    expect(g1.totalValue).toBe(200);
    expect(g1.conversionFromPrev).toBe(0.5); // 1 of 2 carried over
  });

  it('reports conversion 0 when previous gate is empty', () => {
    const funnel = pipelineFunnel([mkGate('G2', 10)]);
    const g1 = funnel.find((s) => s.gate === 'G1')!;
    const g2 = funnel.find((s) => s.gate === 'G2')!;
    expect(g1.count).toBe(0);
    expect(g2.count).toBe(1);
    expect(g2.conversionFromPrev).toBe(0); // prev (G1) empty -> 0
  });

  it('treats null value evidence as zero', () => {
    const funnel = pipelineFunnel([mkGate('G0', null), mkGate('G0', 25)]);
    const g0 = funnel.find((s) => s.gate === 'G0')!;
    expect(g0.count).toBe(2);
    expect(g0.totalValue).toBe(25);
  });

  it('returns all-zero funnel for empty input', () => {
    const funnel = pipelineFunnel([]);
    expect(funnel.every((s) => s.count === 0 && s.totalValue === 0)).toBe(true);
    expect(funnel[0].conversionFromPrev).toBe(1);
  });
});
