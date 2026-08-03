/**
 * Post-Investment Review Service (FIN-007)
 *
 * Closes the round-trip: approved Finance baseline → Execution actual
 * (`roi_realized_values`, keyed via `recordExecutionRealizationForBaseline`
 * in executionRealizationService.ts) → a durable receipt confronting the
 * two, persisted in `finance_post_investment_reviews`.
 *
 * CTO DECISION, confirmed in discovery: no second actuals ledger. This
 * service never copies realized values into its own table — it references
 * the canonical `roi_realized_values` rows by id (`actual_ids`) and stores
 * only the DERIVED comparison (projected, realized sum, variance, status),
 * frozen at creation time so a later actual entry for the same
 * initiative/period cannot retroactively change what an existing review
 * reported.
 *
 * "Projected" is never guessed. Discovery found no existing, non-heuristic
 * mapping from a financial model's P&L/BS/CF line codes to "the" projected
 * revenue/cost/savings figure for a period. Inventing one here would be
 * exactly the cross-domain guessing this packet forbids. Instead, the
 * caller (a human, via the UI) names the EXACT locator — statementType +
 * lineCode + periodDate — inside the approved, frozen baseline snapshot
 * (`financial_model_versions.snapshot_data`), and this service resolves and
 * freezes that one number. It never decides on its own which line "is"
 * revenue.
 *
 * Idempotency mirrors the FIN-05-proven reservation/finalize state machine,
 * simplified because there is exactly one target row (no multi-section
 * complexity): RESERVE (insert 'in_progress') → compute → FINALIZE (update
 * to 'completed', only if still 'in_progress'). A crash between RESERVE and
 * FINALIZE never leaves a false 'completed' row (contract requirement 11) —
 * a retry with the same key reclaims the SAME row instead of minting a
 * second one.
 */
import crypto from 'crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { reconcile } from './realizedValueReconciliationService.js';

const LOG_PREFIX = '[FIN-007:PostInvestmentReview]';

/** How long an 'in_progress' review reservation is treated as live before a
 * later request for the same (org, key) may reclaim it — mirrors FIN-05's
 * STALE_IN_PROGRESS_SECONDS for the identical reason: recover a reservation
 * abandoned by a crashed process, without blocking a genuinely in-flight one. */
export const STALE_REVIEW_IN_PROGRESS_SECONDS = 60;

export class BaselineNotApprovedForReviewError extends Error {}
export class BaselineVersionConflictForReviewError extends Error {
  constructor(
    message: string,
    public readonly serverVersion: number
  ) {
    super(message);
  }
}
export class BaselineLineNotFoundError extends Error {}
export class ActualNotFoundError extends Error {}
export class ActualPeriodMismatchError extends Error {}
export class ReviewKeyConflictError extends Error {}
export class ReviewInProgressError extends Error {}
export class ReviewFinalizeFailedError extends Error {}

export interface CreatePostInvestmentReviewParams {
  organizationId: string;
  initiativeId: string;
  actualIds: string[];
  baselineModelId: string;
  baselineExpectedVersion: number;
  baselineStatementType: 'P&L' | 'BS' | 'CF';
  baselineLineCode: string;
  baselinePeriodDate: string;
  tolerancePct?: number;
  createdBy: string;
  operationKey: string;
}

export interface PostInvestmentReview {
  id: string;
  organizationId: string;
  initiativeId: string;
  baselineModelId: string;
  baselineVersion: number;
  baselineStatementType: string;
  baselineLineCode: string;
  baselinePeriodDate: string;
  projectedValue: number;
  actualIds: string[];
  actualPeriodMonth: string;
  realizedValue: number;
  variance: number;
  variancePct: number;
  reconciliationStatus: 'matched' | 'variance';
  evidence: Record<string, unknown> | null;
  status: 'in_progress' | 'completed' | 'failed';
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
}

