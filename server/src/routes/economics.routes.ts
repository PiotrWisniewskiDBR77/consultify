/**
 * Economics Routes
 * API endpoints for digitization maturity analyses
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import decisionService from '../services/decisionService.js';
import {
  applyScenarioAdjustments,
  calculateFinancialMetrics,
  defaultFinancialData,
  type FinancialData,
  normalizeFinancialData,
  validateFinancialData,
} from '../services/economicsFinancials.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

console.log('[Economics Routes] Module loaded - TypeScript version');
console.log('[Economics Routes] Router type:', typeof Router);
const router = Router();
console.log('[Economics Routes] Router created. Stack length:', router.stack?.length);

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

      const rows = await dbAll<any>(sql, params);

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
        importedFrom: row.imported_from,
        importDate: row.import_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return res.json({ analyses, total: analyses.length });
    } catch (error: any) {
      logger.error('[Economics] Error fetching analyses:', error);
      return res.json({ analyses: [], total: 0 });
    }
  })
);

console.log('[Economics Routes] After /analyses route. Stack length:', router.stack?.length);

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
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, description, projectId, initiativeId, analysisType } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

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
         af.npv as financial_npv, af.roi_percent as financial_roi,
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
      currency: row.currency || 'PLN',
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
      const scenarioRow = await dbGet<any>(
        `SELECT id FROM analysis_financial_scenarios WHERE analysis_id = ? AND scenario_type = ?`,
        [id, scenarioType]
      );

      if (scenarioRow) {
        await dbRun(
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
          ]
        );
      } else {
        await dbRun(
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
          ]
        );
      }
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
      isActive: !!row.is_active,
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
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    const { id } = req.params;
    const { scenarioType, name, financialData: rawFinancialData } = req.body || {};

    if (!orgId || !scenarioType) {
      return res.status(400).json({ error: 'scenarioType is required' });
    }

    const scenarioData = rawFinancialData
      ? normalizeFinancialData(rawFinancialData)
      : normalizeFinancialData({});
    const metrics = calculateFinancialMetrics(scenarioData);
    const now = new Date().toISOString();

    const existing = await dbGet<any>(
      `SELECT id FROM analysis_financial_scenarios WHERE analysis_id = ? AND scenario_type = ?`,
      [id, scenarioType]
    );

    if (existing) {
      await dbRun(
        `UPDATE analysis_financial_scenarios SET
          name = ?, assumptions = ?, financial_data = ?, metrics = ?, updated_at = ?
         WHERE id = ?`,
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

    const existing = await dbGet<any>(
      `SELECT id FROM benefit_tracking WHERE organization_id = ? AND initiative_id = ? AND tracking_period = ?`,
      [orgId, analysis.initiative_id, trackingPeriod]
    );

    const variancePercent =
      plannedBenefits > 0 ? ((actualBenefits - plannedBenefits) / plannedBenefits) * 100 : 0;

    if (existing) {
      await dbRun(
        `UPDATE benefit_tracking SET
          planned_cost_savings = ?, actual_cost_savings = ?, overall_variance_percent = ?, updated_at = ?
         WHERE id = ?`,
        [plannedBenefits, actualBenefits, variancePercent, now, existing.id]
      );
    } else {
      await dbRun(
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
        ]
      );
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
      currency: row.currency || 'PLN',
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
 * Generate business case (lightweight data-url)
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

    const financials = await dbGet<any>(
      `SELECT * FROM analysis_financials WHERE analysis_id = ? AND organization_id = ?`,
      [id, orgId]
    );

    const metrics = financials
      ? {
          npv: financials.npv,
          irr: financials.irr,
          roi: financials.roi_percent,
          payback: financials.payback_months,
        }
      : {};

    const content = `Business Case: ${analysis.name}

Opis: ${analysis.description || 'Brak opisu'}

Metryki:
- NPV: ${metrics.npv ?? '—'}
- IRR: ${metrics.irr ?? '—'}
- ROI: ${metrics.roi ?? '—'}
- Payback: ${metrics.payback ?? '—'}
`;

    const encoded = encodeURIComponent(content);
    const downloadUrl = `data:text/plain;charset=utf-8,${encoded}`;

    return res.json({
      downloadUrl,
      filename: `business-case-${analysis.id}.txt`,
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
    const initiativeId = uuidv4();
    const costCapex =
      (financials?.initial_investment || 0) +
      (financials?.implementation_cost || 0) +
      (financials?.training_cost || 0);
    const costOpex = financials?.annual_operating_cost || 0;
    const expectedRoi = financials?.roi_percent ?? null;

    await dbRun(
      `INSERT INTO initiatives (
        id, organization_id, project_id, title, summary, status, cost_capex, cost_opex, expected_roi, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        initiativeId,
        orgId,
        analysis.project_id || null,
        analysis.name,
        analysis.description || null,
        normalizeStatusForDb('DRAFT'),
        costCapex,
        costOpex,
        expectedRoi,
        now,
        now,
      ]
    );

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

export default router;
