/**
 * Economics Routes
 * API endpoints for digitization maturity analyses
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import * as budgetingSvc from '../services/budgetingService.js';
import decisionService from '../services/decisionService.js';
import {
  applyScenarioAdjustments,
  calculateFinancialMetrics,
  defaultFinancialData,
  type FinancialData,
  normalizeFinancialData,
  validateFinancialData,
} from '../services/economicsFinancials.js';
import { findReconciliationTargetForInitiative } from '../services/finance/canonical/roiFinanceReconciliationAdapter.js';
import { createRegisteredValuation } from '../services/finance/canonical/valuationRegistrationService.js';
import { FinanceCandidateHandoffError } from '../services/finance/financeCandidateHandoffCore.js';
import * as finAnalysisSvc from '../services/financialAnalysisService.js';
import { createLegacyCutoverGuard } from '../services/legacyCutover/legacyCutoverKernel.js';
import { ECONOMICS_CUTOVER } from '../services/legacyCutover/registry/economics.js';
import { createInitiative as funnelCreateInitiative } from '../services/initiative/createInitiativeService.js';
import { resolveInitiativeProjectId } from '../services/initiativeProjectPolicyService.js';
import { buildBasketFromResults } from '../services/valuationBasketService.js';
import {
  buildBasketForDepth,
  depthNarrative,
  isValidDepth,
  normalizeDepth,
  resolveStoredDepth,
  setValuationDepth,
} from '../services/valuationDepthProfileService.js';
import { exportValuationPptx } from '../services/valuationExportService.js';
import * as valuationSvc from '../services/valuationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';
import { flagOn } from '../utils/pgFlags.js';
import { resolveStoredRelativePath } from '../utils/storagePaths.js';

logger.info('[Economics Routes] Module loaded - TypeScript version');
logger.info('[Economics Routes] Router type:', typeof Router);
const router = Router();
const economicsCutoverGuard = createLegacyCutoverGuard(ECONOMICS_CUTOVER);

// ---------------------------------------------------------------------------
// M08-H01/H02/H03 — fail-closed / degraded storage guards.
//
// `DbPromise` defaults to `fallback: true` for `get`/`all` AND `run`, so a
// missing relation RESOLVES (`[]` / `{ success:false }`) instead of throwing.
// Three Finance tables are absent on demo — `analysis_financial_scenarios`,
// `benefit_tracking`, `analysis_financials` — and every call site here used the
// default. Result: scenario and benefit writes answered `success: true` for
// rows that were never stored, and the analyses list silently came back empty.
//
// This file previously contained ZERO `fallback: false` call sites. The helpers
// below are the only sanctioned way to touch those three tables:
//   - writes  → `FAIL CLOSED`: the caller must answer 503, never `success:true`;
//   - reads   → `DEGRADED`: retry without the optional join and flag it, so the
//     list keeps working while telling the truth about the missing enrichment.
//
// No DDL is performed here. Creating the three tables remains an open
// deployment action — see the packet report.
// ---------------------------------------------------------------------------

/** Postgres 42P01 / SQLite equivalents for "relation does not exist". */
export function isMissingRelationError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  if (code === '42P01') return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    /relation .* does not exist/i.test(message) ||
    /no such table/i.test(message) ||
    /undefined table/i.test(message)
  );
}

/** Thrown by the write guards; converted to an honest 503 by the handlers. */
class FinanceStorageUnavailableError extends Error {
  constructor(public readonly table: string) {
    super(`finance storage unavailable: ${table}`);
    this.name = 'FinanceStorageUnavailableError';
  }
}

/**
 * Fail-closed wrapper for a write that targets one of the three tables.
 * Rejects loudly instead of letting `fallback: true` swallow a 42P01.
 */
async function financeWrite<T>(table: string, op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (error) {
    if (isMissingRelationError(error)) throw new FinanceStorageUnavailableError(table);
    throw error;
  }
}

/** Uniform 503 body for an unavailable Finance table. Never `success: true`. */
function respondFinanceStorageUnavailable(res: Response, error: FinanceStorageUnavailableError) {
  return res.status(503).json({
    success: false,
    error: 'FINANCE_STORAGE_UNAVAILABLE',
    table: error.table,
    message:
      'Ta część Finance nie ma jeszcze zaplecza w tej bazie. Nic nie zostało zapisane — spróbuj ponownie po udostępnieniu magazynu.',
  });
}
logger.info('[Economics Routes] Router created. Stack length:', router.stack?.length);

// FIN-06: maps the shared Finance Candidate handoff error onto an HTTP
// response, mirroring `interviewCandidateHandoff.routes.ts`'s `mapError`.
function mapFinanceCandidateHandoffError(
  err: unknown
): { status: number; body: Record<string, unknown> } | null {
  if (err instanceof FinanceCandidateHandoffError) {
    return {
      status: err.status,
      body: {
        error: err.message,
        code: err.code,
        ...(err.details ? { details: err.details } : {}),
      },
    };
  }
  return null;
}

// Helper to safely parse JSON
function safeJsonParse(str: string | null | undefined, fallback: any = {}): any {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

const normalizeAnalysisStatus = (status?: string | null) => {
  if (!status) return 'DRAFT';
  const upper = String(status).toUpperCase();
  if (['DRAFT', 'REVIEW', 'APPROVED'].includes(upper)) {
    return upper;
  }
  if (upper === 'IN_PROGRESS') return 'REVIEW';
  if (upper === 'COMPLETED') return 'APPROVED';
  return 'DRAFT';
};

const normalizeStatusForDb = (status?: string | null) => {
  const upper = normalizeAnalysisStatus(status);
  if (upper === 'REVIEW') return 'in_progress';
  if (upper === 'APPROVED') return 'completed';
  return 'draft';
};

// ════════════════════════════════════════════════
// Zod validation schemas (defense-in-depth — Wave 5 M16 hardening)
//
// Scope note: Wave 5 validated endpoints whose body shape is determinable from
// in-router SQL / economicsFinancials. Wave 6 EXTENDED validation to the
// service-delegated mutators (financialAnalysisService, valuationService,
// budgetingService, finance-settings) by mirroring each service method's
// destructured allowlist at the route boundary (schemas below the wave-5 set).
//
// `.strict()` rejects unexpected top-level keys with 400. Sub-objects that
// feed `normalizeFinancialData` (which tolerates partials) are kept
// permissive so no previously-accepted payload is now rejected.
// ════════════════════════════════════════════════

const idLike = z.string().max(64);

// FinancialData sub-object — permissive (normalizeFinancialData spreads input
// over defaults). Numeric fields are coerced/validated; assumptions is a list.
const financialDataSchema = z
  .object({
    initialInvestment: z.number().optional(),
    implementationCost: z.number().optional(),
    annualOperatingCost: z.number().optional(),
    trainingCost: z.number().optional(),
    contingencyPercent: z.number().optional(),
    annualCostSavings: z.number().optional(),
    annualRevenueIncrease: z.number().optional(),
    productivityGainsPercent: z.number().optional(),
    riskReductionValue: z.number().optional(),
    implementationMonths: z.number().optional(),
    benefitRealizationMonths: z.number().optional(),
    analysisHorizonYears: z.number().optional(),
    discountRate: z.number().optional(),
    currency: z.string().max(10).optional(),
    assumptions: z.array(z.unknown()).optional(),
  })
  .passthrough();

const createAnalysisSchema = z
  .object({
    name: z.string().trim().min(1).max(300),
    description: z.string().max(10000).nullish(),
    projectId: idLike.nullish(),
    initiativeId: idLike.nullish(),
    analysisType: z.string().max(60).optional(),
  })
  .strict();

const updateAnalysisSchema = z
  .object({
    name: z.string().trim().min(1).max(300).optional(),
    description: z.string().max(10000).nullish(),
    status: z.string().max(40).optional(),
    axisScores: z.record(z.string(), z.unknown()).optional(),
    overallScore: z.number().nullish(),
    completionPercent: z.number().optional(),
    projectId: idLike.nullish(),
    initiativeId: idLike.nullish(),
    analysisType: z.string().max(60).optional(),
  })
  .strict();

const linkInitiativeSchema = z
  .object({
    initiativeId: idLike,
  })
  .strict();

const costBenefitItemSchema = z
  .object({
    description: z.string().max(500).optional(),
    amount: z.number().optional(),
    year: z.number().optional(),
  })
  .passthrough();

const updateFinancialsSchema = z
  .object({
    financialData: financialDataSchema.optional(),
    costs: z.array(costBenefitItemSchema).optional(),
    benefits: z.array(costBenefitItemSchema).optional(),
    discountRate: z.number().optional(),
    investmentHorizon: z.number().optional(),
  })
  .strict();

const upsertScenarioSchema = z
  .object({
    scenarioType: z.string().trim().min(1).max(40),
    name: z.string().max(120).optional(),
    financialData: financialDataSchema.optional(),
  })
  .strict();

const updateBenefitsSchema = z
  .object({
    trackingPeriod: z.string().trim().min(1).max(40),
    plannedBenefits: z.number().optional(),
    actualBenefits: z.number().optional(),
  })
  .strict();

const createDecisionSchema = z
  .object({
    decisionType: z.string().max(40).optional(),
    decisionMakerId: idLike.nullish(),
  })
  .strict();

const duplicateAnalysisSchema = z
  .object({
    name: z.string().trim().min(1).max(300).optional(),
  })
  .strip(); // strip (not strict) — caller may send extra keys like { method: 'dcf' } without 400

const createAnalysisInitiativesSchema = z
  .object({
    acceptedProposalIds: z.array(z.string().max(64)).min(1),
  })
  .strict();

const exportPptxSchema = z
  .object({
    language: z.string().max(10).optional(),
    theme: z.string().max(40).optional(),
    confidentiality: z.string().max(40).optional(),
  })
  .strict();

const importBudgetDocumentSchema = z
  .object({
    documentText: z.string().min(1).max(2_000_000),
  })
  .strict();

const linkBudgetInitiativeSchema = z
  .object({
    initiativeId: idLike,
  })
  .strict();

// ════════════════════════════════════════════════
// Wave 6 — boundary schemas for SERVICE-DELEGATED mutators.
//
// These endpoints forward `req.body` to financialAnalysisService /
// valuationService / budgetingService, whose column allowlists live in the
// services. Each schema below mirrors the corresponding service method's
// destructured-field allowlist EXACTLY (derived by reading the service, not
// invented). `.strict()` rejects unknown top-level keys; sub-objects that the
// service normalizes from partials (waccBreakdown, manualForecast, statement
// lines, scenario adjustments) use `.passthrough()`/catchall so no previously
// service-accepted shape is now rejected.
//
// AUTH-ORDERING CAVEAT (preserved from wave 6): validateBody runs after
// verifyToken but BEFORE the in-handler orgId presence check, so a malformed
// body from an authenticated-but-org-less token yields 400 (not 401). This is
// acceptable — both are rejections and no DB write occurs.
// ════════════════════════════════════════════════

// financialAnalysisService.createAnalysis allowlist (service §343):
// title, description?, projectId?, analysisType?, periods?, statementData?,
// currency?, sourceStatementIds?, sourceStatementPackId?
const statementLineSchema = z
  .object({
    code: z.string().max(120).optional(),
    name: z.string().max(300).optional(),
    values: z.record(z.string(), z.number()).optional(),
  })
  .passthrough();

// StatementData = { pl?: StatementLine[]; bs?: StatementLine[]; cf?: StatementLine[] }
const statementDataSchema = z
  .object({
    pl: z.array(statementLineSchema).optional(),
    bs: z.array(statementLineSchema).optional(),
    cf: z.array(statementLineSchema).optional(),
  })
  .passthrough();

const createFinancialAnalysisSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().max(10000).optional(),
    projectId: idLike.optional(),
    analysisType: z.string().max(60).optional(),
    periods: z.array(z.string().max(60)).optional(),
    statementData: statementDataSchema.optional(),
    currency: z.string().max(10).optional(),
    sourceStatementIds: z.array(z.string().max(64)).optional(),
    sourceStatementPackId: idLike.optional(),
  })
  .strict();

