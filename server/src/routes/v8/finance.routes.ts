/**
 * V8 Finance bridge — org-scoped runtime dashboard and bounded
 * analysis/operator continuity slices under /api/v8/finance.
 *
 * @module routes/v8/finance.routes
 */

import { v4 as uuidv4 } from 'uuid';
import { Router } from 'express';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { getFinanceDashboard } from '../../services/v8/financeIntegrationService.js';
import {
  approveAnalysis,
  createAnalysis,
  getAnalysisInsights,
  getAnalysisRatios,
  listAnalyses,
  runFullAnalysis,
} from '../../services/financialAnalysisService.js';
import { listBudgets } from '../../services/budgetingService.js';
import { listModels } from '../../services/financialModelingService.js';
import { computeRatios } from '../../services/ratioAnalysisService.js';
import {
  getStatementPackDetail,
  listStatementPacks,
} from '../../services/financialStatementPackService.js';
import { getStatementDetail, listStatements } from '../../services/financialStatementReadService.js';
import { listValuations } from '../../services/valuationService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();

/** Stable contract id for V8 Finance read responses. */
export const V8_FINANCE_READ_CONTRACT = 'finance_runtime_read_v1';

function financeMeta() {
  return { version: 'v8' as const, contract: V8_FINANCE_READ_CONTRACT };
}

/**
 * GET /api/v8/finance/dashboard
 * Ingestion pipeline summary, initiative economics linkage health, unresolved
 * escalations count, stale cloud-linked refreshes, and promotion gate pass rate
 * for the V8 org context.
 */
router.get(
  '/dashboard',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const dashboard = await getFinanceDashboard(organizationId);
    return res.json({
      data: { dashboard },
      meta: financeMeta(),
    });
  }),
);

router.get(
  '/models',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const models = await listModels(organizationId);
    return res.json({
      data: { models, count: models.length },
      meta: financeMeta(),
    });
  }),
);

router.get(
  '/valuations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const valuations = await listValuations(organizationId);
    return res.json({
      data: { valuations, count: valuations.length },
      meta: financeMeta(),
    });
  }),
);

router.get(
  '/budgets',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const budgets = await listBudgets(organizationId);
    return res.json({
      data: { budgets, count: budgets.length },
      meta: financeMeta(),
    });
  }),
);

router.get(
  '/statement-packs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const readiness =
      typeof req.query.readiness === 'string' ? String(req.query.readiness).trim().toLowerCase() : '';
    const statementPacks = await listStatementPacks(organizationId, readiness);
    return res.json({
      data: { statementPacks, count: statementPacks.length },
      meta: financeMeta(),
    });
  }),
);

router.get(
  '/statement-packs/:packId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const packId = String(req.params.packId || '');
    const pack = await getStatementPackDetail(organizationId, packId);
    if (!pack) {
      return res.status(404).json({ error: 'Statement pack not found' });
    }
    return res.json({
      data: { pack },
      meta: financeMeta(),
    });
  }),
);

router.get(
  '/statements',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const readiness =
      typeof req.query.readiness === 'string' ? String(req.query.readiness).trim().toLowerCase() : '';
    const statements = await listStatements(organizationId, readiness);
    return res.json({
      data: { statements, count: statements.length },
      meta: financeMeta(),
    });
  }),
);

router.get(
  '/statements/:statementId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const statementId = String(req.params.statementId || '');
    const statement = await getStatementDetail(organizationId, statementId);
    if (!statement) {
      return res.status(404).json({ error: 'Statement not found' });
    }
    return res.json({
      data: { statement },
      meta: financeMeta(),
    });
  }),
);

router.get(
  '/statements/:statementId/ratios',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const statementId = String(req.params.statementId || '');
    try {
      const ratios = await computeRatios(statementId, organizationId);
      return res.json({
        data: { ratios },
        meta: financeMeta(),
      });
    } catch (error: any) {
      return res.status(404).json({ error: error?.message || 'Statement not found' });
    }
  }),
);

router.get(
  '/canonical-lines',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const canonicalLines = await dbAll<any>(
      `SELECT id, statement_type, line_code, line_name, line_name_en, line_name_pl, parent_line_id, sort_order,
              aggregation_level, required_level, sign_convention, is_total, is_subtotal, is_computed,
              formula_json, deaggregation_ready, taxonomy_version
       FROM financial_statement_lines
       WHERE is_system = TRUE OR organization_id = ?
       ORDER BY statement_type, sort_order`,
      [organizationId],
    );
    return res.json({
      data: { canonicalLines, count: canonicalLines.length },
      meta: financeMeta(),
    });
  }),
);

router.get(
  '/analyses',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const analyses = await listAnalyses(organizationId, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      projectId: typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
    });
    return res.json({
      data: { analyses, count: analyses.length },
      meta: financeMeta(),
    });
  }),
);

