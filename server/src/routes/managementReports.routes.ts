/**
 * Management Reports Routes
 * Reporting module for management-level reports
 */
import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { resolveAiLanguageFromRequest } from '../services/ai/languagePolicy.js';
import managementReportsService from '../services/managementReportsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

const respondFeatureUnavailable = (res: Response, _detail?: string) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });

router.use(verifyToken);
router.use(demoContextMiddleware);

/**
 * DEC-136 (same class as the DEC-131 hole): the organization is taken from the
 * verified JWT (`req.organizationId`) and NOWHERE else. `?organizationId=` and
 * `body.organizationId` are attacker-controlled and must never be able to
 * widen the caller's tenant. Collection routes that cannot express the check
 * as a 404-on-a-report answer 401 when the token carries no organization.
 */
const requireOrganizationId = (req: AuthRequest, res: Response): string | null => {
  const organizationId = req.organizationId;
  if (!organizationId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return organizationId;
};

const validTypes = [
  'TEAM_MEETING',
  'TEAM_WEEKLY',
  'STEERING_COMMITTEE',
  'PORTFOLIO_HEALTH',
  'RAID',
];

router.post(
  '/generate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    const organizationId = req.organizationId;
    const {
      reportType,
      scope,
      projectId,
      periodDays,
      includeSections,
      excludeSections,
      aiEnhancement,
      requiresApproval,
      approvalConfig,
      language,
    } = req.body;

    if (!userId || !organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!reportType || !validTypes.includes(reportType)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }

    if (!scope) {
      return res.status(400).json({ error: 'scope is required' });
    }

    if (scope === 'PROJECT' && !projectId) {
      return res.status(400).json({ error: 'projectId is required for project scope' });
    }

    // 1.1-Z2 #2: tytuł raportu (`Portfolio RAID Report` itd.) był zawsze po
    // angielsku bez względu na język użytkownika/organizacji — ten sam SSOT
    // jezykowy co reszta serwera (services/ai/languagePolicy.ts), jawny wybór
    // z żądania/nagłówka wygrywa, domyślny `pl` (nie `en`).
    const resolvedLanguage = resolveAiLanguageFromRequest(req, language);

    const report = await managementReportsService.generateReport({
      reportType,
      scope,
      projectId,
      organizationId,
      periodDays,
      includeSections,
      excludeSections,
      aiEnhancement,
      requiresApproval,
      approvalConfig,
      userId,
      language: resolvedLanguage,
    });

    return res.json({ success: true, report });
  })
);

router.get(
  '/history',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = requireOrganizationId(req, res);
    if (!organizationId) return undefined;

    const { reportType, scope, status, limit, offset } = req.query;
    const result = await managementReportsService.getReportHistory({
      organizationId,
      reportType,
      scope,
      status,
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });
    return res.json({ success: true, ...result });
  })
);

// Templates
router.get(
  '/templates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const templates = await managementReportsService.listTemplates(req.organizationId);
    return res.json({ success: true, templates });
  })
);

router.post(
  '/templates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const template = await managementReportsService.createTemplate(
      req.organizationId,
      req.userId,
      req.body
    );
    return res.json({ success: true, template });
  })
);

router.put(
  '/templates/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await managementReportsService.updateTemplate(req.params.id, req.organizationId, req.body);
    return res.json({ success: true });
  })
);

router.delete(
  '/templates/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await managementReportsService.deleteTemplate(req.params.id, req.organizationId);
    return res.json({ success: true });
  })
);

// Schedules
router.get(
  '/schedules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const schedules = await managementReportsService.listSchedules(req.organizationId);
    return res.json({ success: true, schedules });
  })
);

router.post(
  '/schedules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const schedule = await managementReportsService.createSchedule(
      req.organizationId,
      req.userId,
      req.body
    );
    return res.json({ success: true, schedule });
  })
);

router.delete(
  '/schedules/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await managementReportsService.deleteSchedule(req.params.id, req.organizationId);
    return res.json({ success: true });
  })
);

