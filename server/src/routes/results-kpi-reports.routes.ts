/**
 * Results KPI Reports Routes (V3 R1)
 * Creates KPI report snapshots and opens them in Report Builder.
 */

import { type NextFunction, type Request, type Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import { requireActiveMembership } from '../services/legacyCutover/requireActiveMembership.js';
import * as ReportBuilderService from '../services/reportBuilderService.js';
import {
  createKpiReportSnapshot,
  getKpiReportSnapshot,
  ResultsKpiReportSnapshotError,
} from '../services/results/kpiReportSnapshotService.js';
import {
  correlationIdFromRequest,
  observeWriter,
} from '../services/results/resultsWriterObservationService.js';
import { all as dbAll } from '../utils/DbPromise.js';
import * as queryHelpers from '../utils/queryHelpers.js';

const router = Router();
router.use(verifyToken);
// Strict per-request tenant membership wall — see the identical mount and full
// rationale in `benefits.routes.ts`. Proven hole closed here too: after
// revoking `organization_members`, the first request still created a KPI report
// snapshot with the same signed token.
router.use(requireActiveMembership);

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

function parseJsonObject(input: unknown): Record<string, any> | null {
  if (!input) return null;
  if (typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, any>;
  }
  try {
    const parsed = JSON.parse(String(input));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, any>)
      : null;
  } catch {
    return null;
  }
}

async function createReportArtifactFromSnapshot(params: {
  orgId: string;
  userId: string;
  created: Awaited<ReturnType<typeof createKpiReportSnapshot>>;
}) {
  const { orgId, userId, created } = params;
  const rb = await ReportBuilderService.createReport({
    organizationId: orgId,
    sourceType: 'RESULTS_KPI_REPORT',
    sourceId: created.snapshotId,
    sourceName: created.snapshot.title,
    title: created.snapshot.title,
    description: `KPI review for ${created.snapshot.periodStart}${created.snapshot.periodEnd ? ` → ${created.snapshot.periodEnd}` : ''}`,
    createdBy: userId,
  });

  await ReportBuilderService.updateSectionContent(
    rb.report.id,
    'executive_summary',
    created.markdown.executive_summary,
    userId
  );
  await ReportBuilderService.updateSectionContent(
    rb.report.id,
    'kpi_overview',
    created.markdown.kpi_overview,
    userId
  );
  await ReportBuilderService.updateSectionContent(
    rb.report.id,
    'deviation_cases',
    created.markdown.deviation_cases,
    userId
  );
  await ReportBuilderService.updateSectionContent(
    rb.report.id,
    'action_plan',
    created.markdown.action_plan,
    userId
  );
  await ReportBuilderService.updateSectionContent(
    rb.report.id,
    'appendix',
    created.markdown.appendix,
    userId
  );
  await ReportBuilderService.updateReportStatus(rb.report.id, 'GENERATED', userId);

  return rb.report.id;
}

// ============================================================
// V4-RSLT-01: Metrics semantic layer — KPI definitions + dimensions + slices
// ============================================================

