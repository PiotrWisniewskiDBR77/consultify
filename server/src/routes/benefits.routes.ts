/**
 * Benefits Routes — Bundle 12
 * T046: ROI Tracking, T047: KPI Time Series, T048: Attribution, T049: Financial Mapping
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyToken } from '../middleware/auth.middleware.js';
import { all as dbAll, run as dbRun, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { computeAttribution } from '../services/kpiAttributionService.js';

const router = Router();
router.use(verifyToken);

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

function getOrgId(req: any): string {
  return req.user?.organizationId || req.user?.organization_id || '';
}

// ============================================================
// T047: KPI TIME SERIES
// ============================================================

router.get('/kpis/:kpiId/time-series', asyncHandler(async (req, res) => {
  const { kpiId } = req.params;
  const orgId = getOrgId(req);
  const rows = await dbAll(
    `SELECT * FROM kpi_time_series WHERE kpi_id = ? AND organization_id = ? ORDER BY period_start DESC`,
    [kpiId, orgId]
  );
  res.json({ success: true, data: rows || [] });
}));

router.post('/kpis/:kpiId/time-series', asyncHandler(async (req, res) => {
  const { kpiId } = req.params;
  const orgId = getOrgId(req);
  const { value, periodStart, periodEnd, source, notes } = req.body;
  const id = uuidv4().replace(/-/g, '');
  await dbRun(
    `INSERT INTO kpi_time_series (id, kpi_id, organization_id, value, period_start, period_end, source, notes, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, kpiId, orgId, value, periodStart, periodEnd || null, source || 'manual', notes || null, (req as any).user?.id]
  );

  const kpi = await dbGet(`SELECT current_value FROM initiative_kpis WHERE id = ?`, [kpiId]);
  if (kpi) {
    await dbRun(`UPDATE initiative_kpis SET current_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [value, kpiId]);
  }

  res.json({ success: true, data: { id, kpiId, value, periodStart } });
}));

router.delete('/kpis/:kpiId/time-series/:tsId', asyncHandler(async (req, res) => {
  const { kpiId, tsId } = req.params;
  const orgId = getOrgId(req);
  await dbRun(`DELETE FROM kpi_time_series WHERE id = ? AND kpi_id = ? AND organization_id = ?`, [tsId, kpiId, orgId]);
  res.json({ success: true });
}));

// ============================================================
// T047: INITIATIVE <-> KPI MAPPINGS
// ============================================================

router.get('/kpi-mappings', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const { initiativeId, kpiId } = req.query;
  let query = `SELECT m.*, ik.name as kpi_name, ik.unit, i.name as initiative_name
               FROM initiative_kpi_mappings m
               LEFT JOIN initiative_kpis ik ON ik.id = m.kpi_id
               LEFT JOIN initiatives i ON i.id = m.initiative_id
               WHERE m.organization_id = ?`;
  const params: any[] = [orgId];
  if (initiativeId) { query += ' AND m.initiative_id = ?'; params.push(initiativeId); }
  if (kpiId) { query += ' AND m.kpi_id = ?'; params.push(kpiId); }
  const rows = await dbAll(query, params);
  res.json({ success: true, data: rows || [] });
}));

router.post('/kpi-mappings', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const { initiativeId, kpiId, impactWeight, impactDirection, expectedDelta, expectedDeltaUnit, lagDays, confidence, notes } = req.body;
  const id = uuidv4().replace(/-/g, '');
  await dbRun(
    `INSERT INTO initiative_kpi_mappings (id, initiative_id, kpi_id, organization_id, impact_weight, impact_direction, expected_delta, expected_delta_unit, lag_days, confidence, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(initiative_id, kpi_id) DO UPDATE SET impact_weight=excluded.impact_weight, impact_direction=excluded.impact_direction, expected_delta=excluded.expected_delta, lag_days=excluded.lag_days, confidence=excluded.confidence, notes=excluded.notes, updated_at=CURRENT_TIMESTAMP`,
    [id, initiativeId, kpiId, orgId, impactWeight || 1.0, impactDirection || 'increase', expectedDelta || null, expectedDeltaUnit || null, lagDays || 0, confidence || 'medium', notes || null, (req as any).user?.id]
  );
  res.json({ success: true, data: { id, initiativeId, kpiId } });
}));

router.delete('/kpi-mappings/:mappingId', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  await dbRun(`DELETE FROM initiative_kpi_mappings WHERE id = ? AND organization_id = ?`, [req.params.mappingId, orgId]);
  res.json({ success: true });
}));

// ============================================================
// T046: ROI ASSUMPTIONS
// ============================================================

router.get('/roi/:initiativeId/assumptions', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const row = await dbGet(
    `SELECT * FROM roi_assumptions WHERE initiative_id = ? AND organization_id = ?`,
    [req.params.initiativeId, orgId]
  );
  res.json({ success: true, data: row || null });
}));

router.put('/roi/:initiativeId/assumptions', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const { initiativeId } = req.params;
  const {
    capex, opexAnnual, expectedRoiPercent, expectedNpv, expectedPaybackMonths,
    horizonMonths, baselineRevenue, baselineCost, expectedRevenueDelta, expectedCostDelta,
    effectStartDate, assumptionsText, assumptionsOwner, confidence,
  } = req.body;
  const id = uuidv4().replace(/-/g, '');
  await dbRun(
    `INSERT INTO roi_assumptions (id, initiative_id, organization_id, capex, opex_annual, expected_roi_percent, expected_npv, expected_payback_months, horizon_months, baseline_revenue, baseline_cost, expected_revenue_delta, expected_cost_delta, effect_start_date, assumptions_text, assumptions_owner, confidence, last_updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(initiative_id) DO UPDATE SET
       capex=excluded.capex, opex_annual=excluded.opex_annual, expected_roi_percent=excluded.expected_roi_percent,
       expected_npv=excluded.expected_npv, expected_payback_months=excluded.expected_payback_months,
       horizon_months=excluded.horizon_months, baseline_revenue=excluded.baseline_revenue, baseline_cost=excluded.baseline_cost,
       expected_revenue_delta=excluded.expected_revenue_delta, expected_cost_delta=excluded.expected_cost_delta,
       effect_start_date=excluded.effect_start_date, assumptions_text=excluded.assumptions_text,
       assumptions_owner=excluded.assumptions_owner, confidence=excluded.confidence,
       last_updated_by=excluded.last_updated_by, updated_at=CURRENT_TIMESTAMP`,
    [id, initiativeId, orgId, capex || 0, opexAnnual || 0, expectedRoiPercent || null, expectedNpv || null, expectedPaybackMonths || null, horizonMonths || 36, baselineRevenue || null, baselineCost || null, expectedRevenueDelta || null, expectedCostDelta || null, effectStartDate || null, assumptionsText || null, assumptionsOwner || null, confidence || 'medium', (req as any).user?.id]
  );
  res.json({ success: true });
}));

// ============================================================
// T046: ROI REALIZED VALUES
// ============================================================

router.get('/roi/:initiativeId/realized', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const rows = await dbAll(
    `SELECT * FROM roi_realized_values WHERE initiative_id = ? AND organization_id = ? ORDER BY period_month DESC`,
    [req.params.initiativeId, orgId]
  );
  res.json({ success: true, data: rows || [] });
}));

router.post('/roi/:initiativeId/realized', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const { initiativeId } = req.params;
  const { periodMonth, realizedRevenueDelta, realizedCostDelta, realizedSavings, source, varianceNotes } = req.body;
  const id = uuidv4().replace(/-/g, '');
  await dbRun(
    `INSERT INTO roi_realized_values (id, initiative_id, organization_id, period_month, realized_revenue_delta, realized_cost_delta, realized_savings, source, variance_notes, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, initiativeId, orgId, periodMonth, realizedRevenueDelta || null, realizedCostDelta || null, realizedSavings || null, source || 'manual', varianceNotes || null, (req as any).user?.id]
  );
  res.json({ success: true, data: { id } });
}));

router.get('/roi/:initiativeId/variance', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const { initiativeId } = req.params;
  const assumptions = await dbGet(
    `SELECT * FROM roi_assumptions WHERE initiative_id = ? AND organization_id = ?`,
    [initiativeId, orgId]
  );
  const realized = await dbAll(
    `SELECT * FROM roi_realized_values WHERE initiative_id = ? AND organization_id = ? ORDER BY period_month`,
    [initiativeId, orgId]
  );
  const realizedList = (realized || []) as any[];

  if (!assumptions) {
    return res.json({ success: true, data: { hasAssumptions: false, variance: null } });
  }

  const ass = assumptions as any;
  const totalRealizedRevDelta = realizedList.reduce((s, r) => s + (r.realized_revenue_delta || 0), 0);
  const totalRealizedCostDelta = realizedList.reduce((s, r) => s + (r.realized_cost_delta || 0), 0);
  const totalRealizedSavings = realizedList.reduce((s, r) => s + (r.realized_savings || 0), 0);

  const projectedBenefit = (ass.expected_revenue_delta || 0) + (ass.expected_cost_delta || 0);
  const realizedBenefit = totalRealizedRevDelta + totalRealizedCostDelta + totalRealizedSavings;
  const varianceAbs = realizedBenefit - projectedBenefit;
  const variancePct = projectedBenefit !== 0 ? (varianceAbs / Math.abs(projectedBenefit)) * 100 : 0;

  res.json({
    success: true,
    data: {
      hasAssumptions: true,
      projected: { revenueDelta: ass.expected_revenue_delta, costDelta: ass.expected_cost_delta, totalBenefit: projectedBenefit, capex: ass.capex, opexAnnual: ass.opex_annual, roiPercent: ass.expected_roi_percent, npv: ass.expected_npv, paybackMonths: ass.expected_payback_months, horizonMonths: ass.horizon_months, confidence: ass.confidence },
      realized: { revenueDelta: totalRealizedRevDelta, costDelta: totalRealizedCostDelta, savings: totalRealizedSavings, totalBenefit: realizedBenefit, dataPoints: realizedList.length },
      variance: { absolute: varianceAbs, percent: Math.round(variancePct * 10) / 10, status: variancePct > 10 ? 'above_plan' : variancePct < -10 ? 'below_plan' : 'on_track' },
    },
  });
}));

// ============================================================
// T048: KPI ATTRIBUTION
// ============================================================

router.get('/attribution/:kpiId', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const { kpiId } = req.params;
  const periodStart = (req.query.periodStart as string) || new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const periodEnd = (req.query.periodEnd as string) || new Date().toISOString().slice(0, 10);
  const result = await computeAttribution(kpiId, orgId, periodStart, periodEnd);
  res.json({ success: true, data: result });
}));

router.post('/attribution/:kpiId/snapshot', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const { kpiId } = req.params;
  const { periodStart, periodEnd } = req.body;
  const result = await computeAttribution(kpiId, orgId, periodStart, periodEnd);
  const id = uuidv4().replace(/-/g, '');
  await dbRun(
    `INSERT INTO kpi_attribution_snapshots (id, kpi_id, organization_id, period_start, period_end, kpi_delta, contributions, unexplained_remainder, unexplained_percent, overall_confidence, confidence_reasons, assumptions, algorithm_version, computed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, kpiId, orgId, periodStart, periodEnd, result.kpiDelta, JSON.stringify(result.contributions), result.unexplainedRemainder, result.unexplainedPercent, result.overallConfidence, JSON.stringify(result.confidenceReasons), JSON.stringify(result.assumptions), 'v1_heuristic', (req as any).user?.id]
  );
  res.json({ success: true, data: { ...result, snapshotId: id } });
}));

router.get('/attribution/:kpiId/history', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const rows = await dbAll(
    `SELECT * FROM kpi_attribution_snapshots WHERE kpi_id = ? AND organization_id = ? ORDER BY computed_at DESC LIMIT 20`,
    [req.params.kpiId, orgId]
  );
  res.json({ success: true, data: (rows || []).map((r: any) => ({ ...r, contributions: JSON.parse(r.contributions || '[]'), confidence_reasons: JSON.parse(r.confidence_reasons || '[]'), assumptions: JSON.parse(r.assumptions || '[]') })) });
}));

// ============================================================
// T049: FINANCIAL STATEMENT LINES
// ============================================================

router.get('/financial/statement-lines', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const rows = await dbAll(
    `SELECT * FROM financial_statement_lines WHERE (organization_id IS NULL OR organization_id = ?) ORDER BY statement_type, sort_order`,
    [orgId]
  );
  res.json({ success: true, data: rows || [] });
}));

router.post('/financial/statement-lines', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const { statementType, lineCode, lineName, lineNamePl, parentLineId, sortOrder } = req.body;
  const id = uuidv4().replace(/-/g, '');
  await dbRun(
    `INSERT INTO financial_statement_lines (id, organization_id, statement_type, line_code, line_name, line_name_pl, parent_line_id, sort_order, is_system)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
    [id, orgId, statementType, lineCode, lineName, lineNamePl || null, parentLineId || null, sortOrder || 0]
  );
  res.json({ success: true, data: { id } });
}));

// ============================================================
// T049: KPI -> FINANCIAL MAPPING
// ============================================================

router.get('/financial/kpi-mappings', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const { kpiId } = req.query;
  let query = `SELECT m.*, fsl.line_name, fsl.statement_type, fsl.line_code, ik.name as kpi_name, ik.unit
               FROM kpi_financial_mappings m
               LEFT JOIN financial_statement_lines fsl ON fsl.id = m.statement_line_id
               LEFT JOIN initiative_kpis ik ON ik.id = m.kpi_id
               WHERE m.organization_id = ?`;
  const params: any[] = [orgId];
  if (kpiId) { query += ' AND m.kpi_id = ?'; params.push(kpiId); }
  const rows = await dbAll(query, params);
  res.json({ success: true, data: rows || [] });
}));

router.post('/financial/kpi-mappings', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const { kpiId, statementLineId, direction, relationshipType, multiplier, formulaParams, confidence, assumptionsText, assumptionsOwner } = req.body;
  const id = uuidv4().replace(/-/g, '');
  await dbRun(
    `INSERT INTO kpi_financial_mappings (id, kpi_id, statement_line_id, organization_id, direction, relationship_type, multiplier, formula_params, confidence, assumptions_text, assumptions_owner, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(kpi_id, statement_line_id, organization_id) DO UPDATE SET
       direction=excluded.direction, relationship_type=excluded.relationship_type, multiplier=excluded.multiplier,
       formula_params=excluded.formula_params, confidence=excluded.confidence, assumptions_text=excluded.assumptions_text,
       assumptions_owner=excluded.assumptions_owner, updated_at=CURRENT_TIMESTAMP`,
    [id, kpiId, statementLineId, orgId, direction, relationshipType || 'linear', multiplier || 1.0, formulaParams ? JSON.stringify(formulaParams) : null, confidence || 'medium', assumptionsText || null, assumptionsOwner || null, (req as any).user?.id]
  );
  res.json({ success: true, data: { id } });
}));

router.delete('/financial/kpi-mappings/:mappingId', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  await dbRun(`DELETE FROM kpi_financial_mappings WHERE id = ? AND organization_id = ?`, [req.params.mappingId, orgId]);
  res.json({ success: true });
}));

router.get('/financial/impact/:kpiId', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const { kpiId } = req.params;

  const mappings = await dbAll(
    `SELECT m.*, fsl.line_name, fsl.line_name_pl, fsl.statement_type, fsl.line_code
     FROM kpi_financial_mappings m
     LEFT JOIN financial_statement_lines fsl ON fsl.id = m.statement_line_id
     WHERE m.kpi_id = ? AND m.organization_id = ?`,
    [kpiId, orgId]
  );

  const kpi = await dbGet(`SELECT * FROM initiative_kpis WHERE id = ?`, [kpiId]) as any;
  const ts = await dbAll(
    `SELECT value, period_start FROM kpi_time_series WHERE kpi_id = ? ORDER BY period_start DESC LIMIT 2`,
    [kpiId]
  );
  const tsList = (ts || []) as any[];
  const kpiDelta = tsList.length >= 2 ? tsList[0].value - tsList[1].value : 0;

  const impacts = ((mappings || []) as any[]).map((m: any) => {
    const estimatedImpact = kpiDelta * (m.multiplier || 1.0) * (m.direction === 'negative' ? -1 : 1);
    return {
      statementLineId: m.statement_line_id,
      lineName: m.line_name,
      lineNamePl: m.line_name_pl,
      statementType: m.statement_type,
      lineCode: m.line_code,
      direction: m.direction,
      relationshipType: m.relationship_type,
      multiplier: m.multiplier,
      confidence: m.confidence,
      kpiDelta,
      estimatedImpact: Math.round(estimatedImpact * 100) / 100,
      assumptions: m.assumptions_text,
    };
  });

  res.json({
    success: true,
    data: {
      kpiId, kpiName: kpi?.name, kpiUnit: kpi?.unit,
      currentValue: kpi?.current_value, baselineValue: kpi?.baseline_value, targetValue: kpi?.target_value,
      kpiDelta, impacts,
    },
  });
}));

// Portfolio ROI summary
router.get('/roi/portfolio/summary', asyncHandler(async (req, res) => {
  const orgId = getOrgId(req);
  const assumptions = await dbAll(
    `SELECT ra.*, i.name as initiative_name, i.status, i.priority
     FROM roi_assumptions ra
     JOIN initiatives i ON i.id = ra.initiative_id
     WHERE ra.organization_id = ?`,
    [orgId]
  );
  const realized = await dbAll(
    `SELECT initiative_id, SUM(realized_revenue_delta) as total_rev, SUM(realized_cost_delta) as total_cost, SUM(realized_savings) as total_savings, COUNT(*) as data_points
     FROM roi_realized_values WHERE organization_id = ? GROUP BY initiative_id`,
    [orgId]
  );

  const realizedMap: Record<string, any> = {};
  ((realized || []) as any[]).forEach((r: any) => { realizedMap[r.initiative_id] = r; });

  const items = ((assumptions || []) as any[]).map((a: any) => {
    const r = realizedMap[a.initiative_id];
    const projectedBenefit = (a.expected_revenue_delta || 0) + (a.expected_cost_delta || 0);
    const realizedBenefit = r ? (r.total_rev || 0) + (r.total_cost || 0) + (r.total_savings || 0) : 0;
    return {
      initiativeId: a.initiative_id,
      initiativeName: a.initiative_name,
      status: a.status,
      priority: a.priority,
      capex: a.capex,
      opexAnnual: a.opex_annual,
      projectedBenefit,
      realizedBenefit,
      variance: realizedBenefit - projectedBenefit,
      confidence: a.confidence,
      hasRealized: !!r,
    };
  });

  const totalProjected = items.reduce((s, i) => s + i.projectedBenefit, 0);
  const totalRealized = items.reduce((s, i) => s + i.realizedBenefit, 0);
  const totalCapex = items.reduce((s, i) => s + (i.capex || 0), 0);
  const coveragePercent = items.length > 0 ? Math.round((items.filter(i => i.hasRealized).length / items.length) * 100) : 0;

  res.json({
    success: true,
    data: {
      items,
      summary: { totalProjected, totalRealized, totalCapex, totalVariance: totalRealized - totalProjected, initiativeCount: items.length, coveragePercent },
    },
  });
}));

export default router;
