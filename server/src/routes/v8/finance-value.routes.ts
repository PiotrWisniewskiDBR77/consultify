/**
 * V8 Finance — Value Tracking cluster (M16 "ŚLEDZENIE WARTOŚCI" wiring).
 *
 * Wires 7 previously-orphaned M16 services (0 importers before this file) into
 * org-scoped REST endpoints:
 *   - valueLedgerService.ts               — frozen KPI baselines + append-only
 *                                            correction ledger (DB, org-scoped)
 *   - valueAttributionRollupService.ts    — anti-double-count portfolio value
 *                                            rollup (pure)
 *   - valueCapturePipelineService.ts      — G0..G5 value-capture stage-gates
 *                                            (DB, org-scoped)
 *   - realizedValueReconciliationService.ts — declared-vs-statement reconciliation
 *                                            (pure + optional DB loader)
 *   - kpiLineageService.ts                — leading/lagging KPI early-warning
 *                                            divergence (pure)
 *   - bankingValueService.ts              — "banking the value" into next-period
 *                                            budget lines (pure)
 *   - extendedRatiosService.ts            — ROE/ROA/ROIC/DSCR/DuPont/benchmark
 *                                            ratios (pure)
 *
 * NOTE: intentionally NOT mounted in Gateway/v8/index.ts here — wiring the
 * mount point is a separate step so this file can be reviewed/tested in
 * isolation first.
 *
 * MOUNT: v8Router.use('/finance/value-tracking', financeValueTrackingRoutes);
 *        (NOT '/finance-value' — that prefix is already taken by
 *        financeValueRoutes.ts, mounted at both '/finance/value' and
 *        '/finance-value' in server/src/routes/v8/index.ts.)
 *
 * @module routes/v8/finance-value.routes
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  bankBenefit,
  bankingStatus,
  type Benefit,
  portfolioBanked,
} from '../../services/bankingValueService.js';
import {
  benchmarkStatus,
  computeExtendedRatios,
  dupontDecomposition,
  type ExtendedFinancials,
  type IndustryBenchmark,
} from '../../services/extendedRatiosService.js';
import { detectEarlyWarnings, type KpiLineagePair } from '../../services/kpiLineageService.js';
import {
  ActualNotFoundError,
  ActualPeriodMismatchError,
  BaselineLineNotFoundError,
  BaselineNotApprovedForReviewError,
  BaselineVersionConflictForReviewError,
  createPostInvestmentReview,
  getPostInvestmentReview,
  listPostInvestmentReviews,
  ReviewInProgressError,
  ReviewKeyConflictError,
} from '../../services/postInvestmentReviewService.js';
import {
  reconcile,
  reconcileOrganization,
  reconcilePortfolio,
  type ReconcileRow,
} from '../../services/realizedValueReconciliationService.js';
import {
  rollupPortfolioValue,
  valueByInitiative,
  type ValueContribution,
} from '../../services/valueAttributionRollupService.js';
import {
  advanceGate,
  createGate,
  listGates,
  pipelineFunnel,
  type ValueCaptureGate,
} from '../../services/valueCapturePipelineService.js';
import {
  appendLedgerEntry,
  currentValueFromLedger,
  freezeBaseline,
  getActiveBaseline,
  getLedger,
} from '../../services/valueLedgerService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

/** Stable contract id for the Value Tracking cluster's responses. */
export const V8_FINANCE_VALUE_TRACKING_CONTRACT = 'finance_value_tracking_v1';

function meta() {
  return { version: 'v8' as const, contract: V8_FINANCE_VALUE_TRACKING_CONTRACT };
}

