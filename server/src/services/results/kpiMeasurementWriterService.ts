/**
 * RES-003 — canonical KPI measurement / time-series writer.
 *
 * Single entry point for every caller that records a `kpi_time_series` row
 * (the canonical v8 route, the legacy /api/benefits fallback, the IRIS
 * bulk-ingest loop, and connector ingestion). Replaces four independent,
 * bare-INSERT call sites that shared no dedup key — the same (kpi, period,
 * source) could previously be written twice with no rejection, no merge, no
 * warning (see docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/
 * RES-003_IMPLEMENTATION_PACKET.md §1/§5 and the migration this module
 * depends on: 20260803_res003_kpi_time_series_measurement_identity.sql).
 *
 * RES-02 reconciliation (2026-08-03): the canonical KPI-definition owner
 * (codex/res02-canonical-owner-versioning, CODE_GO_FROZEN) already wired an
 * additive `kpi_time_series.definition_version_id` pin into all four writer
 * call sites individually, resolved via its own exported
 * `getCurrentDefinitionVersionId(kpiId, organizationId)`. This module
 * absorbs that same call (single source of truth, not a re-implementation)
 * so the pin, the dedup/idempotency upsert, and the ownership gate all live
 * in one place instead of being duplicated across four call sites again.
 *
 * Scope boundary: this module reads `initiative_kpis` for tenant ownership
 * and `measurement_frequency`, and calls RES-02's own
 * `getCurrentDefinitionVersionId` to resolve the pin. It never writes KPI
 * *definition* fields and never references `kpi_definition_versions`
 * directly — RES-02's `kpiDefinitionService.ts` remains the sole owner of
 * that table.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { getCurrentDefinitionVersionId } from './kpiDefinitionService.js';
import { handleTimeSeriesRecorded } from './kpiDeviationService.js';

// The audit-log insert is intentionally inlined here (not imported from
// resultsEnterpriseService.createMetricAuditEntry, which does the identical
// INSERT) — resultsEnterpriseService.recordConnectorMeasurement is one of
// this module's callers, so importing it back would create a circular
// module dependency. Same table, same columns, single source of truth for
// the query even though the class method isn't reused.
async function writeMetricAuditEntry(
  organizationId: string,
  data: {
    kpiId: string;
    section: string;
    eventType: string;
    source: string;
    actorUserId?: string | null;
    summary?: string | null;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  }
): Promise<void> {
  await dbRun(
    `INSERT INTO kpi_metric_audit_log
       (id, organization_id, kpi_id, section, event_type, source, actor_user_id, summary, before_json, after_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      organizationId,
      data.kpiId,
      data.section,
      data.eventType,
      data.source,
      data.actorUserId || null,
      data.summary || null,
      JSON.stringify(data.before || {}),
      JSON.stringify(data.after || {}),
    ]
  );
}

export class KpiMeasurementKpiNotFoundError extends Error {
  constructor(kpiId: string) {
    super(`KPI ${kpiId} not found`);
    this.name = 'KpiMeasurementKpiNotFoundError';
  }
}

export class KpiMeasurementInvalidValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KpiMeasurementInvalidValueError';
  }
}

export interface RecordKpiMeasurementInput {
  organizationId: string;
  kpiId: string;
  value: number;
  periodStart: string; // YYYY-MM-DD
  periodEnd?: string | null;
  source?: string | null;
  notes?: string | null;
  actorUserId?: string | null;
  /** Audit trail event_type; defaults to 'measurement_recorded'. */
  auditEventType?: string;
  auditSourceLabel?: string;
  auditSummary?: string | null;
  auditAfterExtra?: Record<string, unknown>;
  /**
   * Defaults to true. The IRIS bulk-ingest loop (up to 500 points per call)
   * passes false to preserve its existing behaviour of not firing a
   * deviation evaluation (and therefore a possible owner notification) per
   * point — that would be a 500x notification storm nobody asked for as
   * part of this change. Every other caller keeps today's behaviour of
   * running the check on every write.
   */
  runDeviationCheck?: boolean;
}

