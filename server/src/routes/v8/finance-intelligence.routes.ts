/**
 * V8 Finance Intelligence bridge — org-scoped endpoints for the previously
 * orphaned "INTELIGENCJA/JAKOŚĆ SPRAWOZDAŃ" engine cluster (M16 Finance).
 *
 * Every engine below existed in server/src/services/ with 0 importers before
 * this file. All 5 pure/rule-based engines are wired here 1:1 to their public
 * API. The 2 LLM-backed engines are wired differently by design:
 *   - llmFinancialPipelineService: grounded — the LLM only maps/validates
 *     canonical lines against text the caller supplies (an actual document
 *     excerpt), never invents figures. Wired as-is.
 *   - livingBusinessCaseService: NOT LLM at all (pure math) — the risky part
 *     is its own documented fallback (reconstructing a flat benefit stream
 *     from ROI% when the caller supplies no capex/opex/benefit drivers). That
 *     fallback is grounded in a REAL analysis ratio pulled from the DB
 *     (financial_analysis_ratios), not fabricated — see the endpoint below
 *     for the org-ownership check before that ratio is read.
 *
 * MOUNTED at server/src/routes/v8/index.ts:121 —
 * `v8Router.use('/finance-intelligence', financeIntelligenceRoutes);` — this
 * IS the live route to other tenants' revenue, ROI, and margin data.
 * (Corrected 2026-08-31: this comment previously said "NOT MOUNTED YET" after
 * the mount had already landed — a stale claim that could have led the next
 * reader to treat this barrier as dead code.)
 *
 * Every endpoint below sits behind the full `v8Router` chain applied before
 * line 121 in index.ts: `verifyToken` (line 58) and `requireV8OrgContext`
 * (line 59) globally, then `v8OrgGate`, `attachV8Context`, and
 * `v8MetricsMiddleware` (lines 87-89) on the tenant-routes branch this file
 * is mounted under. `getV8Context(req)` (imported below) is what each handler
 * calls to read the verified `organizationId` that `attachV8Context` put on
 * the request — see the org-ownership check on the `livingBusinessCaseService`
 * endpoint noted above.
 *
 * @module routes/v8/finance-intelligence.routes
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { aiRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  compareInitiatives,
  generateOnePager,
  type InitiativeEconomics,
} from '../../services/businessCaseGeneratorService.js';
import {
  type StatementPack,
  tieOutSummary,
  validatePackTieOut,
} from '../../services/crossStatementTieOutService.js';
import {
  type AnomalySeverity,
  anomalySummary,
  detectAnomalies,
  type FinanceStatement,
} from '../../services/financeAnomalyDetectorService.js';
import {
  type CanonicalStatementType,
  getCanonicalLinesByStatementType,
} from '../../services/financeCanonicalRegistry.js';
import type { RatioResult } from '../../services/financialAnalysisService.js';
import { getAnalysisRatios, listAnalyses } from '../../services/financialAnalysisService.js';
import {
  getStatementPackDetail,
  loadPackValueMaps,
} from '../../services/financialStatementPackService.js';
import {
  buildBusinessCaseFromAnalysis,
  computeNpvOnRead,
  toRoiAssumptions,
} from '../../services/livingBusinessCaseService.js';
import {
  runDocumentPipeline,
  runLlmFinancialPipeline,
} from '../../services/llmFinancialPipelineService.js';
import {
  computeYoY,
  convertCurrency,
  mergeMultiYear,
  type MultiYearStatement,
  normalizeToPresentation,
  readinessThreshold,
  type StatementLine as CompletenessStatementLine,
} from '../../services/statementCompletenessService.js';
import {
  narrateVariance,
  topVarianceDrivers,
  type VarianceBridge,
  varianceSeverity,
} from '../../services/varianceNarrationService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

/** Stable contract id for V8 Finance Intelligence responses. */
export const V8_FINANCE_INTELLIGENCE_CONTRACT = 'finance_intelligence_runtime_v1';

function meta() {
  return { version: 'v8' as const, contract: V8_FINANCE_INTELLIGENCE_CONTRACT };
}

/** Verifies an analysisId belongs to the caller's org before any DB read keyed only by analysisId. */
async function assertAnalysisOwnedByOrg(
  organizationId: string,
  analysisId: string
): Promise<boolean> {
  const analyses = await listAnalyses(organizationId);
  return analyses.some((analysis: any) => String(analysis.id) === analysisId);
}

// ---------------------------------------------------------------------------
// 1. crossStatementTieOutService — pure, DB-grounded via statement pack.
// ---------------------------------------------------------------------------

/**
 * GET /api/v8/finance-intelligence/packs/:packId/tie-out
 * Loads the org-scoped statement pack's canonical P&L/BS/CF value maps and
 * runs the 5 cross-statement tie-out checks (net income -> retained earnings,
 * closing cash match, indirect CF reconciliation, BS balances, CF sections sum).
 */