function queryString(req: AuthRequest, key: string): string | undefined {
  const v = req.query?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

// ---------------------------------------------------------------------------
// 1. valueLedgerService — frozen baseline + append-only correction ledger
// ---------------------------------------------------------------------------

/**
 * POST /ledger/baselines
 * Body: { initiativeId, kpiId, value, frozenBy?, sourceSnapshot? }
 * Freezes a new active baseline (deactivating any prior active one).
 */
router.post(
  '/ledger/baselines',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const initiativeId = String(req.body?.initiativeId || '').trim();
    const kpiId = String(req.body?.kpiId || '').trim();
    if (!initiativeId || !kpiId) {
      return res
        .status(400)
        .json({ error: 'initiativeId and kpiId are required', code: 'VALUE_LEDGER_BAD_INPUT' });
    }
    try {
      const baseline = await freezeBaseline(organizationId, {
        initiativeId,
        kpiId,
        value: Number(req.body?.value) || 0,
        frozenBy: req.body?.frozenBy ?? userId,
        sourceSnapshot: req.body?.sourceSnapshot,
      });
      return res.status(201).json({ data: baseline, meta: meta() });
    } catch (err) {
      logger.error(`[V8:FinanceValue] freezeBaseline failed: ${String(err)}`);
      return res
        .status(500)
        .json({ error: 'Failed to freeze baseline', code: 'VALUE_LEDGER_BASELINE_WRITE_FAILED' });
    }
  })
);

/**
 * GET /ledger/baselines/active?initiativeId=&kpiId=
 * The single active (frozen) baseline for a KPI, or null.
 */
router.get(
  '/ledger/baselines/active',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const initiativeId = queryString(req, 'initiativeId');
    const kpiId = queryString(req, 'kpiId');
    if (!initiativeId || !kpiId) {
      return res
        .status(400)
        .json({ error: 'initiativeId and kpiId are required', code: 'VALUE_LEDGER_BAD_INPUT' });
    }
    const baseline = await getActiveBaseline(organizationId, initiativeId, kpiId);
    return res.json({ data: baseline, meta: meta() });
  })
);

/**
 * POST /ledger/entries
 * Body: { initiativeId, entryType, valueDelta, reason?, provenance?, createdBy? }
 * Appends an auditable correction entry to the ledger.
 */
router.post(
  '/ledger/entries',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const initiativeId = String(req.body?.initiativeId || '').trim();
    const entryType = String(req.body?.entryType || '').trim();
    if (!initiativeId || !entryType) {
      return res.status(400).json({
        error: 'initiativeId and entryType are required',
        code: 'VALUE_LEDGER_BAD_INPUT',
      });
    }
    try {
      const entry = await appendLedgerEntry(organizationId, {
        initiativeId,
        entryType,
        valueDelta: Number(req.body?.valueDelta) || 0,
        reason: req.body?.reason ?? null,
        provenance: req.body?.provenance,
        createdBy: req.body?.createdBy ?? userId,
      });
      return res.status(201).json({ data: entry, meta: meta() });
    } catch (err) {
      logger.error(`[V8:FinanceValue] appendLedgerEntry failed: ${String(err)}`);
      return res
        .status(500)
        .json({ error: 'Failed to append ledger entry', code: 'VALUE_LEDGER_ENTRY_WRITE_FAILED' });
    }
  })
);

/**
 * GET /ledger/entries?initiativeId=
 * All ledger entries for an initiative, oldest first.
 */
router.get(
  '/ledger/entries',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const initiativeId = queryString(req, 'initiativeId');
    if (!initiativeId) {
      return res
        .status(400)
        .json({ error: 'initiativeId is required', code: 'VALUE_LEDGER_BAD_INPUT' });
    }
    const entries = await getLedger(organizationId, initiativeId);
    return res.json({ data: entries, meta: meta() });
  })
);

/**
 * GET /ledger/current-value?initiativeId=&kpiId=
 * Composed read: active baseline + ledger entries -> current value + audit trail.
 * current = baseline.frozen_value + Σ ledger.value_delta (see currentValueFromLedger).
 */
router.get(
  '/ledger/current-value',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const initiativeId = queryString(req, 'initiativeId');
    const kpiId = queryString(req, 'kpiId');
    if (!initiativeId || !kpiId) {
      return res
        .status(400)
        .json({ error: 'initiativeId and kpiId are required', code: 'VALUE_LEDGER_BAD_INPUT' });
    }
    const [baseline, entries] = await Promise.all([
      getActiveBaseline(organizationId, initiativeId, kpiId),
      getLedger(organizationId, initiativeId),
    ]);
    const result = currentValueFromLedger(
      baseline
        ? { frozen_value: baseline.frozen_value, id: baseline.id, frozen_at: baseline.frozen_at }
        : null,
      entries.map((e) => ({
        id: e.id,
        entry_type: e.entry_type,
        value_delta: e.value_delta,
        reason: e.reason,
        provenance: e.provenance,
        created_at: e.created_at,
      }))
    );
    return res.json({ data: result, meta: meta() });
  })
);