router.post(
  '/analyses',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const analysis = await createAnalysis(organizationId, req.body ?? {}, userId);
    return res.status(201).json({
      data: { analysis },
      meta: financeMeta(),
    });
  }),
);

router.get(
  '/analyses/:analysisId/ratios',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const analysisId = String(req.params.analysisId || '');
    const analyses = await listAnalyses(organizationId);
    const analysisExists = analyses.some((analysis) => String(analysis.id) === analysisId);
    if (!analysisExists) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    const ratios = await getAnalysisRatios(analysisId);
    return res.json({
      data: { ratios },
      meta: financeMeta(),
    });
  }),
);

router.get(
  '/analyses/:analysisId/initiative-proposals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const analysisId = String(req.params.analysisId || '');
    const analyses = await listAnalyses(organizationId);
    const analysisExists = analyses.some((analysis) => String(analysis.id) === analysisId);
    if (!analysisExists) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    const insights = await getAnalysisInsights(analysisId);
    const proposals = (insights || [])
      .filter((insight: any) =>
        ['action', 'risk', 'driver'].includes(String(insight.insight_type || insight.type || ''))
      )
      .map((insight: any) => ({
        id: String(insight.id),
        title: String(insight.title || 'Initiative'),
        summary: String(insight.description || ''),
        kind: String(insight.insight_type || insight.type || 'action'),
        priority: Number(insight.priority || 0),
      }));

    return res.json({
      data: { proposals },
      meta: financeMeta(),
    });
  }),
);

router.post(
  '/analyses/:analysisId/initiatives',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const analysisId = String(req.params.analysisId || '');
    const acceptedProposalIds = Array.isArray(req.body?.acceptedProposalIds)
      ? (req.body.acceptedProposalIds as any[]).map((x) => String(x)).filter(Boolean)
      : [];

    if (acceptedProposalIds.length === 0) {
      return res.status(400).json({ error: 'acceptedProposalIds is required' });
    }

    const analysis = await dbGet<any>(
      `SELECT id, organization_id, project_id, title
       FROM financial_analyses
       WHERE id = ? AND organization_id = ?`,
      [analysisId, organizationId],
    );
    if (!analysis) {
      return res.status(404).json({ error: 'Not found' });
    }

    const placeholders = acceptedProposalIds.map(() => '?').join(',');
    const insights = await dbAll<any>(
      `SELECT id, insight_type, title, description
       FROM financial_analysis_insights
       WHERE analysis_id = ? AND id IN (${placeholders})`,
      [analysisId, ...acceptedProposalIds],
    );

    const now = new Date().toISOString();
    const created: string[] = [];

    for (const insight of insights || []) {
      const initiativeId = uuidv4();
      const name = String(insight.title || `Initiative from analysis ${analysisId.slice(0, 8)}`);
      const summary = String(insight.description || '');

      await dbRun(
        `INSERT INTO initiatives (
          id, organization_id, project_id, name, summary, status,
          source_type, source_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          initiativeId,
          organizationId,
          analysis.project_id || null,
          name,
          summary || null,
          'step3',
          'financial_analysis',
          analysisId,
          now,
          now,
        ],
      );

      created.push(initiativeId);
    }

    return res.status(201).json({
      data: { success: true, initiativeIds: created },
      meta: financeMeta(),
    });
  }),
);

router.post(
  '/analyses/:analysisId/run',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const analysisId = String(req.params.analysisId || '');
    const result = await runFullAnalysis(organizationId, analysisId);
    return res.json({
      data: { success: true, result },
      meta: financeMeta(),
    });
  }),
);

router.post(
  '/analyses/:analysisId/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const userId = String(req.user?.id || '');
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const analysisId = String(req.params.analysisId || '');
    await approveAnalysis(organizationId, analysisId, userId);
    return res.json({
      data: { success: true },
      meta: financeMeta(),
    });
  }),
);

router.delete(
  '/analyses/:analysisId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const analysisId = String(req.params.analysisId || '');
    const row = await dbGet<any>(
      `SELECT id, status FROM financial_analyses WHERE id = ? AND organization_id = ?`,
      [analysisId, organizationId],
    );
    if (!row) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    if (row.status === 'APPROVED') {
      return res
        .status(400)
        .json({ error: 'Cannot delete approved analysis. Archive it instead.' });
    }
    await dbRun(`DELETE FROM financial_analysis_insights WHERE analysis_id = ?`, [analysisId]);
    await dbRun(`DELETE FROM financial_analysis_ratios WHERE analysis_id = ?`, [analysisId]);
    await dbRun(`DELETE FROM financial_analyses WHERE id = ?`, [analysisId]);
    return res.json({
      data: { success: true, deleted: analysisId },
      meta: financeMeta(),
    });
  }),
);

export default router;