router.get(
  '/packs/:packId/tie-out',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const packId = String(req.params.packId || '');
    const pack = await getStatementPackDetail(organizationId, packId);
    if (!pack) {
      return res.status(404).json({ error: 'Statement pack not found' });
    }

    const tolerancePctRaw = Number(req.query.tolerancePct);
    const tolerancePct =
      Number.isFinite(tolerancePctRaw) && tolerancePctRaw > 0 ? tolerancePctRaw : 1;

    const maps = await loadPackValueMaps(pack.statements || []);
    const statementPack: StatementPack = { pnl: maps.pnl, bs: maps.bs, cf: maps.cf };

    const checks = validatePackTieOut(statementPack, tolerancePct);
    const summary = tieOutSummary(checks);

    return res.json({
      data: { packId, tolerancePct, checks, summary },
      meta: meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// 2. statementCompletenessService — pure helpers, body-supplied inputs
//    (FX rates / multi-year merges are caller-assembled; no canonical DB
//    table of FX rates or cross-period bundles exists to source them from).
// ---------------------------------------------------------------------------

/**
 * POST /api/v8/finance-intelligence/completeness/normalize-currency
 * body: { lines: StatementLine[], presentationCcy: string, rates: Record<string, number> }
 */
router.post(
  '/completeness/normalize-currency',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req); // org-scope gate; no org-keyed data read here (pure calc)
    const body = req.body || {};
    const lines: CompletenessStatementLine[] = Array.isArray(body.lines) ? body.lines : [];
    const presentationCcy = typeof body.presentationCcy === 'string' ? body.presentationCcy : '';
    const rates = body.rates && typeof body.rates === 'object' ? body.rates : {};

    if (!presentationCcy) {
      return res.status(400).json({ error: 'presentationCcy is required' });
    }

    const normalized = normalizeToPresentation(lines, presentationCcy, rates);
    return res.json({ data: { presentationCcy, lines: normalized }, meta: meta() });
  })
);

/**
 * POST /api/v8/finance-intelligence/completeness/multi-year
 * body: { statements: MultiYearStatement[], yoyCode?: string }
 * Merges single-period statements into a per-code time series; when
 * `yoyCode` is supplied also returns the YoY series for that one code.
 */
router.post(
  '/completeness/multi-year',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body || {};
    const statements: MultiYearStatement[] = Array.isArray(body.statements) ? body.statements : [];
    const merged = mergeMultiYear(statements);

    let yoy: ReturnType<typeof computeYoY> | null = null;
    const yoyCode = typeof body.yoyCode === 'string' ? body.yoyCode : '';
    if (yoyCode && merged.byCode[yoyCode]) {
      const points = merged.periods.map((period, idx) => ({
        period,
        value: merged.byCode[yoyCode][idx],
      }));
      yoy = computeYoY(points);
    }

    return res.json({ data: { merged, yoyCode: yoyCode || null, yoy }, meta: meta() });
  })
);

/**
 * POST /api/v8/finance-intelligence/completeness/readiness
 * body: { coverage: Record<string, boolean>, requiredCoverage: string[] }
 */
router.post(
  '/completeness/readiness',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body || {};
    const coverage = body.coverage && typeof body.coverage === 'object' ? body.coverage : {};
    const requiredCoverage: string[] = Array.isArray(body.requiredCoverage)
      ? body.requiredCoverage
      : [];

    const result = readinessThreshold(coverage, requiredCoverage);
    return res.json({ data: result, meta: meta() });
  })
);

/**
 * POST /api/v8/finance-intelligence/completeness/convert-currency
 * body: { value: number, fromCcy?: string, toCcy?: string, rates: Record<string, number> }
 * Single-value convenience wrapper (the normalize-currency endpoint batches
 * this over a whole line array).
 */
router.post(
  '/completeness/convert-currency',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body || {};
    const value = Number(body.value);
    if (!Number.isFinite(value)) {
      return res.status(400).json({ error: 'value must be a finite number' });
    }
    const rates = body.rates && typeof body.rates === 'object' ? body.rates : {};
    const converted = convertCurrency(value, body.fromCcy, body.toCcy, rates);
    return res.json({ data: { value, converted }, meta: meta() });
  })
);

// ---------------------------------------------------------------------------
// 3. financeAnomalyDetectorService — pure, rule-based (NO LLM), body-supplied
//    statement (shape is caller-assembled: lines + sign conventions + prior
//    values, which don't map 1:1 onto the flat canonical value maps used by
//    tie-out above).
// ---------------------------------------------------------------------------

/**
 * POST /api/v8/finance-intelligence/anomalies/detect
 * body: FinanceStatement { type, lines: StatementLine[], assets?, liabilities?, equity? }
 */
