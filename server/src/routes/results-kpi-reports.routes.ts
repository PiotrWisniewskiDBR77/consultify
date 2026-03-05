/**
 * Results KPI Reports Routes (V3 R1)
 * Creates KPI report snapshots and opens them in Report Builder.
 */

import { type NextFunction, type Request, type Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import * as ReportBuilderService from '../services/reportBuilderService.js';
import { createKpiReportSnapshot, getKpiReportSnapshot } from '../services/results/kpiReportSnapshotService.js';
import { all as dbAll } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
router.use(verifyToken);

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

function getOrgId(req: any): string {
  return req.user?.organizationId || req.user?.organization_id || '';
}

function getUserId(req: any): string {
  return req.user?.id || req.user?.userId || '';
}

// ============================================================
// V4-RSLT-01: Metrics semantic layer — KPI definitions + dimensions
// ============================================================

router.get(
  '/kpi-definitions',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const rows = await dbAll<any>(
      `SELECT k.id, k.organization_id, k.initiative_id, k.name, k.unit, k.target_value,
              k.baseline_value, k.current_value, k.direction, k.threshold_mode,
              k.amber_threshold_pct, k.red_threshold_pct, k.owner_user_id,
              i.name as initiative_name
       FROM initiative_kpis k
       LEFT JOIN initiatives i ON i.id = k.initiative_id
       WHERE (k.organization_id = ? OR (k.organization_id IS NULL AND i.organization_id = ?))
       ORDER BY k.name`,
      [orgId, orgId]
    );

    const defs = (rows || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      initiativeId: r.initiative_id,
      initiativeName: r.initiative_name,
      unit: r.unit,
      targetValue: r.target_value,
      baselineValue: r.baseline_value,
      currentValue: r.current_value,
      direction: r.direction || 'HIGHER_IS_BETTER',
      thresholdMode: r.threshold_mode || 'PERCENT_FROM_TARGET',
      amberThresholdPct: r.amber_threshold_pct,
      redThresholdPct: r.red_threshold_pct,
    }));

    res.json({ success: true, definitions: defs });
  })
);

// ============================================================
// KPI Reports
// ============================================================

router.get(
  '/kpi-reports',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const rows = await dbAll<any>(
      `
      SELECT
        r.id AS report_id,
        r.title,
        r.status,
        r.created_at,
        r.updated_at,
        r.source_id AS snapshot_id,
        s.period_start,
        s.period_end
      FROM report_builder_reports r
      LEFT JOIN results_kpi_report_snapshots s ON s.id = r.source_id
      WHERE r.organization_id = ? AND r.source_type = 'RESULTS_KPI_REPORT'
      ORDER BY r.created_at DESC
      LIMIT 100
      `,
      [orgId]
    );

    const data = (rows || []).map((r: any) => ({
      id: r.report_id,
      reportId: r.report_id,
      snapshotId: r.snapshot_id,
      title: r.title,
      status: r.status,
      periodStart: r.period_start || null,
      periodEnd: r.period_end || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json({ success: true, data });
  })
);

router.post(
  '/kpi-reports',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { periodStart, periodEnd, title, filters, kpiIds } = req.body || {};
    const safeStart = String(periodStart || '').slice(0, 10);
    if (!safeStart) return res.status(400).json({ success: false, error: 'periodStart is required' });

    const selectedKpiIds: string[] | null = Array.isArray(kpiIds)
      ? (kpiIds as any[])
          .map((x) => String(x || '').trim())
          .filter(Boolean)
      : null;

    const created = await createKpiReportSnapshot({
      organizationId: orgId,
      periodStart: safeStart,
      periodEnd: periodEnd ? String(periodEnd).slice(0, 10) : null,
      title: title ? String(title) : null,
      createdBy: userId,
      filters: filters && typeof filters === 'object' ? filters : null,
      kpiIds: selectedKpiIds && selectedKpiIds.length ? selectedKpiIds : null,
    });

    const rb = await ReportBuilderService.createReport({
      organizationId: orgId,
      sourceType: 'RESULTS_KPI_REPORT',
      sourceId: created.snapshotId,
      sourceName: created.snapshot.title,
      title: created.snapshot.title,
      description: `KPI review for ${created.snapshot.periodStart}${created.snapshot.periodEnd ? ` → ${created.snapshot.periodEnd}` : ''}`,
      createdBy: userId,
    });

    // Prefill sections with snapshot markdown (best-effort)
    try {
      await ReportBuilderService.updateSectionContent(rb.report.id, 'executive_summary', created.markdown.executive_summary, userId);
      await ReportBuilderService.updateSectionContent(rb.report.id, 'kpi_overview', created.markdown.kpi_overview, userId);
      await ReportBuilderService.updateSectionContent(rb.report.id, 'deviation_cases', created.markdown.deviation_cases, userId);
      await ReportBuilderService.updateSectionContent(rb.report.id, 'action_plan', created.markdown.action_plan, userId);
      await ReportBuilderService.updateSectionContent(rb.report.id, 'appendix', created.markdown.appendix, userId);
      await ReportBuilderService.updateReportStatus(rb.report.id, 'GENERATED', userId);
    } catch (err: any) {
      logger.warn('[Results KPI Reports] Failed to prefill report sections (non-fatal)', {
        reportId: rb.report.id,
        message: err?.message,
      });
    }

    res.json({ success: true, data: { snapshotId: created.snapshotId, reportId: rb.report.id } });
  })
);

router.get(
  '/kpi-reports/:snapshotId',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const snapshotId = String(req.params.snapshotId || '').trim();
    if (!snapshotId) return res.status(400).json({ success: false, error: 'snapshotId is required' });

    const data = await getKpiReportSnapshot({ organizationId: orgId, snapshotId });
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });

    res.json({ success: true, data });
  })
);

export default router;