interface ReviewRow {
  id: string;
  organization_id: string;
  initiative_id: string;
  baseline_model_id: string;
  baseline_version: number;
  baseline_statement_type: string;
  baseline_line_code: string;
  baseline_period_date: string;
  projected_value: number;
  actual_ids: unknown;
  actual_period_month: string;
  realized_value: number;
  variance: number;
  variance_pct: number;
  reconciliation_status: string;
  evidence_json: unknown;
  status: 'in_progress' | 'completed' | 'failed';
  idempotency_key: string | null;
  request_hash: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
}

/** node-pg parses a DATE column into a JS Date at LOCAL midnight, not a
 * string — `String(dateObj)` produces "Tue Dec 01 2026 ...", not an ISO
 * date. Every DATE column read in this service must go through this, never
 * a bare `String(...)`. MUST use LOCAL getters, not UTC ones: the Date is
 * already local midnight, so `.getUTCDate()`/`.toISOString()` re-interpret
 * that instant in UTC and roll the calendar day back by one for any
 * server timezone east of UTC (e.g. Europe/Warsaw) — the exact trap this
 * repo has hit before with DATE columns. */
function toIsoDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToReview(row: ReviewRow): PostInvestmentReview {
  return {
    id: row.id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    baselineModelId: row.baseline_model_id,
    baselineVersion: row.baseline_version,
    baselineStatementType: row.baseline_statement_type,
    baselineLineCode: row.baseline_line_code,
    baselinePeriodDate: toIsoDate(row.baseline_period_date),
    projectedValue: row.projected_value,
    actualIds: parseJsonColumn<string[]>(row.actual_ids, []),
    actualPeriodMonth: toIsoDate(row.actual_period_month),
    realizedValue: row.realized_value,
    variance: row.variance,
    variancePct: row.variance_pct,
    reconciliationStatus: row.reconciliation_status as 'matched' | 'variance',
    evidence: parseJsonColumn<Record<string, unknown> | null>(row.evidence_json, null),
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function hashReviewPayload(
  params: Pick<
    CreatePostInvestmentReviewParams,
    | 'initiativeId'
    | 'actualIds'
    | 'baselineModelId'
    | 'baselineExpectedVersion'
    | 'baselineStatementType'
    | 'baselineLineCode'
    | 'baselinePeriodDate'
  >
): string {
  const canonical = JSON.stringify([
    params.initiativeId,
    [...params.actualIds].sort(),
    params.baselineModelId,
    params.baselineExpectedVersion,
    params.baselineStatementType,
    params.baselineLineCode,
    params.baselinePeriodDate,
  ]);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

async function withReviewIdempotencyLock<T>(
  organizationId: string,
  operationKey: string,
  work: () => Promise<T>
): Promise<T> {
  const { getPoolClientForPinnedTransaction } = await import('../database/PostgresDatabase.js');
  const client = await getPoolClientForPinnedTransaction();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
      `${organizationId}:post_investment_review`,
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
 * Resolve ONE explicit line from the FROZEN approved-baseline snapshot.
 * Never guesses which line "is" revenue/cost — the caller names it exactly.
 * Throws on: model not found/foreign-org, not approved, version mismatch
 * (TOCTOU), missing version snapshot, period not present, or line not
 * present in that period's statement — every failure mode is fail-closed,
 * never a fabricated 0.
 */
async function resolveApprovedBaselineLine(params: {
  organizationId: string;
  baselineModelId: string;
  baselineExpectedVersion: number;
  statementType: 'P&L' | 'BS' | 'CF';
  lineCode: string;
  periodDate: string;
}): Promise<number> {
  const model = await dbGet<{ id: string; status: string; version: number }>(
    `SELECT id, status, version FROM financial_models WHERE id = ? AND organization_id = ?`,
    [params.baselineModelId, params.organizationId],
    { fallback: false }
  );
  if (!model) {
    throw new BaselineNotApprovedForReviewError(
      `Baseline ${params.baselineModelId} not found in this organization`
    );
  }
  if (String(model.status).toLowerCase() !== 'approved') {
    throw new BaselineNotApprovedForReviewError(
      `Baseline ${params.baselineModelId} is not approved (status: ${model.status})`
    );
  }
  const serverVersion = Number(model.version || 1);
  if (serverVersion !== Number(params.baselineExpectedVersion)) {
    throw new BaselineVersionConflictForReviewError(
      `Baseline ${params.baselineModelId} version changed since preview (expected ${params.baselineExpectedVersion}, now ${serverVersion})`,
      serverVersion
    );
  }

  const versionRow = await dbGet<{ snapshot_data: string }>(
    `SELECT snapshot_data FROM financial_model_versions WHERE model_id = ? AND version = ?`,
    [params.baselineModelId, serverVersion],
    { fallback: false }
  );
  if (!versionRow?.snapshot_data) {
    throw new BaselineLineNotFoundError(
      `No immutable snapshot found for baseline ${params.baselineModelId}@v${serverVersion}`
    );
  }

  let snapshot: {
    periods?: Array<{
      date: string;
      pl: Record<string, number>;
      bs: Record<string, number>;
      cf: Record<string, number>;
    }>;
  };
  try {
    snapshot = JSON.parse(versionRow.snapshot_data);
  } catch {
    throw new BaselineLineNotFoundError(
      `Baseline ${params.baselineModelId}@v${serverVersion} snapshot is not valid JSON`
    );
  }

  const targetDate = params.periodDate.slice(0, 10);
  const period = (snapshot.periods || []).find((p) => String(p.date).slice(0, 10) === targetDate);
  if (!period) {
    throw new BaselineLineNotFoundError(
      `Baseline ${params.baselineModelId}@v${serverVersion} has no period ${targetDate}`
    );
  }

  const statementMap: Record<'P&L' | 'BS' | 'CF', Record<string, number> | undefined> = {
    'P&L': period.pl,
    BS: period.bs,
    CF: period.cf,
  };
  const lines = statementMap[params.statementType];
  const value = lines ? lines[params.lineCode] : undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BaselineLineNotFoundError(
      `Baseline ${params.baselineModelId}@v${serverVersion} period ${targetDate} has no ${params.statementType} line "${params.lineCode}"`
    );
  }
  return value;
}

/**
 * Create (or idempotently replay/recover) a post-investment review.
 *
 * Every `actualIds` row must belong to `organizationId` + `initiativeId` and
 * share the SAME `period_month` — reconciling actuals from different periods
 * against one baseline period would silently misattribute them, so this
 * throws `ActualPeriodMismatchError` instead.
 */
export async function createPostInvestmentReview(
  params: CreatePostInvestmentReviewParams
): Promise<PostInvestmentReview> {
  const requestHash = hashReviewPayload(params);

  return withReviewIdempotencyLock(params.organizationId, params.operationKey, async () => {
    const existing = await dbGet<ReviewRow>(
      `SELECT * FROM finance_post_investment_reviews WHERE organization_id = ? AND idempotency_key = ?`,
      [params.organizationId, params.operationKey],
      { fallback: false }
    );

    if (existing) {
      if (existing.request_hash && existing.request_hash !== requestHash) {
        throw new ReviewKeyConflictError(
          `Idempotency-Key ${params.operationKey} was already used with different review parameters`
        );
      }
      if (existing.status === 'completed') {
        return rowToReview(existing);
      }
      if (existing.status === 'in_progress') {
        const staleCutoff = await dbGet<{ id: string }>(
          `SELECT id FROM finance_post_investment_reviews
            WHERE id = ? AND created_at < CURRENT_TIMESTAMP - INTERVAL '${STALE_REVIEW_IN_PROGRESS_SECONDS} seconds'`,
          [existing.id],
          { fallback: false }
        );
        if (!staleCutoff) {
          throw new ReviewInProgressError(
            `A review for this Idempotency-Key is already in progress — retry shortly`
          );
        }
        // Stale — fall through and reclaim the same row below.
      }
      // 'failed', or a stale 'in_progress' — reclaim by recomputing into the
      // SAME row id (never a second row for this key).
      return await computeAndFinalizeReview(existing.id, params, requestHash, /*isReclaim*/ true);
    }

    const id = `fpir-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await dbRun(
      `INSERT INTO finance_post_investment_reviews (
         id, organization_id, initiative_id,
         baseline_model_id, baseline_version, baseline_statement_type, baseline_line_code, baseline_period_date,
         projected_value, actual_ids, actual_period_month, realized_value, variance, variance_pct, reconciliation_status,
         evidence_json, status, idempotency_key, request_hash, created_by, created_at
       ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?, 0, 0, 0, 'variance', NULL, 'in_progress', ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        id,
        params.organizationId,
        params.initiativeId,
        params.baselineModelId,
        params.baselineStatementType,
        params.baselineLineCode,
        params.baselinePeriodDate,
        JSON.stringify([...params.actualIds].sort()),
        // Placeholder period_month — overwritten by the finalize UPDATE once
        // the actual rows' real shared period is verified below. Using the
        // baseline's own period date keeps the placeholder a valid DATE.
        params.baselinePeriodDate,
        params.operationKey,
        requestHash,
        params.createdBy,
      ],
      { fallback: false }
    );

    return await computeAndFinalizeReview(id, params, requestHash, /*isReclaim*/ false);
  });
}

/**
 * The compute step, shared by the fresh-create and reclaim-a-failed-attempt
 * paths. On ANY failure (baseline rejected, actuals invalid, mismatch), marks
 * the row 'failed' (never silently 'completed', never left claiming success)
 * and re-throws — the caller (route) maps the specific error to the right
 * HTTP status.
 */
async function computeAndFinalizeReview(
  reviewId: string,
  params: CreatePostInvestmentReviewParams,
  requestHash: string,
  isReclaim: boolean
): Promise<PostInvestmentReview> {
  try {
    if (isReclaim) {
      // Reclaim: take ownership of the row for this attempt before doing any
      // work, mirroring FIN-05's reclaim UPDATE — a genuinely fresh
      // 'in_progress' row (not stale) is never touched (already rejected
      // above with ReviewInProgressError before this function is called).
      const owned = await dbGet<{ id: string }>(
        `UPDATE finance_post_investment_reviews
            SET status = 'in_progress', request_hash = ?, created_by = ?, created_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND (status = 'failed'
                 OR (status = 'in_progress'
                     AND created_at < CURRENT_TIMESTAMP - INTERVAL '${STALE_REVIEW_IN_PROGRESS_SECONDS} seconds'))
          RETURNING id`,
        [requestHash, params.createdBy, reviewId],
        { fallback: false }
      );
      if (!owned) {
        throw new ReviewInProgressError(
          `A review for this Idempotency-Key is already in progress — retry shortly`
        );
      }
    }

    if (params.actualIds.length === 0) {
      throw new ActualNotFoundError('At least one actualId is required');
    }

    const idPlaceholders = params.actualIds.map(() => '?').join(', ');
    const actualRows = await dbAll<{
      id: string;
      initiative_id: string;
      organization_id: string;
      period_month: string;
      realized_revenue_delta: number | null;
      realized_cost_delta: number | null;
      realized_savings: number | null;
    }>(
      `SELECT id, initiative_id, organization_id, period_month, realized_revenue_delta, realized_cost_delta, realized_savings
         FROM roi_realized_values
        WHERE id IN (${idPlaceholders}) AND organization_id = ? AND initiative_id = ?`,
      [...params.actualIds, params.organizationId, params.initiativeId],
      { fallback: false }
    );
    const found = actualRows || [];
    if (found.length !== params.actualIds.length) {
      const foundIds = new Set(found.map((r) => r.id));
      const missing = params.actualIds.filter((id) => !foundIds.has(id));
      throw new ActualNotFoundError(
        `Actual(s) not found in this organization/initiative: ${missing.join(', ')}`
      );
    }
    const periods = new Set(found.map((r) => toIsoDate(r.period_month)));
    if (periods.size !== 1) {
      throw new ActualPeriodMismatchError(
        `All actualIds must share the same period_month; found: ${[...periods].join(', ')}`
      );
    }
    const actualPeriodMonth = [...periods][0];

    const realizedValue = found.reduce(
      (sum, r) =>
        sum +
        (r.realized_revenue_delta || 0) +
        (r.realized_cost_delta || 0) +
        (r.realized_savings || 0),
      0
    );

    const projectedValue = await resolveApprovedBaselineLine({
      organizationId: params.organizationId,
      baselineModelId: params.baselineModelId,
      baselineExpectedVersion: params.baselineExpectedVersion,
      statementType: params.baselineStatementType,
      lineCode: params.baselineLineCode,
      periodDate: params.baselinePeriodDate,
    });

    const tolerancePct = params.tolerancePct ?? 5;
    const comparison = reconcile(projectedValue, realizedValue, tolerancePct);
    const reconciliationStatus: 'matched' | 'variance' =
      comparison.status === 'matched' ? 'matched' : 'variance';

    const evidence = {
      actualIds: params.actualIds,
      baselineModelId: params.baselineModelId,
      baselineVersion: params.baselineExpectedVersion,
      baselineStatementType: params.baselineStatementType,
      baselineLineCode: params.baselineLineCode,
      baselinePeriodDate: params.baselinePeriodDate,
      tolerancePct,
      resolvedAt: new Date().toISOString(),
    };

    const finalized = await dbRun(
      `UPDATE finance_post_investment_reviews
          SET baseline_version = ?, projected_value = ?, actual_period_month = ?,
              realized_value = ?, variance = ?, variance_pct = ?, reconciliation_status = ?,
              evidence_json = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'in_progress'`,
      [
        params.baselineExpectedVersion,
        projectedValue,
        actualPeriodMonth,
        realizedValue,
        comparison.variance,
        comparison.variancePct,
        reconciliationStatus,
        JSON.stringify(evidence),
        reviewId,
      ],
      { fallback: false }
    );
    if (!finalized?.success || Number(finalized?.changes || 0) !== 1) {
      throw new ReviewFinalizeFailedError(
        `Finalize UPDATE for review ${reviewId} did not affect exactly one row`
      );
    }

    const row = await dbGet<ReviewRow>(
      `SELECT * FROM finance_post_investment_reviews WHERE id = ?`,
      [reviewId],
      { fallback: false }
    );
    if (!row) {
      throw new ReviewFinalizeFailedError(`Review ${reviewId} vanished after finalize`);
    }
    logger.info(`${LOG_PREFIX} Finalized review ${reviewId} (${reconciliationStatus})`);
    return rowToReview(row);
  } catch (error) {
    // Never leave a false 'completed' — mark 'failed' so a retry can
    // honestly reclaim this SAME row instead of a permanently stuck
    // 'in_progress' one, and re-throw so the route reports the real cause.
    try {
      await dbRun(
        `UPDATE finance_post_investment_reviews SET status = 'failed' WHERE id = ? AND status = 'in_progress'`,
        [reviewId],
        { fallback: false }
      );
    } catch (markError) {
      logger.warn(
        `${LOG_PREFIX} Failed to mark review ${reviewId} as failed after an error: ${markError}`
      );
    }
    throw error;
  }
}

/** Fresh, org-scoped read-back. Never returns a review belonging to another org. */
export async function getPostInvestmentReview(
  id: string,
  organizationId: string
): Promise<PostInvestmentReview | null> {
  const row = await dbGet<ReviewRow>(
    `SELECT * FROM finance_post_investment_reviews WHERE id = ? AND organization_id = ?`,
    [id, organizationId],
    { fallback: false }
  );
  return row ? rowToReview(row) : null;
}

/** List reviews for an initiative, newest first — org-scoped. */
export async function listPostInvestmentReviews(
  organizationId: string,
  initiativeId: string
): Promise<PostInvestmentReview[]> {
  const rows = await dbAll<ReviewRow>(
    `SELECT * FROM finance_post_investment_reviews
      WHERE organization_id = ? AND initiative_id = ? AND status = 'completed'
      ORDER BY created_at DESC`,
    [organizationId, initiativeId],
    { fallback: false }
  );
  return (rows || []).map(rowToReview);
}
