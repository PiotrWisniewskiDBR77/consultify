/**
 * Report Builder Routes
 *
 * API endpoints for the generic Report Builder module.
 * Handles report CRUD, section management, and AI generation.
 */

import bcrypt from 'bcryptjs';
import { NextFunction, Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';

import {
  getInvocationProfile,
  getProfilesForSourceType,
  INVOCATION_PROFILES,
} from '../config/reportInvocationProfiles.js';
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
// INVOCATION PROFILES ENDPOINTS
// ==========================================

/**
 * GET /api/report-builder/profiles
 * List all available invocation profiles
 */
router.get('/profiles', async (_req: Request, res: Response, _next: NextFunction) => {
  try {
    const profiles = Object.values(INVOCATION_PROFILES).map((p) => ({
      id: p.id,
      name: p.name,
      namePl: p.namePl,
      description: p.description,
      descriptionPl: p.descriptionPl,
      sourceTypes: p.sourceTypes,
      features: p.features,
    }));

    res.json({ profiles });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing profiles:', err);
    res.status(500).json({ error: 'Failed to list profiles' });
  }
});

/**
 * GET /api/report-builder/profiles/:profileId
 * Get a specific invocation profile with full details
 */
router.get('/profiles/:profileId', async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const { profileId } = req.params;
    const profile = getInvocationProfile(profileId);

    res.json({ profile });
  } catch (err) {
    logger.error('[ReportBuilder] Error getting profile:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * GET /api/report-builder/profiles/for-source/:sourceType
 * Get profiles available for a specific source type
 */
router.get(
  '/profiles/for-source/:sourceType',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { sourceType } = req.params;
      const profiles = getProfilesForSourceType(sourceType.toUpperCase()).map((p) => ({
        id: p.id,
        name: p.name,
        namePl: p.namePl,
        description: p.description,
        descriptionPl: p.descriptionPl,
        sourceTypes: p.sourceTypes,
        features: p.features,
        defaultIntent: p.defaultIntent,
      }));

      res.json({ profiles });
    } catch (err) {
      logger.error('[ReportBuilder] Error getting profiles for source:', err);
      res.status(500).json({ error: 'Failed to get profiles' });
    }
  }
);

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
// BLOCK TYPES (Library)
// ==========================================

/**
 * GET /api/report-builder/block-types
 * List available block types (system + organization).
 */
router.get('/block-types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const blocks = await ReportBuilderService.listBlockTypes(organizationId);
    res.json({ blocks });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing block types:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/block-types
 * Create a new block type for the organization.
 */
router.post('/block-types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId, userId } = getAuthContext(req);
    const {
      name,
      description,
      sourceTypes,
      renderKind,
      promptTemplate,
      inputSchema,
      defaultLength,
      defaultLanguage,
    } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!renderKind || typeof renderKind !== 'string') {
      return res.status(400).json({ error: 'renderKind is required' });
    }

    const created = await ReportBuilderService.createBlockType({
      organizationId,
      userId,
      name,
      description,
      sourceTypes: Array.isArray(sourceTypes) ? sourceTypes : undefined,
      renderKind,
      promptTemplate,
      inputSchema: inputSchema && typeof inputSchema === 'object' ? inputSchema : null,
      defaultLength,
      defaultLanguage,
    } as any);

    res.status(201).json({ block: created });
  } catch (err: any) {
    logger.error('[ReportBuilder] Error creating block type:', err);
    res.status(500).json({ error: err?.message || 'Failed to create block type' });
  }
});

/**
 * PUT /api/report-builder/block-types/:blockTypeId
 * Update an existing org block type.
 */
router.put('/block-types/:blockTypeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId, userId } = getAuthContext(req);
    const { blockTypeId } = req.params;
    const patch = req.body || {};

    await ReportBuilderService.updateBlockType(blockTypeId, organizationId, userId, patch);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('[ReportBuilder] Error updating block type:', err);
    const msg = err?.message || 'Failed to update block type';
    res.status(msg.includes('not found') ? 404 : 400).json({ error: msg });
  }
});

/**
 * DELETE /api/report-builder/block-types/:blockTypeId
 * Deactivate an org block type (soft delete).
 */
