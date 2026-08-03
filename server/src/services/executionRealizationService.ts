/**
 * Execution Realization Service (M14 → M15 feed-forward)
 *
 * Records a HUMAN-ENTERED realized benefit value for an initiative from the
 * Execution (M14) context, writing to `roi_realized_values` — the same table
 * that Results (M15) reads via `getROIPortfolioSummary` / `getROIInitiativeDetail`.
 *
 * Design (CTO-decided): realization is never auto-fabricated from task %. A user
 * records "initiative X realized value V for period P" and that entry flows into
 * the Results ROI portfolio rollup. Provenance is stamped as `source='execution'`
 * and `recorded_by` = the authenticated caller so M15 can attribute the entry.
 *
 * Org-scoping and initiative ownership are verified by the calling route before
 * this service writes; the INSERT additionally carries the resolved organization_id.
 */
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const LOG_PREFIX = '[Execution:Realization]';

export interface RecordExecutionRealizationParams {
  organizationId: string;
  initiativeId: string;
  /** First day of the realization period, ISO date (YYYY-MM-DD). */
  periodMonth: string;
  /** At least one of the three deltas must be a finite number (route-enforced). */
  realizedRevenueDelta?: number | null;
  realizedCostDelta?: number | null;
  realizedSavings?: number | null;
  varianceNotes?: string | null;
  /** Authenticated caller id — never client-supplied. */
  recordedBy: string;
  /**
   * EXE-09 (minimal additive param, migration 937) — when a closure-triggered
   * automated write (as opposed to the normal human-entered write this
   * service exists for) provides this, it becomes the idempotency key: a
   * partial unique index on `roi_realized_values.closure_receipt_id`
   * guarantees at most one realization row per closure receipt, even under
   * a retried/concurrent delivery attempt. `undefined`/omitted for every
   * existing (human-entry) caller — completely inert for them.
   */
  closureReceiptId?: string;
}

export interface ExecutionRealizationResult {
  id: string;
  initiativeId: string;
  organizationId: string;
  periodMonth: string;
  realizedRevenueDelta: number | null;
  realizedCostDelta: number | null;
  realizedSavings: number | null;
  source: 'execution';
  varianceNotes: string | null;
  recordedBy: string;
}

/**
 * Persist a realized-value entry into `roi_realized_values` with execution provenance.
 *
 * The caller (route) is responsible for verifying that `initiativeId` belongs to
 * `organizationId` (404 on foreign-org) and for role-gating the write. This service
 * does the persistence only and always stamps `source='execution'`.
 */
export async function recordExecutionRealization(
  params: RecordExecutionRealizationParams
): Promise<ExecutionRealizationResult> {
  const id = uuidv4().replace(/-/g, '');

  const realizedRevenueDelta =
    typeof params.realizedRevenueDelta === 'number' ? params.realizedRevenueDelta : null;
  const realizedCostDelta =
    typeof params.realizedCostDelta === 'number' ? params.realizedCostDelta : null;
  const realizedSavings =
    typeof params.realizedSavings === 'number' ? params.realizedSavings : null;
  const varianceNotes = params.varianceNotes ?? null;

  await dbRun(
    `INSERT INTO roi_realized_values (
       id, initiative_id, organization_id, period_month,
       realized_revenue_delta, realized_cost_delta, realized_savings,
       source, variance_notes, recorded_by, closure_receipt_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.initiativeId,
      params.organizationId,
      params.periodMonth,
      realizedRevenueDelta,
      realizedCostDelta,
      realizedSavings,
      'execution',
      varianceNotes,
      params.recordedBy,
      params.closureReceiptId ?? null,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Recorded realization ${id} for initiative ${params.initiativeId} (org ${params.organizationId}, period ${params.periodMonth})`
  );

  return {
    id,
    initiativeId: params.initiativeId,
    organizationId: params.organizationId,
    periodMonth: params.periodMonth,
    realizedRevenueDelta,
    realizedCostDelta,
    realizedSavings,
    source: 'execution',
    varianceNotes,
    recordedBy: params.recordedBy,
  };
}

// ════════════════════════════════════════════════
// FIN-007: keyed, baseline-bound realization write
//
// A SECOND entrypoint into the SAME canonical table (never a second ledger —
// see the FIN-007 discovery report). Adds three things the pre-existing
// human-entry path above deliberately does not need:
//   1. Idempotency-Key + payload-hash — retry-safe, 409 on same-key-different-
//      payload, exactly-once under concurrency.
//   2. A stamped, immutable baseline pointer (financial_models.id + the
//      approved version at write time) — required so a later post-investment
//      review reconciles against the SAME baseline the actual was recorded
//      against, not "whatever happens to be approved now".
//   3. A fail-closed TOCTOU guard: the caller supplies the version it saw
//      when it prepared this write; if the model's real version has since
//      moved (re-approval, edit-then-reapprove), the write is rejected
//      rather than silently binding to a baseline the caller never saw.
// ════════════════════════════════════════════════

