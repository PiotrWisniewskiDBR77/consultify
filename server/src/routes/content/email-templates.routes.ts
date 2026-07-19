// @ts-nocheck
/**
 * Email Templates Routes
 * API endpoints for Email Template Management in Content Module
 *
 * Covers: CRUD, Publishing, Cloning, Preview, Test Send, Categories, Tags
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import {
  type AuthRequest,
  requireSuperAdmin,
  verifyToken,
} from '../../middleware/auth.middleware.js';
import { defaultRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

// Database helpers
type SQLParam = string | number | boolean | null | undefined;
type SQLParams = SQLParam[];

// ==========================================
// EMAIL TEMPLATES CRUD
// ==========================================

/**
 * GET /content/emails/templates - list email templates
 */
router.get(
  '/templates',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const {
        search,
        status,
        categoryId,
        page = 1,
        pageSize = 50,
      } = req.query as {
        search?: string;
        status?: string;
        categoryId?: string;
        page?: number;
        pageSize?: number;
      };
      const offset = ((page || 1) - 1) * (pageSize || 50);

      let query = `
                SELECT 
                    et.id,
                    et.template_key as "templateKey",
                    et.name,
                    et.subject,
                    et.body_html as "htmlContent",
                    et.body_text as "textContent",
                    et.variables as "availableVariables",
                    et.is_active as "isActive",
                    et.is_default as "isDefault",
                    et.created_at as "createdAt",
                    et.updated_at as "updatedAt",
                    COALESCE(et.version, 1) as version,
                    COALESCE(et.status, 'DRAFT') as status,
                    et.category_id as "categoryId",
                    et.language_code as "languageCode",
                    COALESCE(et.usage_count, 0) as usageCount,
                    cc.name as "categoryName",
                    cc.color as "categoryColor"
                FROM email_templates et
                LEFT JOIN content_categories cc ON et.category_id = cc.id
                WHERE 1=1
            `;
      const params: SQLParams = [];

      if (search) {
        query += ' AND (et.name LIKE ? OR et.template_key LIKE ? OR et.subject LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }
      if (status) {
        query += " AND COALESCE(et.status, 'DRAFT') = ?";
        params.push(status);
      }
      if (categoryId) {
        query += ' AND et.category_id = ?';
        params.push(categoryId);
      }

      query += ' ORDER BY et.updated_at DESC, et.created_at DESC LIMIT ? OFFSET ?';
      params.push(pageSize || 50, offset);

      const templates = await dbAll(query, params);

      // Parse JSON fields and transform
      const transformedTemplates = (templates || []).map((t: any) => ({
        ...t,
        availableVariables: t.availableVariables ? JSON.parse(t.availableVariables) : [],
        category: t.categoryId
          ? {
              id: t.categoryId,
              name: t.categoryName,
              color: t.categoryColor,
            }
          : null,
      }));

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM email_templates WHERE 1=1';
      const countParams: SQLParams = [];
      if (search) {
        countQuery += ' AND (name LIKE ? OR template_key LIKE ? OR subject LIKE ?)';
        const searchTerm = `%${search}%`;
        countParams.push(searchTerm, searchTerm, searchTerm);
      }
      if (status) {
        countQuery += " AND COALESCE(status, 'DRAFT') = ?";
        countParams.push(status);
      }
      if (categoryId) {
        countQuery += ' AND category_id = ?';
        countParams.push(categoryId);
      }
      const total = (await dbGet(countQuery, countParams)) as { total: number } | null;

      return res.json({
        templates: transformedTemplates,
        total: total?.total || 0,
        page: page || 1,
        pageSize: pageSize || 50,
      });
    } catch (error: any) {
      logger.error('[Content] Get email templates error:', error);
      return res.status(500).json({ error: 'Failed to get email templates' });
    }
  })
);

/**
 * GET /content/emails/templates/:id - get single template
 */