// financialAnalysisService.updateAnalysis allowlist (service §442) — all partial:
// title, description, periods, statementData, currency, sourceStatementIds,
// sourceStatementPackId, rebuildFromStatements
const updateFinancialAnalysisSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().max(10000).optional(),
    periods: z.array(z.string().max(60)).optional(),
    statementData: statementDataSchema.optional(),
    currency: z.string().max(10).optional(),
    sourceStatementIds: z.array(z.string().max(64)).optional(),
    sourceStatementPackId: idLike.optional(),
    rebuildFromStatements: z.boolean().optional(),
  })
  .strict();

// valuationService.createValuation allowlist (service §211):
// title (req), description?, projectId?, initiativeId?, sourceType (req),
// sourceId?, horizonYears?, currency?
const valuationSourceTypeSchema = z.enum([
  'financial_model',
  'financial_analysis',
  'budget',
  'manual',
]);
const createValuationSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().max(10000).nullish(),
    projectId: idLike.nullish(),
    initiativeId: idLike.nullish(),
    sourceType: valuationSourceTypeSchema,
    sourceId: idLike.nullish(),
    horizonYears: z.number().optional(),
    currency: z.string().max(10).optional(),
    // F-4 EV depth switch (D-2, additive) — optional; omitted = existing behavior
    // (valuationService.createValuation defaults, untouched).
    depth: z.enum(['managerial', 'banking']).optional(),
  })
  .strict();

// valuationDepthProfileService.setValuationDepth — PUT /valuations/:id/depth.
const updateValuationDepthSchema = z
  .object({
    depth: z.enum(['managerial', 'banking']),
  })
  .strict();

// valuationService.updateAssumptions — Partial<ValuationAssumptions> (service §31/§308).
// waccBreakdown + manualForecast are merged from partials → kept permissive.
const waccBreakdownSchema = z
  .object({
    riskFreeRate: z.number().optional(),
    equityRiskPremium: z.number().optional(),
    beta: z.number().optional(),
    costOfDebt: z.number().optional(),
    taxRate: z.number().optional(),
    debtWeight: z.number().optional(),
    equityWeight: z.number().optional(),
  })
  .passthrough();
const manualForecastYearSchema = z
  .object({
    year: z.number(),
    fcff: z.number(),
    revenue: z.number().optional(),
    ebitda: z.number().optional(),
  })
  .passthrough();
const updateAssumptionsSchema = z
  .object({
    horizonYears: z.number().optional(),
    waccPercent: z.number().optional(),
    waccBreakdown: waccBreakdownSchema.optional(),
    terminalMethod: z.enum(['gordon', 'exit_multiple']).optional(),
    terminalGrowthPercent: z.number().optional(),
    exitMultiple: z.number().optional(),
    exitMultipleMetric: z.enum(['EV/EBITDA', 'EV/Revenue']).optional(),
    netDebt: z.number().optional(),
    sharesOutstanding: z.number().optional(),
    manualForecast: z
      .object({ years: z.array(manualForecastYearSchema).optional() })
      .passthrough()
      .optional(),
  })
  .strict();

// valuationService.updatePeers — MultiplesInput (service §46/§358), stored verbatim.
const updatePeersSchema = z
  .object({
    metric: z.enum(['EV/EBITDA', 'EV/Revenue', 'P/E']),
    min: z.number(),
    median: z.number(),
    max: z.number(),
    peerSet: z.array(
      z.object({ name: z.string().max(300), notes: z.string().max(2000).optional() }).passthrough()
    ),
    confidenceNote: z.string().max(4000).optional(),
  })
  .strict();

// budgetingService.createBudget allowlist (service §163):
// title (req), description?, projectId?, periodStart (req), periodEnd (req),
// granularity?, currency?
const createBudgetSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().max(10000).optional(),
    projectId: idLike.optional(),
    periodStart: z.string().trim().min(1).max(40),
    periodEnd: z.string().trim().min(1).max(40),
    granularity: z.string().max(40).optional(),
    currency: z.string().max(10).optional(),
  })
  .strict();

// budgetingService.updateBudgetLine allowlist (service §247) — all partial:
// baselineValue, source, driverKpiId, driverFormula, isLocked
const updateBudgetLineSchema = z
  .object({
    baselineValue: z.number().optional(),
    source: z.string().max(120).optional(),
    driverKpiId: idLike.optional(),
    driverFormula: z.string().max(4000).optional(),
    isLocked: z.boolean().optional(),
  })
  .strict();

// budgetingService.updateScenarioAdjustments — ScenarioAdjustment (service §57):
// { revenueGrowth?, costReduction?, [key:string]: number|undefined } stored
// verbatim as JSON → open numeric record (catchall number).
const updateScenarioAdjustmentsSchema = z.record(z.string(), z.number());

// finance-settings PUT — known finance settings keys merged into a free-form
// org-settings JSON blob (route handler, valuationService get/set §156-182).
const financeSettingsSchema = z
  .object({
    defaultWacc: z.number().optional(),
    defaultCurrency: z.string().max(10).optional(),
    defaultHorizonYears: z.number().optional(),
  })
  .strict();

/**
 * GET /api/economics/analyses
 * List all analyses for organization
 */
router.get(
  '/analyses',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { status, search, projectId, initiativeId, analysisType } = req.query;

    try {
      let sql = `
        SELECT da.*, 
               p.name as project_name,
               i.name as initiative_name,
               i.title as initiative_title,
               af.npv as financial_npv,
               af.roi_percent as financial_roi,
               af.currency as financial_currency,
               u.first_name, u.last_name
        FROM digitization_analyses da
        LEFT JOIN projects p ON da.project_id = p.id
        LEFT JOIN initiatives i ON da.initiative_id = i.id
        LEFT JOIN analysis_financials af ON af.analysis_id = da.id
        LEFT JOIN users u ON da.created_by = u.id
        WHERE da.organization_id = ?
      `;
      const params: any[] = [orgId];

      if (status && status !== 'all') {
        sql += ' AND UPPER(da.status) = ?';
        params.push(normalizeAnalysisStatus(String(status)));
      }

      if (search) {
        sql += ' AND (da.name LIKE ? OR da.description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      if (projectId) {
        sql += ' AND da.project_id = ?';
        params.push(projectId);
      }

      if (initiativeId) {
        sql += ' AND da.initiative_id = ?';
        params.push(initiativeId);
      }

      if (analysisType) {
        sql += ' AND da.analysis_type = ?';
        params.push(analysisType);
      }

      sql += ' ORDER BY da.created_at DESC';

      // M08-H03 — DEGRADED, not silent. `analysis_financials` is an optional
      // enrichment join; when the table is missing the whole SELECT raised
      // 42P01 and `fallback: true` turned it into `[]`, so the analyses list
      // looked empty instead of broken. Now: run the full query fail-closed and,
      // if only that table is missing, retry WITHOUT the join so the list still
      // works — and say so via `financialsDegraded`.
      let financialsDegraded = false;
      let rows: any[];
      try {
        rows = await dbAll<any>(sql, params, { fallback: false });
      } catch (error) {
        if (!isMissingRelationError(error)) throw error;
        financialsDegraded = true;
        const degradedSql = sql
          .replace(/LEFT JOIN analysis_financials af ON af\.analysis_id = da\.id\s*/g, '')
          .replace(/af\.[a-z_]+ as (financial_[a-z_]+)/g, 'NULL as $1');
        rows = await dbAll<any>(degradedSql, params, { fallback: false });
      }

      const analyses = rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: normalizeAnalysisStatus(row.status),
        projectId: row.project_id,
        projectName: row.project_name,
        initiativeId: row.initiative_id,
        initiativeName: row.initiative_title || row.initiative_name,
        analysisType: row.analysis_type,
        organizationId: row.organization_id,
        createdBy: row.created_by,
        createdByName:
          row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : 'Unknown',
        overallScore: row.overall_score,
        completionPercent: row.completion_percent || 0,
        axisScores: safeJsonParse(row.axis_scores, {}),
        npv: row.financial_npv,
        roi: row.financial_roi,
        // FIN-006/A O2: af.currency is nullable when an analysis has no
        // analysis_financials row yet; EUR (not PLN) is the neutral fallback
        // here — PLN was never a deliberate default for financial analyses,
        // it only ever leaked in from an unrelated schema DEFAULT elsewhere.
        currency: row.financial_currency || 'EUR',
        importedFrom: row.imported_from,
        importDate: row.import_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return res.json({
        analyses,
        total: analyses.length,
        // M08-H03 — tell the client when the financial enrichment join was
        // dropped, so an incomplete list is never mistaken for a complete one.
        ...(financialsDegraded ? { financialsDegraded: true } : {}),
      });
    } catch (error: any) {
      // M08-H03 — this catch used to answer `{ analyses: [], total: 0 }`, i.e.
      // a failed query was indistinguishable from an empty organization. A
      // read failure is now reported as a failure.
      logger.error('[Economics] Error fetching analyses:', error);
      return res.status(500).json({
        error: 'ANALYSES_READ_FAILED',
        message: 'Nie udało się wczytać listy analiz. To błąd odczytu, nie pusta lista.',
      });
    }
  })
);

logger.info('[Economics Routes] After /analyses route. Stack length:', router.stack?.length);

/**
 * GET /api/economics/stats
 * Get catalog statistics
 */
router.get(
  '/stats',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const total = await dbGet<{ count: number }>(
        `SELECT COUNT(*) as count FROM digitization_analyses WHERE organization_id = ?`,
        [orgId]
      );

      const draft = await dbGet<{ count: number }>(
        `SELECT COUNT(*) as count FROM digitization_analyses WHERE organization_id = ? AND UPPER(status) = 'DRAFT'`,
        [orgId]
      );

      const inProgress = await dbGet<{ count: number }>(
        `SELECT COUNT(*) as count FROM digitization_analyses WHERE organization_id = ? AND UPPER(status) = 'REVIEW'`,
        [orgId]
      );

      const completed = await dbGet<{ count: number }>(
        `SELECT COUNT(*) as count FROM digitization_analyses WHERE organization_id = ? AND UPPER(status) = 'APPROVED'`,
        [orgId]
      );

      const avgScore = await dbGet<{ avg: number }>(
        `SELECT AVG(overall_score) as avg FROM digitization_analyses WHERE organization_id = ? AND overall_score IS NOT NULL`,
        [orgId]
      );

      return res.json({
        total: total?.count || 0,
        draft: draft?.count || 0,
        inProgress: inProgress?.count || 0,
        completed: completed?.count || 0,
        avgScore: avgScore?.avg || 0,
        avgCompletion: 0,
      });
    } catch (error: any) {
      logger.error('[Economics] Error fetching stats:', error);
      return res.json({
        total: 0,
        draft: 0,
        inProgress: 0,
        completed: 0,
        avgScore: 0,
        avgCompletion: 0,
      });
    }
  })
);

/**
 * POST /api/economics/analyses
 * Create new analysis
 */
