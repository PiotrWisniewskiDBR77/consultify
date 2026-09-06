/**
 * Report Cadence Service (M14 / F6 · 6.3)
 *
 * Scheduler-side due-detection for initiative status reports.
 * Human-in-the-loop: this module ONLY decides which reports are *due*; it does
 * NOT generate anything. The caller (Scheduler cron wiring — follow-up) turns
 * the returned list into auto-DRAFT reports for human review.
 *
 * Two layers:
 *  1. Pure functions (isReportDue / nextDueDate) — no I/O, fully unit-testable.
 *  2. findDueReports — org-scoped read against `status_reports` + `initiatives`.
 */

import { all as dbAll } from '../utils/DbPromise.js';

export type ReportPeriodType = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

/** Cadence length per period type, in whole days. */
export const PERIOD_DAYS: Record<ReportPeriodType, number> = {
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 90,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** All period types we evaluate for cadence. */
export const ALL_PERIOD_TYPES: ReportPeriodType[] = ['WEEKLY', 'MONTHLY', 'QUARTERLY'];

/**
 * Parse a DB timestamp into epoch millis. Returns null when unparseable/absent.
 *
 * Tolerant of BOTH shapes the `status_reports.created_at` column can hand
 * back, because the live column type differs by environment (table-name
 * collision documented in
 * server/migrations/20260719_status_reports_m14_columns_backfill.sql — the
 * legacy bootstrap in PostgresDatabase.ts created this table as `TIMESTAMP`,
 * not the `TEXT` the 066 migration intended):
 *   - a JS `Date` (node-postgres auto-parses a genuine `timestamp` column), or
 *   - an ISO string / `YYYY-MM-DD HH:MM:SS` string (a `TEXT`-typed column, or
 *     any DB driver that does not auto-parse timestamps).
 */
function parseTimestamp(value: string | Date | null): number | null {
  if (!value) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  // Postgres `TIMESTAMP` (no tz) serializes as "2026-06-23 10:00:00".
  // Date.parse on that is engine-dependent; normalize the space to 'T' and
  // treat it as UTC so cadence math is stable across environments.
  let normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(normalized)) {
    normalized = normalized.replace(' ', 'T');
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) {
      normalized += 'Z';
    }
  }
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * CZYSTA — is a report of the given period type due?
 *
 * Due when the full period (7 / 30 / 90 days) has elapsed since the last
 * generated report, or when none was ever generated.
 *
 * @param periodType      WEEKLY | MONTHLY | QUARTERLY
 * @param lastGeneratedAt ISO/DB timestamp of the most recent report, or null
 * @param now             current time in epoch millis
 */
export function isReportDue(
  periodType: ReportPeriodType,
  lastGeneratedAt: string | Date | null,
  now: number
): boolean {
  const last = parseTimestamp(lastGeneratedAt);
  // Never generated (or unparseable last value) → due.
  if (last === null) return true;
  const periodMs = PERIOD_DAYS[periodType] * MS_PER_DAY;
  return now - last >= periodMs;
}

/**
 * CZYSTA — when is the next report due?
 *
 * Anchored to the last report (+ one period). When none was ever generated the
 * baseline is `now`, so the next due date is one period out.
 *
 * @returns ISO-8601 string (UTC).
 */
export function nextDueDate(
  periodType: ReportPeriodType,
  lastGeneratedAt: string | Date | null,
  now: number
): string {
  const periodMs = PERIOD_DAYS[periodType] * MS_PER_DAY;
  const last = parseTimestamp(lastGeneratedAt);
  const anchor = last === null ? now : last;
  return new Date(anchor + periodMs).toISOString();
}

export interface DueReport {
  initiativeId: string;
  periodType: ReportPeriodType;
}

interface LastReportRow {
  initiative_id: string;
  period_type: string;
  last_generated_at: string | Date | null;
}

/**
 * Find all (initiative, periodType) pairs that are due for a fresh report.
 *
 * Reads EXECUTING initiatives in the org and LEFT JOINs the most recent
 * `status_reports.created_at` per (initiative, period_type). An initiative with
 * no report for a given period type yields last_generated_at = null → due.
 *
 * Org-scoped. node-pg snake_case. Does NOT trigger generation.
 *
 * @param orgId organization id (org isolation)
 * @param now   current time in epoch millis
 */
export async function findDueReports(orgId: string, now: number): Promise<DueReport[]> {
  // Cross-join each EXECUTING initiative with the three period types, then
  // LEFT JOIN the latest report for that (initiative, period_type). Status is
  // matched case-insensitively because initiative status casing is mixed
  // across the codebase ('EXECUTING' vs 'executing').
  const sql = `
    SELECT
      i.id AS initiative_id,
      p.period_type AS period_type,
      MAX(r.created_at) AS last_generated_at
    FROM initiatives i
    CROSS JOIN (
      SELECT 'WEEKLY' AS period_type
      UNION ALL SELECT 'MONTHLY'
      UNION ALL SELECT 'QUARTERLY'
    ) p
    LEFT JOIN status_reports r
      ON r.initiative_id = i.id
     AND r.organization_id = i.organization_id
     AND r.period_type = p.period_type
    WHERE i.organization_id = ?
      -- DEC-424 (P12-int-c): EXECUTING -> IN_EXECUTION.
      AND UPPER(i.status) = 'IN_EXECUTION'
    GROUP BY i.id, p.period_type
  `;

  const rows = await dbAll<LastReportRow>(sql, [orgId]);

  const due: DueReport[] = [];
  for (const row of rows) {
    const periodType = row.period_type as ReportPeriodType;
    if (!PERIOD_DAYS[periodType]) continue; // defensive: ignore unknown period types
    if (isReportDue(periodType, row.last_generated_at, now)) {
      due.push({ initiativeId: row.initiative_id, periodType });
    }
  }
  return due;
}

export default {
  PERIOD_DAYS,
  ALL_PERIOD_TYPES,
  isReportDue,
  nextDueDate,
  findDueReports,
};
