/**
 * DateDependencyEngine — Airtable-style date dependency calculations.
 *
 * Supports:
 * - FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish)
 * - Lag/lead days
 * - Weekend skipping (business days only)
 * - Cascading recalculation through dependency chains
 */

import logger from '../../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface DateDependencyConfig {
  tableId: string;
  startDateFieldId: string;
  endDateFieldId: string;
  durationFieldId?: string;
  predecessorFieldId?: string;
  dependencyTypeFieldId?: string;
  lagFieldId?: string;
  defaultDependencyType: DependencyType;
  defaultLagDays: number;
  skipWeekends: boolean;
}

export interface RecordDateData {
  recordId: string;
  startDate: string | null;
  endDate: string | null;
  duration: number | null;
  predecessorIds: string[];
  dependencyType: DependencyType;
  lagDays: number;
}

export interface DateRecalcResult {
  recordId: string;
  startDate: string | null;
  endDate: string | null;
  duration: number | null;
  changed: boolean;
}

// ---------------------------------------------------------------------------
// Business day utilities
// ---------------------------------------------------------------------------

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let remaining = Math.abs(days);
  const direction = days >= 0 ? 1 : -1;

  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + direction);
    if (!isWeekend(result)) {
      remaining--;
    }
  }
  return result;
}

function addCalendarDays(start: Date, days: number): Date {
  const result = new Date(start);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  const target = end.getTime();
  const direction = target >= current.getTime() ? 1 : -1;

  while (
    direction > 0
      ? current.getTime() < target
      : current.getTime() > target
  ) {
    current.setUTCDate(current.getUTCDate() + direction);
    if (!isWeekend(current)) {
      count++;
    }
  }
  return count * direction;
}

function countCalendarDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

export class DateDependencyEngine {
  private config: DateDependencyConfig;

  constructor(config: DateDependencyConfig) {
    this.config = config;
  }

