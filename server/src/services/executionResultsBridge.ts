/**
 * Execution → Results bridge (M14 → M15 feed-forward)
 *
 * Closes the broken spine link found in the Harvard audit (INTEGRACJE.md §C poz.5):
 * Execution computes budget/health but never fed Results. This bridge exports a
 * `budget_health` KPI signal to the Results runtime whenever an initiative's
 * budget summary turns AMBER/RED, attached to KPIs linked to that initiative.
 *
 * Fire-and-forget by design: callers must not block budget writes on this.
 */

import { randomUUID } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { getInitiativeBudgetSummary } from './executionBudgetService.js';
import { createKpiSignal } from './v8/resultsROIService.js';

const LOG_PREFIX = '[ExecutionResultsBridge]';

/**
 * Source tag written to `initiative_benefits.source_tag` for benefits created by
 * the M14 closure handoff. M15 (Results/Benefits) reads this to distinguish
 * auto-materialized closure benefits from manually-authored ones, and it is the
 * dedup key (see migration 783 partial unique index).
 */
export const CLOSURE_HANDOFF_SOURCE = 'M14_CLOSURE_HANDOFF';

interface PlannedKpiRow {
  id: string;
  name: string;
  unit: string | null;
  target_value: number | null;
  description: string | null;
}

interface InitiativeFallbackRow {
  name: string;
  expected_roi: number | string | null;
}

export interface ClosureHandoffResult {
  /** Benefit rows newly inserted this call. */
  created: number;
  /** KPIs skipped because a closure benefit already existed (idempotency). */
  skipped: number;
  /** Planned KPIs considered (had a target_value). */
  considered: number;
  /**
   * True when `created` came from the no-KPI fallback (initiative.expected_roi)
   * rather than a planned KPI. The row itself still carries
   * `source_tag = CLOSURE_HANDOFF_SOURCE` (same as a KPI-backed row) so it
   * shows up in the same M15 inbox — the fallback is distinguishable by
   * `kpi_id IS NULL`, not by a different source tag.
   */
  fallbackUsed?: boolean;
}

/**
 * M14 → M15 closure handoff (Decision B1b).
 *
 * When an initiative closes (status → DONE), materialize its planned KPIs
 * (`initiative_kpis`) into the M15-readable benefits register
 * (`initiative_benefits`), tagged `source_tag = 'M14_CLOSURE_HANDOFF'`.
 *
 * Contract:
 * - Source of benefit definitions = the initiative's planned KPIs that carry a
 *   `target_value` (KPIs without a target can't seed a measurable benefit).
 * - Idempotent: a KPI that already has a closure benefit is skipped, so a repeat
 *   DONE — or a DONE → revert → DONE cycle — never produces duplicates. The
 *   source-KPI unique index (migration 938) is the backstop; this pre-check avoids
 *   relying on DB error semantics that differ across sqlite/pg.
 * - No KPIs (or none with a target) → zero benefits, no error.
 *
 * Callers MUST wrap this in try/catch (or use the fire-and-forget wrapper): a
 * handoff failure must never block the initiative status change.
 */