export interface RecordKpiMeasurementResult {
  id: string;
  kpiId: string;
  value: number;
  periodStart: string;
  periodEnd: string | null;
  periodKey: string | null;
  source: string;
  notes: string | null;
  /** true when this call inserted a new row; false when it updated an existing one at the same (kpiId, periodStart, source). */
  wasNewRow: boolean;
  /**
   * RES-02 pin: the kpi_definition_versions.id that was current for this KPI
   * at the moment this measurement was recorded (or corrected — a
   * correction re-pins to whatever is current at correction time, not the
   * original write's version). Null when the KPI has no resolvable current
   * definition version yet.
   */
  definitionVersionId: string | null;
}

/**
 * `kpi_time_series.period_start`/`period_end` are Postgres `DATE` columns.
 * node-pg has no type parser registered for OID 1082 in this codebase (see
 * `financePeriodFormat.ts`'s header comment for the same trap hit on Finance
 * statements), so a `MAX(period_start)` read hands back a raw JS `Date`
 * object, not a string. `String(date)` produces `Date.prototype.toString()`
 * garbage ("Mon Jun 01 2026 ..."), and `.toISOString()` is *also* wrong here
 * — it converts through UTC, which silently rolls the date back a day in any
 * negative-UTC-offset timezone, because node-pg constructs this Date at
 * LOCAL midnight, not UTC midnight. Reading it back with the same local
 * getters it was built from is the only symmetric, timezone-safe conversion.
 */
function toIsoDateString(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10) || null;
}

/**
 * Mirrors the frequency-bucketing logic that lived, duplicated, in both
 * `results.routes.ts` and `benefits.routes.ts`. Centralised here so both
 * routes (and any future caller) derive the same period key from one place.
 */
export function deriveKpiPeriodKey(
  periodStart?: string | null,
  measurementFrequency?: string | null
): string | null {
  const start = String(periodStart || '').slice(0, 10);
  if (!start) return null;
  const [year, month = '01', day = '01'] = start.split('-');
  const frequency = String(measurementFrequency || 'MONTHLY').toUpperCase();

  if (frequency === 'DAILY') return start;
  if (frequency === 'WEEKLY') {
    return `${year}-W${String(Math.max(1, Math.ceil(Number(day) / 7))).padStart(2, '0')}`;
  }
  if (frequency === 'QUARTERLY') {
    return `${year}-Q${String(Math.max(1, Math.ceil(Number(month) / 3)))}`;
  }
  return `${year}-${month}`;
}

async function assertOwnedKpiAndFrequency(
  kpiId: string,
  organizationId: string
): Promise<{ id: string; measurementFrequency: string | null }> {
  const row = await dbGet<{ id: string; measurement_frequency?: string | null }>(
    `SELECT k.id, k.measurement_frequency
     FROM initiative_kpis k
     LEFT JOIN initiatives i ON i.id = k.initiative_id
     WHERE k.id = ? AND COALESCE(k.organization_id, i.organization_id) = ?`,
    [kpiId, organizationId]
  );
  if (!row?.id) {
    throw new KpiMeasurementKpiNotFoundError(kpiId);
  }
  return { id: row.id, measurementFrequency: row.measurement_frequency ?? null };
}

/**
 * Records (creates or, at the same kpiId/periodStart/source key, corrects)
 * one KPI measurement. Atomic upsert via the unique index added by
 * 20260803_res003_kpi_time_series_measurement_identity.sql — safe under
 * concurrent duplicate submissions (the database, not application logic,
 * serializes the race).
 */
