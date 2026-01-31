/**
 * Report Builder Routes
 *
 * API endpoints for the generic Report Builder module.
 * Handles report CRUD, section management, and AI generation.
 */

import { NextFunction, Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import ReportBuilderService from '../services/reportBuilderService.js';
import ReportGenerationService from '../services/reportGenerationService.js';
import logger from '../utils/Logger.js';

const router = Router();

// Apply middleware
router.use(authRateLimiter);
router.use(verifyToken);
router.use(demoContextMiddleware);

// Helper to get auth context
function getAuthContext(req: any): { userId: string; organizationId: string } {
  const userId = req?.user?.id || req?.userId || '';
  const organizationId = req?.user?.organizationId || req?.organizationId || 'org-default';
  return { userId, organizationId };
}

// ==========================================
// SOURCE ENDPOINTS
// ==========================================

/**
 * GET /api/report-builder/sources/assessment
 * List approved assessments available for report creation
 */
router.get('/sources/assessment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);

    const sources = await ReportBuilderService.listAssessmentSources(organizationId);

    res.json({ sources });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing assessment sources:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/sources/assessment/:sourceId
 * Get assessment source data for report
 */
router.get(
  '/sources/assessment/:sourceId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceId } = req.params;
      const { organizationId } = getAuthContext(req);

      // For now, return basic source info
      // Full data will be loaded when report is created
      const sources = await ReportBuilderService.listAssessmentSources(organizationId);
      const source = sources.find((s) => s.id === sourceId);

      if (!source) {
        return res.status(404).json({ error: 'Assessment not found or not approved' });
      }

      res.json(source);
    } catch (err) {
      logger.error('[ReportBuilder] Error getting assessment source:', err);
      next(err);
    }
  }
);

// ==========================================
// TEMPLATE ENDPOINTS
// ==========================================

/**
 * GET /api/report-builder/templates/:sourceType
 * Get default template for source type
 */
router.get('/templates/:sourceType', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceType } = req.params;
    const { framework } = req.query;

    const template = await ReportBuilderService.getTemplateForSource(
      sourceType.toUpperCase() as any,
      framework as string | undefined
    );

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (err) {
    logger.error('[ReportBuilder] Error getting template:', err);
    next(err);
  }
});

// ==========================================
// REPORT CRUD ENDPOINTS
// ==========================================

/**
 * POST /api/report-builder
 * Create new report from source
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, organizationId } = getAuthContext(req);
    const { sourceType, sourceId, title, description, templateId } = req.body;

    if (!sourceType || !sourceId || !title) {
      return res.status(400).json({ error: 'sourceType, sourceId, and title are required' });
    }

    const result = await ReportBuilderService.createReport({
      organizationId,
      sourceType: sourceType.toUpperCase(),
      sourceId,
      title,
      description,
      createdBy: userId,
      templateId,
    });

    logger.info('[ReportBuilder] Report created', { reportId: result.report.id, userId });

    res.status(201).json(result);
  } catch (err: any) {
    logger.error('[ReportBuilder] Error creating report:', err);
    if (err.message?.includes('not found') || err.message?.includes('not approved')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/report-builder
 * List reports for organization
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const { status, sourceType, search } = req.query;

    const reports = await ReportBuilderService.listReports(organizationId, {
      status: status as any,
      sourceType: sourceType as any,
      search: search as string,
    });

    res.json({ reports, total: reports.length });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing reports:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/:id
 * Get report with sections
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { organizationId } = getAuthContext(req);

    const result = await ReportBuilderService.getReport(id, organizationId);

    if (!result) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(result);
  } catch (err) {
    logger.error('[ReportBuilder] Error getting report:', err);
    next(err);
  }
});

/**
 * DELETE /api/report-builder/:id
 * Delete report
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { organizationId } = getAuthContext(req);

    // Verify report exists and belongs to org
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Only allow deletion of DRAFT reports
    if (report.report.status !== 'DRAFT' && report.report.status !== 'GENERATED') {
      return res.status(400).json({ error: 'Only draft or generated reports can be deleted' });
    }

    // Delete (cascade will handle sections)
    const { getDatabase } = await import('../database/index.js');
    const db = getDatabase();
    await new Promise<void>((resolve, reject) => {
      db.run('DELETE FROM report_builder_reports WHERE id = ?', [id], (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    logger.info('[ReportBuilder] Report deleted', { reportId: id });

    res.json({ success: true });
  } catch (err) {
    logger.error('[ReportBuilder] Error deleting report:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/duplicate
 * Duplicate report
 */
