/**
 * M14/F8 — dependency graph analytics.
 */
import { describe, expect, it } from 'vitest';

import {
  cascadeImpact,
  criticalDependencyChain,
  detectCycles,
  topoOrder,
} from '../../../server/src/services/raidDependencyService.js';

const E = (...pairs: [string, string][]) => pairs.map(([fromId, toId]) => ({ fromId, toId }));

describe('raidDependencyService', () => {
  it('topoOrder of a simple chain A→B→C', () => {
    const r = topoOrder(E(['A', 'B'], ['B', 'C']));
    expect(r.hasCycle).toBe(false);
    expect(r.order.indexOf('A')).toBeLessThan(r.order.indexOf('B'));
    expect(r.order.indexOf('B')).toBeLessThan(r.order.indexOf('C'));
  });

  it('detects a cycle A→B→C→A', () => {
    const cycles = detectCycles(E(['A', 'B'], ['B', 'C'], ['C', 'A']));
    expect(cycles.length).toBeGreaterThan(0);
    expect(topoOrder(E(['A', 'B'], ['B', 'C'], ['C', 'A'])).hasCycle).toBe(true);
  });

  it('detects a self-loop', () => {
    expect(detectCycles(E(['A', 'A'])).some((c) => c[0] === 'A' && c[1] === 'A')).toBe(true);
  });

  it('cascade impact: delaying A affects B and C (downstream), not A', () => {
    const aff = cascadeImpact(E(['A', 'B'], ['B', 'C'], ['X', 'Y']), ['A']);
    expect([...aff].sort()).toEqual(['B', 'C']);
    expect(aff.has('A')).toBe(false);
    expect(aff.has('Y')).toBe(false);
  });

  it('critical chain = longest path (durations weighted)', () => {
    // A→B→D (3) vs A→C→D where C is long
    const edges = E(['A', 'B'], ['B', 'D'], ['A', 'C'], ['C', 'D']);
    const dur = new Map([['A', 1], ['B', 1], ['C', 10], ['D', 1]]);
    const chain = criticalDependencyChain(edges, dur);
    expect(chain).toContain('C'); // the long node must be on the critical chain
  });

  it('critical chain is empty when cyclic', () => {
    expect(criticalDependencyChain(E(['A', 'B'], ['B', 'A']))).toEqual([]);
  });
});