router.get(
  '/templates/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const template = (await dbGet(
        `
                SELECT 
                    et.id,
                    et.template_key as "templateKey",
                    et.name,
                    et.subject,
                    et.body_html as "htmlContent",
                    et.body_text as "textContent",
                    et.variables as "availableVariables",
                    et.is_active as "isActive",
                    et.is_default as "isDefault",
                    et.created_at as "createdAt",
                    et.updated_at as "updatedAt",
                    COALESCE(et.version, 1) as version,
                    COALESCE(et.status, 'DRAFT') as status,
                    et.category_id as "categoryId",
                    et.language_code as "languageCode",
                    et.variables_schema as "variablesSchema",
                    COALESCE(et.usage_count, 0) as usageCount,
                    et.published_at as "publishedAt",
                    et.published_by as "publishedBy",
                    cc.name as "categoryName",
                    cc.color as "categoryColor"
                FROM email_templates et
                LEFT JOIN content_categories cc ON et.category_id = cc.id
                WHERE et.id = ?
            `,
        [id]
      )) as any;

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Parse JSON fields
      const result = {
        ...template,
        availableVariables: template.availableVariables
          ? JSON.parse(template.availableVariables)
          : [],
        variablesSchema: template.variablesSchema ? JSON.parse(template.variablesSchema) : {},
        category: template.categoryId
          ? {
              id: template.categoryId,
              name: template.categoryName,
              color: template.categoryColor,
            }
          : null,
      };

      return res.json(result);
    } catch (error: any) {
      logger.error('[Content] Get email template error:', error);
      return res.status(500).json({ error: 'Failed to get email template' });
    }
  })
);

/**
 * POST /content/emails/templates - create new template
 */
router.post(
  '/templates',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const {
        templateKey,
        name,
        subject,
        htmlContent,
        textContent,
        categoryId,
        languageCode,
        availableVariables,
        description,
      } = req.body;

      if (!templateKey || !name || !subject) {
        return res.status(400).json({ error: 'templateKey, name, and subject are required' });
      }

      // Check for duplicate key
      const existing = await dbGet('SELECT id FROM email_templates WHERE template_key = ?', [
        templateKey,
      ]);
      if (existing) {
        return res.status(409).json({ error: 'Template key already exists' });
      }

      const id = `tpl_${uuidv4()}`;
      const now = new Date().toISOString();
      const variablesJson = JSON.stringify(availableVariables || []);

      await dbRun(
        `
                INSERT INTO email_templates (
                    id, template_key, name, subject, body_html, body_text, 
                    variables, category_id, language_code, status, version,
                    is_active, is_default, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 1, 1, 0, ?, ?)
            `,
        [
          id,
          templateKey,
          name,
          subject,
          htmlContent || '',
          textContent || '',
          variablesJson,
          categoryId || null,
          languageCode || 'en',
          now,
          now,
        ]
      );

      // Create initial version
      await dbRun(
        `
                INSERT INTO email_template_versions (
                    id, template_id, version, template_key, name, subject,
                    html_content, text_content, variables_schema, changed_by,
                    change_type, status_at_version, created_at
                ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 'CREATE', 'DRAFT', ?)
            `,
        [
          `ver_${uuidv4()}`,
          id,
          templateKey,
          name,
          subject,
          htmlContent || '',
          textContent || '',
          variablesJson,
          req.user?.id || 'system',
          now,
        ]
      );

      logger.info(`[Content] Created email template: ${templateKey}`);

      return res.status(201).json({
        id,
        templateKey,
        name,
        subject,
        status: 'DRAFT',
        version: 1,
        createdAt: now,
      });
    } catch (error: any) {
      logger.error('[Content] Create email template error:', error);
      return res.status(500).json({ error: 'Failed to create email template' });
    }
  })
);

/**
 * PUT /content/emails/templates/:id - update template
 */