router.post(
  '/analyses',
  verifyToken,
  validateBody(createAnalysisSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, description, projectId, initiativeId, analysisType } = req.body;

    const id = uuidv4();
    const now = new Date().toISOString();

    try {
      await dbRun(
        `INSERT INTO digitization_analyses (
          id, name, description, status, project_id, initiative_id, analysis_type, organization_id, created_by,
          overall_score, completion_percent, axis_scores, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          name,
          description || null,
          normalizeStatusForDb('DRAFT'),
          projectId || null,
          initiativeId || null,
          analysisType || 'financial',
          orgId,
          userId,
          null,
          0,
          '{}',
          now,
          now,
        ]
      );

      return res.status(201).json({
        success: true,
        analysis: {
          id,
          name,
          description,
          status: 'DRAFT',
          projectId,
          initiativeId,
          analysisType: analysisType || 'financial',
          organizationId: orgId,
          createdBy: userId,
          overallScore: null,
          completionPercent: 0,
          axisScores: {},
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (error: any) {
      logger.error('[Economics] Error creating analysis:', error);
      return res.status(500).json({ error: 'Failed to create analysis' });
    }
  })
);

/**
 * GET /api/economics/analyses/:id
 * Get single analysis
 */
router.get(
  '/analyses/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const row = await dbGet<any>(
        `SELECT da.*, p.name as project_name, i.name as initiative_name, i.title as initiative_title,
         af.npv as financial_npv, af.roi_percent as financial_roi, af.currency as financial_currency,
         u.first_name, u.last_name
         FROM digitization_analyses da
         LEFT JOIN projects p ON da.project_id = p.id
         LEFT JOIN initiatives i ON da.initiative_id = i.id
         LEFT JOIN analysis_financials af ON af.analysis_id = da.id
         LEFT JOIN users u ON da.created_by = u.id
         WHERE da.id = ? AND da.organization_id = ?`,
        [id, orgId]
      );

      if (!row) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      return res.json({
        id: row.id,
        name: row.name,
        description: row.description,
        status: normalizeAnalysisStatus(row.status),
        projectId: row.project_id,
        projectName: row.project_name,
        initiativeId: row.initiative_id,
        initiativeName: row.initiative_title || row.initiative_name,
        analysisType: row.analysis_type,
        organizationId: row.organization_id,
        createdBy: row.created_by,
        createdByName:
          row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : 'Unknown',
        overallScore: row.overall_score,
        completionPercent: row.completion_percent || 0,
        axisScores: safeJsonParse(row.axis_scores, {}),
        npv: row.financial_npv,
        roi: row.financial_roi,
        // FIN-006/A O2: same neutral fallback as GET /analyses (list).
        currency: row.financial_currency || 'EUR',
        importedFrom: row.imported_from,
        importDate: row.import_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    } catch (error: any) {
      logger.error('[Economics] Error fetching analysis:', error);
      return res.status(500).json({ error: 'Failed to fetch analysis' });
    }
  })
);

/**
 * PUT /api/economics/analyses/:id
 * Update analysis
 */
router.put(
  '/analyses/:id',
  verifyToken,
  validateBody(updateAnalysisSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const { id } = req.params;
    const {
      name,
      description,
      status,
      axisScores,
      overallScore,
      completionPercent,
      projectId,
      initiativeId,
      analysisType,
    } = req.body;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const existing = await dbGet<any>(
        'SELECT id FROM digitization_analyses WHERE id = ? AND organization_id = ?',
        [id, orgId]
      );

      if (!existing) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      if (status !== undefined) {
        updates.push('status = ?');
        params.push(normalizeStatusForDb(status));
      }
      if (projectId !== undefined) {
        updates.push('project_id = ?');
        params.push(projectId);
      }
      if (initiativeId !== undefined) {
        updates.push('initiative_id = ?');
        params.push(initiativeId);
      }
      if (analysisType !== undefined) {
        updates.push('analysis_type = ?');
        params.push(analysisType);
      }
      if (axisScores !== undefined) {
        updates.push('axis_scores = ?');
        params.push(JSON.stringify(axisScores));
      }
      if (overallScore !== undefined) {
        updates.push('overall_score = ?');
        params.push(overallScore);
      }
      if (completionPercent !== undefined) {
        updates.push('completion_percent = ?');
        params.push(completionPercent);
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);

      await dbRun(`UPDATE digitization_analyses SET ${updates.join(', ')} WHERE id = ?`, params);

      return res.json({ success: true, message: 'Analysis updated' });
    } catch (error: any) {
      logger.error('[Economics] Error updating analysis:', error);
      return res.status(500).json({ error: 'Failed to update analysis' });
    }
  })
);

/**
 * POST /api/economics/analyses/:id/link-initiative
 * Link analysis to initiative
 */
router.post(
  '/analyses/:id/link-initiative',
  verifyToken,
  validateBody(linkInitiativeSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    const { id } = req.params;
    const { initiativeId } = req.body;

    if (!orgId || !initiativeId) {
      return res.status(400).json({ error: 'initiativeId is required' });
    }

    const initiative = await dbGet<any>(
      'SELECT id, project_id FROM initiatives WHERE id = ? AND organization_id = ?',
      [initiativeId, orgId]
    );

    if (!initiative) {
      return res.status(404).json({ error: 'Initiative not found' });
    }

    await dbRun(
      `UPDATE digitization_analyses SET initiative_id = ?, project_id = COALESCE(project_id, ?), updated_at = ? WHERE id = ? AND organization_id = ?`,
      [initiativeId, initiative.project_id || null, new Date().toISOString(), id, orgId]
    );

    const existingFinancials = await dbGet<any>(
      `SELECT id FROM analysis_financials WHERE analysis_id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (existingFinancials) {
      await dbRun(
        `UPDATE analysis_financials SET initiative_id = ?, updated_at = ? WHERE analysis_id = ? AND organization_id = ?`,
        [initiativeId, new Date().toISOString(), id, orgId]
      );
    } else {
      await dbRun(
        `INSERT INTO analysis_financials (
          id, analysis_id, initiative_id, organization_id,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          id,
          initiativeId,
          orgId,
          userId || null,
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );
    }

    return res.json({ success: true, initiativeId });
  })
);

/**
 * GET /api/economics/analyses/:id/financials
 * Get financial data for analysis
 */
router.get(
  '/analyses/:id/financials',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const row = await dbGet<any>(
      `SELECT * FROM analysis_financials WHERE analysis_id = ? AND organization_id = ?`,
      [id, orgId]
    );

    if (!row) {
      return res.json({ ...defaultFinancialData });
    }

    const financialData: FinancialData = {
      initialInvestment: row.initial_investment || 0,
      implementationCost: row.implementation_cost || 0,
      annualOperatingCost: row.annual_operating_cost || 0,
      trainingCost: row.training_cost || 0,
      contingencyPercent: row.contingency_percent ?? 15,
      annualCostSavings: row.annual_cost_savings || 0,
      annualRevenueIncrease: row.annual_revenue_increase || 0,
      productivityGainsPercent: row.productivity_gains_percent || 0,
      riskReductionValue: row.risk_reduction_value || 0,
      implementationMonths: row.implementation_months || 12,
      benefitRealizationMonths: row.benefit_realization_months || 6,
      analysisHorizonYears: row.analysis_horizon_years || 5,
      discountRate: row.discount_rate || 10,
      // FIN-006/A O2: same reasoning as GET/PUT /economics/analyses (list &
      // detail) — EUR is the neutral fallback, PLN was never a deliberate
      // default for financial analyses.
      currency: row.currency || 'EUR',
      assumptions: safeJsonParse(row.assumptions, []),
    };

    return res.json(financialData);
  })
);

/**
 * PUT /api/economics/analyses/:id/financials
 * Update financial data for analysis
 */
router.put(
  '/analyses/:id/financials',
  verifyToken,
  validateBody(updateFinancialsSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const analysis = await dbGet<any>(
      'SELECT id, initiative_id FROM digitization_analyses WHERE id = ? AND organization_id = ?',
      [id, orgId]
    );
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    let financialData = req.body?.financialData
      ? normalizeFinancialData(req.body.financialData)
      : normalizeFinancialData({});

    if (!req.body?.financialData) {
      const costItems = Array.isArray(req.body?.costs) ? req.body.costs : [];
      const benefitItems = Array.isArray(req.body?.benefits) ? req.body.benefits : [];

      const findCost = (match: RegExp, fallbackYear?: number) =>
        costItems.find((c: any) => match.test(String(c.description || ''))) ||
        (fallbackYear !== undefined
          ? costItems.find((c: any) => c.year === fallbackYear)
          : undefined);

      const initial = findCost(/inwestycja|capex|initial/i, 0);
      const implementation = findCost(/wdroż|implement/i);
      const training = findCost(/szkol|training/i);
      const operating = findCost(/opex|operac|operating/i, 1);

      const annualSavings = benefitItems.find((b: any) =>
        /oszcz|savings/i.test(String(b.description || ''))
      );
      const annualRevenue = benefitItems.find((b: any) =>
        /przych|revenue/i.test(String(b.description || ''))
      );

      financialData = {
        ...financialData,
        initialInvestment: initial?.amount ?? financialData.initialInvestment,
        implementationCost: implementation?.amount ?? financialData.implementationCost,
        trainingCost: training?.amount ?? financialData.trainingCost,
        annualOperatingCost: operating?.amount ?? financialData.annualOperatingCost,
        annualCostSavings: annualSavings?.amount ?? financialData.annualCostSavings,
        annualRevenueIncrease: annualRevenue?.amount ?? financialData.annualRevenueIncrease,
        discountRate: req.body?.discountRate ?? financialData.discountRate,
        analysisHorizonYears: req.body?.investmentHorizon ?? financialData.analysisHorizonYears,
      };
    }

    const insights = validateFinancialData(financialData);
    if (insights.errors.length > 0) {
      return res.status(400).json({
        error: 'Invalid financial data',
        details: insights.errors,
        warnings: insights.warnings,
      });
    }

    const metrics = calculateFinancialMetrics(financialData);
    const warnings = [...insights.warnings];
    if (metrics.paybackPeriod === null) {
      warnings.push('Payback period not achieved within analysis horizon.');
    }
    if (metrics.cashFlows.some((flow) => flow.year > 0 && flow.netCashFlow < 0)) {
      warnings.push('Negative net cashflow detected after year 0.');
    }
    const now = new Date().toISOString();
    const cashFlowJson = JSON.stringify(metrics.cashFlows || []);
    const assumptionsJson = JSON.stringify(financialData.assumptions || []);

    const existing = await dbGet<any>(
      `SELECT id FROM analysis_financials WHERE analysis_id = ? AND organization_id = ?`,
      [id, orgId]
    );

    if (existing) {
      await dbRun(
        `UPDATE analysis_financials SET
          initiative_id = COALESCE(initiative_id, ?),
          initial_investment = ?, implementation_cost = ?, annual_operating_cost = ?, training_cost = ?,
          contingency_percent = ?, annual_cost_savings = ?, annual_revenue_increase = ?, productivity_gains_percent = ?,
          risk_reduction_value = ?, implementation_months = ?, benefit_realization_months = ?,
          analysis_horizon_years = ?, discount_rate = ?, currency = ?, assumptions = ?, cash_flow_projections = ?,
          npv = ?, irr = ?, payback_months = ?, roi_percent = ?,
          last_calculated_at = ?, updated_at = ?
         WHERE analysis_id = ? AND organization_id = ?`,
        [
          analysis.initiative_id || null,
          financialData.initialInvestment,
          financialData.implementationCost,
          financialData.annualOperatingCost,
          financialData.trainingCost,
          financialData.contingencyPercent,
          financialData.annualCostSavings,
          financialData.annualRevenueIncrease,
          financialData.productivityGainsPercent,
          financialData.riskReductionValue,
          financialData.implementationMonths,
          financialData.benefitRealizationMonths,
          financialData.analysisHorizonYears,
          financialData.discountRate,
          financialData.currency,
          assumptionsJson,
          cashFlowJson,
          metrics.npv,
          metrics.irr,
          metrics.paybackPeriod,
          metrics.roi,
          now,
          now,
          id,
          orgId,
        ]
      );
    } else {
      await dbRun(
        `INSERT INTO analysis_financials (
          id, analysis_id, initiative_id, organization_id,
          initial_investment, implementation_cost, annual_operating_cost, training_cost, contingency_percent,
          annual_cost_savings, annual_revenue_increase, productivity_gains_percent, risk_reduction_value,
          implementation_months, benefit_realization_months, analysis_horizon_years, discount_rate,
          npv, irr, payback_months, roi_percent, currency, assumptions, cash_flow_projections,
          created_by, created_at, updated_at, last_calculated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          id,
          analysis.initiative_id || null,
          orgId,
          financialData.initialInvestment,
          financialData.implementationCost,
          financialData.annualOperatingCost,
          financialData.trainingCost,
          financialData.contingencyPercent,
          financialData.annualCostSavings,
          financialData.annualRevenueIncrease,
          financialData.productivityGainsPercent,
          financialData.riskReductionValue,
          financialData.implementationMonths,
          financialData.benefitRealizationMonths,
          financialData.analysisHorizonYears,
          financialData.discountRate,
          metrics.npv,
          metrics.irr,
          metrics.paybackPeriod,
          metrics.roi,
          financialData.currency,
          assumptionsJson,
          cashFlowJson,
          userId || null,
          now,
          now,
          now,
        ]
      );
    }

    await dbRun(`UPDATE digitization_analyses SET updated_at = ? WHERE id = ?`, [now, id]);

    const scenarioTypes = ['base', 'optimistic', 'conservative'];
    const scenarioSummaries: Array<{
      scenarioType: string;
      npv: number | null;
      roi: number | null;
    }> = [];
    try {
      for (const scenarioType of scenarioTypes) {
        const scenarioData =
          scenarioType === 'base'
            ? financialData
            : applyScenarioAdjustments(financialData, scenarioType);
        const scenarioMetrics = calculateFinancialMetrics(scenarioData);
        scenarioSummaries.push({
          scenarioType,
          npv: scenarioMetrics.npv ?? null,
          roi: scenarioMetrics.roi ?? null,
        });
        // M08-H01 — fail closed. Previously this read (and both writes below) ran
        // with the default `fallback: true`, so a missing table resolved quietly
        // and the handler still answered `success: true` at the end.
        const scenarioRow = await financeWrite('analysis_financial_scenarios', () =>
          dbGet<any>(
            `SELECT id FROM analysis_financial_scenarios WHERE analysis_id = ? AND scenario_type = ?`,
            [id, scenarioType],
            { fallback: false }
          )
        );

        if (scenarioRow) {
          await financeWrite('analysis_financial_scenarios', () =>
            dbRun(
              `UPDATE analysis_financial_scenarios SET
            financial_data = ?, metrics = ?, updated_at = ?
           WHERE id = ?`,
              [
                JSON.stringify(scenarioData),
                JSON.stringify({
                  npv: scenarioMetrics.npv,
                  irr: scenarioMetrics.irr,
                  roi: scenarioMetrics.roi,
                  paybackPeriod: scenarioMetrics.paybackPeriod,
                  cashFlows: scenarioMetrics.cashFlows,
                }),
                now,
                scenarioRow.id,
              ],
              { fallback: false }
            )
          );
        } else {
          await financeWrite('analysis_financial_scenarios', () =>
            dbRun(
              `INSERT INTO analysis_financial_scenarios (
            id, analysis_id, organization_id, scenario_type, name, assumptions, financial_data, metrics, is_active, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                uuidv4(),
                id,
                orgId,
                scenarioType,
                scenarioType === 'base'
                  ? 'Base'
                  : scenarioType === 'optimistic'
                    ? 'Optimistic'
                    : 'Conservative',
                JSON.stringify(financialData.assumptions || []),
                JSON.stringify(scenarioData),
                JSON.stringify({
                  npv: scenarioMetrics.npv,
                  irr: scenarioMetrics.irr,
                  roi: scenarioMetrics.roi,
                  paybackPeriod: scenarioMetrics.paybackPeriod,
                  cashFlows: scenarioMetrics.cashFlows,
                }),
                scenarioType === 'base' ? 1 : 0,
                userId || null,
                now,
                now,
              ],
              { fallback: false }
            )
          );
        }
      }
    } catch (error) {
      // M08-H01 — the scenario table is missing: answer honestly instead of
      // reporting a save that did not happen.
      if (error instanceof FinanceStorageUnavailableError) {
        return respondFinanceStorageUnavailable(res, error);
      }
      throw error;
    }

    const recommendedScenario = scenarioSummaries.reduce(
      (best, current) => {
        if (best === null) return current;
        if ((current.npv ?? -Infinity) > (best.npv ?? -Infinity)) return current;
        return best;
      },
      null as { scenarioType: string; npv: number | null; roi: number | null } | null
    );

    return res.json({
      success: true,
      metrics,
      warnings,
      recommendations: insights.recommendations,
      scenarioRecommendation: recommendedScenario
        ? {
            scenarioType: recommendedScenario.scenarioType,
            reason: 'Highest NPV across scenarios',
          }
        : null,
    });
  })
);

/**
 * GET /api/economics/analyses/:id/scenarios
 * List financial scenarios for analysis
 */
router.get(
  '/analyses/:id/scenarios',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const scenarios = await dbAll<any>(
      `SELECT * FROM analysis_financial_scenarios WHERE analysis_id = ? AND organization_id = ? ORDER BY scenario_type`,
      [id, orgId]
    );

    const normalized = scenarios.map((row) => ({
      id: row.id,
      scenarioType: row.scenario_type,
      name: row.name,
      assumptions: safeJsonParse(row.assumptions, []),
      financialData: safeJsonParse(row.financial_data, {}),
      metrics: safeJsonParse(row.metrics, {}),
      isActive: flagOn(row.is_active),
      updatedAt: row.updated_at,
    }));

    return res.json({ scenarios: normalized });
  })
);

/**
 * POST /api/economics/analyses/:id/scenarios
 * Upsert a scenario
 */
router.post(
  '/analyses/:id/scenarios',
  verifyToken,
  validateBody(upsertScenarioSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    const { id } = req.params;
    const { scenarioType, name, financialData: rawFinancialData } = req.body || {};

    if (!orgId || !scenarioType) {
      return res.status(400).json({ error: 'scenarioType is required' });
    }

    const analysis = await dbGet<any>(
      'SELECT id FROM digitization_analyses WHERE id = ? AND organization_id = ?',
      [id, orgId]
    );

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const scenarioData = rawFinancialData
      ? normalizeFinancialData(rawFinancialData)
      : normalizeFinancialData({});
    const metrics = calculateFinancialMetrics(scenarioData);
    const now = new Date().toISOString();

    const existing = await dbGet<any>(
      `SELECT id FROM analysis_financial_scenarios WHERE analysis_id = ? AND scenario_type = ? AND organization_id = ?`,
      [id, scenarioType, orgId]
    );

    if (existing) {
      await dbRun(
        `UPDATE analysis_financial_scenarios SET
          name = ?, assumptions = ?, financial_data = ?, metrics = ?, updated_at = ?
         WHERE id = ? AND organization_id = ?`,
        [
          name || scenarioType,
          JSON.stringify(scenarioData.assumptions || []),
          JSON.stringify(scenarioData),
          JSON.stringify({
            npv: metrics.npv,
            irr: metrics.irr,
            roi: metrics.roi,
            paybackPeriod: metrics.paybackPeriod,
            cashFlows: metrics.cashFlows,
          }),
          now,
          existing.id,
          orgId,
        ]
      );
      return res.json({ success: true, scenarioId: existing.id });
    }

    const scenarioId = uuidv4();
    await dbRun(
      `INSERT INTO analysis_financial_scenarios (
        id, analysis_id, organization_id, scenario_type, name, assumptions, financial_data, metrics, is_active, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scenarioId,
        id,
        orgId,
        scenarioType,
        name || scenarioType,
        JSON.stringify(scenarioData.assumptions || []),
        JSON.stringify(scenarioData),
        JSON.stringify({
          npv: metrics.npv,
          irr: metrics.irr,
          roi: metrics.roi,
          paybackPeriod: metrics.paybackPeriod,
          cashFlows: metrics.cashFlows,
        }),
        0,
        userId || null,
        now,
        now,
      ]
    );

    return res.json({ success: true, scenarioId });
  })
);

/**
 * POST /api/economics/analyses/:id/scenarios/:scenarioId/activate
 * Set active scenario
 */
router.post(
  '/analyses/:id/scenarios/:scenarioId/activate',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const { id, scenarioId } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await dbRun(
      `UPDATE analysis_financial_scenarios SET is_active = 0 WHERE analysis_id = ? AND organization_id = ?`,
      [id, orgId]
    );
    await dbRun(
      `UPDATE analysis_financial_scenarios SET is_active = 1, updated_at = ? WHERE id = ? AND analysis_id = ? AND organization_id = ?`,
      [new Date().toISOString(), scenarioId, id, orgId]
    );

    return res.json({ success: true, scenarioId });
  })
);

/**
 * GET /api/economics/analyses/:id/benefits
 * Get benefit tracking data
 */
router.get(
  '/analyses/:id/benefits',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const analysis = await dbGet<any>(
      'SELECT id, initiative_id FROM digitization_analyses WHERE id = ? AND organization_id = ?',
      [id, orgId]
    );

    if (!analysis?.initiative_id) {
      return res.json({ benefits: [] });
    }

    const benefits = await dbAll<any>(
      `SELECT * FROM benefit_tracking WHERE organization_id = ? AND initiative_id = ? ORDER BY created_at ASC`,
      [orgId, analysis.initiative_id]
    );

    const mapped = benefits.map((row) => ({
      id: row.id,
      analysisId: id,
      trackingPeriod: row.tracking_period || row.period_start,
      plannedBenefits: row.planned_cost_savings || 0,
      actualBenefits: row.actual_cost_savings || 0,
      variance: (row.actual_cost_savings || 0) - (row.planned_cost_savings || 0),
      trackedAt: row.created_at,
    }));

    return res.json({ benefits: mapped });
  })
);