router.get(
  '/pending-approvals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = requireOrganizationId(req, res);
    if (!organizationId) return undefined;
    const pending = await managementReportsService.getPendingApprovals(organizationId);
    return res.json({ success: true, pending });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const report = await managementReportsService.getReport(req.params.id, req.organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    return res.json({ success: true, report });
  })
);

router.post(
  '/:id/submit',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await managementReportsService.submitForApproval(
      req.params.id,
      req.userId,
      req.organizationId
    );
    return res.json({ success: true });
  })
);

router.get(
  '/:id/approval-status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const status = await managementReportsService.getApprovalStatus(
      req.params.id,
      req.organizationId
    );
    return res.json({ success: true, ...status });
  })
);

router.post(
  '/:id/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await managementReportsService.approveReport(
      req.params.id,
      req.userId,
      req.body.comment,
      req.organizationId
    );
    return res.json({ success: true });
  })
);

router.get(
  '/:id/versions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const versions = await managementReportsService.getVersions(req.params.id, req.organizationId);
    return res.json({ success: true, versions });
  })
);

// NOTE: `/versions/compare` MUST stay above `/versions/:versionNumber`, or the
// parameterised route swallows it (`Number('compare')` -> NaN) and the compare
// endpoint is unreachable.
router.get(
  '/:id/versions/compare',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = req.organizationId;
    let comparison;
    try {
      comparison = await managementReportsService.compareVersions(
        req.params.id,
        Number(req.query.v1),
        Number(req.query.v2),
        organizationId
      );
    } catch (error: any) {
      // A tenant miss must stay a 404 — do not let the generic 400 below
      // swallow it, or "foreign report" becomes distinguishable from
      // "versions do not compare".
      if (error?.status === 404) throw error;
      return res.status(400).json({ error: 'Unable to compare versions' });
    }
    return res.json({ success: true, comparison });
  })
);

router.get(
  '/:id/versions/:versionNumber',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const version = await managementReportsService.getVersion(
      req.params.id,
      Number(req.params.versionNumber),
      req.organizationId
    );
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }
    return res.json({ success: true, version });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    let report;
    try {
      report = await managementReportsService.updateReport(
        req.params.id,
        req.body,
        req.userId,
        req.organizationId
      );
    } catch (error: any) {
      // Tenant miss keeps its 404 identity; only genuine update failures
      // become the generic 400.
      if (error?.status === 404) throw error;
      logger.warn('[ManagementReports] Update report failed', {
        error,
        correlationId: (req as any).correlationId,
      });
      return res.status(400).json({
        error: 'Nie udało się zaktualizować raportu',
        code: 'MANAGEMENT_REPORT_UPDATE_FAILED',
      });
    }
    return res.json({ success: true, report });
  })
);

router.post(
  '/:id/comments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const comment = await managementReportsService.addComment(
      req.params.id,
      req.body,
      req.userId,
      req.organizationId
    );
    return res.status(201).json({ success: true, comment });
  })
);

router.get(
  '/:id/comments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const comments = await managementReportsService.getComments(
      req.params.id,
      req.organizationId
    );
    return res.json({ success: true, comments });
  })
);

router.patch(
  '/:id/comments/:commentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const comment = await managementReportsService.updateComment(
      req.params.commentId,
      req.body,
      req.userId,
      req.params.id,
      req.organizationId
    );
    return res.json({ success: true, comment });
  })
);

router.delete(
  '/:id/comments/:commentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await managementReportsService.deleteComment(
      req.params.commentId,
      req.params.id,
      req.organizationId
    );
    return res.json({ success: true });
  })
);

router.get(
  '/:id/audit-log',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const log = await managementReportsService.getAuditLog(
      req.params.id,
      req.query.action,
      req.organizationId
    );
    return res.json({ success: true, log });
  })
);

router.post(
  '/:id/finalize',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const report = await managementReportsService.finalizeReport(
      req.params.id,
      req.userId,
      req.organizationId
    );
    return res.json({ success: true, report });
  })
);