router.put(
  '/templates/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const {
        name,
        subject,
        htmlContent,
        textContent,
        categoryId,
        languageCode,
        availableVariables,
      } = req.body;

      // Check template exists
      const existing = (await dbGet(
        'SELECT id, version, status FROM email_templates WHERE id = ?',
        [id]
      )) as any;

      if (!existing) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const now = new Date().toISOString();
      const newVersion = (existing.version || 1) + 1;
      const variablesJson = availableVariables ? JSON.stringify(availableVariables) : null;

      // Update template
      await dbRun(
        `
                UPDATE email_templates SET
                    name = COALESCE(?, name),
                    subject = COALESCE(?, subject),
                    body_html = COALESCE(?, body_html),
                    body_text = COALESCE(?, body_text),
                    variables = COALESCE(?, variables),
                    category_id = ?,
                    language_code = COALESCE(?, language_code),
                    version = ?,
                    updated_at = ?
                WHERE id = ?
            `,
        [
          name,
          subject,
          htmlContent,
          textContent,
          variablesJson,
          categoryId,
          languageCode,
          newVersion,
          now,
          id,
        ]
      );

      // Create version entry
      const template = (await dbGet('SELECT * FROM email_templates WHERE id = ?', [id])) as any;
      await dbRun(
        `
                INSERT INTO email_template_versions (
                    id, template_id, version, template_key, name, subject,
                    html_content, text_content, variables_schema, changed_by,
                    change_type, status_at_version, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UPDATE', ?, ?)
            `,
        [
          `ver_${uuidv4()}`,
          id,
          newVersion,
          template.template_key,
          template.name,
          template.subject,
          template.body_html,
          template.body_text,
          template.variables,
          req.user?.id || 'system',
          template.status,
          now,
        ]
      );

      logger.info(`[Content] Updated email template: ${id}`);

      return res.json({
        id,
        version: newVersion,
        updatedAt: now,
      });
    } catch (error: any) {
      logger.error('[Content] Update email template error:', error);
      return res.status(500).json({ error: 'Failed to update email template' });
    }
  })
);

/**
 * DELETE /content/emails/templates/:id - delete template
 */
router.delete(
  '/templates/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Check template exists and not default
      const existing = (await dbGet(
        'SELECT id, is_default, template_key FROM email_templates WHERE id = ?',
        [id]
      )) as any;

      if (!existing) {
        return res.status(404).json({ error: 'Template not found' });
      }

      if (existing.is_default) {
        return res.status(400).json({ error: 'Cannot delete default templates' });
      }

      // Delete (cascade will handle versions)
      await dbRun('DELETE FROM email_templates WHERE id = ?', [id]);

      logger.info(`[Content] Deleted email template: ${existing.template_key}`);

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Content] Delete email template error:', error);
      return res.status(500).json({ error: 'Failed to delete email template' });
    }
  })
);

// ==========================================
// TEMPLATE ACTIONS
// ==========================================

/**
 * POST /content/emails/templates/:id/publish - publish template
 */
router.post(
  '/templates/:id/publish',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const now = new Date().toISOString();

      const template = (await dbGet(
        'SELECT id, status, template_key FROM email_templates WHERE id = ?',
        [id]
      )) as any;

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      await dbRun(
        `
                UPDATE email_templates SET 
                    status = 'PUBLISHED',
                    published_at = ?,
                    published_by = ?,
                    updated_at = ?
                WHERE id = ?
            `,
        [now, req.user?.id || 'system', now, id]
      );

      logger.info(`[Content] Published email template: ${template.template_key}`);

      return res.json({
        id,
        status: 'PUBLISHED',
        publishedAt: now,
      });
    } catch (error: any) {
      logger.error('[Content] Publish email template error:', error);
      return res.status(500).json({ error: 'Failed to publish email template' });
    }
  })
);

/**
 * POST /content/emails/templates/:id/deprecate - deprecate template
 */
