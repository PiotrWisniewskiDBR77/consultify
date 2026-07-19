/**
 * Report Generation Routes
 * FLOW-REPORT-001: Generate, export, and share reports
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import reportGenerationService from '../services/reportGenerationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { withRequestTimeout } from '../utils/withRequestTimeout.js';

// H5.2 — ciężkie operacje raportowe/exportowe: budżety czasu.
const REPORT_GENERATE_TIMEOUT_MS = 60_000;
const REPORT_EXPORT_TIMEOUT_MS = 45_000;

const router = Router();

// ==========================================
// PROTECTED ROUTES
// ==========================================

/**
 * POST /api/reports/generate
 * Generate a new report
 */
router.post(
  '/generate',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { reportType, sourceId, language, templateId, includeAppendix } = req.body;

    if (!reportType || !sourceId) {
      return res.status(400).json({ error: 'reportType and sourceId are required' });
    }

    const report = await withRequestTimeout(
      reportGenerationService.generateReport(
        {
          reportType,
          sourceId,
          language,
          templateId,
          includeAppendix,
        },
        orgId
      ),
      REPORT_GENERATE_TIMEOUT_MS,
      {
        code: 'REPORT_GENERATION_TIMEOUT',
        message: 'Generowanie raportu przekroczyło limit czasu',
        details: { reportType, sourceId },
      }
    );

    return res.json({
      success: true,
      report,
    });
  })
);

/**
 * POST /api/reports/:reportId/export/:format
 * Export report to format
 */
router.post(
  '/:reportId/export/:format',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { reportId, format } = req.params;

    if (!['pdf', 'pptx'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Supported: pdf, pptx' });
    }

    const result = await withRequestTimeout(
      reportGenerationService.exportReport(
        reportId,
        format as 'pdf' | 'pptx' | 'docx' | 'xlsx',
        userId
      ),
      REPORT_EXPORT_TIMEOUT_MS,
      {
        code: 'REPORT_EXPORT_TIMEOUT',
        message: 'Eksport raportu przekroczył limit czasu',
        details: { reportId, format },
      }
    );

    return res.json({
      success: true,
      ...result,
      message:
        format === 'pdf' || format === 'pptx'
          ? 'Export ready'
          : 'Export queued. This format will be available soon.',
    });
  })
);

/**
 * POST /api/reports/:reportId/share
 * Create public link for report
 */
router.post(
  '/:reportId/share',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;
    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { reportId } = req.params;
    const {
      reportType,
      password,
      expiresInDays,
      showCompanyLogo,
      showConsultifyBranding,
      customMessage,
    } = req.body;

    const result = await reportGenerationService.createPublicLink({
      reportId,
      reportType: reportType || 'assessment',
      organizationId: orgId,
      userId,
      password,
      expiresInDays,
      showCompanyLogo,
      showConsultifyBranding,
      customMessage,
    });

    return res.json({
      success: true,
      ...result,
    });
  })
);

/**
 * GET /api/reports/templates
 * Get available report templates
 */
router.get(
  '/templates',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await import('../database/Database.js').then((m) => m.getDatabase());

    const templates = await db.all(
      `SELECT * FROM report_templates 
             WHERE (organization_id IS NULL OR organization_id = ?) AND is_active = 1
             ORDER BY is_default DESC, name ASC`,
      [orgId]
    );

    return res.json({
      success: true,
      templates: templates || [],
    });
  })
);

// ==========================================
// PUBLIC ROUTES (no auth)
// ==========================================

/**
 * GET /api/reports/public/:linkToken
 * Access report via public link
 */
router.get(
  '/public/:linkToken',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { linkToken } = req.params;
    const { password } = req.query;

    const result = await reportGenerationService.getPublicReport(
      linkToken,
      password as string | undefined
    );

    if ('error' in result) {
      const statusCode =
        result.error === 'Password required'
          ? 401
          : result.error === 'Invalid password'
            ? 403
            : 404;
      return res.status(statusCode).json({ error: result.error });
    }

    return res.json({
      success: true,
      report: result.report,
    });
  })
);

/**
 * POST /api/reports/public/:linkToken/verify
 * Verify password for protected public link
 */
router.post(
  '/public/:linkToken/verify',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { linkToken } = req.params;
    const { password } = req.body;

    const result = await reportGenerationService.getPublicReport(linkToken, password);

    if ('error' in result) {
      return res.status(403).json({ error: result.error });
    }

    return res.json({
      success: true,
      message: 'Password verified',
    });
  })
);

export default router;