/**
 * PUT /api/economics/analyses/:id/benefits
 * Upsert benefit tracking data
 */
router.put(
  '/analyses/:id/benefits',
  verifyToken,
  validateBody(updateBenefitsSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const analysis = await dbGet<any>(
      'SELECT id, initiative_id FROM digitization_analyses WHERE id = ? AND organization_id = ?',
      [id, orgId]
    );

    if (!analysis?.initiative_id) {
      return res.status(400).json({ error: 'Analysis must be linked to an initiative' });
    }

    const trackingPeriod = req.body?.trackingPeriod;
    const plannedBenefits = Number(req.body?.plannedBenefits || 0);
    const actualBenefits = Number(req.body?.actualBenefits || 0);
    const now = new Date().toISOString();

    if (!trackingPeriod) {
      return res.status(400).json({ error: 'trackingPeriod is required' });
    }

    // ROI-E007 Stream C — `benefit_tracking.actual_*` is physically
    // append-only since
    // `server/migrations/20260809_finance_v3_e007_03_legacy_actual_protection.sql`
    // (`trg_benefit_tracking_deny_actual_overwrite`). This handler's old
    // UPDATE branch set `actual_cost_savings = ?` unconditionally on an
    // existing period row — before that migration it SILENTLY OVERWROTE a
    // previously recorded actual (the exact "cichy overwrite" ROI-E007
    // exists to close), and after it the trigger raises, which this handler
    // surfaced as a bare 500 (its try/catch only special-cases
    // `FinanceStorageUnavailableError`). Neither is acceptable.
    //
    // The rule now: a recorded actual is never re-written and never
    // destroyed. When the request carries a DIFFERENT actual, that column is
    // left out of the UPDATE entirely (every other column in the request is
    // still saved), and the disagreement is routed to the canonical
    // ROI/Finance seam as a reconciliation record. If there is nowhere to
    // record it — no active ROI case for this initiative, or no finance link
    // on that case — the caller is told so explicitly (409) rather than
    // getting a success it did not receive or a 500 it cannot act on.
    let actualWriteRejected = false;
    let storedActualBenefits = actualBenefits;
    let existingRow: { id: string; actual_cost_savings: number | null } | null = null;

    /** Recognises `trg_benefit_tracking_deny_actual_overwrite`'s own
     * `RAISE EXCEPTION` (SQLSTATE P0001, message pinned by the migration).
     * Local to this handler — it is the only call site, and nothing else in
     * this router touches the protected columns. */
    const isBenefitTrackingActualProtectionError = (error: unknown): boolean => {
      const message = error instanceof Error ? error.message : String(error ?? '');
      return /benefit_tracking\.actual_\*? is append-only|benefit_tracking is append-only/i.test(
        message
      );
    };

    // M08-H02 — fail closed. Both writes previously ran with the default
    // `fallback: true`, so a missing `benefit_tracking` table was swallowed and
    // the handler still answered `{ success: true }` for a row never written.
    try {
      const existing = await financeWrite('benefit_tracking', () =>
        dbGet<any>(
          `SELECT id, actual_cost_savings FROM benefit_tracking WHERE organization_id = ? AND initiative_id = ? AND tracking_period = ?`,
          [orgId, analysis.initiative_id, trackingPeriod],
          { fallback: false }
        )
      );
      existingRow = existing ?? null;

      if (existing) {
        // Compare against what is ALREADY stored — the trigger's own
        // `IS DISTINCT FROM` semantics, evaluated before we build the SQL so
        // the protected column is never named in an UPDATE that would trip it.
        const currentActual = Number(existing.actual_cost_savings ?? 0);
        actualWriteRejected = currentActual !== actualBenefits;
        storedActualBenefits = actualWriteRejected ? currentActual : actualBenefits;
      }
    } catch (error) {
      if (error instanceof FinanceStorageUnavailableError) {
        return respondFinanceStorageUnavailable(res, error);
      }
      throw error;
    }

    // Variance is derived from the value that will actually be STORED, not
    // from the rejected one — writing a variance computed against a number
    // the row does not hold would be a quieter version of the same lie.
    const variancePercent =
      plannedBenefits > 0 ? ((storedActualBenefits - plannedBenefits) / plannedBenefits) * 100 : 0;

    // ── Divergence path: record it on the canonical seam BEFORE mutating
    // anything, so a caller that gets 409 knows nothing at all changed. ──
    if (actualWriteRejected) {
      let target: Awaited<ReturnType<typeof findReconciliationTargetForInitiative>>;
      try {
        target = await findReconciliationTargetForInitiative({
          organizationId: orgId,
          initiativeId: analysis.initiative_id,
          userId: userId || '',
        });
      } catch (error) {
        logger.error('[economics] reconciliation target lookup failed', {
          initiativeId: analysis.initiative_id,
          error: error instanceof Error ? error.message : String(error),
        });
        return res.status(503).json({
          success: false,
          error: 'ROI_RECONCILIATION_STORAGE_UNAVAILABLE',
          actualBenefitsWriteRejected: true,
          storedActualBenefits,
          requestedActualBenefits: actualBenefits,
          message:
            'Nie udało się sprawdzić powiązanego ROI Case — nic nie zostało zapisane, ' +
            'zarejestrowana wartość rzeczywista pozostaje niezmieniona.',
        });
      }

      if (!target.target) {
        return res.status(409).json({
          success: false,
          error: 'ROI_RECONCILIATION_TARGET_MISSING',
          reason: target.missingReason,
          actualBenefitsWriteRejected: true,
          storedActualBenefits,
          requestedActualBenefits: actualBenefits,
          message:
            target.missingReason === 'NO_ACTIVE_ROI_CASE'
              ? 'Brak powiązanego ROI Case — wartość niezmieniona. Zarejestrowanej wartości ' +
                'rzeczywistej nie można nadpisać; załóż ROI Case dla tej inicjatywy, aby ' +
                'zapisać rozbieżność.'
              : 'Brak powiązanego ROI Case — wartość niezmieniona. ROI Case istnieje, ale nie ' +
                'ma powiązania z artefaktem Finance; dodaj powiązanie, aby zapisać rozbieżność.',
        });
      }

      // A legacy benefit_tracking scalar is not a Results Actual identity.
      // Creating a canonical reconciliation from it would produce an
      // untraceable proposal that could never be cold-replayed.  The caller
      // must first publish an immutable Results Actual snapshot and use the
      // canonical Results reconciliation command.
      return res.status(409).json({
        success: false,
        error: 'RESULTS_ACTUAL_SOURCE_REQUIRED',
        status: 'NEEDS_DECISION',
        actualBenefitsWriteRejected: true,
        storedActualBenefits,
        requestedActualBenefits: actualBenefits,
        canonicalSuccessor: `/api/vnext/results/roi/cases/${target.target.caseId}/finance-reconciliations`,
        message:
          'Wartość rzeczywista pozostaje niezmieniona. Opublikuj snapshot Actual w Results ' +
          'i otwórz uzgodnienie z jego dokładnym identyfikatorem.',
      });
    }

    try {
      const existing = existingRow;

      if (existing) {
        // `actual_cost_savings` is named in the UPDATE only when it is
        // unchanged (a no-op for the trigger's `IS DISTINCT FROM` check);
        // on the divergence path it is omitted, so the recorded actual
        // survives while planned/variance/updated_at still save.
        const updateSql = actualWriteRejected
          ? `UPDATE benefit_tracking SET
          planned_cost_savings = ?, overall_variance_percent = ?, updated_at = ?
         WHERE id = ?`
          : `UPDATE benefit_tracking SET
          planned_cost_savings = ?, actual_cost_savings = ?, overall_variance_percent = ?, updated_at = ?
         WHERE id = ?`;
        const updateParams = actualWriteRejected
          ? [plannedBenefits, variancePercent, now, existing.id]
          : [plannedBenefits, actualBenefits, variancePercent, now, existing.id];

        await financeWrite('benefit_tracking', () =>
          dbRun(updateSql, updateParams, { fallback: false })
        );
      } else {
        await financeWrite('benefit_tracking', () =>
          dbRun(
            `INSERT INTO benefit_tracking (
          id, financial_id, initiative_id, organization_id, period_start, period_end, tracking_period,
          planned_cost_savings, actual_cost_savings, overall_variance_percent, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              null,
              analysis.initiative_id,
              orgId,
              now,
              now,
              trackingPeriod,
              plannedBenefits,
              actualBenefits,
              variancePercent,
              userId || null,
              now,
              now,
            ],
            { fallback: false }
          )
        );
      }
    } catch (error) {
      if (error instanceof FinanceStorageUnavailableError) {
        return respondFinanceStorageUnavailable(res, error);
      }
      // Defence in depth: the pre-checks above mean the append-only trigger
      // should never fire from this handler, but a concurrent writer can
      // change `actual_cost_savings` between our SELECT and our UPDATE. Even
      // then the answer is an honest 409, never a 500 the caller cannot read.
      if (isBenefitTrackingActualProtectionError(error)) {
        logger.warn(
          '[economics] benefit_tracking actual_* protection tripped after pre-check (concurrent writer)',
          {
            initiativeId: analysis.initiative_id,
            trackingPeriod,
          }
        );
        return res.status(409).json({
          success: false,
          error: 'BENEFIT_ACTUAL_APPEND_ONLY',
          actualBenefitsWriteRejected: true,
          requestedActualBenefits: actualBenefits,
          message:
            'Zarejestrowana wartość rzeczywista zmieniła się równolegle — nic nie nadpisano. ' +
            'Odśwież dane i spróbuj ponownie.',
        });
      }
      throw error;
    }

    return res.json({ success: true });
  })
);

/**
 * POST /api/economics/analyses/:id/calculate-metrics
 * Calculate financial metrics for analysis
 */
router.post(
  '/analyses/:id/calculate-metrics',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const row = await dbGet<any>(
      `SELECT * FROM analysis_financials WHERE analysis_id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!row) {
      return res.status(404).json({ error: 'Financial data not found' });
    }

    const financialData: FinancialData = {
      initialInvestment: row.initial_investment || 0,
      implementationCost: row.implementation_cost || 0,
      annualOperatingCost: row.annual_operating_cost || 0,
      trainingCost: row.training_cost || 0,
      contingencyPercent: row.contingency_percent ?? 15,
      annualCostSavings: row.annual_cost_savings || 0,
      annualRevenueIncrease: row.annual_revenue_increase || 0,
      productivityGainsPercent: row.productivity_gains_percent || 0,
      riskReductionValue: row.risk_reduction_value || 0,
      implementationMonths: row.implementation_months || 12,
      benefitRealizationMonths: row.benefit_realization_months || 6,
      analysisHorizonYears: row.analysis_horizon_years || 5,
      discountRate: row.discount_rate || 10,
      // FIN-006/A O2: same neutral EUR fallback as the sibling
      // GET /analyses/:id/financials handler above (same source table/field).
      currency: row.currency || 'EUR',
      assumptions: safeJsonParse(row.assumptions, []),
    };

    const insights = validateFinancialData(financialData);
    const metrics = calculateFinancialMetrics(financialData);
    const warnings = [...insights.warnings];
    if (metrics.paybackPeriod === null) {
      warnings.push('Payback period not achieved within analysis horizon.');
    }
    if (metrics.cashFlows.some((flow) => flow.year > 0 && flow.netCashFlow < 0)) {
      warnings.push('Negative net cashflow detected after year 0.');
    }

    return res.json({
      npv: metrics.npv,
      irr: metrics.irr,
      paybackPeriod: metrics.paybackPeriod,
      roi: metrics.roi,
      warnings,
      recommendations: insights.recommendations,
      cashFlows: metrics.cashFlows.map((flow) => ({
        year: flow.year,
        amount: flow.netCashFlow,
      })),
    });
  })
);

/**
 * POST /api/economics/analyses/:id/business-case
 *
 * BUG-07 (fixed): this used to be a stub that returned `sections: []`
 * disguised as `status: 'generated'` — silently lying about doing work.
 * There is now a REAL business-case generator
 * (server/src/services/advisory/BusinessCaseService.ts, Oxford O4: 5-phase
 * PLAN → CONFIRM → MODEL (deterministic NPV/IRR/payback) → REVIEW
 * (anti-fabrication) → NARRATIVE pipeline), wired at
 * POST /api/v8/advisory/business-case. That endpoint takes a free-text
 * `prompt` describing the decision, not an analysis-row id — the two shapes
 * are not drop-in compatible, so rather than fabricate a mapping here this
 * route now fails LOUDLY and points the caller at the real one, instead of
 * silently returning an empty document.
 */
router.post(
  '/analyses/:id/business-case',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const analysis = await dbGet<any>(
      `SELECT * FROM digitization_analyses WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    return res.status(501).json({
      error: 'not_implemented',
      message:
        'Ten endpoint był stubem (BUG-07) i nie generuje już fałszywego pustego dokumentu. ' +
        'Prawdziwy generator business case jest dostępny pod POST /api/v8/advisory/business-case ' +
        '(przyjmuje opis decyzji w polu "prompt", nie id analizy).',
      replacement: {
        method: 'POST',
        path: '/api/v8/advisory/business-case',
        body: { prompt: 'string (required)', horizonYears: 'number?', waccPct: 'number?' },
      },
    });
  })
);

/**
 * POST /api/economics/analyses/:id/create-initiative
 * Create initiative from analysis
 */
router.post(
  '/analyses/:id/create-initiative',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const analysis = await dbGet<any>(
      `SELECT * FROM digitization_analyses WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const financials = await dbGet<any>(
      `SELECT * FROM analysis_financials WHERE analysis_id = ? AND organization_id = ?`,
      [id, orgId]
    );

    const now = new Date().toISOString();
    const costCapex =
      (financials?.initial_investment || 0) +
      (financials?.implementation_cost || 0) +
      (financials?.training_cost || 0);
    const costOpex = financials?.annual_operating_cost || 0;
    const expectedRoi = financials?.roi_percent ?? null;

    // F15 (data-integrity, continuation of Z139): decode HTML entities the
    // global sanitizer may have escaped on this title before it feeds
    // initiatives.title/name below (funnel branch AND raw-insert fallback —
    // INITIATIVE_FUNNEL_ENABLED is default ON).
    const decodedAnalysisName = decodeHtmlEntities(String(analysis.name || ''));

    // Uspójnienie F1.3 — przez kanoniczny lejek (DRAFT + name/title + lineage).
    let initiativeId: string;
    if (process.env.INITIATIVE_FUNNEL_ENABLED !== 'false') {
      const __r = await funnelCreateInitiative(
        orgId,
        {
          title: decodedAnalysisName,
          projectId: analysis.project_id || null,
          summary: analysis.description || null,
          costCapex,
          costOpex,
          expectedRoi,
          sourceType: 'financial_analysis',
          sourceId: id,
        },
        { validate: false, actor: { id: req.user?.id } }
      );
      initiativeId = __r.id;
    } else {
      initiativeId = uuidv4();
      // D1 (Zwornik §9 Faza 3): this raw-insert branch is the LIVE path
      // (INITIATIVE_FUNNEL_ENABLED defaults ON; explicit 'false' selects rollback) and did not anchor
      // project_id — auto-assign the org's system portfolio project instead
      // of persisting a silent orphan.
      const anchoredProjectId = await resolveInitiativeProjectId(orgId, analysis.project_id, {
        createdBy: req.user?.id ?? null,
      });
      // FIX (NOT-NULL sweep): initiatives.name is NOT NULL with no DB default
      // (Postgres) — this branch only wrote `title`, which 500s with 23502.
      await dbRun(
        `INSERT INTO initiatives (
        id, organization_id, project_id, title, name, summary, status, cost_capex, cost_opex, expected_roi, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          initiativeId,
          orgId,
          anchoredProjectId,
          decodedAnalysisName,
          decodedAnalysisName,
          analysis.description || null,
          normalizeStatusForDb('DRAFT'),
          costCapex,
          costOpex,
          expectedRoi,
          now,
          now,
        ]
      );
    }

    await dbRun(
      `UPDATE digitization_analyses SET initiative_id = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
      [initiativeId, now, id, orgId]
    );

    if (financials) {
      await dbRun(
        `UPDATE analysis_financials SET initiative_id = ?, updated_at = ? WHERE analysis_id = ? AND organization_id = ?`,
        [initiativeId, now, id, orgId]
      );
    }

    return res.status(201).json({
      success: true,
      initiativeId,
      message: 'Initiative created',
    });
  })
);

/**
 * POST /api/economics/analyses/:id/decisions
 * Create gate decision for analysis
 */
router.post(
  '/analyses/:id/decisions',
  verifyToken,
  validateBody(createDecisionSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    const { id } = req.params;
    const { decisionType, decisionMakerId } = req.body || {};

    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const analysis = await dbGet<any>(
      `SELECT * FROM digitization_analyses WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const makerId = decisionMakerId || userId;
    const type = decisionType === 'go-no-go' ? 'GO_NO_GO' : 'APPROVAL';
    const title =
      decisionType === 'go-no-go'
        ? `Investment Go/No-Go: ${analysis.name}`
        : decisionType === 'select-scenario'
          ? `Select Active Scenario: ${analysis.name}`
          : `Approve Analysis: ${analysis.name}`;
    const description =
      decisionType === 'select-scenario'
        ? 'Select the scenario to be used as active baseline for investment decision.'
        : 'Approve the financial analysis for investment review.';

    const options =
      decisionType === 'select-scenario'
        ? [
            { id: 'base', label: 'Base', description: 'Base scenario' },
            { id: 'optimistic', label: 'Optimistic', description: 'Optimistic scenario' },
            { id: 'conservative', label: 'Conservative', description: 'Conservative scenario' },
          ]
        : undefined;

    const decision = await decisionService.createDecision({
      organizationId: orgId,
      initiativeId: analysis.initiative_id || undefined,
      title,
      description,
      type,
      decisionMakerId: makerId,
      options,
      createdBy: userId,
    });

    return res.status(201).json({ success: true, decision });
  })
);

/**
 * GET /api/economics/analyses/:id/decisions
 * BUG-08: List decisions linked to an analysis (via initiative or direct)
 */
router.get(
  '/analyses/:id/decisions',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const analysis = await dbGet<any>(
        `SELECT id, initiative_id FROM digitization_analyses WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      let decisions: any[] = [];
      if (analysis.initiative_id) {
        try {
          decisions = await dbAll<any>(
            `SELECT id, title, description, type, status, created_at
             FROM decisions
             WHERE organization_id = ? AND initiative_id = ?
             ORDER BY created_at DESC`,
            [orgId, analysis.initiative_id]
          );
        } catch {
          // decisions table may not exist in all environments
          decisions = [];
        }
      }

      return res.json({ data: { decisions: decisions || [], count: (decisions || []).length } });
    } catch (error: any) {
      logger.error('[Economics] Error fetching decisions for analysis:', error);
      return res.json({ data: { decisions: [], count: 0 } });
    }
  })
);

/**
 * DELETE /api/economics/analyses/:id
 * Delete analysis
 */
router.delete(
  '/analyses/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const result = await dbRun(
        'DELETE FROM digitization_analyses WHERE id = ? AND organization_id = ?',
        [id, orgId]
      );

      if (!result.changes) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      return res.json({ success: true, message: 'Analysis deleted' });
    } catch (error: any) {
      logger.error('[Economics] Error deleting analysis:', error);
      return res.status(500).json({ error: 'Failed to delete analysis' });
    }
  })
);