  /**
   * Given a set of records, recalculate dates based on dependencies.
   * Returns only records that changed.
   */
  recalculateDates(records: RecordDateData[]): DateRecalcResult[] {
    const recordMap = new Map<string, RecordDateData>();
    for (const r of records) {
      recordMap.set(r.recordId, { ...r });
    }

    const order = this.topologicalSort(records);
    const results: DateRecalcResult[] = [];

    for (const recordId of order) {
      const record = recordMap.get(recordId);
      if (!record) continue;

      const result = this.recalculateRecord(record, recordMap);
      if (result.changed) {
        recordMap.set(recordId, {
          ...record,
          startDate: result.startDate,
          endDate: result.endDate,
          duration: result.duration,
        });
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Recalculate a single record based on its predecessors.
   */
  private recalculateRecord(
    record: RecordDateData,
    allRecords: Map<string, RecordDateData>
  ): DateRecalcResult {
    const original = {
      startDate: record.startDate,
      endDate: record.endDate,
      duration: record.duration,
    };

    let newStart = toDate(record.startDate);
    let newEnd = toDate(record.endDate);
    let newDuration = record.duration;

    // If there are predecessors, calculate start/end from them
    if (record.predecessorIds.length > 0) {
      const constraintDate = this.getConstraintDate(
        record.predecessorIds,
        record.dependencyType,
        record.lagDays,
        allRecords
      );

      if (constraintDate) {
        const depType = record.dependencyType;

        if (depType === 'FS' || depType === 'SS') {
          newStart = constraintDate;
          if (newDuration != null && newDuration > 0) {
            newEnd = this.addDays(newStart, newDuration);
          }
        } else if (depType === 'FF' || depType === 'SF') {
          newEnd = constraintDate;
          if (newDuration != null && newDuration > 0) {
            newStart = this.addDays(newEnd, -newDuration);
          }
        }
      }
    }

    // Auto-calculate duration if both dates exist but duration is missing
    if (newStart && newEnd && (newDuration == null || newDuration <= 0)) {
      newDuration = this.daysBetween(newStart, newEnd);
    }

    // Auto-calculate end date if start + duration exist but end is missing
    if (newStart && !newEnd && newDuration != null && newDuration > 0) {
      newEnd = this.addDays(newStart, newDuration);
    }

    // Auto-calculate start date if end + duration exist but start is missing
    if (!newStart && newEnd && newDuration != null && newDuration > 0) {
      newStart = this.addDays(newEnd, -newDuration);
    }

    const resultStart = newStart ? toISODate(newStart) : null;
    const resultEnd = newEnd ? toISODate(newEnd) : null;

    const changed =
      resultStart !== original.startDate ||
      resultEnd !== original.endDate ||
      newDuration !== original.duration;

    return {
      recordId: record.recordId,
      startDate: resultStart,
      endDate: resultEnd,
      duration: newDuration,
      changed,
    };
  }

  /**
   * Get the constraint date from predecessors based on dependency type.
   */
  private getConstraintDate(
    predecessorIds: string[],
    depType: DependencyType,
    lagDays: number,
    allRecords: Map<string, RecordDateData>
  ): Date | null {
    let latestDate: Date | null = null;

    for (const predId of predecessorIds) {
      const pred = allRecords.get(predId);
      if (!pred) continue;

      let refDate: Date | null = null;

      switch (depType) {
        case 'FS':
          refDate = toDate(pred.endDate);
          break;
        case 'SS':
          refDate = toDate(pred.startDate);
          break;
        case 'FF':
          refDate = toDate(pred.endDate);
          break;
        case 'SF':
          refDate = toDate(pred.startDate);
          break;
      }

      if (refDate) {
        const withLag = this.addDays(refDate, lagDays);
        if (!latestDate || withLag.getTime() > latestDate.getTime()) {
          latestDate = withLag;
        }
      }
    }

    return latestDate;
  }

  /**
   * Topological sort of records by dependency order.
   * Records with no predecessors come first.
   */
  private topologicalSort(records: RecordDateData[]): string[] {
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    for (const r of records) {
      if (!inDegree.has(r.recordId)) inDegree.set(r.recordId, 0);
      if (!dependents.has(r.recordId)) dependents.set(r.recordId, []);
    }

    for (const r of records) {
      for (const predId of r.predecessorIds) {
        if (!dependents.has(predId)) dependents.set(predId, []);
        dependents.get(predId)!.push(r.recordId);
        inDegree.set(r.recordId, (inDegree.get(r.recordId) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);

      for (const dep of dependents.get(current) ?? []) {
        const newDeg = (inDegree.get(dep) ?? 1) - 1;
        inDegree.set(dep, newDeg);
        if (newDeg === 0) queue.push(dep);
      }
    }

    // Any remaining records (cycles) get appended at the end
    for (const r of records) {
      if (!order.includes(r.recordId)) {
        logger.warn('[DateDependencyEngine] Cycle detected, record appended at end', {
          recordId: r.recordId,
        });
        order.push(r.recordId);
      }
    }

    return order;
  }

  /**
   * Detect circular dependencies. Returns cycle path or null.
   */
  detectCycle(records: RecordDateData[]): string[] | null {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;

    const color = new Map<string, number>();
    const parent = new Map<string, string | null>();
    const adjList = new Map<string, string[]>();

    for (const r of records) {
      color.set(r.recordId, WHITE);
      adjList.set(r.recordId, r.predecessorIds.filter((id) => records.some((rec) => rec.recordId === id)));
    }

    const dfs = (node: string): string[] | null => {
      color.set(node, GRAY);

      for (const pred of adjList.get(node) ?? []) {
        if (color.get(pred) === GRAY) {
          const cycle = [pred, node];
          let cur = node;
          while (cur !== pred) {
            const p = parent.get(cur);
            if (!p) break;
            cycle.push(p);
            cur = p;
          }
          return cycle.reverse();
        }
        if (color.get(pred) === WHITE) {
          parent.set(pred, node);
          const result = dfs(pred);
          if (result) return result;
        }
      }

      color.set(node, BLACK);
      return null;
    };

    for (const r of records) {
      if (color.get(r.recordId) === WHITE) {
        const cycle = dfs(r.recordId);
        if (cycle) return cycle;
      }
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private addDays(date: Date, days: number): Date {
    if (this.config.skipWeekends) {
      return addBusinessDays(date, days);
    }
    return addCalendarDays(date, days);
  }

  private daysBetween(start: Date, end: Date): number {
    if (this.config.skipWeekends) {
      return countBusinessDays(start, end);
    }
    return countCalendarDays(start, end);
  }
}

// ---------------------------------------------------------------------------
// Convenience: recalculate dates for a set of records
// ---------------------------------------------------------------------------

export function recalculateDates(
  config: DateDependencyConfig,
  records: RecordDateData[]
): DateRecalcResult[] {
  const engine = new DateDependencyEngine(config);

  const cycle = engine.detectCycle(records);
  if (cycle) {
    logger.error('[DateDependencyEngine] Circular dependency detected', { cycle });
    return [];
  }

  return engine.recalculateDates(records);
}

// ---------------------------------------------------------------------------
// Single-record trigger helpers
// ---------------------------------------------------------------------------

export type DateChangeType = 'startDate' | 'endDate' | 'duration';

/**
 * When a single field changes on a record, determine what to recalculate.
 */
export function computeRecordDateUpdate(
  changeType: DateChangeType,
  record: RecordDateData,
  skipWeekends: boolean
): { startDate: string | null; endDate: string | null; duration: number | null } {
  const start = toDate(record.startDate);
  const end = toDate(record.endDate);
  const dur = record.duration;

  const addDaysFn = skipWeekends ? addBusinessDays : addCalendarDays;
  const daysBetweenFn = skipWeekends ? countBusinessDays : countCalendarDays;

  switch (changeType) {
    case 'startDate': {
      if (start && dur != null && dur > 0) {
        const newEnd = addDaysFn(start, dur);
        return { startDate: record.startDate, endDate: toISODate(newEnd), duration: dur };
      }
      if (start && end) {
        const newDur = daysBetweenFn(start, end);
        return { startDate: record.startDate, endDate: record.endDate, duration: newDur };
      }
      return { startDate: record.startDate, endDate: record.endDate, duration: dur };
    }

    case 'endDate': {
      if (start && end) {
        const newDur = daysBetweenFn(start, end);
        return { startDate: record.startDate, endDate: record.endDate, duration: newDur };
      }
      return { startDate: record.startDate, endDate: record.endDate, duration: dur };
    }

    case 'duration': {
      if (start && dur != null && dur > 0) {
        const newEnd = addDaysFn(start, dur);
        return { startDate: record.startDate, endDate: toISODate(newEnd), duration: dur };
      }
      if (end && dur != null && dur > 0) {
        const newStart = addDaysFn(end, -dur);
        return { startDate: toISODate(newStart), endDate: record.endDate, duration: dur };
      }
      return { startDate: record.startDate, endDate: record.endDate, duration: dur };
    }

    default:
      return { startDate: record.startDate, endDate: record.endDate, duration: dur };
  }
}
