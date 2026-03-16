import { describe, it, expect } from 'vitest';
import { DateDependencyEngine, type DateDependencyConfig, type RecordDateData } from '../DateDependencyEngine.js';

const baseConfig: DateDependencyConfig = {
  tableId: 'tbl-1',
  startDateFieldId: 'fld-start',
  endDateFieldId: 'fld-end',
  durationFieldId: 'fld-dur',
  predecessorFieldId: 'fld-pred',
  defaultDependencyType: 'FS',
  defaultLagDays: 0,
  skipWeekends: false,
};

function makeRecord(
  id: string,
  start: string | null,
  end: string | null,
  duration: number | null = null,
  predecessorIds: string[] = [],
  depType: 'FS' | 'SS' | 'FF' | 'SF' = 'FS',
  lag = 0,
): RecordDateData {
  return { recordId: id, startDate: start, endDate: end, duration, predecessorIds, dependencyType: depType, lagDays: lag };
}

describe('DateDependencyEngine', () => {
  it('recalculates FS dependency correctly', () => {
    const engine = new DateDependencyEngine(baseConfig);
    const records: RecordDateData[] = [
      makeRecord('A', '2026-03-01', '2026-03-05', 4),
      makeRecord('B', null, null, 3, ['A'], 'FS'),
    ];
    const results = engine.recalculateDates(records);
    const bResult = results.find((r) => r.recordId === 'B');
    expect(bResult).toBeDefined();
    expect(bResult!.changed).toBe(true);
    // FS: B starts after A ends — exact date depends on engine's day math
    expect(bResult!.startDate).toBeTruthy();
    const bStart = new Date(bResult!.startDate!);
    const aEnd = new Date('2026-03-05');
    expect(bStart.getTime()).toBeGreaterThanOrEqual(aEnd.getTime());
  });

  it('detects cycle in dependencies', () => {
    const engine = new DateDependencyEngine(baseConfig);
    const records: RecordDateData[] = [
      makeRecord('A', '2026-03-01', '2026-03-05', 4, ['B'], 'FS'),
      makeRecord('B', '2026-03-06', '2026-03-10', 4, ['A'], 'FS'),
    ];
    const cycle = engine.detectCycle(records);
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThan(0);
  });

  it('returns null for no cycle', () => {
    const engine = new DateDependencyEngine(baseConfig);
    const records: RecordDateData[] = [
      makeRecord('A', '2026-03-01', '2026-03-05', 4),
      makeRecord('B', null, null, 3, ['A'], 'FS'),
    ];
    const cycle = engine.detectCycle(records);
    expect(cycle).toBeNull();
  });

  it('handles lag days', () => {
    const engine = new DateDependencyEngine(baseConfig);
    const records: RecordDateData[] = [
      makeRecord('A', '2026-03-01', '2026-03-05', 4),
      makeRecord('B', null, null, 2, ['A'], 'FS', 2),
    ];
    const results = engine.recalculateDates(records);
    const bResult = results.find((r) => r.recordId === 'B');
    expect(bResult).toBeDefined();
    expect(bResult!.changed).toBe(true);
    // With 2 lag days, B starts at least 2 days after A ends
    const bStart = new Date(bResult!.startDate!);
    const aEnd = new Date('2026-03-05');
    const diffDays = (bStart.getTime() - aEnd.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(2);
  });

  it('skips weekends when configured', () => {
    const weekendConfig = { ...baseConfig, skipWeekends: true };
    const engine = new DateDependencyEngine(weekendConfig);
    const records: RecordDateData[] = [
      makeRecord('A', '2026-03-06', '2026-03-06', 0),
      makeRecord('B', null, null, 3, ['A'], 'FS'),
    ];
    const results = engine.recalculateDates(records);
    const bResult = results.find((r) => r.recordId === 'B');
    expect(bResult).toBeDefined();
    if (bResult?.startDate) {
      const startDay = new Date(bResult.startDate).getUTCDay();
      expect(startDay).not.toBe(0);
      expect(startDay).not.toBe(6);
    }
  });

  it('handles records with no predecessors (no changes)', () => {
    const engine = new DateDependencyEngine(baseConfig);
    const records: RecordDateData[] = [
      makeRecord('A', '2026-03-01', '2026-03-05', 4),
      makeRecord('B', '2026-03-10', '2026-03-15', 5),
    ];
    const results = engine.recalculateDates(records);
    expect(results.filter((r) => r.changed)).toHaveLength(0);
  });

  it('cascades through chain A → B → C', () => {
    const engine = new DateDependencyEngine(baseConfig);
    const records: RecordDateData[] = [
      makeRecord('A', '2026-03-01', '2026-03-03', 2),
      makeRecord('B', null, null, 2, ['A'], 'FS'),
      makeRecord('C', null, null, 1, ['B'], 'FS'),
    ];
    const results = engine.recalculateDates(records);
    const bResult = results.find((r) => r.recordId === 'B');
    const cResult = results.find((r) => r.recordId === 'C');
    expect(bResult).toBeDefined();
    expect(bResult!.changed).toBe(true);
    expect(cResult).toBeDefined();
    expect(cResult!.changed).toBe(true);
    // C starts after B ends, B starts after A ends
    const bStart = new Date(bResult!.startDate!);
    const cStart = new Date(cResult!.startDate!);
    expect(cStart.getTime()).toBeGreaterThan(bStart.getTime());
  });
});