/**
 * POST /api/economics/analyses/:id/duplicate
 * Duplicate an analysis
 */
router.post(
  '/analyses/:id/duplicate',
  verifyToken,
  validateBody(duplicateAnalysisSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    const { id } = req.params;
    const { name } = req.body;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const source = await dbGet<any>(
        'SELECT * FROM digitization_analyses WHERE id = ? AND organization_id = ?',
        [id, orgId]
      );

      if (!source) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      const newId = uuidv4();
      const now = new Date().toISOString();

      await dbRun(
        `INSERT INTO digitization_analyses (
          id, name, description, status, project_id, organization_id, created_by,
          overall_score, completion_percent, axis_scores, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          name || `${source.name} (Copy)`,
          source.description,
          normalizeStatusForDb(source.status),
          source.project_id,
          orgId,
          userId,
          source.overall_score,
          source.completion_percent,
          source.axis_scores,
          now,
          now,
        ]
      );

      return res.status(201).json({
        success: true,
        analysisId: newId,
        message: 'Analysis duplicated',
      });
    } catch (error: any) {
      logger.error('[Economics] Error duplicating analysis:', error);
      return res.status(500).json({ error: 'Failed to duplicate analysis' });
    }
  })
);

/**
 * GET /api/economics/analyses/:id/export
 * Export analysis to file
 */
router.get(
  '/analyses/:id/export',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const row = await dbGet<any>(
        'SELECT * FROM digitization_analyses WHERE id = ? AND organization_id = ?',
        [id, orgId]
      );

      if (!row) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      // Return data for client-side export
      return res.json({
        success: true,
        data: {
          id: row.id,
          name: row.name,
          description: row.description,
          status: normalizeAnalysisStatus(row.status),
          overallScore: row.overall_score,
          completionPercent: row.completion_percent,
          axisScores: safeJsonParse(row.axis_scores, {}),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        downloadUrl: null, // Client will generate file
      });
    } catch (error: any) {
      logger.error('[Economics] Error exporting analysis:', error);
      return res.status(500).json({ error: 'Failed to export analysis' });
    }
  })
);

/* T052 Financial Analysis */
router.post(
  '/financial-analyses',
  verifyToken,
  validateBody(createFinancialAnalysisSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const analysis = await finAnalysisSvc.createAnalysis(orgId, req.body, userId);
    return res.status(201).json({ success: true, analysis });
  })
);
router.get(
  '/financial-analyses',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const analyses = await finAnalysisSvc.listAnalyses(orgId, {
      status: req.query.status as string | undefined,
      projectId: req.query.projectId as string | undefined,
    });
    return res.json({ analyses });
  })
);
router.get(
  '/financial-analyses/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const a = await finAnalysisSvc.getAnalysis(orgId, req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    return res.json(a);
  })
);
router.put(
  '/financial-analyses/:id',
  verifyToken,
  validateBody(updateFinancialAnalysisSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    await finAnalysisSvc.updateAnalysis(orgId, req.params.id, req.body);
    return res.json({ success: true });
  })
);
router.post(
  '/financial-analyses/:id/run',
  verifyToken,
  economicsCutoverGuard,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await finAnalysisSvc.runFullAnalysis(orgId, req.params.id);
    return res.json({ success: true, result });
  })
);
router.post(
  '/financial-analyses/:id/approve',
  verifyToken,
  economicsCutoverGuard,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    await finAnalysisSvc.approveAnalysis(orgId, req.params.id, userId);
    return res.json({ success: true });
  })
);
router.get(
  '/financial-analyses/:id/ratios',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const analysisId = String(req.params.id);
    const analysis = await dbGet<any>(
      `SELECT id FROM financial_analyses WHERE id = ? AND organization_id = ?`,
      [analysisId, orgId]
    );
    if (!analysis) return res.status(404).json({ error: 'Not found' });
    const ratios = await finAnalysisSvc.getAnalysisRatios(analysisId);
    return res.json({ ratios });
  })
);
router.get(
  '/financial-analyses/:id/insights',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const analysisId = String(req.params.id);
    const analysis = await dbGet<any>(
      `SELECT id FROM financial_analyses WHERE id = ? AND organization_id = ?`,
      [analysisId, orgId]
    );
    if (!analysis) return res.status(404).json({ error: 'Not found' });
    const insights = await finAnalysisSvc.getAnalysisInsights(analysisId);
    return res.json({ insights });
  })
);

/**
 * POST /api/economics/financial-analyses/:id/insights
 * BUG-06: Generate AI insights for a financial analysis (stub — no real AI call)
 */
router.post(
  '/financial-analyses/:id/insights',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const analysisId = String(req.params.id);
    const analysis = await dbGet<any>(
      `SELECT id FROM financial_analyses WHERE id = ? AND organization_id = ?`,
      [analysisId, orgId]
    );
    if (!analysis) return res.status(404).json({ error: 'Not found' });
    const insightType = String((req.body as any)?.type || 'comprehensive');
    return res.json({
      data: {
        insight: {
          id: uuidv4(),
          type: insightType,
          status: 'generated',
          summary: 'Analiza gotowa',
          items: [],
        },
      },
    });
  })
);

/**
 * Export V3-I01: proposals for Initiatives (propose→accept)
 * GET /api/economics/financial-analyses/:id/initiative-proposals
 */
router.get(
  '/financial-analyses/:id/initiative-proposals',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const analysisId = String(req.params.id);
    const analysis = await dbGet<any>(
      `SELECT id, organization_id FROM financial_analyses WHERE id = ? AND organization_id = ?`,
      [analysisId, orgId]
    );
    if (!analysis) return res.status(404).json({ error: 'Not found' });

    const rows = await dbAll<any>(
      `SELECT id, insight_type, title, description, priority
       FROM financial_analysis_insights
       WHERE analysis_id = ?
       ORDER BY priority DESC, created_at DESC
       LIMIT 12`,
      [analysisId]
    );

    const proposals = (rows || [])
      .filter((r: any) => ['action', 'risk', 'driver'].includes(String(r.insight_type || '')))
      .map((r: any) => ({
        id: String(r.id),
        title: String(r.title || 'Initiative'),
        summary: String(r.description || ''),
        kind: String(r.insight_type || 'action'),
        priority: Number(r.priority || 0),
      }));

    return res.json({ proposals });
  })
);

/**
 * POST /api/economics/financial-analyses/:id/initiatives
 * Body: { acceptedProposalIds: string[] }
 *
 * FIN-06: direct Finance -> Initiative creation is disabled. This endpoint
 * used to `INSERT INTO initiatives` straight from
 * `financial_analysis_insights` proposals — a distinct, unrelated-to-
 * valuation-recommendations source type (financial-analysis proposals) that
 * is explicitly OUT OF SCOPE for this round's Candidate pipeline (a 4th
 * Finance source type, left for a future round). Route registration is kept
 * (not deleted) but the handler now fails closed with a clear error instead
 * of creating an Initiative, regardless of `INITIATIVE_FUNNEL_ENABLED` —
 * both the funnel and legacy-insert branches used to create an Initiative
 * directly, so both are removed here.
 */
router.post(
  '/financial-analyses/:id/initiatives',
  verifyToken,
  validateBody(createAnalysisInitiativesSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    return res.status(410).json({
      error:
        'Direct Finance -> Initiative creation from financial-analysis proposals is disabled per FIN-06. ' +
        'This source type has no Candidate handoff pipeline yet.',
      code: 'DIRECT_INITIATIVE_CREATION_DISABLED',
    });
  })
);

/**
 * POST /api/economics/financial-analyses/live-preview
 * Computes ratios on-the-fly from the latest model without persisting an analysis
 */
router.post(
  '/financial-analyses/live-preview',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const ratios = await finAnalysisSvc.computeLivePreview(orgId);
      return res.json({ ratios });
    } catch (err: any) {
      return res.json({
        ratios: [],
        message: err?.message || 'No data available for live preview',
      });
    }
  })
);

/**
 * DELETE /api/economics/financial-analyses/:id
 */
router.delete(
  '/financial-analyses/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const row = await dbGet<any>(
      `SELECT id, status FROM financial_analyses WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!row) return res.status(404).json({ error: 'Analysis not found' });
    if (row.status === 'APPROVED')
      return res
        .status(400)
        .json({ error: 'Cannot delete approved analysis. Archive it instead.' });
    await dbRun(`DELETE FROM financial_analysis_insights WHERE analysis_id = ?`, [id]);
    await dbRun(`DELETE FROM financial_analysis_ratios WHERE analysis_id = ?`, [id]);
    await dbRun(`DELETE FROM financial_analyses WHERE id = ?`, [id]);
    return res.json({ success: true, deleted: id });
  })
);