export async function recordKpiMeasurement(
  input: RecordKpiMeasurementInput
): Promise<RecordKpiMeasurementResult> {
  const { organizationId, kpiId } = input;
  if (!kpiId) {
    throw new KpiMeasurementInvalidValueError('kpiId is required');
  }
  if (input.value == null || !Number.isFinite(Number(input.value))) {
    throw new KpiMeasurementInvalidValueError('value must be a finite number');
  }
  const periodStart = String(input.periodStart || '').slice(0, 10);
  if (!periodStart) {
    throw new KpiMeasurementInvalidValueError('periodStart is required');
  }

  const owned = await assertOwnedKpiAndFrequency(kpiId, organizationId);
  const periodKey = deriveKpiPeriodKey(periodStart, owned.measurementFrequency);

  const value = Number(input.value);
  const periodEnd = input.periodEnd ? String(input.periodEnd).slice(0, 10) : null;
  const source = input.source ? String(input.source) : 'manual';
  const notes = input.notes != null ? String(input.notes) : null;
  const newId = uuidv4().replace(/-/g, '');

  // RES-02 pin: resolved via the canonical owner's own function — not a
  // re-implementation of its join. Re-resolved on every call (including a
  // correction), so a correction pins to whatever is current AT CORRECTION
  // TIME, matching "this measurement, as it now reads, was evaluated
  // against this definition" rather than freezing the original write's
  // version forever.
  const definitionVersionId = await getCurrentDefinitionVersionId(kpiId, organizationId);

  // ON CONFLICT DO UPDATE against the (kpi_id, period_start, source) unique
  // index: a resubmission for the same key corrects the existing row in
  // place (keeps the original id, bumps updated_at) instead of creating a
  // silent duplicate. `xmax = 0` is the standard Postgres tell for "this
  // RETURNING row came from the INSERT branch, not the UPDATE branch".
  const upserted = await dbGet<{ id: string; was_new_row: boolean }>(
    `INSERT INTO kpi_time_series
       (id, kpi_id, organization_id, value, period_start, period_end, source, notes, recorded_by, definition_version_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT (kpi_id, period_start, source) DO UPDATE SET
       value = EXCLUDED.value,
       period_end = EXCLUDED.period_end,
       notes = EXCLUDED.notes,
       recorded_by = EXCLUDED.recorded_by,
       definition_version_id = EXCLUDED.definition_version_id,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, (xmax = 0) AS was_new_row`,
    [
      newId,
      kpiId,
      organizationId,
      value,
      periodStart,
      periodEnd,
      source,
      notes,
      input.actorUserId || null,
      definitionVersionId,
    ]
  );
  const id = upserted?.id || newId;
  const wasNewRow = Boolean(upserted?.was_new_row);

  // Conditional current_value update: only advance it when this write is for
  // the latest-known period for the KPI. Without this guard, backfilling an
  // older period after a newer one was already recorded would overwrite
  // current_value with the stale backfilled number (RES-003 packet §1).
  const latest = await dbGet<{ latest_period: unknown }>(
    `SELECT MAX(period_start) AS latest_period FROM kpi_time_series WHERE kpi_id = ? AND organization_id = ?`,
    [kpiId, organizationId]
  );
  const latestPeriod = toIsoDateString(latest?.latest_period);
  if (!latestPeriod || periodStart >= latestPeriod) {
    await dbRun(
      `UPDATE initiative_kpis SET current_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
      [value, kpiId, organizationId]
    ).catch(() => null);
  }

  if (input.runDeviationCheck !== false) {
    try {
      await handleTimeSeriesRecorded({
        db: {
          get: (sql: string, params: unknown[]) => dbGet(sql, params),
          all: (sql: string, params: unknown[]) => dbAll(sql, params),
          run: (sql: string, params: unknown[]) => dbRun(sql, params),
        } as any,
        orgId: organizationId,
        kpiId: String(kpiId),
        value,
        periodStart,
        periodEnd,
        recordedByUserId: input.actorUserId || null,
      });
    } catch {
      // Do not fail the measurement write on deviation-evaluation side effects
      // (unchanged behaviour from the three pre-existing call sites).
    }
  }

  await writeMetricAuditEntry(organizationId, {
    kpiId,
    section: 'history',
    eventType: input.auditEventType || 'measurement_recorded',
    source: input.auditSourceLabel || source,
    actorUserId: input.actorUserId || null,
    summary: input.auditSummary || `Measurement recorded for ${periodStart}`,
    before: {},
    after: {
      value,
      periodStart,
      periodEnd,
      source,
      wasNewRow,
      definitionVersionId,
      ...input.auditAfterExtra,
    },
  }).catch(() => null);

  return {
    id,
    kpiId,
    value,
    periodStart,
    periodEnd,
    periodKey,
    source,
    notes,
    wasNewRow,
    definitionVersionId,
  };
}
