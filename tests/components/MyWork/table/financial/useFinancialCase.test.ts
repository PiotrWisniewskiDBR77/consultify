/**
 * useFinancialCase — stale/recompute state machine (doc 09 §7.3, doc 11 E09
 * DoD: "invalid/stale state blocks misleading approval"). Exercises the
 * machine WITHOUT any real calculation math (that's the sibling engine's
 * job, deliberately not implemented here) — computeFn is a test double.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createEmptyDriver } from '../../../../../src/components/MyWork/table/financial/financialDefaults';
import type {
  FinancialCaseResult,
  FinancialComputeFn,
} from '../../../../../src/components/MyWork/table/financial/financialTypes';
import { useFinancialCase } from '../../../../../src/components/MyWork/table/financial/useFinancialCase';

function fakeResult(overrides: Partial<FinancialCaseResult> = {}): FinancialCaseResult {
  return {
    formulaVersion: 'test-1',
    computedAt: new Date('2026-08-10T00:00:00Z').toISOString(),
    currency: 'PLN',
    scenarios: {},
    sensitivity: [],
    warnings: [],
    ...overrides,
  };
}

describe('useFinancialCase — stale/recompute state machine', () => {
  it('starts empty with no drivers', () => {
    const { result } = renderHook(() => useFinancialCase());
    expect(result.current.status).toBe('empty');
    expect(result.current.isStaleOrWorse).toBe(true);
  });

  it('adding the first driver moves empty → stale (never fresh without a compute)', () => {
    const { result } = renderHook(() => useFinancialCase());
    act(() => {
      result.current.addDriver(createEmptyDriver('cost'));
    });
    expect(result.current.status).toBe('stale');
  });

  it('recompute with no computeFn reports an honest `blocked`, not a fabricated result', async () => {
    const { result } = renderHook(() => useFinancialCase());
    act(() => {
      result.current.addDriver(createEmptyDriver('cost'));
    });
    await act(async () => {
      await result.current.recompute();
    });
    expect(result.current.status).toBe('blocked');
    expect(result.current.result).toBeNull();
    expect(result.current.engineWired).toBe(false);
  });

  it('recompute with computeFn: stale → computing → fresh, and any later edit snaps back to stale', async () => {
    const computeFn: FinancialComputeFn = vi.fn().mockResolvedValue(fakeResult());
    const { result } = renderHook(() => useFinancialCase({ computeFn }));
    act(() => {
      result.current.addDriver(createEmptyDriver('cost'));
    });
    expect(result.current.status).toBe('stale');

    await act(async () => {
      await result.current.recompute();
    });
    expect(result.current.status).toBe('fresh');
    expect(result.current.isStaleOrWorse).toBe(false);
    expect(computeFn).toHaveBeenCalledTimes(1);

    // §7.3: "changes to drivers IMMEDIATELY mark calculations stale" — no
    // intermediate fresh-looking state during the edit.
    act(() => {
      result.current.updateDriver(result.current.drivers[0].id, { label: 'Cloud hosting' });
    });
    expect(result.current.status).toBe('stale');
    expect(result.current.isStaleOrWorse).toBe(true);
  });

  it('editing case meta (e.g. discount rate) also marks a fresh case stale', async () => {
    const computeFn: FinancialComputeFn = vi.fn().mockResolvedValue(fakeResult());
    const { result } = renderHook(() => useFinancialCase({ computeFn }));
    act(() => {
      result.current.addDriver(createEmptyDriver('benefit'));
    });
    await act(async () => {
      await result.current.recompute();
    });
    expect(result.current.status).toBe('fresh');

    act(() => {
      result.current.setCaseMeta({ discountRatePct: 12 });
    });
    expect(result.current.status).toBe('stale');
  });

  it('a computeFn rejection surfaces as an honest `error`, not a stale success', async () => {
    const computeFn: FinancialComputeFn = vi.fn().mockRejectedValue(new Error('engine exploded'));
    const { result } = renderHook(() => useFinancialCase({ computeFn }));
    act(() => {
      result.current.addDriver(createEmptyDriver('cost'));
    });
    await act(async () => {
      await result.current.recompute();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('engine exploded');
    expect(result.current.result).toBeNull();
  });

  it('removing all drivers returns to empty', () => {
    const { result } = renderHook(() => useFinancialCase());
    let driverId = '';
    act(() => {
      const d = createEmptyDriver('cost');
      driverId = d.id;
      result.current.addDriver(d);
    });
    expect(result.current.status).toBe('stale');
    act(() => {
      result.current.removeDriver(driverId);
    });
    expect(result.current.status).toBe('empty');
  });

  it('driverCounts tracks cost vs benefit split for the ≥3/≥3 acceptance minimum', () => {
    // One `act()` per call, matching real usage (each toolbar click is its
    // own render cycle) — `addDriver` closes over the hook's current
    // `drivers` snapshot, so batching multiple calls into a single `act()`
    // without an intermediate render would silently drop all but the last.
    const { result } = renderHook(() => useFinancialCase());
    act(() => {
      result.current.addDriver(createEmptyDriver('cost'));
    });
    act(() => {
      result.current.addDriver(createEmptyDriver('cost'));
    });
    act(() => {
      result.current.addDriver(createEmptyDriver('benefit'));
    });
    expect(result.current.driverCounts).toEqual({ cost: 2, benefit: 1 });
  });

  it('undo/redo on drivers goes through markDirty (stays honest about staleness)', async () => {
    const computeFn: FinancialComputeFn = vi.fn().mockResolvedValue(fakeResult());
    const { result } = renderHook(() => useFinancialCase({ computeFn }));
    act(() => {
      result.current.addDriver(createEmptyDriver('cost'));
    });
    await act(async () => {
      await result.current.recompute();
    });
    expect(result.current.status).toBe('fresh');

    act(() => {
      result.current.addDriver(createEmptyDriver('benefit'));
    });
    expect(result.current.drivers).toHaveLength(2);
    expect(result.current.status).toBe('stale');

    act(() => {
      result.current.undo();
    });
    expect(result.current.drivers).toHaveLength(1);
    // Undo is itself a driver-set change — still honestly stale, not
    // silently restored to the old `fresh` result.
    expect(result.current.status).toBe('stale');
  });
});