router.get(
  '/metrics-semantic-layer',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const includeHistory =
      String(req.query.includeHistory || '').toLowerCase() === 'true' ||
      String(req.query.includeHistory) === '1';
    const scope =
      String(req.query.scope || 'org_plus_global').toLowerCase() === 'org'
        ? 'org_only'
        : 'org_plus_global';

    try {
      const rows = await queryHelpers.queryAll<any>(
        `SELECT id, organization_id, name, code, description, category, unit, unit_display,
                direction, precision, default_target, default_baseline, formula,
                coalesce(dimensions_json, '[]') as dimensions_json,
                coalesce(slices_json, '[]') as slices_json,
                coalesce(version, 1) as version, is_active,
                COALESCE(is_global, FALSE) as is_global
         FROM kpi_definitions
         WHERE (
           organization_id = ?
           OR (? = 'org_plus_global' AND is_global = TRUE AND organization_id = '*')
         )
           AND (is_active = TRUE OR is_active IS NULL)
         ORDER BY category, coalesce(code, name), coalesce(version, 1) DESC, name`,
        [orgId, scope]
      );

      const parsedDefinitions = (rows || []).map((r: any) => {
        let dimensions: string[] = [];
        let slices: Array<{ dim: string; op: string; val?: string }> = [];
        try {
          dimensions = JSON.parse(r.dimensions_json || '[]');
        } catch {
          /* ignore */
        }
        try {
          slices = JSON.parse(r.slices_json || '[]');
        } catch {
          /* ignore */
        }
        return {
          id: r.id,
          name: r.name,
          code: r.code || null,
          description: r.description || null,
          category: r.category,
          unit: r.unit,
          unitDisplay: r.unit_display || null,
          direction: r.direction,
          defaultTarget: r.default_target,
          defaultBaseline: r.default_baseline,
          formula: r.formula || null,
          dimensions,
          slices,
          version: r.version ?? 1,
          scope: r.is_global ? 'global' : 'organization',
        };
      });

      const definitions = includeHistory
        ? parsedDefinitions
        : Array.from(
            parsedDefinitions
              .reduce((acc, definition) => {
                const key = String(definition.code || definition.name || definition.id);
                if (!acc.has(key)) acc.set(key, definition);
                return acc;
              }, new Map<string, any>())
              .values()
          );

      res.json({
        success: true,
        definitions,
        meta: {
          scope,
          versionMode: includeHistory ? 'history' : 'latest',
          sourceRows: Array.isArray(rows) ? rows.length : 0,
          returnedDefinitions: definitions.length,
        },
      });
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('no such table') || msg.includes('does not exist')) {
        return res.status(503).json({
          success: false,
          error: 'Metrics semantic layer is not initialized',
          code: 'METRICS_LAYER_NOT_READY',
        });
      }
      throw err;
    }
  })
);

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
        s.period_end,
        s.filters_json,
        s.snapshot_json
      FROM report_builder_reports r
      LEFT JOIN results_kpi_report_snapshots s ON s.id = r.source_id
      WHERE r.organization_id = ? AND r.source_type = 'RESULTS_KPI_REPORT'
      ORDER BY r.created_at DESC
      LIMIT 100
      `,
      [orgId]
    );

    const data = (rows || []).map((r: any) => {
      const filters = parseJsonObject(r.filters_json);
      const snapshot = parseJsonObject(r.snapshot_json);
      const stats = snapshot?.stats && typeof snapshot.stats === 'object' ? snapshot.stats : null;
      return {
        id: r.report_id,
        reportId: r.report_id,
        snapshotId: r.snapshot_id,
        title: r.title,
        status: r.status,
        periodStart: r.period_start || null,
        periodEnd: r.period_end || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        templateKey: filters?.templateKey || 'benefits-review',
        aiNarrativeHint: filters?.aiNarrativeHint || null,
        initiativeCount: Array.isArray(filters?.initiativeIds)
          ? filters.initiativeIds.length
          : null,
        kpiCount: Number.isFinite(Number(stats?.kpisTotal)) ? Number(stats.kpisTotal) : null,
        openActionCount: Number.isFinite(Number(stats?.openActions))
          ? Number(stats.openActions)
          : null,
      };
    });

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
    if (!safeStart)
      return res.status(400).json({ success: false, error: 'periodStart is required' });

    const selectedKpiIds: string[] | null = Array.isArray(kpiIds)
      ? (kpiIds as any[]).map((x) => String(x || '').trim()).filter(Boolean)
      : null;

    let created;
    try {
      created = await createKpiReportSnapshot({
        organizationId: orgId,
        periodStart: safeStart,
        periodEnd: periodEnd ? String(periodEnd).slice(0, 10) : null,
        title: title ? String(title) : null,
        createdBy: userId,
        filters: filters && typeof filters === 'object' ? filters : null,
        kpiIds: selectedKpiIds && selectedKpiIds.length ? selectedKpiIds : null,
      });
    } catch (error) {
      if (error instanceof ResultsKpiReportSnapshotError) {
        return res
          .status(error.status)
          .json({ success: false, error: error.message, code: error.code });
      }
      throw error;
    }

    const reportId = await createReportArtifactFromSnapshot({ orgId, userId, created });

    // Writer observability (side-channel; never gates or alters this write).
    observeWriter({
      organizationId: orgId,
      actorUserId: userId,
      writerFamily: 'kpi_reports',
      operation: 'createSnapshot',
      endpoint: 'POST /api/results/kpi-reports',
      correlationId: correlationIdFromRequest(req as never),
    });

    res.json({ success: true, data: { snapshotId: created.snapshotId, reportId } });
  })
);

router.get(
  '/kpi-reports/:snapshotId',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const snapshotId = String(req.params.snapshotId || '').trim();
    if (!snapshotId)
      return res.status(400).json({ success: false, error: 'snapshotId is required' });

    const data = await getKpiReportSnapshot({ organizationId: orgId, snapshotId });
    if (!data) return res.status(404).json({ success: false, error: 'Not found' });

    res.json({ success: true, data });
  })
);

router.post(
  '/kpi-reports/:snapshotId/refresh',
  asyncHandler(async (req, res) => {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const snapshotId = String(req.params.snapshotId || '').trim();
    if (!snapshotId)
      return res.status(400).json({ success: false, error: 'snapshotId is required' });

    const existing = await getKpiReportSnapshot({ organizationId: orgId, snapshotId });
    if (!existing?.snapshot) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const refreshed = await createKpiReportSnapshot({
      organizationId: orgId,
      periodStart: existing.snapshot.periodStart,
      periodEnd: existing.snapshot.periodEnd,
      title: existing.snapshot.title,
      createdBy: userId,
      filters: existing.filters && typeof existing.filters === 'object' ? existing.filters : null,
      kpiIds: Array.isArray(existing.snapshot.kpis)
        ? existing.snapshot.kpis.map((kpi: any) => String(kpi.id || '').trim()).filter(Boolean)
        : null,
    });

    const reportId = await createReportArtifactFromSnapshot({ orgId, userId, created: refreshed });

    observeWriter({
      organizationId: orgId,
      actorUserId: userId,
      writerFamily: 'kpi_reports',
      operation: 'refreshSnapshot',
      endpoint: 'POST /api/results/kpi-reports/:snapshotId/refresh',
      correlationId: correlationIdFromRequest(req as never),
    });

    res.json({ success: true, data: { snapshotId: refreshed.snapshotId, reportId } });
  })
);

export default router;