export class BaselineNotApprovedError extends Error {}
export class BaselineVersionConflictError extends Error {
  constructor(
    message: string,
    public readonly serverVersion: number
  ) {
    super(message);
  }
}
export class RealizationKeyConflictError extends Error {}

export interface RecordExecutionRealizationForBaselineParams {
  organizationId: string;
  initiativeId: string;
  periodMonth: string;
  realizedRevenueDelta?: number | null;
  realizedCostDelta?: number | null;
  realizedSavings?: number | null;
  varianceNotes?: string | null;
  recordedBy: string;
  /** financial_models.id — must be approved and org-scoped to organizationId. */
  baselineModelId: string;
  /** The version the caller observed when it prepared this write (TOCTOU guard). */
  baselineExpectedVersion: number;
  /** Free-form pointer to the Execution/Results evidence behind this number. */
  evidenceRef?: string | null;
  /** Client-supplied Idempotency-Key. Required — this entrypoint has no
   * unkeyed mode, unlike the human-entry path above. */
  operationKey: string;
}

interface RoiRealizedRow {
  id: string;
  initiative_id: string;
  organization_id: string;
  period_month: string;
  realized_revenue_delta: number | null;
  realized_cost_delta: number | null;
  realized_savings: number | null;
  source: string;
  variance_notes: string | null;
  recorded_by: string | null;
  baseline_model_id: string | null;
  baseline_version: number | null;
  evidence_ref: string | null;
  request_hash: string | null;
}

/** node-pg parses a DATE column into a JS Date at LOCAL midnight, not a
 * string — `String(dateObj)` produces "Tue Dec 01 2026 ...", not an ISO
 * date. MUST use LOCAL getters, not UTC ones: the Date is already local
 * midnight, so UTC getters/`.toISOString()` re-interpret that instant in UTC
 * and roll the calendar day back by one for any server timezone east of UTC
 * — the exact DATE-column trap this repo has hit before. */
function toIsoDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function toExecutionRealizationResult(row: RoiRealizedRow): ExecutionRealizationResult & {
  baselineModelId: string | null;
  baselineVersion: number | null;
  evidenceRef: string | null;
} {
  return {
    id: row.id,
    initiativeId: row.initiative_id,
    organizationId: row.organization_id,
    periodMonth: toIsoDate(row.period_month),
    realizedRevenueDelta: row.realized_revenue_delta,
    realizedCostDelta: row.realized_cost_delta,
    realizedSavings: row.realized_savings,
    source: 'execution',
    varianceNotes: row.variance_notes,
    recordedBy: row.recorded_by || '',
    baselineModelId: row.baseline_model_id,
    baselineVersion: row.baseline_version,
    evidenceRef: row.evidence_ref,
  };
}

/** Deterministic hash of the fields that make two requests "the same write",
 * so a same-key-different-payload retry is rejected (409) rather than
 * silently replaying the wrong content. */
export function hashRealizationPayload(
  params: Pick<
    RecordExecutionRealizationForBaselineParams,
    | 'initiativeId'
    | 'periodMonth'
    | 'realizedRevenueDelta'
    | 'realizedCostDelta'
    | 'realizedSavings'
    | 'baselineModelId'
    | 'baselineExpectedVersion'
  >
): string {
  const canonical = JSON.stringify([
    params.initiativeId,
    params.periodMonth,
    params.realizedRevenueDelta ?? null,
    params.realizedCostDelta ?? null,
    params.realizedSavings ?? null,
    params.baselineModelId,
    params.baselineExpectedVersion,
  ]);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Serialize concurrent attempts for the SAME (organizationId, operationKey)
 * on a pinned PostgreSQL session — identical technique to FIN-05's
 * `withStatementUploadIdempotencyLock` and FIN-03's
 * `withFinancialModelIdempotencyLock`. A dedicated lock namespace
 * (`:realization`) so this never contends with either of those.
 */
async function withRealizationIdempotencyLock<T>(
  organizationId: string,
  operationKey: string,
  work: () => Promise<T>
): Promise<T> {
  const { getPoolClientForPinnedTransaction } = await import('../database/PostgresDatabase.js');
  const client = await getPoolClientForPinnedTransaction();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
      `${organizationId}:realization`,
      operationKey,
    ]);
    const result = await work();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original failure.
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Record a keyed, baseline-bound realized-value entry.
 *
 * Fail-closed contract (FIN-007):
 *  - `baselineModelId` must resolve to an APPROVED model in `organizationId`
 *    — a DRAFT/REVIEW/ARCHIVED model throws `BaselineNotApprovedError`.
 *  - The model's CURRENT version must equal `baselineExpectedVersion` — a
 *    mismatch (the baseline moved between preview and confirm) throws
 *    `BaselineVersionConflictError` with the real server version, never
 *    silently binds to the new one.
 *  - Retry with the SAME (organizationId, operationKey) and the SAME payload
 *    returns the ORIGINAL row — no duplicate. A DIFFERENT payload under the
 *    same key throws `RealizationKeyConflictError` (409).
 *  - Five concurrent callers with the same key create exactly one row — the
 *    advisory lock above serializes the check-then-insert.
 */
