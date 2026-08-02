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
import { v4 as uuidv4 } from 'uuid';

import { run as dbRun } from '../utils/DbPromise.js';
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