// ---------------------------------------------------------------------------
// 2. valueAttributionRollupService — anti-double-count portfolio rollup (pure)
// ---------------------------------------------------------------------------

/**
 * POST /attribution/rollup
 * Body: { contributions: ValueContribution[] }
 */
router.post(
  '/attribution/rollup',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const contributions: ValueContribution[] = Array.isArray(req.body?.contributions)
      ? req.body.contributions
      : [];
    const result = rollupPortfolioValue(contributions);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /attribution/by-initiative
 * Body: { contributions: ValueContribution[] }
 */
router.post(
  '/attribution/by-initiative',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const contributions: ValueContribution[] = Array.isArray(req.body?.contributions)
      ? req.body.contributions
      : [];
    const result = valueByInitiative(contributions);
    return res.json({ data: result, meta: meta() });
  })
);

// ---------------------------------------------------------------------------
// 3. valueCapturePipelineService — G0..G5 stage-gates (DB, org-scoped)
// ---------------------------------------------------------------------------

/**
 * GET /capture/gates?initiativeId=
 * List value-capture gates for the org, optionally filtered to one initiative.
 */
router.get(
  '/capture/gates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const initiativeId = queryString(req, 'initiativeId');
    const gates = await listGates(organizationId, initiativeId);
    return res.json({ data: gates, meta: meta() });
  })
);

/**
 * POST /capture/gates
 * Body: { initiativeId, gate, status?, criteria?, valueEvidence? }
 */