export async function handoffFromClosure(
  organizationId: string,
  initiativeId: string,
  actorId: string | null
): Promise<ClosureHandoffResult> {
  const result: ClosureHandoffResult = { created: 0, skipped: 0, considered: 0 };

  // Planned KPIs for the initiative. `initiative_kpis` is initiative-scoped
  // (FK to initiatives), no organization_id column — mirror the existing
  // controller queries.
  const kpis = (await dbAll<PlannedKpiRow>(
    `SELECT id, name, unit, target_value, description
       FROM initiative_kpis
      WHERE initiative_id = ?
        AND target_value IS NOT NULL`,
    [initiativeId],
    { fallback: true }
  )) as PlannedKpiRow[] | undefined;

  if (!kpis || kpis.length === 0) {
    // G1 fallback (audyt Faza 0, 2026-07-10): the vast majority of DONE
    // initiatives in the wild never got a formal `initiative_kpis` row with a
    // target — the KPI-based path above silently produced zero benefits for
    // them, leaving the initiative's realized value untracked. Fall back to
    // the initiative's own business-case field (`expected_roi`) so closure
    // still lands *something* in the canonical registry instead of nothing.
    return handoffFromInitiativeFallback(organizationId, initiativeId, actorId, result);
  }

  result.considered = kpis.length;
  const now = new Date().toISOString();

  for (const kpi of kpis) {
    // Dedup: skip if a closure benefit already exists for this KPI.
    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM initiative_benefits
        WHERE initiative_id = ? AND source_initiative_kpi_id = ? AND source_tag = ?
        LIMIT 1`,
      [initiativeId, kpi.id, CLOSURE_HANDOFF_SOURCE],
      { fallback: true }
    );
    if (existing) {
      result.skipped += 1;
      continue;
    }

    await dbRun(
      `INSERT INTO initiative_benefits (
         id, initiative_id, organization_id, name, description,
         benefit_type, kpi_id, source_initiative_kpi_id, target_value, status, source_tag,
         created_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 'quantitative', NULL, ?, ?, 'tracking', ?, ?, ?, ?)`,
      [
        randomUUID(),
        initiativeId,
        organizationId,
        kpi.name,
        kpi.description ?? null,
        kpi.id,
        kpi.target_value ?? 0,
        CLOSURE_HANDOFF_SOURCE,
        actorId,
        now,
        now,
      ]
    );
    result.created += 1;
  }

  logger.info(
    `${LOG_PREFIX} closure handoff for initiative ${initiativeId}: ` +
      `created ${result.created}, skipped ${result.skipped} of ${result.considered} planned KPIs`
  );
  return result;
}

/**
 * G1 fallback path: an initiative closed with no `initiative_kpis` carrying a
 * target. Materialize a single business-case benefit row from the
 * initiative's own `expected_roi` (set at creation/definition time), tagged
 * with the SAME `source_tag` as a KPI-backed row so it surfaces in the M15
 * inbox identically — distinguishable only by `kpi_id IS NULL`.
 *
 * - No `expected_roi` on the initiative either → zero benefits, no error
 *   (nothing to hand off; matches the KPI path's existing contract).
 * - Idempotent: dedups on (initiative_id, source_tag, kpi_id IS NULL) since
 *   the partial unique index (migration 783) only covers kpi_id IS NOT NULL
 *   rows — the NULL-kpi_id case is guarded here at the application level.
 */
async function handoffFromInitiativeFallback(
  organizationId: string,
  initiativeId: string,
  actorId: string | null,
  result: ClosureHandoffResult
): Promise<ClosureHandoffResult> {
  const existingFallback = await dbGet<{ id: string }>(
    `SELECT id FROM initiative_benefits
      WHERE initiative_id = ? AND kpi_id IS NULL AND source_tag = ?
      LIMIT 1`,
    [initiativeId, CLOSURE_HANDOFF_SOURCE],
    { fallback: true }
  );
  if (existingFallback) {
    result.skipped += 1;
    logger.info(
      `${LOG_PREFIX} closure handoff: initiative ${initiativeId} — fallback benefit already exists, skipping`
    );
    return result;
  }

  // EXE-09 (Codex review, minimal additive fix to frozen EXE-08 code,
  // explicitly required this round): this query previously read
  // `COALESCE(title, name)` — `initiatives` has never had a `title` column
  // in this schema (confirmed: only `name`), so the query always threw
  // "column \"title\" does not exist". With `{ fallback: true }` (the
  // previous setting) that error was silently swallowed and `initiative`
  // resolved to `null`, making this whole fallback path a permanent silent
  // no-op — a real "planned KPIs or expected_roi" case would report
  // "nothing to hand off" and mark the closure DELIVERED without ever
  // actually creating a benefit row. Fixed: read the real column, and use
  // `{ fallback: false }` so any FUTURE genuine error here throws instead of
  // being swallowed — it propagates to `handoffFromClosure`'s caller
  // (`attemptDeliveryInternal` in closureDeliveryReceiptService.ts), which
  // records it as a retryable FAILED status rather than a false DELIVERED.
  const initiative = await dbGet<InitiativeFallbackRow>(
    `SELECT name, expected_roi
       FROM initiatives
      WHERE id = ? AND organization_id = ?`,
    [initiativeId, organizationId],
    { fallback: false }
  );

  const expectedRoi =
    initiative?.expected_roi !== null && initiative?.expected_roi !== undefined
      ? Number(initiative.expected_roi)
      : null;

  if (!initiative || expectedRoi === null || Number.isNaN(expectedRoi)) {
    logger.info(
      `${LOG_PREFIX} closure handoff: initiative ${initiativeId} has no planned KPIs and no ` +
        `expected_roi — nothing to hand off`
    );
    return result;
  }

  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO initiative_benefits (
       id, initiative_id, organization_id, name, description,
       benefit_type, kpi_id, target_value, status, confidence_level,
       source_tag, created_by, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, 'quantitative', NULL, ?, 'tracking', 'low', ?, ?, ?, ?)`,
    [
      randomUUID(),
      initiativeId,
      organizationId,
      `${initiative.name || 'Initiative'} — ROI docelowy (business case)`,
      'Fallback G1: brak initiative_kpis w chwili zamknięcia — wartość z pola expected_roi inicjatywy.',
      expectedRoi,
      CLOSURE_HANDOFF_SOURCE,
      actorId,
      now,
      now,
    ]
  );
  result.created += 1;
  result.fallbackUsed = true;

  logger.info(
    `${LOG_PREFIX} closure handoff for initiative ${initiativeId}: created 1 fallback benefit ` +
      `from expected_roi (no planned KPIs)`
  );
  return result;
}