export async function recordExecutionRealizationForBaseline(
  params: RecordExecutionRealizationForBaselineParams
): Promise<ReturnType<typeof toExecutionRealizationResult>> {
  const requestHash = hashRealizationPayload(params);

  return withRealizationIdempotencyLock(params.organizationId, params.operationKey, async () => {
    // Replay/conflict check FIRST — a genuine retry must never re-validate
    // the baseline against a version the original attempt already accepted
    // (the baseline could legitimately move on AFTER a completed write; that
    // must not turn a pure replay into a false VERSION_CONFLICT).
    const existing = await dbGet<RoiRealizedRow>(
      `SELECT * FROM roi_realized_values WHERE organization_id = ? AND operation_key = ?`,
      [params.organizationId, params.operationKey],
      { fallback: false }
    );
    if (existing) {
      if (existing.request_hash && existing.request_hash !== requestHash) {
        throw new RealizationKeyConflictError(
          `Idempotency-Key ${params.operationKey} was already used with a different payload`
        );
      }
      return toExecutionRealizationResult(existing);
    }

    // Fresh baseline check, as close to the write as the lock allows — the
    // TOCTOU window this closes is "the model was re-approved between the
    // client's preview read and this confirm", not concurrent writers on
    // this same key (already serialized above).
    const model = await dbGet<{ id: string; status: string; version: number }>(
      `SELECT id, status, version FROM financial_models WHERE id = ? AND organization_id = ?`,
      [params.baselineModelId, params.organizationId],
      { fallback: false }
    );
    if (!model) {
      throw new BaselineNotApprovedError(
        `Baseline ${params.baselineModelId} not found in this organization`
      );
    }
    if (String(model.status).toLowerCase() !== 'approved') {
      throw new BaselineNotApprovedError(
        `Baseline ${params.baselineModelId} is not approved (status: ${model.status})`
      );
    }
    const serverVersion = Number(model.version || 1);
    if (serverVersion !== Number(params.baselineExpectedVersion)) {
      throw new BaselineVersionConflictError(
        `Baseline ${params.baselineModelId} version changed since preview (expected ${params.baselineExpectedVersion}, now ${serverVersion})`,
        serverVersion
      );
    }

    const id = uuidv4().replace(/-/g, '');
    const realizedRevenueDelta =
      typeof params.realizedRevenueDelta === 'number' ? params.realizedRevenueDelta : null;
    const realizedCostDelta =
      typeof params.realizedCostDelta === 'number' ? params.realizedCostDelta : null;
    const realizedSavings =
      typeof params.realizedSavings === 'number' ? params.realizedSavings : null;

    await dbRun(
      `INSERT INTO roi_realized_values (
         id, initiative_id, organization_id, period_month,
         realized_revenue_delta, realized_cost_delta, realized_savings,
         source, variance_notes, recorded_by,
         operation_key, request_hash, baseline_model_id, baseline_version, evidence_ref
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.initiativeId,
        params.organizationId,
        params.periodMonth,
        realizedRevenueDelta,
        realizedCostDelta,
        realizedSavings,
        'execution',
        params.varianceNotes ?? null,
        params.recordedBy,
        params.operationKey,
        requestHash,
        params.baselineModelId,
        serverVersion,
        params.evidenceRef ?? null,
      ],
      { fallback: false }
    );

    logger.info(
      `${LOG_PREFIX} Recorded baseline-bound realization ${id} for initiative ${params.initiativeId} against baseline ${params.baselineModelId}@v${serverVersion} (org ${params.organizationId})`
    );

    const row = await dbGet<RoiRealizedRow>(
      `SELECT * FROM roi_realized_values WHERE id = ?`,
      [id],
      {
        fallback: false,
      }
    );
    if (!row) {
      throw new Error(
        `[Execution:Realization] Insert for ${id} succeeded but could not be read back`
      );
    }
    return toExecutionRealizationResult(row);
  });
}