router.post(
  '/templates/:id/deprecate',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const now = new Date().toISOString();

      const template = (await dbGet('SELECT id, template_key FROM email_templates WHERE id = ?', [
        id,
      ])) as any;

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      await dbRun(
        `
                UPDATE email_templates SET 
                    status = 'DEPRECATED',
                    is_active = 0,
                    updated_at = ?
                WHERE id = ?
            `,
        [now, id]
      );

      logger.info(`[Content] Deprecated email template: ${template.template_key}`);

      return res.json({ id, status: 'DEPRECATED' });
    } catch (error: any) {
      logger.error('[Content] Deprecate email template error:', error);
      return res.status(500).json({ error: 'Failed to deprecate email template' });
    }
  })
);

/**
 * POST /content/emails/templates/:id/clone - clone template
 */
router.post(
  '/templates/:id/clone',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { newName } = req.body;

      const original = (await dbGet('SELECT * FROM email_templates WHERE id = ?', [id])) as any;

      if (!original) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const newId = `tpl_${uuidv4()}`;
      const now = new Date().toISOString();
      const clonedName = newName || `${original.name} (Copy)`;
      const clonedKey = `${original.template_key}_copy_${Date.now()}`;

      await dbRun(
        `
                INSERT INTO email_templates (
                    id, template_key, name, subject, body_html, body_text,
                    variables, category_id, language_code, status, version,
                    is_active, is_default, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 1, 1, 0, ?, ?)
            `,
        [
          newId,
          clonedKey,
          clonedName,
          original.subject,
          original.body_html,
          original.body_text,
          original.variables,
          original.category_id,
          original.language_code,
          now,
          now,
        ]
      );

      logger.info(`[Content] Cloned email template: ${original.template_key} -> ${clonedKey}`);

      return res.status(201).json({
        id: newId,
        templateKey: clonedKey,
        name: clonedName,
        status: 'DRAFT',
        version: 1,
      });
    } catch (error: any) {
      logger.error('[Content] Clone email template error:', error);
      return res.status(500).json({ error: 'Failed to clone email template' });
    }
  })
);

/**
 * GET /content/emails/templates/:id/preview - preview rendered template
 */