router.post('/:id/duplicate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userId, organizationId } = getAuthContext(req);
    const { title } = req.body;

    const result = await ReportBuilderService.duplicateReport(id, organizationId, userId, title);

    logger.info('[ReportBuilder] Report duplicated', {
      originalId: id,
      newId: result.report.id,
    });

    res.status(201).json(result);
  } catch (err: any) {
    logger.error('[ReportBuilder] Error duplicating report:', err);
    if (err.message === 'Report not found') {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// ==========================================
// SECTION CONFIGURATION ENDPOINTS
// ==========================================

/**
 * PUT /api/report-builder/:id/config
 * Update section configuration (enable/disable, order, options)
 */
router.put('/:id/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { sections } = req.body;

    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({ error: 'sections array is required' });
    }

    const updatedSections = await ReportBuilderService.updateSectionConfig(id, sections);

    logger.info('[ReportBuilder] Section config updated', {
      reportId: id,
      sectionsUpdated: sections.length,
    });

    res.json({ sections: updatedSections });
  } catch (err) {
    logger.error('[ReportBuilder] Error updating section config:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/sections
 * Add custom section
 */
router.post('/:id/sections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, sectionType, afterSectionKey, length, language } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const section = await ReportBuilderService.addCustomSection(id, {
      title,
      sectionType,
      afterSectionKey,
      length,
      language,
    });

    logger.info('[ReportBuilder] Custom section added', {
      reportId: id,
      sectionKey: section.sectionKey,
    });

    res.status(201).json({ section });
  } catch (err) {
    logger.error('[ReportBuilder] Error adding custom section:', err);
    next(err);
  }
});

/**
 * DELETE /api/report-builder/:id/sections/:sectionKey
 * Remove section
 */
router.delete(
  '/:id/sections/:sectionKey',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, sectionKey } = req.params;

      const success = await ReportBuilderService.removeSection(id, sectionKey);

      if (!success) {
        return res.status(404).json({ error: 'Section not found' });
      }

      logger.info('[ReportBuilder] Section removed', { reportId: id, sectionKey });

      res.json({ success: true });
    } catch (err: any) {
      logger.error('[ReportBuilder] Error removing section:', err);
      if (err.message?.includes('Cannot remove required')) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  }
);

/**
 * PUT /api/report-builder/:id/sections/:sectionKey/content
 * Update section content (user edit)
 */
router.put(
  '/:id/sections/:sectionKey/content',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, sectionKey } = req.params;
      const { userId } = getAuthContext(req);
      const { content, contentFormat } = req.body;

      if (content === undefined) {
        return res.status(400).json({ error: 'content is required' });
      }

      await ReportBuilderService.updateSectionContent(
        id,
        sectionKey,
        content,
        userId,
        contentFormat || 'markdown'
      );

      logger.info('[ReportBuilder] Section content updated', { reportId: id, sectionKey });

      res.json({ success: true });
    } catch (err) {
      logger.error('[ReportBuilder] Error updating section content:', err);
      next(err);
    }
  }
);

// ==========================================
// GENERATION ENDPOINTS
// ==========================================

/**
 * POST /api/report-builder/:id/generate
 * Generate all sections
 */