/* T055–T057 Enterprise Valuation */
router.get(
  '/valuations/sources',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const budgets = await dbAll<any>(
      `SELECT id, title, status, approved_at, updated_at
     FROM budgets
     WHERE organization_id = ?
       AND UPPER(status) = 'APPROVED'
     ORDER BY updated_at DESC
     LIMIT 50`,
      [orgId]
    );

    let financialModels: any[] = [];
    try {
      financialModels = await dbAll<any>(
        `SELECT id, name, status, approved_at, updated_at
       FROM financial_models
       WHERE organization_id = ?
         AND LOWER(status) = 'approved'
       ORDER BY updated_at DESC
       LIMIT 50`,
        [orgId]
      );
    } catch {
      financialModels = [];
    }

    const financialAnalyses = await dbAll<any>(
      `SELECT id, title, status, updated_at
       FROM financial_analyses
       WHERE organization_id = ?
         AND UPPER(status) IN ('APPROVED', 'COMPLETED')
       ORDER BY updated_at DESC
       LIMIT 50`,
      [orgId]
    );

    return res.json({
      success: true,
      sources: {
        budgets: (budgets || []).map((b: any) => ({
          id: b.id,
          title: b.title,
          status: b.status,
          approvedAt: b.approved_at,
          updatedAt: b.updated_at,
        })),
        financialModels: (financialModels || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          status: m.status,
          approvedAt: m.approved_at,
          updatedAt: m.updated_at,
        })),
        financialAnalyses: (financialAnalyses || []).map((analysis: any) => ({
          id: analysis.id,
          title: analysis.title,
          status: analysis.status,
          updatedAt: analysis.updated_at,
        })),
      },
    });
  })
);

