import { describe, expect, it } from 'vitest';

import {
  buildValueBridge,
  stageBreakdown,
  type ValueBridgeInitiative,
} from '../../../server/src/services/valueBridgeService.js';

const inits: ValueBridgeInitiative[] = [
  { id: 'a', name: 'Alpha', value: 100, stage: 'identified' },
  { id: 'b', name: 'Beta', value: 50, stage: 'identified' },
  { id: 'c', name: 'Gamma', value: 120, stage: 'committed' },
  { id: 'd', name: 'Delta', value: 80, stage: 'in_flight' },
  { id: 'e', name: 'Epsilon', value: 60, stage: 'realized' },
  { id: 'f', name: 'Zeta', value: 30, stage: 'banked' },
];

describe('valueBridgeService.buildValueBridge', () => {
  it('emits a baseline start bar at 0 and a terminal total bar', () => {
    const { steps } = buildValueBridge(inits);
    expect(steps[0]).toEqual({ label: 'Baseline', value: 0, kind: 'start' });
    expect(steps[steps.length - 1].kind).toBe('total');
  });

  it('builds one stage bar per maturity stage in canonical order', () => {
    const { steps } = buildValueBridge(inits);
    // start + 5 stages + total = 7
    expect(steps).toHaveLength(7);
    expect(steps.slice(1, 6).map((s) => s.label)).toEqual([
      'Identified',
      'Committed',
      'In-flight',
      'Realized',
      'Banked',
    ]);
  });

  it('sums initiative value per stage as deltas vs the prior stage', () => {
    const { steps } = buildValueBridge(inits);
    // Identified absolute = 150 (from 0) -> increase 150
    expect(steps[1]).toEqual({ label: 'Identified', value: 150, kind: 'increase' });
    // Committed absolute = 120 vs 150 -> leakage 30 -> decrease
    expect(steps[2]).toEqual({ label: 'Committed', value: 30, kind: 'decrease' });
    // In-flight absolute = 80 vs 120 -> leakage 40 -> decrease
    expect(steps[3]).toEqual({ label: 'In-flight', value: 40, kind: 'decrease' });
    // Realized absolute = 60 vs 80 -> leakage 20 -> decrease
    expect(steps[4]).toEqual({ label: 'Realized', value: 20, kind: 'decrease' });
    // Banked absolute = 30 vs 60 -> leakage 30 -> decrease
    expect(steps[5]).toEqual({ label: 'Banked', value: 30, kind: 'decrease' });
  });

  it('marks a rising stage as increase (no leakage)', () => {
    const rising: ValueBridgeInitiative[] = [
      { id: '1', value: 40, stage: 'identified' },
      { id: '2', value: 100, stage: 'committed' },
    ];
    const { steps } = buildValueBridge(rising);
    const committed = steps.find((s) => s.label === 'Committed')!;
    // 100 vs 40 -> +60 -> increase
    expect(committed).toEqual({ label: 'Committed', value: 60, kind: 'increase' });
  });

  it('terminal total equals the final cumulative (banked) absolute value', () => {
    const { steps } = buildValueBridge(inits);
    const total = steps[steps.length - 1];
    expect(total).toEqual({ label: 'Net Value', value: 30, kind: 'total' });
  });

  it('computes totalIdentified and totalRealized aggregates', () => {
    const { totalIdentified, totalRealized } = buildValueBridge(inits);
    expect(totalIdentified).toBe(150); // 100 + 50
    expect(totalRealized).toBe(90); // realized 60 + banked 30
  });

  it('handles empty input with a zeroed waterfall', () => {
    const { steps, totalIdentified, totalRealized } = buildValueBridge([]);
    expect(steps[0]).toEqual({ label: 'Baseline', value: 0, kind: 'start' });
    expect(steps[steps.length - 1]).toEqual({ label: 'Net Value', value: 0, kind: 'total' });
    expect(steps.slice(1, 6).every((s) => s.value === 0)).toBe(true);
    expect(totalIdentified).toBe(0);
    expect(totalRealized).toBe(0);
  });

  it('coerces non-finite / missing values to 0 and ignores unknown stages', () => {
    const dirty = [
      { id: 'x', value: Number.NaN as number, stage: 'identified' as const },
      { id: 'y', value: 10, stage: 'identified' as const },
      // @ts-expect-error unknown stage must be ignored
      { id: 'z', value: 999, stage: 'bogus' },
    ] as ValueBridgeInitiative[];
    const { steps, totalIdentified } = buildValueBridge(dirty);
    expect(steps[1]).toEqual({ label: 'Identified', value: 10, kind: 'increase' });
    expect(totalIdentified).toBe(10);
  });
});

describe('valueBridgeService.stageBreakdown', () => {
  it('drills down count, value and initiative names per stage', () => {
    const rows = stageBreakdown(inits);
    expect(rows.map((r) => r.stage)).toEqual([
      'identified',
      'committed',
      'in_flight',
      'realized',
      'banked',
    ]);

    const identified = rows.find((r) => r.stage === 'identified')!;
    expect(identified.count).toBe(2);
    expect(identified.value).toBe(150);
    expect(identified.initiatives).toEqual(['Alpha', 'Beta']);

    const banked = rows.find((r) => r.stage === 'banked')!;
    expect(banked.count).toBe(1);
    expect(banked.value).toBe(30);
    expect(banked.initiatives).toEqual(['Zeta']);
  });

  it('returns every stage even when empty', () => {
    const rows = stageBreakdown([]);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.count === 0 && r.value === 0 && r.initiatives.length === 0)).toBe(
      true,
    );
  });

  it('falls back to id when name is missing or blank', () => {
    const rows = stageBreakdown([
      { id: 'no-name', value: 5, stage: 'committed' },
      { id: 'blank', name: '   ', value: 5, stage: 'committed' },
    ]);
    const committed = rows.find((r) => r.stage === 'committed')!;
    expect(committed.initiatives).toEqual(['no-name', 'blank']);
  });
});