router.post('/:id/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userId, organizationId } = getAuthContext(req);
    const { regenerateAll } = req.body;

    const result = await ReportGenerationService.generateFullReport(id, organizationId, userId, {
      regenerateAll,
    });

    logger.info('[ReportBuilder] Report generated', {
      reportId: id,
      totalTokens: result.totalTokens,
      sectionsGenerated: result.generatedSections.length,
    });

    // Get updated report
    const report = await ReportBuilderService.getReport(id, organizationId);

    res.json({
      success: true,
      ...result,
      report: report?.report,
      sections: report?.sections,
    });
  } catch (err: any) {
    logger.error('[ReportBuilder] Error generating report:', err);
    if (err.message?.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/generate-section/:sectionKey
 * Generate or regenerate a single section
 */
router.post(
  '/:id/generate-section/:sectionKey',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, sectionKey } = req.params;
      const { userId, organizationId } = getAuthContext(req);
      const { customPrompt } = req.body;

      const result = await ReportGenerationService.regenerateSection(
        id,
        sectionKey,
        organizationId,
        userId,
        customPrompt
      );

      logger.info('[ReportBuilder] Section generated', {
        reportId: id,
        sectionKey,
        tokensUsed: result.tokensUsed,
      });

      res.json({
        success: true,
        content: result.content,
        tokensUsed: result.tokensUsed,
      });
    } catch (err: any) {
      logger.error('[ReportBuilder] Error generating section:', err);
      if (err.message?.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      next(err);
    }
  }
);

// ==========================================
// WORKFLOW ENDPOINTS
// ==========================================

/**
 * POST /api/report-builder/:id/finalize
 * Finalize report (move to IN_REVIEW)
 */
router.post('/:id/finalize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userId, organizationId } = getAuthContext(req);

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.report.status !== 'GENERATED') {
      return res.status(400).json({ error: 'Report must be generated before finalizing' });
    }

    // Check all enabled sections have content
    const missingContent = report.sections.filter(
      (s) => s.enabled && !s.generatedContent && !s.editedContent
    );

    if (missingContent.length > 0) {
      return res.status(400).json({
        error: 'All enabled sections must have content',
        missingSections: missingContent.map((s) => s.sectionKey),
      });
    }

    await ReportBuilderService.updateReportStatus(id, 'IN_REVIEW', userId);

    logger.info('[ReportBuilder] Report finalized', { reportId: id });

    res.json({ success: true, status: 'IN_REVIEW' });
  } catch (err) {
    logger.error('[ReportBuilder] Error finalizing report:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/approve
 * Approve report
 */
router.post('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userId, organizationId } = getAuthContext(req);

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.report.status !== 'IN_REVIEW') {
      return res.status(400).json({ error: 'Report must be in review to approve' });
    }

    await ReportBuilderService.updateReportStatus(id, 'APPROVED', userId);

    logger.info('[ReportBuilder] Report approved', { reportId: id });

    res.json({ success: true, status: 'APPROVED' });
  } catch (err) {
    logger.error('[ReportBuilder] Error approving report:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/send-back
 * Send report back to generated status
 */
router.post('/:id/send-back', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userId, organizationId } = getAuthContext(req);

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.report.status !== 'IN_REVIEW') {
      return res.status(400).json({ error: 'Report must be in review to send back' });
    }

    await ReportBuilderService.updateReportStatus(id, 'GENERATED', userId);

    logger.info('[ReportBuilder] Report sent back', { reportId: id });

    res.json({ success: true, status: 'GENERATED' });
  } catch (err) {
    logger.error('[ReportBuilder] Error sending report back:', err);
    next(err);
  }
});

// ==========================================
// SOURCE DATA ENDPOINT
// ==========================================

/**
 * GET /api/report-builder/:id/source-data
 * Get source data for report (for preview/reference)
 */
router.get('/:id/source-data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { organizationId } = getAuthContext(req);

    const sourceData = await ReportBuilderService.getSourceDataForReport(id, organizationId);

    if (!sourceData) {
      return res.status(404).json({ error: 'Source data not found' });
    }

    res.json(sourceData);
  } catch (err) {
    logger.error('[ReportBuilder] Error getting source data:', err);
    next(err);
  }
});

export default router;