/**
 * Single choke-point wrapper for EVERY code path that transitions an
 * initiative to DONE (status endpoint, `/complete`, demo/seed materialization
 * of already-closed initiatives). Fire-and-forget: a handoff failure must
 * never block the status write. Idempotent — safe to call more than once for
 * the same initiative (e.g. a repeat `/complete` call, or a demo re-seed).
 */
export function fireClosureHandoff(
  organizationId: string,
  initiativeId: string,
  actorId: string | null
): void {
  void handoffFromClosure(organizationId, initiativeId, actorId).catch((err) => {
    logger.warn(
      `${LOG_PREFIX} closure handoff failed for initiative ${initiativeId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  });
}

/**
 * Export the initiative's budget health to Results as KPI signals.
 *
 * - GREEN → no signal (nothing actionable).
 * - AMBER → 'medium' severity, RED → 'critical'.
 * - Attaches to every KPI linked to the initiative (`v8_kpi_definitions.initiative_id`).
 * - Deduplicates: skips a KPI that already has a pending `budget_health` signal,
 *   so repeated budget writes do not spam the Results queue.
 * - Initiatives without linked KPIs are skipped (the signal table requires a KPI).
 */
export async function exportBudgetHealthToResults(
  organizationId: string,
  initiativeId: string
): Promise<void> {
  const summary = await getInitiativeBudgetSummary(organizationId, initiativeId);
  if (!summary) return;
  if (summary.status === 'GREEN') return;

  const linkedKpis = (await dbAll<{ kpi_id: string; name: string }>(
    `SELECT kpi_id, name FROM v8_kpi_definitions
     WHERE organization_id = ? AND initiative_id = ?`,
    [organizationId, initiativeId],
    { fallback: true }
  )) as Array<{ kpi_id: string; name: string }> | undefined;

  if (!linkedKpis || linkedKpis.length === 0) {
    logger.debug(
      `${LOG_PREFIX} Initiative ${initiativeId} has no linked KPIs — budget_health signal skipped`
    );
    return;
  }

  const severity = summary.status === 'RED' ? 'critical' : 'medium';
  const description =
    `Budget ${summary.status} on initiative "${summary.initiativeName}": ` +
    `actual ${summary.actual.total} / planned ${summary.planned.total} ${summary.currency} ` +
    `(${summary.variance.percent}% of plan, burn rate ${summary.burnRate}%).`;

  for (const kpi of linkedKpis) {
    const existing = await dbGet<{ signal_id: string }>(
      `SELECT signal_id FROM v8_kpi_signals
       WHERE organization_id = ? AND kpi_id = ?
         AND signal_type = 'budget_health' AND next_action_status = 'pending'
       LIMIT 1`,
      [organizationId, kpi.kpi_id],
      { fallback: true }
    );
    if (existing) continue;

    await createKpiSignal({
      organizationId,
      kpiId: kpi.kpi_id,
      signalType: 'budget_health',
      severity,
      description,
      evidencePointers: [`execution:budget-summary:${initiativeId}`],
    });
  }
}

/**
 * Non-blocking wrapper for write paths (budget entry create/delete).
 */
export function fireBudgetHealthExport(organizationId: string, initiativeId: string): void {
  void exportBudgetHealthToResults(organizationId, initiativeId).catch((err) => {
    logger.warn(
      `${LOG_PREFIX} budget_health export failed for initiative ${initiativeId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  });
}
