/**
 * Realized-Value Reconciliation Service (M16/2.5 — Seam D)
 *
 * Confronts the *declared* realized value of an initiative
 * (`roi_realized_values`) with the *actual* line of an imported P&L
 * (`financial_statement_lines` → `financial_statement_values`),
 * connected through `kpi_financial_mappings`.
 *
 * Without this reconciliation a declared benefit can drift arbitrarily
 * from what the accounting statements actually show — Seam D. This
 * service flags those gaps so they can be explained (a "case").
 *
 * The core comparison functions are PURE (no I/O), so they are trivially
 * testable. An optional org-scoped DB loader assembles reconciliation
 * rows from the three tables and feeds them into the pure aggregator.
 */

import { all as dbAll } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ─── types ──────────────────────────────────────────────────────────────────

export type ReconcileStatus = 'matched' | 'variance' | 'unmapped';

export interface ReconcileResult {
  status: ReconcileStatus;
  /** Signed variance: statementValue - declared. 0 when unmapped. */
  variance: number;
  /** |variance| / |declared| as a percentage. 0 when unmapped or declared===0. */
  variancePct: number;
  /** Present only when status === 'variance'; a short label for the gap to explain. */
  case?: string;
}

export interface ReconcileRow {
  kpiId: string;
  initiativeId: string;
  declaredValue: number;
  /** Code of the statement line the KPI maps to; absent → unmapped. */
  mappedStatementLineCode?: string | null;
  /** Value read from the imported statement line; absent → unmapped. */
  statementValue?: number | null;
}

export interface ReconcileItem extends ReconcileResult {
  kpiId: string;
  initiativeId: string;
  declaredValue: number;
  mappedStatementLineCode?: string | null;
  statementValue?: number | null;
}

export interface PortfolioReconciliation {
  matched: number;
  variances: number;
  unmapped: number;
  items: ReconcileItem[];
}

// ─── pure core ────────────────────────────────────────────────────────────────

/**
 * Reconcile a single declared realized value against a statement line value.
 *
 * @param declared        declared realized value (from roi_realized_values)
 * @param statementValue  value read from the mapped P&L line; null/undefined → unmapped
 * @param tolerancePct    allowed |Δ|/declared before it counts as a variance (default 5%)
 */
export function reconcile(
  declared: number,
  statementValue: number | null | undefined,
  tolerancePct = 5
): ReconcileResult {
  // No statement line value available → cannot confront → unmapped.
  if (statementValue === null || statementValue === undefined || !Number.isFinite(statementValue)) {
    return { status: 'unmapped', variance: 0, variancePct: 0 };
  }

  const declaredNum = Number.isFinite(declared) ? declared : 0;
  const variance = statementValue - declaredNum;

  // When nothing was declared, any non-zero statement value is itself a variance.
  if (declaredNum === 0) {
    if (variance === 0) {
      return { status: 'matched', variance: 0, variancePct: 0 };
    }
    return {
      status: 'variance',
      variance,
      variancePct: Infinity,
      case: 'declared-zero-statement-nonzero',
    };
  }

  const variancePct = (Math.abs(variance) / Math.abs(declaredNum)) * 100;
  const tol = Number.isFinite(tolerancePct) ? Math.abs(tolerancePct) : 5;

  if (variancePct > tol) {
    return {
      status: 'variance',
      variance,
      variancePct,
      case: variance > 0 ? 'statement-exceeds-declared' : 'declared-exceeds-statement',
    };
  }

  return { status: 'matched', variance, variancePct };
}

/**
 * Aggregate reconciliation across a portfolio of KPI/initiative rows.
 * Counts matched / variance / unmapped and returns per-row detail.
 */
export function reconcilePortfolio(
  rows: ReconcileRow[],
  tolerancePct = 5
): PortfolioReconciliation {
  const items: ReconcileItem[] = [];
  let matched = 0;
  let variances = 0;
  let unmapped = 0;

  for (const row of rows ?? []) {
    const hasMapping =
      row.mappedStatementLineCode !== null &&
      row.mappedStatementLineCode !== undefined &&
      row.mappedStatementLineCode !== '';

    const statementValue = hasMapping ? row.statementValue : undefined;
    const result = reconcile(row.declaredValue, statementValue, tolerancePct);

    if (result.status === 'matched') matched += 1;
    else if (result.status === 'variance') variances += 1;
    else unmapped += 1;

    items.push({
      kpiId: row.kpiId,
      initiativeId: row.initiativeId,
      declaredValue: row.declaredValue,
      mappedStatementLineCode: row.mappedStatementLineCode ?? null,
      statementValue: row.statementValue ?? null,
      ...result,
    });
  }

  return { matched, variances, unmapped, items };
}

// ─── optional org-scoped DB loader ───────────────────────────────────────────

/**
 * Load reconciliation rows for an organization by joining the three seams:
 *   roi_realized_values (declared) → kpi_financial_mappings (the link)
 *   → financial_statement_lines (the mapped line code)
 *   → financial_statement_values (the imported actual value).
 *
 * `realized_savings` is treated as the declared realized value (falling back
 * to revenue_delta - cost_delta when savings is absent). The statement value
 * is the latest imported value for the mapped line within the org.
 *
 * This is a best-effort assembler: schema drift or missing tables degrade to
 * an empty list rather than throwing, so the pure functions remain the SoT.
 */
export async function loadReconciliationRows(organizationId: string): Promise<ReconcileRow[]> {
  try {
    const rows = await dbAll(
      `SELECT
         kfm.kpi_id           AS "kpiId",
         rrv.initiative_id    AS "initiativeId",
         COALESCE(
           NULLIF(rrv.realized_savings, 0),
           COALESCE(rrv.realized_revenue_delta, 0) - COALESCE(rrv.realized_cost_delta, 0)
         )                    AS "declaredValue",
         fsl.line_code        AS "mappedStatementLineCode",
         fsv.value            AS "statementValue"
       FROM roi_realized_values rrv
       JOIN kpi_financial_mappings kfm
         ON kfm.organization_id = rrv.organization_id
       LEFT JOIN financial_statement_lines fsl
         ON fsl.id = kfm.statement_line_id
       LEFT JOIN financial_statement_values fsv
         ON fsv.canonical_line_id = fsl.id
       WHERE rrv.organization_id = ?
       ORDER BY rrv.initiative_id, kfm.kpi_id`,
      [organizationId]
    );

    return (rows ?? []).map((r: any) => ({
      kpiId: String(r.kpiId),
      initiativeId: String(r.initiativeId),
      declaredValue: Number(r.declaredValue ?? 0),
      mappedStatementLineCode: r.mappedStatementLineCode ?? null,
      statementValue:
        r.statementValue === null || r.statementValue === undefined
          ? null
          : Number(r.statementValue),
    }));
  } catch (err) {
    logger.warn(
      `[realizedValueReconciliation] loadReconciliationRows failed for org ${organizationId}: ${
        (err as Error)?.message ?? err
      }`
    );
    return [];
  }
}

/**
 * Convenience: load org rows and reconcile them in one call.
 */
export async function reconcileOrganization(
  organizationId: string,
  tolerancePct = 5
): Promise<PortfolioReconciliation> {
  const rows = await loadReconciliationRows(organizationId);
  return reconcilePortfolio(rows, tolerancePct);
}