router.delete(
  '/block-types/:blockTypeId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, userId } = getAuthContext(req);
      const { blockTypeId } = req.params;
      await ReportBuilderService.deactivateBlockType(blockTypeId, organizationId, userId);
      res.json({ success: true });
    } catch (err: any) {
      logger.error('[ReportBuilder] Error deactivating block type:', err);
      const msg = err?.message || 'Failed to deactivate block type';
      res.status(msg.includes('not found') ? 404 : 400).json({ error: msg });
    }
  }
);

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
    const { sourceType, sourceId, title, description, templateId, config } = req.body;

    if (!sourceType || !sourceId || !title) {
      return res.status(400).json({ error: 'sourceType, sourceId, and title are required' });
    }

    const result = await ReportBuilderService.createReport({
      organizationId,
      sourceType: sourceType.toUpperCase(),
      sourceId,
      title,
      description,
      config:
        config && typeof config === 'object' ? (config as Record<string, unknown>) : undefined,
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
    if (
      report.report.status !== 'CONFIGURING' &&
      report.report.status !== 'DRAFT' &&
      report.report.status !== 'GENERATED'
    ) {
      return res
        .status(400)
        .json({ error: 'Only configuring, draft, or generated reports can be deleted' });
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
 * PUT /api/report-builder/:id/intent
 * Update report-level intent/config (no generation happens here).
 */
router.put('/:id/intent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userId, organizationId } = getAuthContext(req);
    const { config } = req.body;

    // Verify report exists and belongs to org
    const existing = await ReportBuilderService.getReport(id, organizationId);
    if (!existing) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await ReportBuilderService.updateReportConfig(
      id,
      organizationId,
      config && typeof config === 'object' ? (config as Record<string, unknown>) : null,
      userId
    );

    const refreshed = await ReportBuilderService.getReport(id, organizationId);
    res.json({ success: true, report: refreshed?.report });
  } catch (err) {
    logger.error('[ReportBuilder] Error updating intent/config:', err);
    next(err);
  }
});

/**
 * PUT /api/report-builder/:id/config
 * Update section configuration (enable/disable, order, options)
 */
router.put('/:id/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userId, organizationId } = getAuthContext(req);
    const { sections } = req.body;

    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({ error: 'sections array is required' });
    }

    // Verify report exists and belongs to org
    const existing = await ReportBuilderService.getReport(id, organizationId);
    if (!existing) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const updatedSections = await ReportBuilderService.updateSectionConfig(id, sections);

    // If outline/config has been touched, move CONFIGURING -> DRAFT automatically
    if (existing.report.status === 'CONFIGURING') {
      await ReportBuilderService.updateReportStatus(id, 'DRAFT', userId);
    }

    logger.info('[ReportBuilder] Section config updated', {
      reportId: id,
      sectionsUpdated: sections.length,
    });

    const refreshed = await ReportBuilderService.getReport(id, organizationId);
    res.json({ sections: updatedSections, report: refreshed?.report });
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
    const {
      title,
      sectionType,
      afterSectionKey,
      length,
      language,
      blockTypeId,
      blockConfig,
      renderKind,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const section = await ReportBuilderService.addCustomSection(id, {
      title,
      sectionType,
      afterSectionKey,
      length,
      language,
      blockTypeId,
      blockConfig,
      renderKind,
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

// ==========================================
// PDF EXPORT ENDPOINTS
// ==========================================

const ensureExportDir = async (): Promise<string> => {
  const exportDir = path.resolve(process.cwd(), 'exports', 'report-builder');
  await fs.promises.mkdir(exportDir, { recursive: true });
  return exportDir;
};

interface AssessmentMatrixData {
  type: 'assessment_matrix';
  scaleMax: number;
  axes: Array<{
    axisId: string;
    axisName: string;
    score: number;
    maxScore: number;
    gap?: number;
  }>;
}

/**
 * Write PDF for report builder report
 */
const writeReportBuilderPdf = async (
  report: any,
  sections: any[],
  filePath: string
): Promise<void> => {
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Title page
  doc
    .fontSize(24)
    .fillColor('#1e293b')
    .text(report.title || 'Report', { align: 'center' });
  doc.moveDown(0.5);

  if (report.sourceName) {
    doc.fontSize(12).fillColor('#64748b').text(`Source: ${report.sourceName}`, { align: 'center' });
  }
  doc.fontSize(10).fillColor('#94a3b8').text(`Generated: ${new Date().toLocaleDateString()}`, {
    align: 'center',
  });
  doc.moveDown(2);

  // Sections
  const enabledSections = sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  for (const section of enabledSections) {
    const content = section.editedContent || section.generatedContent || '';
    if (!content) continue;

    // Section title
    doc.fontSize(16).fillColor('#1e293b').text(section.title);
    doc.moveDown(0.3);

    // Check if it's a matrix section
    const isMatrix = section.sectionType === 'matrix' || section.renderKind === 'matrix';
    if (isMatrix) {
      try {
        const matrixData = JSON.parse(content) as AssessmentMatrixData;
        if (matrixData.type === 'assessment_matrix' && matrixData.axes) {
          // Render matrix as table
          doc.fontSize(10).fillColor('#64748b').text('Assessment Matrix', { underline: true });
          doc.moveDown(0.3);

          const tableTop = doc.y;
          const colWidth = 80;
          const rowHeight = 20;
          const startX = 48;

          // Header
          doc.fontSize(9).fillColor('#475569');
          doc.text('Axis', startX, tableTop);
          doc.text('Score', startX + 200, tableTop);
          doc.text('Max', startX + 260, tableTop);

          let currentY = tableTop + rowHeight;

          for (const axis of matrixData.axes) {
            doc.fontSize(9).fillColor('#1e293b');
            doc.text(axis.axisName || axis.axisId, startX, currentY, { width: 190 });
            doc.text(axis.score?.toFixed(1) || '—', startX + 200, currentY);
            doc.text(String(axis.maxScore || matrixData.scaleMax), startX + 260, currentY);
            currentY += rowHeight;

            // Page break if needed
            if (currentY > doc.page.height - 100) {
              doc.addPage();
              currentY = 48;
            }
          }

          doc.y = currentY + 10;
        }
      } catch {
        // If parsing fails, render as text
        doc.fontSize(11).fillColor('#334155').text(content);
      }
    } else {
      // Regular markdown content - render as plain text (simplified)
      const plainText = content
        .replace(/#{1,6}\s/g, '') // Remove headers
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.*?)\*/g, '$1') // Remove italic
        .replace(/`(.*?)`/g, '$1') // Remove code
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
        .replace(/^[-*]\s/gm, '• '); // Convert lists

      doc.fontSize(11).fillColor('#334155').text(plainText, {
        align: 'justify',
        lineGap: 2,
      });
    }

    doc.moveDown(1.5);

    // Page break if needed
    if (doc.y > doc.page.height - 150) {
      doc.addPage();
    }
  }

  // Footer on last page
  doc.fontSize(8).fillColor('#94a3b8');
  doc.text(`Report ID: ${report.id}`, 48, doc.page.height - 40);

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
};

/**
 * GET /api/report-builder/:id/export/pdf
 * Export report as PDF
 */
router.get('/:id/export/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userId, organizationId } = getAuthContext(req);

    const reportData = await ReportBuilderService.getReport(id, organizationId);
    if (!reportData) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const exportDir = await ensureExportDir();
    const fileName = `${id}-${Date.now()}.pdf`;
    const filePath = path.join(exportDir, fileName);

    await writeReportBuilderPdf(reportData.report, reportData.sections, filePath);

    // Get file size
    const stats = await fs.promises.stat(filePath);

    // Create export record
    await ReportBuilderService.createExportRecord({
      reportId: id,
      reportType: 'report_builder',
      format: 'pdf',
      filePath,
      fileSize: stats.size,
      language: 'en',
      exportedBy: userId,
    });

    logger.info('[ReportBuilder] PDF exported', { reportId: id, userId });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${reportData.report.title || 'report'}.pdf"`
    );
    return res.sendFile(filePath);
  } catch (err: any) {
    logger.error('[ReportBuilder] Error exporting PDF:', err);
    return res.status(500).json({ error: 'Failed to export PDF', message: err.message });
  }
});