router.post(
  '/anomalies/detect',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = (req.body || {}) as FinanceStatement;
    if (!body || !Array.isArray(body.lines)) {
      return res.status(400).json({ error: 'lines[] is required' });
    }

    const anomalies = detectAnomalies(body);
    const summary = anomalySummary(anomalies);
    const bySeverity = anomalies.reduce(
      (acc, a) => {
        acc[a.severity] = (acc[a.severity] || 0) + 1;
        return acc;
      },
      {} as Record<AnomalySeverity, number>
    );

    return res.json({ data: { anomalies, summary, bySeverity }, meta: meta() });
  })
);

// ---------------------------------------------------------------------------
// 4. varianceNarrationService — pure, rule-based (NO LLM), body-supplied
//    plan-vs-actual bridge.
// ---------------------------------------------------------------------------

/**
 * POST /api/v8/finance-intelligence/variance/narrate
 * body: { bridge: VarianceBridgeLine[], topN?: number }
 */
router.post(
  '/variance/narrate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body || {};
    const bridge: VarianceBridge = Array.isArray(body.bridge) ? body.bridge : [];
    if (bridge.length === 0) {
      return res.status(400).json({ error: 'bridge[] is required' });
    }
    const topN =
      Number.isFinite(Number(body.topN)) && Number(body.topN) > 0 ? Number(body.topN) : 3;

    const narration = narrateVariance(bridge);
    const drivers = topVarianceDrivers(bridge, topN);
    const severity = varianceSeverity(bridge);

    return res.json({ data: { narration, drivers, severity }, meta: meta() });
  })
);

// ---------------------------------------------------------------------------
// 5. businessCaseGeneratorService — pure NPV/IRR/payback math, body-supplied
//    initiative economics (pre-funding one-pager; capital-constrained ranking).
// ---------------------------------------------------------------------------

/**
 * POST /api/v8/finance-intelligence/business-case/one-pager
 * body: { initiative: InitiativeEconomics, waccPct: number }
 */
router.post(
  '/business-case/one-pager',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body || {};
    const initiative = body.initiative as InitiativeEconomics | undefined;
    const waccPct = Number(body.waccPct);
    if (!initiative || !initiative.id || !initiative.name) {
      return res.status(400).json({
        error:
          'initiative { id, name, capex, opexAnnual, benefitAnnual, horizonYears } is required',
      });
    }
    if (!Number.isFinite(waccPct)) {
      return res.status(400).json({ error: 'waccPct must be a finite number' });
    }

    const onePager = generateOnePager(initiative, waccPct);
    return res.json({ data: { onePager }, meta: meta() });
  })
);

/**
 * POST /api/v8/finance-intelligence/business-case/compare
 * body: { initiatives: InitiativeEconomics[], waccPct: number }
 */
router.post(
  '/business-case/compare',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const body = req.body || {};
    const initiatives: InitiativeEconomics[] = Array.isArray(body.initiatives)
      ? body.initiatives
      : [];
    const waccPct = Number(body.waccPct);
    if (initiatives.length === 0) {
      return res.status(400).json({ error: 'initiatives[] is required' });
    }
    if (!Number.isFinite(waccPct)) {
      return res.status(400).json({ error: 'waccPct must be a finite number' });
    }

    const comparison = compareInitiatives(initiatives, waccPct);
    return res.json({ data: { comparison }, meta: meta() });
  })
);

/**
 * POST /api/v8/finance-intelligence/business-case/from-analysis/:analysisId
 * DB-grounded: pulls the org-owned analysis' computed investment ratios
 * (financial_analysis_ratios) and projects them onto a "living" business
 * case (M16/2.1) that can be re-priced at any WACC. When the caller does not
 * supply explicit capex/opex/revenueDelta/costSavings, the service's own
 * documented fallback reconstructs a flat benefit stream from the analysis'
 * REAL roi_pct ratio — never an LLM guess, but callers should be aware the
 * per-year split is a flat approximation, not a schedule extracted from data.
 * body: { capex?, opex?, revenueDelta?, costSavings?, horizonYears?, discountRatePct?, waccPct? }
 */
