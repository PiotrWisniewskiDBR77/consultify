/**
 * Report Builder Routes
 *
 * API endpoints for the generic Report Builder module.
 * Handles report CRUD, section management, and AI generation.
 */

import bcrypt from 'bcryptjs';
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from 'docx';
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
import { default as defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import ReportBuilderCommentsService from '../services/reportBuilderCommentsService.js';
import ReportBuilderService from '../services/reportBuilderService.js';
import ReportGenerationService from '../services/reportGenerationService.js';
import logger from '../utils/Logger.js';

const router = Router();

// Apply middleware (use default API limiter – 1000 req/15min in dev, not the restrictive auth limiter)
router.use(defaultRateLimiter);
router.use(verifyToken);
router.use(demoContextMiddleware);

// Helper to get auth context
function getAuthContext(req: any): { userId: string; organizationId: string } {
  const userId = req?.user?.id || req?.userId || '';
  const organizationId = req?.user?.organizationId || req?.organizationId || 'org-default';
  return { userId, organizationId };
}

// Helper to safely extract string from params (handles string | string[])
function paramStr(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
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
    const profileId = paramStr(req.params.profileId);
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
      const sourceType = paramStr(req.params.sourceType);
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
      const sourceId = paramStr(req.params.sourceId);
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

/**
 * GET /api/report-builder/sources/interview
 * List completed interviews available for report creation
 */
router.get('/sources/interview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const { getDatabase } = await import('../database/index.js');
    const db = getDatabase();

    const sessions = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT s.id, s.name, s.status, s.total_questions, s.answered_questions,
                s.template_id, s.completed_at, s.created_at, s.updated_at,
                COALESCE(
                  NULLIF(
                    TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')),
                    ''
                  ),
                  u.email,
                  u.id
                ) as ownerName
         FROM interview_sessions s
         LEFT JOIN users u ON u.id = s.owner_id
         WHERE s.organization_id = ? AND s.status IN ('completed', 'in_progress')
         ORDER BY s.updated_at DESC
         LIMIT 100`,
        [organizationId],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const sources = sessions.map((s) => ({
      id: s.id,
      sourceType: 'INTERVIEW',
      name: s.name || 'Interview Session',
      status: s.status,
      framework: 'INTERVIEW',
      totalQuestions: s.total_questions || 0,
      answeredQuestions: s.answered_questions || 0,
      completionPercent:
        s.total_questions > 0 ? Math.round((s.answered_questions / s.total_questions) * 100) : 0,
      ownerName: s.ownerName || 'Unknown',
      completedAt: s.completed_at,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    res.json({ sources });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing interview sources:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/sources/interview/:sourceId
 * Get interview source data for report generation
 */
router.get(
  '/sources/interview/:sourceId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sourceId = paramStr(req.params.sourceId);
      const { organizationId } = getAuthContext(req);
      const { getDatabase } = await import('../database/index.js');
      const db = getDatabase();

      const session = await new Promise<any>((resolve, reject) => {
        db.get(
          `SELECT s.*,
                  COALESCE(
                    NULLIF(
                      TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')),
                      ''
                    ),
                    u.email,
                    u.id
                  ) as ownerName
           FROM interview_sessions s
           LEFT JOIN users u ON u.id = s.owner_id
           WHERE s.id = ? AND s.organization_id = ?`,
          [sourceId, organizationId],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!session) {
        return res.status(404).json({ error: 'Interview session not found' });
      }

      // Get questions and answers
      const questions = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT id, category, question_text, answer_text, status, confidence_score, tags
           FROM interview_questions
           WHERE session_id = ? AND organization_id = ?
           ORDER BY sort_order ASC`,
          [sourceId, organizationId],
          (err: Error | null, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      // Get notes
      const notes = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT id, category, title, content, created_by
           FROM interview_notes
           WHERE session_id = ? AND organization_id = ?
           ORDER BY created_at ASC`,
          [sourceId, organizationId],
          (err: Error | null, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      const safeJsonParse = (v: string | null | undefined, fallback: any) => {
        if (!v) return fallback;
        try {
          return JSON.parse(v);
        } catch {
          return fallback;
        }
      };

      res.json({
        id: session.id,
        sourceType: 'INTERVIEW',
        name: session.name || 'Interview Session',
        status: session.status,
        ownerName: session.ownerName || 'Unknown',
        totalQuestions: session.total_questions || 0,
        answeredQuestions: session.answered_questions || 0,
        summaryFacts: safeJsonParse(session.summary_facts, []),
        summaryGaps: safeJsonParse(session.summary_gaps, []),
        summaryConstraints: safeJsonParse(session.summary_constraints, []),
        summaryPainPoints: safeJsonParse(session.summary_pain_points, []),
        questions: questions.map((q) => ({
          id: q.id,
          category: q.category,
          question: q.question_text,
          answer: q.answer_text || '',
          status: q.status,
          confidence: q.confidence_score || 0,
          tags: safeJsonParse(q.tags, []),
        })),
        notes: notes.map((n) => ({
          id: n.id,
          category: n.category,
          title: n.title,
          content: n.content,
        })),
        completedAt: session.completed_at,
        createdAt: session.created_at,
      });
    } catch (err) {
      logger.error('[ReportBuilder] Error getting interview source:', err);
      next(err);
    }
  }
);

/**
 * GET /api/report-builder/sources/tool
 * List tool sessions available for report creation
 */
router.get('/sources/tool', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const { getDatabase } = await import('../database/index.js');
    const db = getDatabase();

    const sessions = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT ts.id, ts.name, ts.tool_type, ts.status, ts.completion_percent,
                ts.confidence_avg, ts.created_at, ts.updated_at,
                u.name as creatorName
         FROM tool_sessions ts
         LEFT JOIN users u ON u.id = ts.created_by
         WHERE ts.organization_id = ?
         ORDER BY ts.updated_at DESC
         LIMIT 100`,
        [organizationId],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const sources = sessions.map((s) => ({
      id: s.id,
      sourceType: 'TOOL',
      name: s.name || 'Tool Session',
      status: s.status || 'DRAFT',
      framework: s.tool_type || 'TOOL',
      toolType: s.tool_type,
      completionPercent: s.completion_percent || 0,
      confidenceAvg: s.confidence_avg || 0,
      creatorName: s.creatorName || 'Unknown',
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    res.json({ sources });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing tool sources:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/sources/tool/:sourceId
 * Get tool session source data for report generation
 */
router.get('/sources/tool/:sourceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sourceId = paramStr(req.params.sourceId);
    const { organizationId } = getAuthContext(req);
    const { getDatabase } = await import('../database/index.js');
    const db = getDatabase();

    const session = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT ts.*, u.name as creatorName
           FROM tool_sessions ts
           LEFT JOIN users u ON u.id = ts.created_by
           WHERE ts.id = ? AND ts.organization_id = ?`,
        [sourceId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!session) {
      return res.status(404).json({ error: 'Tool session not found' });
    }

    // Get related tool works
    const toolWorks = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT tw.id, tw.name, tw.description, tw.tool_id, tw.status, tw.progress, tw.work_data
           FROM tool_works tw
           LEFT JOIN tools t ON t.id = tw.tool_id
           WHERE tw.organization_id = ?
           ORDER BY tw.updated_at DESC
           LIMIT 20`,
        [organizationId],
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const safeJsonParse = (v: string | null | undefined, fallback: any) => {
      if (!v) return fallback;
      try {
        return JSON.parse(v);
      } catch {
        return fallback;
      }
    };

    res.json({
      id: session.id,
      sourceType: 'TOOL',
      name: session.name || 'Tool Session',
      status: session.status,
      toolType: session.tool_type,
      completionPercent: session.completion_percent || 0,
      confidenceAvg: session.confidence_avg || 0,
      creatorName: session.creatorName || 'Unknown',
      answers: safeJsonParse(session.answers_json, {}),
      contextSnapshot: safeJsonParse(session.context_snapshot, {}),
      toolWorks: toolWorks.map((tw) => ({
        id: tw.id,
        name: tw.name,
        description: tw.description,
        toolId: tw.tool_id,
        status: tw.status,
        progress: tw.progress || 0,
        data: safeJsonParse(tw.work_data, {}),
      })),
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    });
  } catch (err) {
    logger.error('[ReportBuilder] Error getting tool source:', err);
    next(err);
  }
});

// ==========================================
// TEMPLATE MARKETPLACE ENDPOINTS
// ==========================================

/**
 * GET /api/report-builder/templates
 * List all available templates (system + organization)
 */
router.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = getAuthContext(req);
    const { sourceType, isPublic, isSystem } = req.query;

    const templates = await ReportBuilderService.listTemplates(organizationId, {
      sourceType: sourceType as string | undefined,
      isPublic: isPublic === 'true',
      isSystem: isSystem === 'true',
    });

    res.json({ templates });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing templates:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/templates
 * Create a new report template
 */
router.post('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId, userId } = getAuthContext(req);
    const { name, description, sourceType, reportType, sections, defaultOptions, isPublic } =
      req.body;

    if (!name || !sourceType || !sections) {
      return res.status(400).json({ error: 'Name, sourceType, and sections are required' });
    }

    const templateId = uuidv4();
    const template = await ReportBuilderService.createTemplate({
      id: templateId,
      organizationId,
      name,
      description,
      sourceType,
      reportType,
      sections,
      defaultOptions,
      isPublic: isPublic || false,
      createdBy: userId,
    });

    logger.info('[ReportBuilder] Template created', { templateId, userId });
    res.status(201).json({ template });
  } catch (err) {
    logger.error('[ReportBuilder] Error creating template:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/templates/:templateId/details
 * Get template details by ID
 */
router.get(
  '/templates/:templateId/details',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const templateId = paramStr(req.params.templateId);
      const { organizationId } = getAuthContext(req);

      const template = await ReportBuilderService.getTemplateById(templateId, organizationId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Normalize: include parsed JSON fields for frontend convenience
      const sections =
        (template as any).sections_json && typeof (template as any).sections_json === 'string'
          ? JSON.parse((template as any).sections_json || '[]')
          : (template as any).sections || [];
      const defaultOptions =
        (template as any).default_options_json &&
        typeof (template as any).default_options_json === 'string'
          ? JSON.parse((template as any).default_options_json || 'null')
          : (template as any).defaultOptions || null;

      res.json({
        template: {
          ...template,
          sections,
          defaultOptions,
        },
      });
    } catch (err) {
      logger.error('[ReportBuilder] Error getting template:', err);
      next(err);
    }
  }
);

/**
 * PUT /api/report-builder/templates/:templateId
 * Update a template
 */
router.put('/templates/:templateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templateId = paramStr(req.params.templateId);
    const { organizationId, userId } = getAuthContext(req);
    const { name, description, sections, defaultOptions, isPublic } = req.body;

    const template = await ReportBuilderService.updateTemplate(templateId, organizationId, {
      name,
      description,
      sections,
      defaultOptions,
      isPublic,
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found or not editable' });
    }

    logger.info('[ReportBuilder] Template updated', { templateId, userId });
    res.json({ template });
  } catch (err) {
    logger.error('[ReportBuilder] Error updating template:', err);
    next(err);
  }
});

/**
 * DELETE /api/report-builder/templates/:templateId
 * Delete a template
 */
router.delete('/templates/:templateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templateId = paramStr(req.params.templateId);
    const { organizationId, userId } = getAuthContext(req);

    const deleted = await ReportBuilderService.deleteTemplate(templateId, organizationId);
    if (!deleted) {
      return res.status(404).json({ error: 'Template not found or cannot be deleted' });
    }

    logger.info('[ReportBuilder] Template deleted', { templateId, userId });
    res.json({ success: true });
  } catch (err) {
    logger.error('[ReportBuilder] Error deleting template:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/templates/:templateId/duplicate
 * Duplicate a template
 */
router.post(
  '/templates/:templateId/duplicate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const templateId = paramStr(req.params.templateId);
      const { organizationId, userId } = getAuthContext(req);
      const { name } = req.body;

      const newTemplate = await ReportBuilderService.duplicateTemplate(
        templateId,
        organizationId,
        userId,
        name
      );

      if (!newTemplate) {
        return res.status(404).json({ error: 'Template not found' });
      }

      logger.info('[ReportBuilder] Template duplicated', {
        originalId: templateId,
        newId: newTemplate.id,
        userId,
      });
      res.status(201).json({ template: newTemplate });
    } catch (err) {
      logger.error('[ReportBuilder] Error duplicating template:', err);
      next(err);
    }
  }
);

/**
 * POST /api/report-builder/templates/import
 * Import template from JSON
 */
router.post('/templates/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId, userId } = getAuthContext(req);
    const { templateJson } = req.body;

    if (!templateJson) {
      return res.status(400).json({ error: 'templateJson is required' });
    }

    let templateData;
    try {
      templateData = typeof templateJson === 'string' ? JSON.parse(templateJson) : templateJson;
    } catch {
      return res.status(400).json({ error: 'Invalid JSON format' });
    }

    const templateId = uuidv4();
    const template = await ReportBuilderService.createTemplate({
      id: templateId,
      organizationId,
      name: templateData.name || 'Imported Template',
      description: templateData.description,
      sourceType: templateData.sourceType || 'ASSESSMENT',
      reportType: templateData.reportType,
      sections: templateData.sections || [],
      defaultOptions: templateData.defaultOptions,
      isPublic: false,
      createdBy: userId,
    });

    logger.info('[ReportBuilder] Template imported', { templateId, userId });
    res.status(201).json({ template });
  } catch (err) {
    logger.error('[ReportBuilder] Error importing template:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/templates/:templateId/export
 * Export template as JSON
 */
router.get(
  '/templates/:templateId/export',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const templateId = paramStr(req.params.templateId);
      const { organizationId } = getAuthContext(req);

      const template = await ReportBuilderService.getTemplateById(templateId, organizationId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const exportData = {
        name: template.name,
        description: template.description,
        sourceType: template.source_type,
        reportType: template.report_type,
        sections: JSON.parse(template.sections_json || '[]'),
        defaultOptions: template.default_options_json
          ? JSON.parse(template.default_options_json)
          : null,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${template.name.replace(/[^a-z0-9]/gi, '_')}.json"`
      );
      res.json(exportData);
    } catch (err) {
      logger.error('[ReportBuilder] Error exporting template:', err);
      next(err);
    }
  }
);

// ==========================================
// TEMPLATE SOURCE TYPE ENDPOINT
// ==========================================

/**
 * GET /api/report-builder/templates/:sourceType
 * Get default template for source type
 */
router.get('/templates/:sourceType', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sourceType = paramStr(req.params.sourceType);
    const { framework } = req.query;
    const { organizationId } = getAuthContext(req);

    const template = await ReportBuilderService.getTemplateForSource(
      sourceType.toUpperCase() as any,
      framework as string | undefined,
      organizationId
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
    const blockTypeId = paramStr(req.params.blockTypeId);
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
      const blockTypeId = paramStr(req.params.blockTypeId);
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
    if (
      err.message?.includes('not found') ||
      err.message?.includes('not approved') ||
      err.message?.includes('mismatch')
    ) {
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
    const { status, statusIn, sourceType, sourceId, search } = req.query;

    // Parse statusIn if provided as comma-separated string
    let statusInArray: string[] | undefined;
    if (statusIn && typeof statusIn === 'string') {
      statusInArray = statusIn.split(',').map((s) => s.trim().toUpperCase());
    }

    const reports = await ReportBuilderService.listReports(organizationId, {
      status: status as any,
      statusIn: statusInArray as any,
      sourceType: sourceType as any,
      sourceId: sourceId as string,
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
    const id = paramStr(req.params.id);
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
    const id = paramStr(req.params.id);
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
    const id = paramStr(req.params.id);
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
    const id = paramStr(req.params.id);
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
    const id = paramStr(req.params.id);
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
    const id = paramStr(req.params.id);
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
      const id = paramStr(req.params.id);
      const sectionKey = paramStr(req.params.sectionKey);

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
 * Auto-revert: If report is IN_REVIEW, editing content automatically reverts status to GENERATED
 */
router.put(
  '/:id/sections/:sectionKey/content',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramStr(req.params.id);
      const sectionKey = paramStr(req.params.sectionKey);
      const { userId, organizationId } = getAuthContext(req);
      const { content, contentFormat } = req.body;

      if (content === undefined) {
        return res.status(400).json({ error: 'content is required' });
      }

      // Check current status for auto-revert logic
      const reportData = await ReportBuilderService.getReport(id, organizationId);
      if (!reportData) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const previousStatus = reportData.report.status;
      let statusReverted = false;

      // AUTO-REVERT: Editing content in IN_REVIEW automatically reverts to GENERATED
      if (previousStatus === 'IN_REVIEW') {
        await ReportBuilderService.updateReportStatus(id, 'GENERATED', userId);
        statusReverted = true;
        logger.info('[ReportBuilder] Review invalidated - content edited, reverting to GENERATED', {
          reportId: id,
          sectionKey,
          previousStatus,
          userId,
        });
      }

      await ReportBuilderService.updateSectionContent(
        id,
        sectionKey,
        content,
        userId,
        contentFormat || 'markdown'
      );

      logger.info('[ReportBuilder] Section content updated', { reportId: id, sectionKey });

      res.json({
        success: true,
        statusReverted,
        previousStatus: statusReverted ? previousStatus : undefined,
        currentStatus: statusReverted ? 'GENERATED' : previousStatus,
      });
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
    const id = paramStr(req.params.id);
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
      const id = paramStr(req.params.id);
      const sectionKey = paramStr(req.params.sectionKey);
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
    const id = paramStr(req.params.id);
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
 * Gate: Cannot approve if there are open comments
 */
router.post('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.report.status !== 'IN_REVIEW') {
      return res.status(400).json({ error: 'Report must be in review to approve' });
    }

    // GATE CHECK: No open comments allowed
    const approvalCheck = await ReportBuilderCommentsService.canApproveReport(id);
    if (!approvalCheck.canApprove) {
      logger.warn('[ReportBuilder] Approval blocked - open comments', {
        reportId: id,
        openCount: approvalCheck.openCount,
      });
      return res.status(400).json({
        error: 'Cannot approve report with open comments',
        openCommentsCount: approvalCheck.openCount,
        blockers: approvalCheck.blockers,
      });
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
 * Send report back to draft status for re-editing
 */
router.post('/:id/send-back', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.report.status !== 'IN_REVIEW') {
      return res.status(400).json({ error: 'Report must be in review to send back' });
    }

    await ReportBuilderService.updateReportStatus(id, 'DRAFT', userId);

    logger.info('[ReportBuilder] Report sent back to draft', { reportId: id });

    res.json({ success: true, status: 'DRAFT' });
  } catch (err) {
    logger.error('[ReportBuilder] Error sending report back:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/reject
 * Reject report with comments (IN_REVIEW/APPROVED -> DRAFT)
 */
router.post('/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { reason, comments } = req.body || {};

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const status = report.report.status;
    if (status !== 'IN_REVIEW' && status !== 'APPROVED') {
      return res.status(400).json({ error: 'Report must be IN_REVIEW or APPROVED to reject' });
    }

    await ReportBuilderService.updateReportStatus(id, 'DRAFT', userId);

    logger.info('[ReportBuilder] Report rejected', {
      reportId: id,
      userId,
      reason: reason || comments || '',
    });

    res.json({ success: true, status: 'DRAFT', reason: reason || comments || '' });
  } catch (err) {
    logger.error('[ReportBuilder] Error rejecting report:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/utilize
 * Mark report as utilized (APPROVED/SENT_EXTERNAL -> UTILIZED)
 */
router.post('/:id/utilize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { notes } = req.body || {};

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const status = report.report.status;
    if (status !== 'APPROVED' && status !== 'SENT_INTERNAL' && status !== 'SENT_EXTERNAL') {
      return res.status(400).json({ error: 'Report must be APPROVED or SENT to utilize' });
    }

    await ReportBuilderService.updateReportStatus(id, 'UTILIZED', userId);

    logger.info('[ReportBuilder] Report utilized', { reportId: id, userId, notes });

    res.json({ success: true, status: 'UTILIZED' });
  } catch (err) {
    logger.error('[ReportBuilder] Error utilizing report:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/mark-sent-internal
 * Mark approved report as sent internally
 */
router.post('/:id/mark-sent-internal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.report.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Report must be approved to mark as sent internally' });
    }

    await ReportBuilderService.updateReportStatus(id, 'SENT_INTERNAL', userId);

    logger.info('[ReportBuilder] Report marked as sent internally', { reportId: id, userId });

    res.json({ success: true, status: 'SENT_INTERNAL' });
  } catch (err) {
    logger.error('[ReportBuilder] Error marking report as sent internally:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/mark-sent-external
 * Mark report as sent externally (after sent internally)
 */
router.post('/:id/mark-sent-external', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);

    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.report.status !== 'SENT_INTERNAL') {
      return res.status(400).json({ error: 'Report must be marked as sent internally first' });
    }

    await ReportBuilderService.updateReportStatus(id, 'SENT_EXTERNAL', userId);

    logger.info('[ReportBuilder] Report marked as sent externally', { reportId: id, userId });

    res.json({ success: true, status: 'SENT_EXTERNAL' });
  } catch (err) {
    logger.error('[ReportBuilder] Error marking report as sent externally:', err);
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
    const id = paramStr(req.params.id);
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
  // bufferPages enables adding page numbers after content generation
  const doc = new PDFDocument({ margin: 48, size: 'A4', bufferPages: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const drawHeaderFooter = (pageNumber: number, totalPages: number) => {
    const title = String(report.title || report.name || 'Report');
    const org = report.organizationName ? String(report.organizationName) : '';

    // Header
    doc
      .fontSize(9)
      .fillColor('#64748b')
      .text(org ? `${org} • ${title}` : title, 48, 22, { align: 'left' });
    doc
      .moveTo(48, 36)
      .lineTo(doc.page.width - 48, 36)
      .lineWidth(0.5)
      .strokeColor('#e2e8f0')
      .stroke();

    // Footer
    const footerY = doc.page.height - 34;
    doc
      .moveTo(48, footerY - 6)
      .lineTo(doc.page.width - 48, footerY - 6)
      .lineWidth(0.5)
      .strokeColor('#e2e8f0')
      .stroke();

    doc.fontSize(8).fillColor('#94a3b8').text('Confidential', 48, footerY, { align: 'left' });
    doc
      .fontSize(8)
      .fillColor('#94a3b8')
      .text(`${pageNumber} / ${totalPages}`, 48, footerY, { align: 'right' });
  };

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
  doc.addPage();

  // Sections
  const enabledSections = sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  for (const section of enabledSections) {
    const content = section.editedContent || section.generatedContent || '';
    if (!content) continue;

    // Section title
    doc.fontSize(16).fillColor('#0f172a').text(section.title);
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

  // Add headers/footers with page numbers (skip title page)
  const range = doc.bufferedPageRange(); // { start: 0, count: N }
  const totalPages = range.count;
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    if (i === 0) continue; // title page
    drawHeaderFooter(i + 1, totalPages);
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
};

const escapeHtml = (input: string) =>
  input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

/**
 * Very small markdown-to-HTML formatter (good enough for Word .doc export).
 * We intentionally keep it simple and robust.
 */
const markdownToHtmlLite = (md: string): string => {
  const lines = String(md || '').split(/\r?\n/);
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      closeList();
      out.push('<p>&nbsp;</p>');
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      closeList();
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      closeList();
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      closeList();
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }

    // Bullets
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }

    closeList();

    // Basic inline cleanup (drop markdown markers)
    const cleaned = line
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1');

    out.push(`<p>${escapeHtml(cleaned)}</p>`);
  }

  closeList();
  return out.join('\n');
};

const writeReportBuilderWordDoc = async (report: any, sections: any[], filePath: string) => {
  const title = report.title || report.name || 'Report';
  const subtitleParts: string[] = [];
  if (report.organizationName) subtitleParts.push(String(report.organizationName));
  if (report.sourceFramework) subtitleParts.push(String(report.sourceFramework));
  if (report.sourceName) subtitleParts.push(String(report.sourceName));

  const body: string[] = [];
  body.push(`<h1>${escapeHtml(String(title))}</h1>`);
  if (subtitleParts.length) {
    body.push(`<p><em>${escapeHtml(subtitleParts.join(' • '))}</em></p>`);
  }
  body.push('<hr />');

  const enabledSections = (sections || [])
    .filter((s) => s && s.enabled)
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  for (const section of enabledSections) {
    const sectionTitle = section.title || section.sectionKey || 'Section';
    body.push(`<h2>${escapeHtml(String(sectionTitle))}</h2>`);
    const content = section.editedContent || section.generatedContent || '';
    body.push(markdownToHtmlLite(String(content)));
    body.push('<br />');
  }

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(String(title))}</title>
    <style>
      body { font-family: Calibri, Arial, sans-serif; color: #0f172a; }
      h1 { font-size: 24pt; margin: 0 0 8pt 0; }
      h2 { font-size: 16pt; margin: 18pt 0 6pt 0; }
      h3 { font-size: 13pt; margin: 14pt 0 6pt 0; }
      p, li { font-size: 11pt; line-height: 1.35; }
      hr { border: 0; border-top: 1px solid #e2e8f0; margin: 10pt 0 14pt 0; }
    </style>
  </head>
  <body>
    ${body.join('\n')}
  </body>
</html>`;

  await fs.promises.writeFile(filePath, html, 'utf8');
};

const markdownToDocxParagraphs = (markdown: string): Paragraph[] => {
  const text = String(markdown || '');
  const lines = text.split('\n');
  const out: Paragraph[] = [];

  for (const raw of lines) {
    const line = raw.replace(/\r/g, '');
    if (!line.trim()) {
      out.push(new Paragraph({ text: '' }));
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      out.push(
        new Paragraph({
          text: line.slice(4).trim(),
          heading: HeadingLevel.HEADING_3,
        })
      );
      continue;
    }
    if (line.startsWith('## ')) {
      out.push(
        new Paragraph({
          text: line.slice(3).trim(),
          heading: HeadingLevel.HEADING_2,
        })
      );
      continue;
    }
    if (line.startsWith('# ')) {
      out.push(
        new Paragraph({
          text: line.slice(2).trim(),
          heading: HeadingLevel.HEADING_1,
        })
      );
      continue;
    }

    // Bullets
    if (/^[-*]\s+/.test(line)) {
      out.push(
        new Paragraph({
          text: line.replace(/^[-*]\s+/, '').trim(),
          bullet: { level: 0 },
        })
      );
      continue;
    }

    // Basic inline cleanup (drop markdown markers)
    const cleaned = line
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1');

    out.push(new Paragraph({ children: [new TextRun(String(cleaned))] }));
  }

  return out;
};

const writeReportBuilderDocx = async (report: any, sections: any[], filePath: string) => {
  const title = report.title || report.name || 'Report';
  const subtitleParts: string[] = [];
  if (report.organizationName) subtitleParts.push(String(report.organizationName));
  if (report.sourceFramework) subtitleParts.push(String(report.sourceFramework));
  if (report.sourceName) subtitleParts.push(String(report.sourceName));

  const enabledSections = (sections || [])
    .filter((s) => s && s.enabled)
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  const children: Paragraph[] = [];

  // Cover-ish header
  children.push(
    new Paragraph({
      text: String(title),
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    })
  );
  if (subtitleParts.length) {
    children.push(
      new Paragraph({
        text: subtitleParts.join(' • '),
        alignment: AlignmentType.CENTER,
      })
    );
  }
  children.push(new Paragraph({ text: '' }));

  // Body
  for (const section of enabledSections) {
    const sectionTitle = section.title || section.sectionKey || 'Section';
    children.push(
      new Paragraph({
        text: String(sectionTitle),
        heading: HeadingLevel.HEADING_1,
      })
    );
    const content = section.editedContent || section.generatedContent || '';
    children.push(...markdownToDocxParagraphs(String(content)));
    children.push(new Paragraph({ text: '' }));
  }

  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun({ text: String(title), size: 18 })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Consultinity Report', size: 16 }),
                  new TextRun('  •  '),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun(' / '),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.promises.writeFile(filePath, buffer);
};

/**
 * GET /api/report-builder/:id/export/pdf
 * Export report as PDF
 */
router.get('/:id/export/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
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
 * GET /api/report-builder/:id/export/doc
 * Export report as a Word document (.docx)
 */
const exportDocx = async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);

    const reportData = await ReportBuilderService.getReport(id, organizationId);
    if (!reportData) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const exportDir = await ensureExportDir();
    const fileName = `${id}-${Date.now()}.docx`;
    const filePath = path.join(exportDir, fileName);

    // Generate real DOCX (client-ready) instead of HTML-in-.doc
    await writeReportBuilderDocx(reportData.report, reportData.sections, filePath);

    const stats = await fs.promises.stat(filePath);

    await ReportBuilderService.createExportRecord({
      reportId: id,
      reportType: 'report_builder',
      format: 'docx',
      filePath,
      fileSize: stats.size,
      language: 'pl',
      exportedBy: userId,
    });

    logger.info('[ReportBuilder] Word (.docx) exported', { reportId: id, userId });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${reportData.report.title || 'report'}.docx"`
    );
    return res.sendFile(filePath);
  } catch (err: any) {
    logger.error('[ReportBuilder] Error exporting Word (.docx):', err);
    return res.status(500).json({ error: 'Failed to export Word', message: err.message });
  }
};

// Backward compatible + explicit endpoints
router.get('/:id/export/doc', exportDocx);
router.get('/:id/export/docx', exportDocx);

/**
 * GET /api/report-builder/:id/export/pptx
 * Export report as PowerPoint presentation
 *
 * Query params:
 *   ?version=2          — use new BCG-grade pipeline (v2)
 *   ?template=corporate — corporate | minimal | modern
 *   ?language=pl        — pl | en
 *   ?confidentiality=confidential — confidential | internal | public
 */
router.get('/:id/export/pptx', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { template, language, version, confidentiality } = req.query;
    const useV2 = version === '2' || version === 'v2';

    const reportData = await ReportBuilderService.getReport(id, organizationId);
    if (!reportData) {
      return res.status(404).json({ error: 'Report not found' });
    }

    let buffer: Buffer;

    if (useV2) {
      // ── V2: BCG-grade component pipeline ──
      const { PptxPipelineService } = await import('../services/report/pptx/PptxPipelineService.js');
      const pipeline = new PptxPipelineService();

      const rpt = reportData.report as any;

      // Parse score summary if stored as JSON string
      let scoreSummary: any = undefined;
      const rawScore = rpt.scoreSummary || rpt.score_summary;
      if (rawScore) {
        try { scoreSummary = typeof rawScore === 'string' ? JSON.parse(rawScore) : rawScore; } catch { /* ignore */ }
      }

      // Parse config if stored as JSON string
      let config: any = undefined;
      const rawConfig = rpt.config || rpt.config_json;
      if (rawConfig) {
        try { config = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig; } catch { /* ignore */ }
      }

      // Pre-load block types once for slide_intent resolution
      const allBlockTypes = await ReportBuilderService.listBlockTypes(organizationId).catch(() => []);
      const btMap = new Map(allBlockTypes.map((bt: any) => [bt.id, bt]));

      const v2Sections = (reportData.sections || []).map((s: any) => {
        const btId = s.blockTypeId || s.block_type_id;
        const bt = btId ? btMap.get(btId) : undefined;
        return {
          sectionKey: s.sectionKey || s.section_key,
          sectionType: s.sectionType || s.section_type,
          title: s.title || s.sectionKey || s.section_key,
          orderIndex: s.orderIndex ?? s.order_index ?? 0,
          enabled: s.enabled !== false,
          blockTypeId: btId,
          blockConfig: s.blockConfig || s.block_config,
          renderKind: s.renderKind || s.render_kind,
          generatedContent: s.generatedContent || s.generated_content,
          editedContent: s.editedContent || s.edited_content,
          contentFormat: s.contentFormat || s.content_format,
          repeatFor: s.repeatFor || s.repeat_for,
          repeatKey: s.repeatKey || s.repeat_key,
          repeatName: s.repeatName || s.repeat_name,
          repeatData: s.repeatData || s.repeat_data,
          slideIntent: bt?.slideIntent || undefined,
        };
      });

      const result = await pipeline.generateFromLegacyReport(
        {
          report: {
            id: rpt.id,
            title: rpt.title || rpt.name || 'Report',
            description: rpt.description,
            sourceType: rpt.sourceType || rpt.source_type || 'ASSESSMENT',
            sourceFramework: rpt.sourceFramework || rpt.source_framework,
            sourceName: rpt.sourceName || rpt.source_name,
            config,
            companyContext: rpt.companyContext || rpt.company_context,
            createdAt: rpt.createdAt || rpt.created_at,
            createdBy: rpt.createdBy || rpt.created_by || userId,
          },
          sections: v2Sections,
          scoreSummary,
          organizationName: rpt.organizationName || rpt.organization_name,
          projectName: rpt.projectName || rpt.project_name,
        },
        {
          template: (template as any) || 'corporate',
          language: (language as any) || 'pl',
          confidentiality: (confidentiality as any) || 'confidential',
        }
      );

      buffer = result.buffer;

      // Log pipeline stats
      logger.info('[ReportBuilder] PPTX v2 exported', {
        reportId: id,
        userId,
        slideCount: result.slideCount,
        warnings: result.warnings.length,
        valid: result.validation.valid,
      });
    } else {
      // ── V1: Legacy monolithic export ──
      const { PptxExportService } = await import('../services/report/PptxExportService.js');
      const pptxService = new PptxExportService();

      const rpt = reportData.report as any;
      const pptxReportData = {
        id: rpt.id,
        name: rpt.title || rpt.name || 'Report',
        sourceType: rpt.sourceType || rpt.source_type || 'ASSESSMENT',
        sourceFramework: rpt.sourceFramework || rpt.source_framework,
        organizationName: rpt.organizationName || rpt.organization_name,
        projectName: rpt.projectName || rpt.project_name,
        createdAt: rpt.createdAt || rpt.created_at,
        intentConfig:
          rpt.intentConfig || rpt.intent_config
            ? JSON.parse(rpt.intentConfig || rpt.intent_config)
            : undefined,
        sections: (reportData.sections || []).map((s: any) => ({
          key: s.sectionKey || s.section_key,
          title: s.title || s.sectionKey || s.section_key,
          type: s.sectionType || s.section_type,
          content: s.generatedContent || s.generated_content || '',
          renderKind: s.renderKind || s.render_kind,
          data: s.dataJson || s.data_json ? JSON.parse(s.dataJson || s.data_json) : undefined,
        })),
        scoreSummary:
          rpt.scoreSummary || rpt.score_summary
            ? JSON.parse(rpt.scoreSummary || rpt.score_summary)
            : undefined,
      };

      buffer = await pptxService.generatePresentation(pptxReportData, {
        template: (template as any) || 'corporate',
        language: (language as any) || 'pl',
        includeCharts: true,
        includeToc: true,
      });

      logger.info('[ReportBuilder] PPTX v1 exported', { reportId: id, userId });
    }

    // Save to exports directory
    const exportDir = await ensureExportDir();
    const fileName = `${id}-${Date.now()}.pptx`;
    const filePath = path.join(exportDir, fileName);
    await fs.promises.writeFile(filePath, buffer);

    // Get file size
    const stats = await fs.promises.stat(filePath);

    // Create export record
    await ReportBuilderService.createExportRecord({
      reportId: id,
      reportType: 'report_builder',
      format: 'pptx',
      filePath,
      fileSize: stats.size,
      language: (language as string) || 'pl',
      exportedBy: userId,
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${reportData.report.title || 'report'}.pptx"`
    );
    return res.sendFile(filePath);
  } catch (err: any) {
    logger.error('[ReportBuilder] Error exporting PPTX:', err);
    return res.status(500).json({ error: 'Failed to export PPTX', message: err.message });
  }
});

/**
 * GET /api/report-builder/:id/exports
 * List export records for a report
 */
router.get('/:id/exports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
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
// VERSION HISTORY ENDPOINTS
// ==========================================

/**
 * GET /api/report-builder/:id/versions
 * List all versions of a report
 */
router.get('/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { organizationId } = getAuthContext(req);

    const versions = await ReportBuilderService.listVersions(id, organizationId);
    res.json({ versions });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing versions:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/versions
 * Create a new version snapshot
 */
router.post('/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { changeSummary } = req.body;

    const version = await ReportBuilderService.createVersion(id, organizationId, userId, {
      changeType: 'manual',
      changeSummary,
    });

    logger.info('[ReportBuilder] Version created manually', { reportId: id, userId });
    res.status(201).json({ version });
  } catch (err) {
    logger.error('[ReportBuilder] Error creating version:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/versions/:versionId
 * Get a specific version with full snapshot
 */
router.get('/versions/:versionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versionId = paramStr(req.params.versionId);
    const { organizationId } = getAuthContext(req);

    const version = await ReportBuilderService.getVersion(versionId, organizationId);
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json({ version });
  } catch (err) {
    logger.error('[ReportBuilder] Error getting version:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/versions/:versionId1/compare/:versionId2
 * Compare two versions
 */
router.get(
  '/versions/:versionId1/compare/:versionId2',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const versionId1 = paramStr(req.params.versionId1);
      const versionId2 = paramStr(req.params.versionId2);
      const { organizationId } = getAuthContext(req);

      const comparison = await ReportBuilderService.compareVersions(
        versionId1,
        versionId2,
        organizationId
      );

      if (!comparison) {
        return res.status(404).json({ error: 'Versions not found or not comparable' });
      }

      res.json({ comparison });
    } catch (err) {
      logger.error('[ReportBuilder] Error comparing versions:', err);
      next(err);
    }
  }
);

/**
 * POST /api/report-builder/versions/:versionId/rollback
 * Rollback report to a specific version
 */
router.post(
  '/versions/:versionId/rollback',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const versionId = paramStr(req.params.versionId);
      const { userId, organizationId } = getAuthContext(req);

      const report = await ReportBuilderService.rollbackToVersion(
        versionId,
        organizationId,
        userId
      );

      if (!report) {
        return res.status(404).json({ error: 'Version not found' });
      }

      logger.info('[ReportBuilder] Rollback completed', { versionId, userId });
      res.json({ report, message: 'Rollback successful' });
    } catch (err) {
      logger.error('[ReportBuilder] Error rolling back:', err);
      next(err);
    }
  }
);

// ==========================================
// PUBLIC SHARE LINK ENDPOINTS
// ==========================================

/**
 * POST /api/report-builder/:id/share
 * Create a public share link for a report
 */
router.post('/:id/share', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
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
    const id = paramStr(req.params.id);
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
    const id = paramStr(req.params.id);
    const linkId = paramStr(req.params.linkId);
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
// COMMENTS ENDPOINTS
// ==========================================

/**
 * GET /api/report-builder/:id/comments
 * List comments for a report with optional filters
 */
router.get('/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { organizationId } = getAuthContext(req);
    const { sectionKey, status, commentType, parentOnly } = req.query;

    // Verify report exists and belongs to org
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const filters: any = {};
    if (sectionKey !== undefined) filters.sectionKey = sectionKey === 'null' ? null : sectionKey;
    if (status) {
      filters.status =
        typeof status === 'string' && status.includes(',') ? status.split(',') : status;
    }
    if (commentType) filters.commentType = commentType;
    if (parentOnly === 'true') filters.parentOnly = true;

    const comments = await ReportBuilderCommentsService.listComments(id, filters);
    const summary = await ReportBuilderCommentsService.getCommentSummary(id);

    res.json({ comments, summary });
  } catch (err) {
    logger.error('[ReportBuilder] Error listing comments:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/:id/comments/summary
 * Get comment summary/counts for a report
 */
router.get('/:id/comments/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { organizationId } = getAuthContext(req);

    // Verify report exists
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const summary = await ReportBuilderCommentsService.getCommentSummary(id);
    const canApprove = await ReportBuilderCommentsService.canApproveReport(id);

    res.json({ summary, canApprove });
  } catch (err) {
    logger.error('[ReportBuilder] Error getting comment summary:', err);
    next(err);
  }
});

/**
 * POST /api/report-builder/:id/comments
 * Create a new comment
 */
router.post('/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const { userId, organizationId } = getAuthContext(req);
    const { sectionKey, anchor, commentType, content, parentCommentId, priority, tags } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Verify report exists and belongs to org
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Get user name from database
    const { getDatabase } = await import('../database/index.js');
    const db = getDatabase();
    const user = await new Promise<any>((resolve, reject) => {
      db.get('SELECT name, avatar FROM users WHERE id = ?', [userId], (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const comment = await ReportBuilderCommentsService.createComment({
      reportId: id,
      sectionKey,
      anchor,
      userId,
      userName: user?.name,
      userAvatar: user?.avatar,
      commentType,
      content: content.trim(),
      parentCommentId,
      priority,
      tags,
    });

    logger.info('[ReportBuilder] Comment created', { reportId: id, commentId: comment.id, userId });

    res.status(201).json({ comment });
  } catch (err) {
    logger.error('[ReportBuilder] Error creating comment:', err);
    next(err);
  }
});

/**
 * GET /api/report-builder/:id/comments/:commentId
 * Get a specific comment
 */
router.get('/:id/comments/:commentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = paramStr(req.params.id);
    const commentId = paramStr(req.params.commentId);
    const { organizationId } = getAuthContext(req);

    // Verify report exists
    const report = await ReportBuilderService.getReport(id, organizationId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const comment = await ReportBuilderCommentsService.getComment(commentId);
    if (!comment || comment.reportId !== id) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json({ comment });
  } catch (err) {
    logger.error('[ReportBuilder] Error getting comment:', err);
    next(err);
  }
});

/**
 * PATCH /api/report-builder/:id/comments/:commentId
 * Update a comment (content, status, etc.)
 */
router.patch(
  '/:id/comments/:commentId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramStr(req.params.id);
      const commentId = paramStr(req.params.commentId);
      const { userId, organizationId } = getAuthContext(req);
      const { content, commentType, status, resolutionNotes, priority, tags } = req.body;

      // Verify report exists
      const report = await ReportBuilderService.getReport(id, organizationId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Verify comment exists and belongs to this report
      const existing = await ReportBuilderCommentsService.getComment(commentId);
      if (!existing || existing.reportId !== id) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      const updates: any = {};
      if (content !== undefined) updates.content = content;
      if (commentType !== undefined) updates.commentType = commentType;
      if (status !== undefined) updates.status = status;
      if (resolutionNotes !== undefined) updates.resolutionNotes = resolutionNotes;
      if (priority !== undefined) updates.priority = priority;
      if (tags !== undefined) updates.tags = tags;

      const comment = await ReportBuilderCommentsService.updateComment(commentId, userId, updates);

      logger.info('[ReportBuilder] Comment updated', {
        reportId: id,
        commentId,
        updates: Object.keys(updates),
      });

      res.json({ comment });
    } catch (err) {
      logger.error('[ReportBuilder] Error updating comment:', err);
      next(err);
    }
  }
);

/**
 * DELETE /api/report-builder/:id/comments/:commentId
 * Delete a comment
 */
router.delete(
  '/:id/comments/:commentId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramStr(req.params.id);
      const commentId = paramStr(req.params.commentId);
      const { userId, organizationId } = getAuthContext(req);

      // Verify report exists
      const report = await ReportBuilderService.getReport(id, organizationId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Verify comment exists and belongs to this report
      const existing = await ReportBuilderCommentsService.getComment(commentId);
      if (!existing || existing.reportId !== id) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      await ReportBuilderCommentsService.deleteComment(commentId, userId);

      logger.info('[ReportBuilder] Comment deleted', { reportId: id, commentId, userId });

      res.json({ success: true });
    } catch (err) {
      logger.error('[ReportBuilder] Error deleting comment:', err);
      next(err);
    }
  }
);

/**
 * POST /api/report-builder/:id/comments/:commentId/resolve
 * Quick resolve a comment
 */
router.post(
  '/:id/comments/:commentId/resolve',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramStr(req.params.id);
      const commentId = paramStr(req.params.commentId);
      const { userId, organizationId } = getAuthContext(req);
      const { resolutionNotes } = req.body;

      // Verify report exists
      const report = await ReportBuilderService.getReport(id, organizationId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const comment = await ReportBuilderCommentsService.updateComment(commentId, userId, {
        status: 'RESOLVED',
        resolutionNotes,
      });

      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      logger.info('[ReportBuilder] Comment resolved', { reportId: id, commentId, userId });

      // Return updated summary
      const summary = await ReportBuilderCommentsService.getCommentSummary(id);

      res.json({ comment, summary });
    } catch (err) {
      logger.error('[ReportBuilder] Error resolving comment:', err);
      next(err);
    }
  }
);

/**
 * POST /api/report-builder/:id/comments/bulk-resolve
 * Resolve multiple comments at once
 */
router.post(
  '/:id/comments/bulk-resolve',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = paramStr(req.params.id);
      const { userId, organizationId } = getAuthContext(req);
      const { commentIds, resolutionNotes } = req.body;

      if (!Array.isArray(commentIds) || commentIds.length === 0) {
        return res.status(400).json({ error: 'commentIds array is required' });
      }

      // Verify report exists
      const report = await ReportBuilderService.getReport(id, organizationId);
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const resolvedCount = await ReportBuilderCommentsService.resolveComments(
        commentIds,
        userId,
        resolutionNotes
      );

      logger.info('[ReportBuilder] Bulk resolve', { reportId: id, resolvedCount, userId });

      const summary = await ReportBuilderCommentsService.getCommentSummary(id);

      res.json({ resolvedCount, summary });
    } catch (err) {
      logger.error('[ReportBuilder] Error bulk resolving comments:', err);
      next(err);
    }
  }
);

export default router;