router.post(
  '/capture/gates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const initiativeId = String(req.body?.initiativeId || '').trim();
    const gate = req.body?.gate;
    if (!initiativeId || !gate) {
      return res
        .status(400)
        .json({ error: 'initiativeId and gate are required', code: 'VALUE_CAPTURE_BAD_INPUT' });
    }
    try {
      const created = await createGate(organizationId, {
        initiativeId,
        gate,
        status: req.body?.status,
        criteria: req.body?.criteria ?? null,
        valueEvidence:
          req.body?.valueEvidence === undefined || req.body?.valueEvidence === null
            ? null
            : Number(req.body.valueEvidence),
      });
      return res.status(201).json({ data: created, meta: meta() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[V8:FinanceValue] createGate rejected: ${message}`);
      return res.status(400).json({
        error: 'Could not create value capture gate',
        code: 'VALUE_CAPTURE_GATE_CREATE_FAILED',
      });
    }
  })
);

/**
 * POST /capture/gates/:id/advance
 * Body: { signedOffBy }
 * Advances a gate to 'passed' when exit criteria are met AND sign-off is given.
 */
router.post(
  '/capture/gates/:id/advance',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id } = req.params;
    const signedOffBy = String(req.body?.signedOffBy || userId || '').trim();
    if (!signedOffBy) {
      return res
        .status(400)
        .json({ error: 'signedOffBy is required', code: 'VALUE_CAPTURE_BAD_INPUT' });
    }
    try {
      const updated: ValueCaptureGate = await advanceGate(organizationId, id, { signedOffBy });
      return res.json({ data: updated, meta: meta() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const notFound = message === 'Gate not found';
      logger.warn(`[V8:FinanceValue] advanceGate rejected for ${id}: ${message}`);
      return res.status(notFound ? 404 : 400).json({
        error: notFound ? 'Gate not found' : 'Could not advance value capture gate',
        code: notFound ? 'VALUE_CAPTURE_GATE_NOT_FOUND' : 'VALUE_CAPTURE_GATE_ADVANCE_REJECTED',
      });
    }
  })
);

/**
 * GET /capture/funnel?initiativeId=
 * Pipeline funnel (count + value + conversion) per canonical gate, org-scoped.
 */
router.get(
  '/capture/funnel',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const initiativeId = queryString(req, 'initiativeId');
    const gates = await listGates(organizationId, initiativeId);
    const funnel = pipelineFunnel(gates);
    return res.json({ data: funnel, meta: meta() });
  })
);

// ---------------------------------------------------------------------------
// 4. realizedValueReconciliationService — declared vs statement (pure + DB)
// ---------------------------------------------------------------------------

/**
 * POST /reconciliation/check
 * Body: { declared: number, statementValue?: number|null, tolerancePct?: number }
 */
router.post(
  '/reconciliation/check',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const declared = Number(req.body?.declared) || 0;
    const statementValue =
      req.body?.statementValue === undefined || req.body?.statementValue === null
        ? undefined
        : Number(req.body.statementValue);
    const tolerancePct = req.body?.tolerancePct === undefined ? 5 : Number(req.body.tolerancePct);
    const result = reconcile(declared, statementValue, tolerancePct);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /reconciliation/portfolio
 * Body: { rows: ReconcileRow[], tolerancePct?: number }
 */
router.post(
  '/reconciliation/portfolio',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const rows: ReconcileRow[] = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const tolerancePct = req.body?.tolerancePct === undefined ? 5 : Number(req.body.tolerancePct);
    const result = reconcilePortfolio(rows, tolerancePct);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * GET /reconciliation/organization?tolerancePct=
 * Org-scoped DB assembler: roi_realized_values -> kpi_financial_mappings ->
 * financial_statement_lines/values, reconciled against declared realized value.
 */
router.get(
  '/reconciliation/organization',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const tolerancePctRaw = queryString(req, 'tolerancePct');
    const tolerancePct = tolerancePctRaw === undefined ? 5 : Number(tolerancePctRaw) || 5;
    const result = await reconcileOrganization(organizationId, tolerancePct);
    return res.json({ data: result, meta: meta() });
  })
);

// ---------------------------------------------------------------------------
// 5. kpiLineageService — leading/lagging early-warning divergence (pure)
// ---------------------------------------------------------------------------

/**
 * POST /lineage/early-warnings
 * Body: { pairs: KpiLineagePair[], threshold?: number }
 */
router.post(
  '/lineage/early-warnings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const pairs: KpiLineagePair[] = Array.isArray(req.body?.pairs) ? req.body.pairs : [];
    const threshold = req.body?.threshold === undefined ? undefined : Number(req.body.threshold);
    const result =
      threshold === undefined ? detectEarlyWarnings(pairs) : detectEarlyWarnings(pairs, threshold);
    return res.json({ data: result, meta: meta() });
  })
);

// ---------------------------------------------------------------------------
// 6. bankingValueService — banking the value into next-period budget (pure)
// ---------------------------------------------------------------------------

/**
 * POST /banking/bank
 * Body: { benefit: Benefit, targetBudgetPeriod: string }
 */
router.post(
  '/banking/bank',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const benefit = req.body?.benefit as Benefit;
    const targetBudgetPeriod = String(req.body?.targetBudgetPeriod || '').trim();
    if (!benefit || !targetBudgetPeriod) {
      return res.status(400).json({
        error: 'benefit and targetBudgetPeriod are required',
        code: 'VALUE_BANKING_BAD_INPUT',
      });
    }
    const result = bankBenefit(benefit, targetBudgetPeriod);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /banking/status
 * Body: { benefit: Benefit, actual?: number }
 */
router.post(
  '/banking/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const benefit = req.body?.benefit as Benefit;
    if (!benefit) {
      return res
        .status(400)
        .json({ error: 'benefit is required', code: 'VALUE_BANKING_BAD_INPUT' });
    }
    const actual =
      req.body?.actual === undefined || req.body?.actual === null
        ? undefined
        : Number(req.body.actual);
    const result = bankingStatus(benefit, actual);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /banking/portfolio
 * Body: { items: PortfolioItem[] }
 */
router.post(
  '/banking/portfolio',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const result = portfolioBanked(items);
    return res.json({ data: result, meta: meta() });
  })
);

// ---------------------------------------------------------------------------
// 7. extendedRatiosService — ROE/ROA/ROIC/DSCR/DuPont/benchmark (pure)
// ---------------------------------------------------------------------------

/**
 * POST /ratios/extended
 * Body: ExtendedFinancials
 */
router.post(
  '/ratios/extended',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const fin = req.body as ExtendedFinancials;
    const result = computeExtendedRatios(fin);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /ratios/dupont
 * Body: ExtendedFinancials
 */
router.post(
  '/ratios/dupont',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const fin = req.body as ExtendedFinancials;
    const result = dupontDecomposition(fin);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /ratios/benchmark
 * Body: { value: number, benchmark: IndustryBenchmark }
 */
router.post(
  '/ratios/benchmark',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const value = Number(req.body?.value);
    const benchmark = req.body?.benchmark as IndustryBenchmark;
    if (!benchmark) {
      return res
        .status(400)
        .json({ error: 'benchmark is required', code: 'VALUE_RATIOS_BAD_INPUT' });
    }
    const result = benchmarkStatus(value, benchmark);
    return res.json({ data: result, meta: meta() });
  })
);

// ---------------------------------------------------------------------------
// 5. postInvestmentReviewService — FIN-007 durable post-investment review
//    receipt (approved baseline vs. Execution-recorded actuals). References
//    the canonical roi_realized_values rows by id; never a second ledger.
// ---------------------------------------------------------------------------

/**
 * GET /approved-baselines?initiativeId=...
 *
 * Read-only lookup so the UI can offer "which approved baseline" as a picker
 * instead of requiring a hand-typed model id — every approved
 * `financial_models` row for this initiative, newest version first. Does NOT
 * read `financial_model_versions.snapshot_data` (no line-level detail here);
 * `resolveApprovedBaselineLine` inside `createPostInvestmentReview` is the
 * ONLY place that resolves a specific statementType/lineCode/periodDate, and
 * it always re-checks approved+version itself — this endpoint is a
 * convenience list, never a trust boundary.
 */
router.get(
  '/approved-baselines',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const initiativeId = String(req.query.initiativeId || '').trim();
    if (!initiativeId) {
      return res.status(400).json({
        error: 'initiativeId is required',
        code: 'APPROVED_BASELINES_BAD_INPUT',
      });
    }
    const rows = await dbAll<{
      id: string;
      name: string;
      version: number;
      approved_at: string | null;
      start_date: string;
    }>(
      `SELECT id, name, version, approved_at, start_date FROM financial_models
        WHERE initiative_id = ? AND organization_id = ? AND status = 'approved'
        ORDER BY version DESC`,
      [initiativeId, organizationId],
      { fallback: true }
    );
    return res.json({
      data: (rows || []).map((row) => ({
        modelId: row.id,
        name: row.name,
        version: Number(row.version),
        approvedAt: row.approved_at,
        startDate: row.start_date,
      })),
      meta: meta(),
    });
  })
);

/**
 * POST /post-investment-reviews
 * Body: { initiativeId, actualIds: string[], baselineModelId, baselineExpectedVersion,
 *         baselineStatementType: 'P&L'|'BS'|'CF', baselineLineCode, baselinePeriodDate,
 *         tolerancePct? }
 * Requires an Idempotency-Key header.
 */
router.post(
  '/post-investment-reviews',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

    const operationKey =
      (typeof req.headers['idempotency-key'] === 'string' && req.headers['idempotency-key']) || '';
    if (!operationKey) {
      return res.status(400).json({
        error: 'Idempotency-Key header is required to create a post-investment review',
        code: 'IDEMPOTENCY_KEY_REQUIRED',
      });
    }

    const body = req.body || {};
    const initiativeId = String(body.initiativeId || '').trim();
    const actualIds = Array.isArray(body.actualIds)
      ? body.actualIds.filter((id: unknown) => typeof id === 'string' && id.length > 0)
      : [];
    const baselineModelId = String(body.baselineModelId || '').trim();
    const baselineExpectedVersion = Number(body.baselineExpectedVersion);
    const baselineStatementType = body.baselineStatementType;
    const baselineLineCode = String(body.baselineLineCode || '').trim();
    const baselinePeriodDate = String(body.baselinePeriodDate || '').trim();

    if (!initiativeId || actualIds.length === 0 || !baselineModelId || !baselineLineCode) {
      return res.status(400).json({
        error:
          'initiativeId, actualIds (non-empty), baselineModelId and baselineLineCode are required',
        code: 'POST_INVESTMENT_REVIEW_BAD_INPUT',
      });
    }
    if (!['P&L', 'BS', 'CF'].includes(baselineStatementType)) {
      return res.status(400).json({
        error: "baselineStatementType must be one of 'P&L', 'BS', 'CF'",
        code: 'POST_INVESTMENT_REVIEW_BAD_INPUT',
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(baselinePeriodDate)) {
      return res.status(400).json({
        error: 'baselinePeriodDate must be an ISO date (YYYY-MM-DD)',
        code: 'POST_INVESTMENT_REVIEW_BAD_INPUT',
      });
    }

    const initiative = await dbGet<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, organizationId],
      { fallback: true }
    );
    if (!initiative?.id) {
      return res.status(404).json({
        error: `Initiative ${initiativeId} not found`,
        code: 'INITIATIVE_NOT_FOUND',
      });
    }

    try {
      const review = await createPostInvestmentReview({
        organizationId,
        initiativeId,
        actualIds,
        baselineModelId,
        baselineExpectedVersion,
        baselineStatementType,
        baselineLineCode,
        baselinePeriodDate,
        tolerancePct: typeof body.tolerancePct === 'number' ? body.tolerancePct : undefined,
        createdBy: userId,
        operationKey,
      });
      return res.status(201).json({ data: review, meta: meta() });
    } catch (error) {
      if (error instanceof ReviewKeyConflictError) {
        return res.status(409).json({ error: error.message, code: 'IDEMPOTENCY_KEY_REUSED' });
      }
      if (error instanceof ReviewInProgressError) {
        res.setHeader('Retry-After', '5');
        return res.status(409).json({ error: error.message, code: 'REVIEW_IN_PROGRESS' });
      }
      if (error instanceof BaselineNotApprovedForReviewError) {
        return res.status(400).json({ error: error.message, code: 'BASELINE_NOT_APPROVED' });
      }
      if (error instanceof BaselineVersionConflictForReviewError) {
        return res.status(409).json({
          error: error.message,
          code: 'BASELINE_VERSION_CONFLICT',
          serverVersion: error.serverVersion,
        });
      }
      if (error instanceof BaselineLineNotFoundError) {
        return res.status(422).json({ error: error.message, code: 'BASELINE_LINE_NOT_FOUND' });
      }
      if (error instanceof ActualNotFoundError) {
        return res.status(404).json({ error: error.message, code: 'ACTUAL_NOT_FOUND' });
      }
      if (error instanceof ActualPeriodMismatchError) {
        return res.status(400).json({ error: error.message, code: 'ACTUAL_PERIOD_MISMATCH' });
      }
      throw error;
    }
  })
);

/**
 * GET /post-investment-reviews/:id
 * Fresh, org-scoped read-back — a foreign-org id 404s (never leaks existence).
 */
router.get(
  '/post-investment-reviews/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const review = await getPostInvestmentReview(String(req.params.id), organizationId);
    if (!review) {
      return res
        .status(404)
        .json({ error: 'Post-investment review not found', code: 'REVIEW_NOT_FOUND' });
    }
    return res.json({ data: review, meta: meta() });
  })
);

/**
 * GET /post-investment-reviews?initiativeId=...
 * Org-scoped list, newest first, completed reviews only.
 */
router.get(
  '/post-investment-reviews',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });
    const initiativeId = String(req.query.initiativeId || '').trim();
    if (!initiativeId) {
      return res.status(400).json({
        error: 'initiativeId query param is required',
        code: 'POST_INVESTMENT_REVIEW_BAD_INPUT',
      });
    }
    const reviews = await listPostInvestmentReviews(organizationId, initiativeId);
    return res.json({ data: reviews, meta: meta() });
  })
);

export default router;