router.post(
  '/business-case/from-analysis/:analysisId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const analysisId = String(req.params.analysisId || '');

    const owned = await assertAnalysisOwnedByOrg(organizationId, analysisId);
    if (!owned) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const rawRatios = await getAnalysisRatios(analysisId);
    const ratios: RatioResult[] = (rawRatios || []).map((r: any) => ({
      category: String(r.category || ''),
      code: String(r.ratio_code || ''),
      name: String(r.ratio_name || r.ratio_code || ''),
      value: r.value == null ? null : Number(r.value),
      benchmark: r.benchmark_value == null ? undefined : Number(r.benchmark_value),
      interpretation: r.interpretation || undefined,
    }));

    const body = req.body || {};
    const economics = buildBusinessCaseFromAnalysis(ratios, {
      capex: body.capex,
      opex: body.opex,
      revenueDelta: body.revenueDelta,
      costSavings: body.costSavings,
      horizonYears: body.horizonYears,
      discountRatePct: body.discountRatePct,
    });

    const waccPctRaw = Number(body.waccPct);
    const waccPct = Number.isFinite(waccPctRaw) ? waccPctRaw : economics.discountRatePct;
    const computed = computeNpvOnRead(economics, waccPct);
    const roiAssumptions = toRoiAssumptions(economics);

    return res.json({
      data: { analysisId, economics, computed, roiAssumptions },
      meta: meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// 6. llmFinancialPipelineService — LLM-GROUNDED (GPT-4o maps/validates
//    canonical lines against caller-supplied document text; never invents
//    figures absent from the text). Rate-limited like other AI endpoints
//    (aiRateLimiter, same bucket ai.routes.ts uses for LLM calls).
// ---------------------------------------------------------------------------

const MAX_PIPELINE_TEXT_LENGTH = 200_000;

/**
 * POST /api/v8/finance-intelligence/pipeline/run
 * body: { text: string, statementType: 'P&L'|'BS'|'CF', options?: LlmPipelineOptions }
 * Runs the 3-phase pipeline (heuristic pre-map -> LLM full analysis -> LLM
 * CFO review) for a single statement type against the supplied text.
 */
router.post(
  '/pipeline/run',
  aiRateLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const body = req.body || {};
    const text = typeof body.text === 'string' ? body.text : '';
    const statementType = typeof body.statementType === 'string' ? body.statementType : '';

    if (!text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.length > MAX_PIPELINE_TEXT_LENGTH) {
      return res.status(413).json({ error: `text exceeds ${MAX_PIPELINE_TEXT_LENGTH} characters` });
    }
    if (!statementType) {
      return res.status(400).json({ error: 'statementType is required (P&L | BS | CF)' });
    }

    const options = body.options && typeof body.options === 'object' ? body.options : {};
    logger.info(`[finance-intelligence] pipeline.run org=${organizationId} user=${userId}`);

    const result = await runLlmFinancialPipeline(text, statementType, {
      organizationId,
      templateFamily: options.templateFamily ?? null,
      documentName: options.documentName,
      currency: options.currency,
      scaling: options.scaling,
      periodLabel: options.periodLabel,
      comparisonPeriodLabel: options.comparisonPeriodLabel ?? null,
    });

    return res.json({ data: { result }, meta: meta() });
  })
);

/**
 * POST /api/v8/finance-intelligence/pipeline/document
 * body: { text: string, documentName: string, options?: LlmPipelineOptions }
 * Runs the full 3-phase pipeline for all 3 statement types (BS, P&L, CF)
 * against the same document text and returns an overall score/verdict.
 */
router.post(
  '/pipeline/document',
  aiRateLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const body = req.body || {};
    const text = typeof body.text === 'string' ? body.text : '';
    const documentName = typeof body.documentName === 'string' ? body.documentName : 'Unknown';

    if (!text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.length > MAX_PIPELINE_TEXT_LENGTH) {
      return res.status(413).json({ error: `text exceeds ${MAX_PIPELINE_TEXT_LENGTH} characters` });
    }

    const options = body.options && typeof body.options === 'object' ? body.options : {};
    logger.info(`[finance-intelligence] pipeline.document org=${organizationId} user=${userId}`);

    const result = await runDocumentPipeline(text, documentName, {
      organizationId,
      templateFamily: options.templateFamily ?? null,
      currency: options.currency,
      scaling: options.scaling,
      periodLabel: options.periodLabel,
      comparisonPeriodLabel: options.comparisonPeriodLabel ?? null,
    });

    return res.json({
      data: {
        documentName: result.documentName,
        overallScore: result.overallScore,
        overallVerdict: result.overallVerdict,
        results: Object.fromEntries(result.results),
      },
      meta: meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// Reference: canonical line catalog (used by the pipeline endpoints above;
// exposed read-only so a caller can render the mapping target list without
// duplicating financeCanonicalRegistry client-side).
// ---------------------------------------------------------------------------

/**
 * GET /api/v8/finance-intelligence/canonical-lines/:statementType
 */
router.get(
  '/canonical-lines/:statementType',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    getV8Context(req);
    const raw = String(req.params.statementType || '').toUpperCase();
    const statementType: CanonicalStatementType = raw === 'BS' ? 'BS' : raw === 'CF' ? 'CF' : 'P&L';
    const lines = getCanonicalLinesByStatementType(statementType);
    return res.json({ data: { statementType, lines }, meta: meta() });
  })
);

export default router;
