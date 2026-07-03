/**
 * M13/V1 — computeCriticalPath (longest-duration chain through the dep DAG).
 */
import { describe, expect, it } from 'vitest';

import { computeCriticalPath } from '@/services/initiativeSchedule';
import type { ScheduleItem } from '@/types/initiativeSchedule';

const mk = (id: string, start: string, end: string): ScheduleItem => ({
  id,
  type: 'task',
  title: id,
  start,
  end,
  status: 'todo',
  sourceId: id,
  sourceKind: 'task',
});

describe('computeCriticalPath', () => {
  it('returns [] with no edges', () => {
    const items = [mk('A', '2026-06-01', '2026-06-04')];
    expect(computeCriticalPath(items, [])).toEqual([]);
  });

  it('picks the longest-duration chain over a shorter parallel path', () => {
    // A(3d) → B(5d) → C(2d)  vs  A → C : long chain wins.
    const items = [
      mk('A', '2026-06-01', '2026-06-03'), // 3 days inclusive
      mk('B', '2026-06-04', '2026-06-08'), // 5 days
      mk('C', '2026-06-09', '2026-06-10'), // 2 days
    ];
    const edges = [
      { fromId: 'A', toId: 'B' },
      { fromId: 'B', toId: 'C' },
      { fromId: 'A', toId: 'C' },
    ];
    expect(computeCriticalPath(items, edges)).toEqual(['A', 'B', 'C']);
  });

  it('ignores edges referencing unknown items', () => {
    const items = [mk('A', '2026-06-01', '2026-06-03'), mk('B', '2026-06-04', '2026-06-06')];
    const edges = [
      { fromId: 'A', toId: 'B' },
      { fromId: 'A', toId: 'ghost' },
    ];
    expect(computeCriticalPath(items, edges)).toEqual(['A', 'B']);
  });

  it('is cycle-safe (does not loop forever)', () => {
    const items = [mk('A', '2026-06-01', '2026-06-02'), mk('B', '2026-06-03', '2026-06-05')];
    const edges = [
      { fromId: 'A', toId: 'B' },
      { fromId: 'B', toId: 'A' },
    ];
    const path = computeCriticalPath(items, edges);
    expect(path.length).toBeGreaterThan(0);
  });
});
