/**
 * G4-TABLE-SCALE — unit tests for the Idea Table row-scale guardrails.
 *
 * These test the pure cap math directly (no component mount), which is the
 * point: mounting hundreds of real `<tr>` rows in jsdom is exactly the cost
 * this module exists to bound (see docs/qa/ideas-complete-transformation-
 * 2026-08-09/17_PERFORMANCE_MEASUREMENT.md — N=1,000 ~6s mount, N=5,000 OOM).
 */
import { describe, expect, it } from 'vitest';

import {
  applyCsvImportCap,
  computeRowRenderCap,
  MAX_TABLE_ROWS,
} from '../../../../../src/components/MyWork/table/tableRowLimits';
import type { TableNode } from '../../../../../src/components/MyWork/table/tableTypes';

function makeRows(n: number, prefix = 'row'): TableNode[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${i}`,
    type: 'idea',
    data: { label: `${prefix} ${i}` },
  }));
}

describe('MAX_TABLE_ROWS', () => {
  it('is the documented product cap of 500', () => {
    expect(MAX_TABLE_ROWS).toBe(500);
  });
});

describe('computeRowRenderCap — flat (ungrouped) view', () => {
  it('shows every row unchanged when under the cap', () => {
    const rows = makeRows(100);
    const result = computeRowRenderCap(rows, null, MAX_TABLE_ROWS);
    expect(result.groups).toBeNull();
    expect(result.rows).toHaveLength(100);
    expect(result.totalCount).toBe(100);
    expect(result.shownCount).toBe(100);
  });

  it('caps at exactly the limit when the count equals the cap', () => {
    const rows = makeRows(500);
    const result = computeRowRenderCap(rows, null, 500);
    expect(result.rows).toHaveLength(500);
    expect(result.totalCount).toBe(500);
    expect(result.shownCount).toBe(500);
  });

  it('truncates to the cap and reports the true total when over the cap', () => {
    const rows = makeRows(5000);
    const result = computeRowRenderCap(rows, null, 500);
    expect(result.rows).toHaveLength(500);
    expect(result.rows?.[0].id).toBe('row-0');
    expect(result.rows?.[499].id).toBe('row-499');
    expect(result.totalCount).toBe(5000);
    expect(result.shownCount).toBe(500);
  });
});

describe('computeRowRenderCap — grouped view', () => {
  it('spends one global budget across groups, in group order, never exceeding the cap in total', () => {
    const groupedRows: Record<string, TableNode[]> = {
      todo: makeRows(300, 'todo'),
      in_progress: makeRows(300, 'ip'),
      done: makeRows(300, 'done'),
    };
    const result = computeRowRenderCap([], groupedRows, 500);
    expect(result.rows).toBeNull();
    expect(result.groups).not.toBeNull();
    // First group takes its full 300, second group takes the remaining 200, third group takes 0.
    const byKey = Object.fromEntries(result.groups!);
    expect(byKey.todo).toHaveLength(300);
    expect(byKey.in_progress).toHaveLength(200);
    expect(byKey.done).toHaveLength(0);
    expect(result.totalCount).toBe(900);
    expect(result.shownCount).toBe(500);
  });

  it('shows every row in every group unchanged when the grouped total is under the cap', () => {
    const groupedRows: Record<string, TableNode[]> = {
      a: makeRows(10, 'a'),
      b: makeRows(20, 'b'),
    };
    const result = computeRowRenderCap([], groupedRows, 500);
    const byKey = Object.fromEntries(result.groups!);
    expect(byKey.a).toHaveLength(10);
    expect(byKey.b).toHaveLength(20);
    expect(result.totalCount).toBe(30);
    expect(result.shownCount).toBe(30);
  });
});

describe('applyCsvImportCap', () => {
  it('imports everything unchanged when well under the cap', () => {
    const rows = Array.from({ length: 50 }, (_, i) => [`label-${i}`]);
    const decision = applyCsvImportCap(0, rows, 500);
    expect(decision.blocked).toBe(false);
    expect(decision.truncatedCount).toBe(0);
    expect(decision.rowsToImport).toHaveLength(50);
  });

  it('truncates to the remaining budget when the import would cross the cap, without dropping silently', () => {
    const rows = Array.from({ length: 501 }, (_, i) => [`label-${i}`]);
    const decision = applyCsvImportCap(0, rows, 500);
    expect(decision.blocked).toBe(false);
    expect(decision.rowsToImport).toHaveLength(500);
    expect(decision.truncatedCount).toBe(1);
  });

  it('truncates correctly when the table already has some rows', () => {
    const rows = Array.from({ length: 50 }, (_, i) => [`label-${i}`]);
    const decision = applyCsvImportCap(480, rows, 500);
    expect(decision.blocked).toBe(false);
    expect(decision.rowsToImport).toHaveLength(20);
    expect(decision.truncatedCount).toBe(30);
  });

  it('blocks entirely (imports nothing) when the table is already at the cap', () => {
    const rows = Array.from({ length: 10 }, (_, i) => [`label-${i}`]);
    const decision = applyCsvImportCap(500, rows, 500);
    expect(decision.blocked).toBe(true);
    expect(decision.rowsToImport).toHaveLength(0);
    expect(decision.truncatedCount).toBe(10);
  });

  it('blocks entirely when the table is already over the cap', () => {
    const rows = Array.from({ length: 10 }, (_, i) => [`label-${i}`]);
    const decision = applyCsvImportCap(600, rows, 500);
    expect(decision.blocked).toBe(true);
    expect(decision.rowsToImport).toHaveLength(0);
    expect(decision.truncatedCount).toBe(10);
  });

  it('respects the real default cap (500) when none is passed explicitly', () => {
    const rows = Array.from({ length: 600 }, (_, i) => [`label-${i}`]);
    const decision = applyCsvImportCap(0, rows);
    expect(decision.rowsToImport).toHaveLength(500);
    expect(decision.truncatedCount).toBe(100);
  });
});
