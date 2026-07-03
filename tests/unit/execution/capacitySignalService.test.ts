import { describe, expect, it } from 'vitest';

import {
  buildCapacitySignals,
  capacityPortfolioSignal,
} from '../../../server/src/services/capacitySignalService.js';
import type {
  ResourceAllocation,
  ResourceCapacity,
} from '../../../server/src/services/capacityModelService.js';

// ── Fixtures ──────────────────────────────────────────────────────────────
// Helper: one allocation of `fte` for a resource over a fixed window.
function alloc(resourceId: string, allocatedFte: number): ResourceAllocation {
  return {
    resourceId,
    initiativeId: `init-${resourceId}`,
    allocatedFte,
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
  };
}

function cap(resourceId: string, availableFte: number): ResourceCapacity {
  return { resourceId, availableFte };
}

describe('buildCapacitySignals — overload severity', () => {
  it('emits CRITICAL CAPACITY_OVERLOAD when utilization ratio > 1.5', () => {
    // 1.6 / 1.0 = 160% → ratio 1.6 > 1.5 → CRITICAL
    const signals = buildCapacitySignals([alloc('r-crit', 1.6)], [cap('r-crit', 1)]);

    expect(signals).toHaveLength(1);
    const s = signals[0];
    expect(s.type).toBe('CAPACITY_OVERLOAD');
    expect(s.severity).toBe('CRITICAL');
    expect(s.resourceId).toBe('r-crit');
    expect(s.utilizationPct).toBe(160);
    expect(s.title).toContain('160%');
  });

  it('emits HIGH CAPACITY_OVERLOAD when 1.2 < ratio <= 1.5', () => {
    // 1.3 / 1.0 = 130% → ratio 1.3 (>1.2, not >1.5) → HIGH
    const signals = buildCapacitySignals([alloc('r-high', 1.3)], [cap('r-high', 1)]);

    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('CAPACITY_OVERLOAD');
    expect(signals[0].severity).toBe('HIGH');
    expect(signals[0].utilizationPct).toBe(130);
  });

  it('emits MEDIUM CAPACITY_OVERLOAD when 1.0 < ratio <= 1.2', () => {
    // 1.1 / 1.0 = 110% → over but ratio <= 1.2 → MEDIUM
    const signals = buildCapacitySignals([alloc('r-med', 1.1)], [cap('r-med', 1)]);

    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('CAPACITY_OVERLOAD');
    expect(signals[0].severity).toBe('MEDIUM');
    expect(signals[0].utilizationPct).toBe(110);
  });
});

describe('buildCapacitySignals — underutilization', () => {
  it('emits LOW CAPACITY_UNDERUTILIZED when ratio < 0.4', () => {
    // 0.3 / 1.0 = 30% → under and < 0.4 → CAPACITY_UNDERUTILIZED / LOW
    const signals = buildCapacitySignals([alloc('r-idle', 0.3)], [cap('r-idle', 1)]);

    expect(signals).toHaveLength(1);
    const s = signals[0];
    expect(s.type).toBe('CAPACITY_UNDERUTILIZED');
    expect(s.severity).toBe('LOW');
    expect(s.resourceId).toBe('r-idle');
    expect(s.utilizationPct).toBe(30);
    expect(s.title).toContain('30%');
  });

  it('does NOT emit for under resources with ratio >= 0.4', () => {
    // 0.5 / 1.0 = 50% → under (< 0.7) but ratio >= 0.4 → no signal
    const signals = buildCapacitySignals([alloc('r-mild', 0.5)], [cap('r-mild', 1)]);
    expect(signals).toHaveLength(0);
  });

  it('does NOT emit for optimal resources', () => {
    // 0.9 / 1.0 = 90% → optimal → no signal
    const signals = buildCapacitySignals([alloc('r-ok', 0.9)], [cap('r-ok', 1)]);
    expect(signals).toHaveLength(0);
  });
});

describe('capacityPortfolioSignal', () => {
  it('balance = critical when a CRITICAL/HIGH overload exists', () => {
    const allocations = [alloc('r-crit', 1.6), alloc('r-idle', 0.2)];
    const capacities = [cap('r-crit', 1), cap('r-idle', 1)];

    const portfolio = capacityPortfolioSignal(allocations, capacities);

    expect(portfolio.balance).toBe('critical');
    expect(portfolio.overloadedCount).toBe(1);
    expect(portfolio.underutilizedCount).toBe(1);
    expect(portfolio.worstUtilizationPct).toBe(160);
  });

  it('balance = strained when only a MEDIUM overload exists', () => {
    const allocations = [alloc('r-med', 1.1)];
    const capacities = [cap('r-med', 1)];

    const portfolio = capacityPortfolioSignal(allocations, capacities);

    expect(portfolio.balance).toBe('strained');
    expect(portfolio.overloadedCount).toBe(1);
    expect(portfolio.worstUtilizationPct).toBe(110);
  });

  it('balance = healthy when there are no overloads', () => {
    const allocations = [alloc('r-ok', 0.9), alloc('r-idle', 0.2)];
    const capacities = [cap('r-ok', 1), cap('r-idle', 1)];

    const portfolio = capacityPortfolioSignal(allocations, capacities);

    expect(portfolio.balance).toBe('healthy');
    expect(portfolio.overloadedCount).toBe(0);
    expect(portfolio.underutilizedCount).toBe(1);
  });

  it('worstUtilizationPct picks the highest across resources', () => {
    const allocations = [alloc('a', 1.3), alloc('b', 1.8), alloc('c', 1.1)];
    const capacities = [cap('a', 1), cap('b', 1), cap('c', 1)];

    const portfolio = capacityPortfolioSignal(allocations, capacities);

    expect(portfolio.worstUtilizationPct).toBe(180);
    expect(portfolio.overloadedCount).toBe(3);
    expect(portfolio.balance).toBe('critical');
  });
});