/**
 * GET /api/report-builder/:id/exports
 * List export records for a report
 */
router.get('/:id/exports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { organizationId } = getAuthContext(req);

    // Verify report exists and belongs to org
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const exports = await ReportBuilderService.getExportRecords(id);
    res.json({ exports });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing exports:', err);
    next(err);
  }
});

// ==========================================
// PUBLIC SHARE LINK ENDPOINTS
// ==========================================

/**
 * POST /api/report-builder/:id/share
 * Create a public share link for a report
 */
router.post('/:id/share', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userId, organizationId } = getAuthContext(req);
    const { password, expiresInDays, showCompanyLogo, showConsultinityBranding, customMessage } =
      req.body || {};

    // Verify report exists and belongs to org
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Only allow sharing of approved or generated reports
    if (!['GENERATED', 'IN_REVIEW', 'APPROVED', 'UTILIZED'].includes(report.report.status)) {
      return res.status(400).json({ error: 'Report must be generated before sharing' });
    }

    // Hash password if provided
    let passwordHash: string | undefined;
    if (password && typeof password === 'string') {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Calculate expiration date
    let expiresAt: string | undefined;
    if (expiresInDays && typeof expiresInDays === 'number' && expiresInDays > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + expiresInDays);
      expiresAt = expDate.toISOString();
    }

    const link = await ReportBuilderService.createPublicLink({
      reportId: id,
      reportType: 'report_builder',
      organizationId,
      createdBy: userId,
      passwordHash,
      expiresAt,
      showCompanyLogo,
      showConsultinityBranding,
      customMessage,
    });

    logger.info('[ReportBuilder] Public link created', { reportId: id, linkId: link.id });

    // Return link without password hash
    res.status(201).json({
      link: {
        id: link.id,
        token: link.linkToken,
        url: `/shared/report/${link.linkToken}`,
        hasPassword: Boolean(passwordHash),
        expiresAt: link.expiresAt,
        showCompanyLogo: link.showCompanyLogo,
        showConsultinityBranding: link.showConsultinityBranding,
        customMessage: link.customMessage,
        createdAt: link.createdAt,
      },
    });
  } catch (err) {
    logger.error('[ReportBuilder] Error creating share link:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/:id/share
 * List public share links for a report
 */
router.get('/:id/share', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { organizationId } = getAuthContext(req);

    // Verify report exists and belongs to org
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const links = await ReportBuilderService.getPublicLinks(id, organizationId);

    res.json({
      links: links.map((l) => ({
        id: l.id,
        token: l.linkToken,
        url: `/shared/report/${l.linkToken}`,
        hasPassword: Boolean(l.passwordHash),
        expiresAt: l.expiresAt,
        showCompanyLogo: l.showCompanyLogo,
        showConsultinityBranding: l.showConsultinityBranding,
        customMessage: l.customMessage,
        viewCount: l.viewCount,
        lastViewedAt: l.lastViewedAt,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing share links:', err);
    next(err);
  }
});

/**
 * DELETE /api/report-builder/:id/share/:linkId
 * Revoke a public share link
 */
router.delete('/:id/share/:linkId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, linkId } = req.params;
    const { organizationId } = getAuthContext(req);

    // Verify report exists and belongs to org
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const success = await ReportBuilderService.revokePublicLink(linkId, organizationId);

    if (!success) {
      return res.status(404).json({ error: 'Link not found or already revoked' });
    }

    logger.info('[ReportBuilder] Public link revoked', { reportId: id, linkId });

    res.json({ success: true });
  } catch (err) {
    logger.error('[ReportBuilder] Error revoking share link:', err);
    next(err);
  }
});

// ==========================================
// PUBLIC ACCESS ENDPOINT (no auth required)
// ==========================================

/**
 * GET /api/report-builder/public/:token
 * Access a shared report via public link (no auth required)
 */
router.get(
  '/public/:token',
  // Skip auth middleware for this route - handled in main router setup
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params;
      const { password } = req.query;

      const result = await ReportBuilderService.getPublicLinkByToken(token);

      if (!result) {
        return res.status(404).json({ error: 'Link not found or expired' });
      }

      // Check password if required
      if (result.link.passwordHash) {
        if (!password || typeof password !== 'string') {
          return res.status(401).json({ error: 'Password required', requiresPassword: true });
        }

        const passwordValid = await bcrypt.compare(password, result.link.passwordHash);
        if (!passwordValid) {
          return res.status(401).json({ error: 'Invalid password', requiresPassword: true });
        }
      }

      // Return report data for public view
      res.json({
        report: {
          id: result.report.id,
          title: result.report.title,
          sourceName: result.report.sourceName,
          status: result.report.status,
          createdAt: result.report.createdAt,
        },
        sections: result.sections
          .filter((s) => s.enabled)
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((s) => ({
            sectionKey: s.sectionKey,
            sectionType: s.sectionType,
            title: s.title,
            content: s.editedContent || s.generatedContent || '',
            renderKind: s.renderKind,
          })),
        branding: {
          showCompanyLogo: result.link.showCompanyLogo,
          showConsultinityBranding: result.link.showConsultinityBranding,
          customMessage: result.link.customMessage,
        },
      });
    } catch (err) {
      logger.error('[ReportBuilder] Error accessing public link:', err);
      next(err);
    }
  }
);

export default router;