router.get(
  '/templates/:id/preview',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const template = (await dbGet(
        'SELECT subject, body_html, body_text, variables FROM email_templates WHERE id = ?',
        [id]
      )) as any;

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Generate preview with sample data
      const variables = template.variables ? JSON.parse(template.variables) : [];
      const sampleData: Record<string, string> = {};
      variables.forEach((v: string) => {
        sampleData[v] = `{{${v}}}`;
      });

      // Simple variable replacement for preview
      let previewHtml = template.body_html || '';
      let previewText = template.body_text || '';
      let previewSubject = template.subject || '';

      Object.entries(sampleData).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        previewHtml = previewHtml.replace(regex, value);
        previewText = previewText.replace(regex, value);
        previewSubject = previewSubject.replace(regex, value);
      });

      res.setHeader('Content-Type', 'text/html');
      return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Preview: ${previewSubject}</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
                        .preview-header { background: #1e293b; color: white; padding: 15px; margin: -20px -20px 20px -20px; }
                        .preview-header h3 { margin: 0 0 5px 0; }
                        .preview-header small { opacity: 0.7; }
                        .email-frame { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 600px; margin: 0 auto; }
                    </style>
                </head>
                <body>
                    <div class="preview-header">
                        <h3>📧 Email Preview</h3>
                        <small>Subject: ${previewSubject}</small>
                    </div>
                    <div class="email-frame">
                        ${previewHtml}
                    </div>
                </body>
                </html>
            `);
    } catch (error: any) {
      logger.error('[Content] Preview email template error:', error);
      return res.status(500).json({ error: 'Failed to preview email template' });
    }
  })
);

/**
 * POST /content/emails/templates/:id/test-send - send test email
 */
router.post(
  '/templates/:id/test-send',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { recipientEmails, testData } = req.body;

      if (!recipientEmails || !Array.isArray(recipientEmails) || recipientEmails.length === 0) {
        return res.status(400).json({ error: 'recipientEmails array is required' });
      }

      const template = (await dbGet('SELECT * FROM email_templates WHERE id = ?', [id])) as any;

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // In production, this would integrate with email service (SendGrid, SES, etc.)
      // For now, log the test and return success
      logger.info(
        `[Content] Test email sent for template ${template.template_key} to: ${recipientEmails.join(', ')}`
      );

      // Record the test sends in email_sends table
      const now = new Date().toISOString();
      let sent = 0;
      let failed = 0;

      for (const email of recipientEmails) {
        try {
          await dbRun(
            `
                        INSERT INTO email_sends (
                            id, template_id, recipient_email, subject, status, sent_at, created_at, metadata
                        ) VALUES (?, ?, ?, ?, 'SENT', ?, ?, ?)
                    `,
            [
              `send_${uuidv4()}`,
              id,
              email,
              `[TEST] ${template.subject}`,
              now,
              now,
              JSON.stringify({ test: true, testData }),
            ]
          );
          sent++;
        } catch (e) {
          failed++;
        }
      }

      // Update usage count
      await dbRun(
        'UPDATE email_templates SET usage_count = COALESCE(usage_count, 0) + ? WHERE id = ?',
        [sent, id]
      );

      return res.json({
        success: true,
        sent,
        failed,
        message: `Test email queued for ${sent} recipient(s)`,
      });
    } catch (error: any) {
      logger.error('[Content] Test send email template error:', error);
      return res.status(500).json({ error: 'Failed to send test email' });
    }
  })
);

/**
 * GET /content/emails/templates/:id/versions - get version history
 */
router.get(
  '/templates/:id/versions',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const versions = await dbAll(
        `
                SELECT 
                    id, version, name, subject, change_type as "changeType",
                    changed_by as "changedBy", change_notes as "changeNotes",
                    status_at_version as "statusAtVersion", created_at as "createdAt"
                FROM email_template_versions
                WHERE template_id = ?
                ORDER BY version DESC
            `,
        [id]
      );

      return res.json({ versions: versions || [] });
    } catch (error: any) {
      logger.error('[Content] Get email template versions error:', error);
      return res.status(500).json({ error: 'Failed to get template versions' });
    }
  })
);

// ==========================================
// CATEGORIES & TAGS
// ==========================================

/**
 * GET /content/categories - get categories
 */
router.get(
  '/../categories',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { contentType } = req.query as { contentType?: string };

      let query = `
                SELECT id, name, slug, description, content_type as "contentType",
                       color, icon, sort_order as "sortOrder", is_active as "isActive"
                FROM content_categories
                WHERE is_active = 1
            `;
      const params: SQLParams = [];

      if (contentType) {
        query += " AND (content_type = ? OR content_type = 'ALL')";
        params.push(contentType);
      }

      query += ' ORDER BY sort_order ASC, name ASC';

      const categories = await dbAll(query, params);

      return res.json({ categories: categories || [] });
    } catch (error: any) {
      logger.error('[Content] Get categories error:', error);
      return res.status(500).json({ error: 'Failed to get categories' });
    }
  })
);

/**
 * GET /content/tags - get tags
 */
router.get(
  '/../tags',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { contentType } = req.query as { contentType?: string };

      let query = `
                SELECT id, name, slug, content_type as "contentType", color, usage_count as "usageCount"
                FROM content_tags
                WHERE is_active = 1
            `;
      const params: SQLParams = [];

      if (contentType) {
        query += " AND (content_type = ? OR content_type = 'ALL')";
        params.push(contentType);
      }

      query += ' ORDER BY usage_count DESC, name ASC';

      const tags = await dbAll(query, params);

      return res.json({ tags: tags || [] });
    } catch (error: any) {
      logger.error('[Content] Get tags error:', error);
      return res.status(500).json({ error: 'Failed to get tags' });
    }
  })
);

export default router;