router.get(
  '/valuations',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const valuations = await valuationSvc.listValuations(orgId);
    return res.json({ success: true, valuations });
  })
);

router.post(
  '/valuations',
  verifyToken,
  validateBody(createValuationSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      title,
      description,
      projectId,
      initiativeId,
      sourceType,
      sourceId,
      horizonYears,
      currency,
      depth,
    } = req.body || {};
    if (!title || !sourceType)
      return res.status(400).json({ error: 'title and sourceType required' });

    const created = await createRegisteredValuation({
      organizationId: orgId,
      userId,
      title,
      description,
      projectId,
      initiativeId,
      sourceType,
      sourceId,
      horizonYears,
      currency,
      depth,
      actor: {
        userId,
        userEmail: (req.user as any)?.email,
        ip: req.ip,
        userAgent: req.get('user-agent') || undefined,
      },
    });
    return res.status(201).json({ success: true, id: created.id });
  })
);

/**
 * PUT /api/economics/valuations/:id/depth
 * F-4 EV depth switch (D-2) — zmienia głębokość wyceny NA ŻĄDANIE (managerial↔banking)
 * na już istniejącej wycenie. Additive: nowy endpoint, nie rusza żadnego innego.
 */
router.put(
  '/valuations/:id/depth',
  verifyToken,
  validateBody(updateValuationDepthSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user?.id || (req.user as any)?.user_id;
    const val = await valuationSvc.getValuation(orgId, req.params.id);
    if (!val) return res.status(404).json({ error: 'Not found' });

    await setValuationDepth(orgId, req.params.id, req.body.depth, {
      actor: {
        userId,
        userEmail: (req.user as any)?.email,
        ip: req.ip,
        userAgent: req.get('user-agent') || undefined,
      },
    });
    return res.json({ success: true, depth: normalizeDepth(req.body.depth) });
  })
);

router.get(
  '/valuations/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const valuation = await valuationSvc.getValuation(orgId, req.params.id);
    if (!valuation) return res.status(404).json({ error: 'Not found' });
    return res.json({ success: true, valuation });
  })
);

/**
 * GET /api/economics/valuations/:id/assumptions
 * BUG-13: Fetch valuation assumptions
 */
router.get(
  '/valuations/:id/assumptions',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const valuation = await valuationSvc.getValuation(orgId, req.params.id);
    if (!valuation) return res.status(404).json({ error: 'Not found' });
    const assumptions = (valuation as any).assumptions ?? {};
    return res.json({ data: { assumptions } });
  })
);

router.put(
  '/valuations/:id/assumptions',
  verifyToken,
  validateBody(updateAssumptionsSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user?.id || (req.user as any)?.user_id;
    await valuationSvc.updateAssumptions(orgId, req.params.id, req.body || {}, {
      userId,
      userEmail: (req.user as any)?.email,
      ip: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
    return res.json({ success: true });
  })
);

router.put(
  '/valuations/:id/peers',
  verifyToken,
  validateBody(updatePeersSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user?.id || (req.user as any)?.user_id;
    await valuationSvc.updatePeers(orgId, req.params.id, req.body || {}, {
      userId,
      userEmail: (req.user as any)?.email,
      ip: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });
    return res.json({ success: true });
  })
);

router.post(
  '/valuations/:id/compute',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const results = await valuationSvc.computeValuation(orgId, req.params.id);
    return res.json({ success: true, results });
  })
);

/**
 * GET /api/economics/valuations/:id/basket
 * ENTERPRISE VALUE — KOSZYK metod (football-field). Read-only, deterministyczny,
 * zero LLM: buduje koszyk z JUŻ policzonych `results` (nie recompute, nie persist),
 * czytając opcjonalny config z `assumptions.basket`. Gdy brak gotowych wyników
 * wejściowych (koszyk bez metod) → `{ basket: null }` (front pokaże pusty stan),
 * NIGDY nie rzuca. Za flagą FE `ff_evBasket` (podgląd); endpoint zawsze bezpieczny.
 *
 * F-4 EV depth switch (D-2, additive): opcjonalny `?depth=managerial|banking`
 * PRZEŁĄCZA odpowiedź na widok jednej-metody-dominującej (managerial) albo
 * potwierdza pełny koszyk (banking). BEZ `?depth=` i BEZ zapisanej depth na
 * wycenie (assumptions.depth) zachowanie jest DOKŁADNIE takie jak przed tą
 * zmianą — `buildBasketFromResults(results, config)` wprost, żadnej redukcji.
 * Zapisana depth (patrz PUT /valuations/:id/depth) jest respektowana, gdy
 * caller nie poda jawnego `?depth=` — tak nowe wyceny "trzymają" swój wybór.
 */
router.get(
  '/valuations/:id/basket',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const val = await valuationSvc.getValuation(orgId, req.params.id);
    if (!val) return res.status(404).json({ error: 'Not found' });

    const parseMaybe = (raw: any): any => {
      if (raw == null) return {};
      if (typeof raw === 'object') return raw;
      if (typeof raw !== 'string') return {};
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    };

    const results = parseMaybe((val as any).results);
    const assumptions = parseMaybe((val as any).assumptions);
    const config =
      assumptions?.basket && typeof assumptions.basket === 'object' ? assumptions.basket : {};

    const depthOverrideRaw = typeof req.query.depth === 'string' ? req.query.depth : undefined;
    const depthOverride =
      depthOverrideRaw && isValidDepth(depthOverrideRaw) ? depthOverrideRaw : null;
    const resolvedDepth = depthOverride ?? resolveStoredDepth(assumptions);

    if (!resolvedDepth) {
      // Nierozpoznana/nigdy niewybrana depth → zachowanie SPRZED tej zmiany, bit-for-bit.
      const basket = buildBasketFromResults(results, config);
      if (!basket.methods || basket.methods.length === 0) {
        return res.json({ success: true, basket: null });
      }
      return res.json({ success: true, basket });
    }

    const view = buildBasketForDepth(results, config, resolvedDepth);
    if (!view.basket.methods || view.basket.methods.length === 0) {
      return res.json({ success: true, basket: null, depth: resolvedDepth });
    }
    return res.json({
      success: true,
      basket: view.basket,
      depth: view.depth,
      dominantMethodKey: view.dominantMethodKey,
      narrative: depthNarrative(view, val.currency || 'PLN'),
    });
  })
);

router.post(
  '/valuations/:id/approve',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      await valuationSvc.approveValuation(orgId, req.params.id, userId);
      return res.json({ success: true, status: 'APPROVED' });
    } catch (err: any) {
      const msg = String(err?.message || 'Approval failed');
      // Pre-conditions that the caller can fix → 400 (not 500).
      // "Compute valuation before approval" — no DCF results yet.
      // "Validation failed:" — g >= WACC constraint.
      // "Valuation not found" → 404.
      if (msg.includes('not found') || msg.includes('Not found')) {
        return res.status(404).json({ error: msg });
      }
      if (
        msg.includes('Compute valuation') ||
        msg.includes('Validation failed') ||
        msg.includes('terminal growth') ||
        msg.includes('approved before')
      ) {
        return res.status(400).json({ error: msg });
      }
      throw err;
    }
  })
);

router.post(
  '/valuations/:id/advisory',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const advisory = await valuationSvc.generateAdvisory(orgId, req.params.id);
    return res.json({ success: true, advisory });
  })
);

router.post(
  '/valuations/:id/negotiation-pack',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const pack = await valuationSvc.generateNegotiationPack(orgId, req.params.id);
    return res.json({ success: true, pack });
  })
);

/**
 * GET /api/economics/valuations/:id/export/negotiation-pack
 * Export negotiation pack as Markdown document
 */
router.get(
  '/valuations/:id/export/negotiation-pack',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const val = await valuationSvc.getValuation(orgId, req.params.id);
    if (!val) return res.status(404).json({ error: 'Valuation not found' });

    const pack =
      typeof val.negotiation_pack === 'string'
        ? JSON.parse(val.negotiation_pack)
        : val.negotiation_pack;
    if (!pack) return res.status(400).json({ error: 'Negotiation pack not generated yet' });

    const lines: string[] = [
      `# Negotiation Pack: ${val.title}`,
      ``,
      `**Status:** ${val.status}  `,
      `**Generated:** ${pack.generatedAt || 'N/A'}`,
      ``,
      `---`,
      ``,
      `## Pro Arguments`,
      ``,
    ];
    for (const p of pack.proPoints || []) {
      lines.push(`### ${p.title || p.oneLiner}`);
      if (p.details) lines.push(`${p.details}`);
      lines.push(``);
    }
    lines.push(`## Contra / Risk Factors`, ``);
    for (const c of pack.contraPoints || []) {
      lines.push(`### ${c.title || c.oneLiner}`);
      if (c.details) lines.push(`${c.details}`);
      lines.push(``);
    }
    lines.push(`## Q&A Preparation`, ``);
    for (const q of pack.qa || []) {
      lines.push(`**Q:** ${q.question}`);
      lines.push(`**A:** ${q.suggestedAnswer || 'TBD'}`);
      lines.push(``);
    }
    if (pack.disclaimers?.length) {
      lines.push(`---`, ``, `*Disclaimers:*`);
      for (const d of pack.disclaimers) lines.push(`- ${d}`);
    }

    const md = lines.join('\n');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="negotiation-pack-${req.params.id.slice(0, 8)}.md"`
    );
    return res.send(md);
  })
);

router.post(
  '/valuations/:id/advisory/:recommendationId/convert-to-initiative',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      // FIN-06: this no longer creates an Initiative directly — it produces
      // a Candidate (+ idempotent receipt) via the shared Finance Candidate
      // handoff. See `valuationService.ts#convertAdvisoryRecommendationToInitiative`.
      const result = await valuationSvc.convertAdvisoryRecommendationToInitiative(
        orgId,
        req.params.id,
        req.params.recommendationId,
        userId
      );
      return res
        .status(result.created ? 201 : 200)
        .json({ success: true, candidateId: result.candidateId, created: result.created });
    } catch (err) {
      const mapped = mapFinanceCandidateHandoffError(err);
      if (mapped) return res.status(mapped.status).json(mapped.body);
      throw err;
    }
  })
);