router.post(
  '/:id/unlock',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const report = await managementReportsService.unlockReport(
      req.params.id,
      req.userId,
      req.body.reason,
      req.organizationId
    );
    return res.json({ success: true, report });
  })
);

router.get(
  '/:id/pdf',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const result = await managementReportsService.generateExport(
        req.params.id,
        'pdf',
        req.userId,
        req.organizationId
      );
      return res.json({ success: true, pdfUrl: result.filePath });
    } catch (error: any) {
      const status = Number(error?.status) || 500;
      if (status === 404)
        return res.status(404).json({ success: false, error: 'Report not found' });
      if (error?.code === 'DEPENDENCY_MISSING') {
        return respondFeatureUnavailable(
          res,
          `missing dependency: ${error.dependency || 'unknown'}`
        );
      }
      const msg = String(error?.message || '').toLowerCase();
      if (
        msg.includes('no such table') ||
        msg.includes('no such column') ||
        msg.includes('does not exist') ||
        msg.includes('relation')
      ) {
        return respondFeatureUnavailable(res, 'schema missing');
      }
      throw error;
    }
  })
);

router.get(
  '/:id/pptx',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const result = await managementReportsService.generateExport(
        req.params.id,
        'pptx',
        req.userId,
        req.organizationId
      );
      return res.json({ success: true, pptxUrl: result.filePath });
    } catch (error: any) {
      const status = Number(error?.status) || 500;
      if (status === 404)
        return res.status(404).json({ success: false, error: 'Report not found' });
      if (error?.code === 'DEPENDENCY_MISSING') {
        return respondFeatureUnavailable(
          res,
          `missing dependency: ${error.dependency || 'unknown'}`
        );
      }
      const msg = String(error?.message || '').toLowerCase();
      if (
        msg.includes('no such table') ||
        msg.includes('no such column') ||
        msg.includes('does not exist') ||
        msg.includes('relation')
      ) {
        return respondFeatureUnavailable(res, 'schema missing');
      }
      throw error;
    }
  })
);

router.get(
  '/:id/xlsx',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const result = await managementReportsService.generateExport(
        req.params.id,
        'xlsx',
        req.userId,
        req.organizationId
      );
      return res.json({ success: true, xlsxUrl: result.filePath });
    } catch (error: any) {
      const status = Number(error?.status) || 500;
      if (status === 404)
        return res.status(404).json({ success: false, error: 'Report not found' });
      if (error?.code === 'DEPENDENCY_MISSING')
        return respondFeatureUnavailable(
          res,
          `missing dependency: ${error.dependency || 'unknown'}`
        );
      const msg = String(error?.message || '').toLowerCase();
      if (
        msg.includes('no such table') ||
        msg.includes('no such column') ||
        msg.includes('does not exist') ||
        msg.includes('relation')
      )
        return respondFeatureUnavailable(res, 'schema missing');
      throw error;
    }
  })
);

router.post(
  '/:id/share',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { shareToken, expiresAt } = await managementReportsService.createShareLink(
      req.params.id,
      req.body.expiresInDays,
      req.userId,
      req.organizationId
    );
    return res.json({
      success: true,
      shareUrl: `/reports/share/${shareToken}`,
      expiresAt,
    });
  })
);

router.get(
  '/analytics/usage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = requireOrganizationId(req, res);
    if (!organizationId) return undefined;
    const data = await managementReportsService.getUsageAnalytics(organizationId);
    return res.json({ success: true, data });
  })
);

router.get(
  '/analytics/types',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = requireOrganizationId(req, res);
    if (!organizationId) return undefined;
    const data = await managementReportsService.getTypesAnalytics(organizationId);
    return res.json({ success: true, data });
  })
);

router.post(
  '/bulk-export',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { reportIds, format } = req.body;
    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({ error: 'reportIds are required' });
    }
    const result = await managementReportsService.bulkExport(
      reportIds,
      format || 'pdf',
      req.userId,
      req.organizationId
    );
    return res.json({ success: true, ...result });
  })
);

export default router;