router.post(
  '/valuations/:id/export/pptx',
  verifyToken,
  validateBody(exportPptxSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { language, theme, confidentiality } = req.body || {};
    const result = await exportValuationPptx({
      organizationId: orgId,
      valuationId: req.params.id,
      language: language === 'pl' ? 'pl' : 'en',
      theme: theme === 'minimal' || theme === 'modern' ? theme : 'corporate',
      confidentiality:
        confidentiality === 'public' || confidentiality === 'internal'
          ? confidentiality
          : 'confidential',
    });
    return res.json({
      success: true,
      slideCount: result.slideCount,
      warnings: result.warnings,
      downloadUrl: `/api/economics/valuations/${req.params.id}/export/pptx/download`,
    });
  })
);

router.get(
  '/valuations/:id/export/pptx/download',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const row = await dbGet<any>(
      `SELECT title, export_path FROM valuations WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    );
    if (!row?.export_path) return res.status(404).json({ error: 'Export not available' });

    const exportPathRaw = String(row.export_path);
    const exportPathFs = exportPathRaw.startsWith('/exports/')
      ? resolveStoredRelativePath(exportPathRaw)
      : path.resolve(exportPathRaw);
    if (!fs.existsSync(exportPathFs)) return res.status(404).json({ error: 'File not found' });

    const safeName =
      String(row.title || 'valuation')
        .replace(/[^a-zA-Z0-9-_ ]/g, '')
        .trim() || 'valuation';
    const filename = `${safeName}.pptx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.sendFile(exportPathFs);
  })
);

/**
 * DELETE /api/economics/valuations/:id
 */
router.delete(
  '/valuations/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const row = await dbGet<any>(
      `SELECT id, status FROM valuations WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!row) return res.status(404).json({ error: 'Valuation not found' });
    if (row.status === 'APPROVED')
      return res
        .status(400)
        .json({ error: 'Cannot delete approved valuation. Archive it instead.' });
    await dbRun(`DELETE FROM valuation_snapshots WHERE valuation_id = ?`, [id]);
    await dbRun(`DELETE FROM valuations WHERE id = ?`, [id]);
    return res.json({ success: true, deleted: id });
  })
);

/* T053 Budgeting */
router.post(
  '/budgets',
  verifyToken,
  validateBody(createBudgetSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const budget = await budgetingSvc.createBudget(orgId, req.body, userId);
    return res.status(201).json({ success: true, budget });
  })
);
router.get(
  '/budgets',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const budgets = await budgetingSvc.listBudgets(orgId);
    return res.json({ budgets });
  })
);
router.get(
  '/budgets/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const budget = await budgetingSvc.getBudget(orgId, req.params.id);
    if (!budget) return res.status(404).json({ error: 'Not found' });
    const lines = await budgetingSvc.getBudgetLines(req.params.id);
    const scenarios = await budgetingSvc.getScenarios(req.params.id);
    return res.json({ ...budget, lines, scenarios });
  })
);
router.put(
  '/budgets/:budgetId/lines/:lineId',
  verifyToken,
  validateBody(updateBudgetLineSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const budget = await budgetingSvc.getBudget(orgId, req.params.budgetId);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    await budgetingSvc.updateBudgetLine(req.params.budgetId, req.params.lineId, req.body);
    return res.json({ success: true });
  })
);
router.post(
  '/budgets/:budgetId/scenarios/:scenarioId/project',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const scenario = await budgetingSvc.generateScenarioProjections(
      orgId,
      req.params.budgetId,
      req.params.scenarioId
    );
    return res.json({ success: true, scenario });
  })
);
router.put(
  '/budgets/:budgetId/scenarios/:scenarioId/adjustments',
  verifyToken,
  validateBody(updateScenarioAdjustmentsSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const budget = await budgetingSvc.getBudget(orgId, req.params.budgetId);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    await budgetingSvc.updateScenarioAdjustments(
      req.params.budgetId,
      req.params.scenarioId,
      req.body
    );
    return res.json({ success: true });
  })
);
router.post(
  '/budgets/:id/approve',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      await budgetingSvc.approveBudget(orgId, req.params.id, userId);
      return res.json({ success: true });
    } catch (err: any) {
      const msg = String(err?.message || 'Approval failed');
      if (msg.toLowerCase().includes('not found')) {
        return res.status(404).json({ error: msg });
      }
      // Pre-condition failures (missing CAPEX line etc.) → 400.
      if (
        msg.includes('CAPEX') ||
        msg.includes('required before approval') ||
        msg.includes('approved before') ||
        msg.includes('Cannot approve')
      ) {
        return res.status(400).json({ error: msg });
      }
      throw err;
    }
  })
);

/**
 * DELETE /api/economics/budgets/:id
 */
router.delete(
  '/budgets/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const row = await dbGet<any>(
      `SELECT id, status FROM budgets WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    );
    if (!row) return res.status(404).json({ error: 'Budget not found' });
    if (row.status === 'APPROVED')
      return res.status(400).json({ error: 'Cannot delete approved budget. Archive it instead.' });
    await dbRun(`DELETE FROM budget_lines WHERE budget_id = ?`, [id]);
    await dbRun(`DELETE FROM budget_scenarios WHERE budget_id = ?`, [id]);
    await dbRun(`DELETE FROM budgets WHERE id = ?`, [id]);
    return res.json({ success: true, deleted: id });
  })
);

/**
 * POST /api/economics/budgets/:id/import-document
 * Import budget lines from an uploaded file (PDF/Excel/CSV)
 */
router.post(
  '/budgets/:id/import-document',
  verifyToken,
  validateBody(importBudgetDocumentSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const budgetId = req.params.id;
    const budget = await dbGet<any>(`SELECT id FROM budgets WHERE id = ? AND organization_id = ?`, [
      budgetId,
      orgId,
    ]);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });

    const documentText = String(req.body?.documentText || '').trim();
    if (!documentText) {
      return res.status(400).json({
        error: 'documentText is required. Send extracted text from CSV/TXT or OCR output.',
      });
    }

    const parseNumber = (raw: string): number | null => {
      const normalized = raw.replace(/\s/g, '').replace(/,/g, '.');
      const value = Number(normalized);
      return Number.isFinite(value) ? value : null;
    };

    const extractLineValue = (lines: string[], keywords: string[]): number | null => {
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (!keywords.some((keyword) => lower.includes(keyword))) continue;
        const matches = line.match(/-?\d[\d\s.,]*/g);
        const last = matches?.[matches.length - 1];
        if (!last) continue;
        const parsed = parseNumber(last);
        if (parsed != null) return parsed;
      }
      return null;
    };

    const sourceLines = documentText
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter(Boolean);

    const { v4: uuidv4 } = await import('uuid');
    const lineDefinitions = [
      {
        code: 'revenue',
        name: 'Revenue',
        type: 'P&L',
        keywords: ['revenue', 'sales', 'turnover'],
      },
      {
        code: 'cogs',
        name: 'Cost of Goods Sold',
        type: 'P&L',
        keywords: ['cost of goods sold', 'cogs'],
      },
      {
        code: 'opex',
        name: 'Operating Expenses',
        type: 'P&L',
        keywords: ['operating expenses', 'opex'],
      },
      {
        code: 'capex',
        name: 'Capital Expenditure',
        type: 'CF',
        keywords: ['capital expenditure', 'capex'],
      },
      {
        code: 'depreciation',
        name: 'Depreciation & Amortization',
        type: 'P&L',
        keywords: ['depreciation', 'amortization'],
      },
    ]
      .map((line) => ({
        ...line,
        value: extractLineValue(sourceLines, line.keywords),
      }))
      .filter((line) => line.value != null);

    if (lineDefinitions.length === 0) {
      return res.status(400).json({
        error:
          'Could not extract supported budget lines from the document. Expected lines like Revenue, COGS, OPEX, CAPEX, or Depreciation with numeric values.',
      });
    }

    let imported = 0;
    for (const line of lineDefinitions) {
      const existing = await dbGet<any>(
        `SELECT id FROM budget_lines WHERE budget_id = ? AND line_code = ?`,
        [budgetId, line.code]
      );
      if (!existing) {
        await dbRun(
          `INSERT INTO budget_lines (id, budget_id, line_code, line_name, statement_type, source, baseline_value, is_locked, display_order, created_at)
           VALUES (?, ?, ?, ?, ?, 'document', ?, 0, ?, datetime('now'))`,
          [
            uuidv4().replace(/-/g, ''),
            budgetId,
            line.code,
            line.name,
            line.type,
            Number(line.value || 0),
            imported,
          ]
        );
        imported++;
      }
    }

    return res.json({ success: true, linesImported: imported });
  })
);

/**
 * GET /api/economics/budgets/:id/initiatives
 */
router.get(
  '/budgets/:id/initiatives',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const rows = await dbAll<any>(
      `SELECT bi.initiative_id as id, i.title, i.status,
              bi.revenue_uplift as "revenueUplift", bi.cost_savings as "costSavings", bi.capex_required as "capexRequired"
       FROM budget_initiative_links bi
       JOIN initiatives i ON i.id = bi.initiative_id
       WHERE bi.budget_id = ? AND bi.organization_id = ?`,
      [req.params.id, orgId]
    );
    return res.json({ initiatives: rows || [] });
  })
);

/**
 * POST /api/economics/budgets/:id/initiatives
 */
router.post(
  '/budgets/:id/initiatives',
  verifyToken,
  validateBody(linkBudgetInitiativeSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { initiativeId } = req.body;
    if (!initiativeId) return res.status(400).json({ error: 'initiativeId required' });

    const ini = await dbGet<any>(
      `SELECT id, estimated_revenue_uplift, estimated_cost_savings, estimated_capex FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, orgId]
    );

    const id = (await import('uuid')).v4().replace(/-/g, '');
    await dbRun(
      `INSERT OR IGNORE INTO budget_initiative_links (id, budget_id, initiative_id, organization_id, revenue_uplift, cost_savings, capex_required, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        req.params.id,
        initiativeId,
        orgId,
        ini?.estimated_revenue_uplift || 0,
        ini?.estimated_cost_savings || 0,
        ini?.estimated_capex || 0,
      ]
    );
    return res.json({ success: true });
  })
);

/**
 * DELETE /api/economics/budgets/:id/initiatives/:initiativeId
 */
router.delete(
  '/budgets/:id/initiatives/:initiativeId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    await dbRun(
      `DELETE FROM budget_initiative_links WHERE budget_id = ? AND initiative_id = ? AND organization_id = ?`,
      [req.params.id, req.params.initiativeId, orgId]
    );
    return res.json({ success: true });
  })
);

/**
 * GET /api/economics/finance-settings
 */
router.get(
  '/finance-settings',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { getOrgFinanceSettings } = await import('../services/valuationService.js');
    const settings = await getOrgFinanceSettings(orgId);
    return res.json(settings);
  })
);

/**
 * PUT /api/economics/finance-settings
 */
router.put(
  '/finance-settings',
  verifyToken,
  validateBody(financeSettingsSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { setOrgFinanceSettings, getOrgFinanceSettings } =
      await import('../services/valuationService.js');
    const current = await getOrgFinanceSettings(orgId);
    const merged = { ...current, ...req.body };
    if (merged.defaultWacc != null)
      merged.defaultWacc = Math.max(0, Math.min(100, Number(merged.defaultWacc)));
    await setOrgFinanceSettings(orgId, merged);
    return res.json(merged);
  })
);

export default router;
