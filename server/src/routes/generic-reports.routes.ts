/**
 * Generic Reports Routes
 * API endpoints for generic (non-assessment) report management.
 * Mounted as a stub route — available in dev/staging, gated in production.
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}
const FEATURE_NAME = 'generic-reports';

const isSchemaMissingError = (error: unknown): boolean => {
  const message = String((error as Error)?.message || '').toLowerCase();
  return (
    message.includes('no such table') ||
    message.includes('no such column') ||
    message.includes('does not exist') ||
    message.includes('relation') ||
    message.includes('database not initialized')
  );
};

const respondFeatureUnavailable = (res: Response, detail?: string) =>
  res.status(503).json({
    error: 'Feature unavailable',
    code: 'FEATURE_UNAVAILABLE',
    feature: FEATURE_NAME,
    detail,
  });

// System-default templates (always available)
const SYSTEM_TEMPLATES = [
  { id: 'project_status', name: 'Project Status Report', category: 'pmo', isSystem: true },
  { id: 'financial_summary', name: 'Financial Summary', category: 'finance', isSystem: true },
  { id: 'resource_utilization', name: 'Resource Utilization', category: 'hr', isSystem: true },
  { id: 'risk_assessment', name: 'Risk Assessment', category: 'governance', isSystem: true },
  { id: 'kpi_dashboard', name: 'KPI Dashboard Report', category: 'analytics', isSystem: true },
  { id: 'audit_trail', name: 'Audit Trail Report', category: 'compliance', isSystem: true },
];

// ─── LIST REPORTS ──────────────────────────────────────────────────────
router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    try {
      const reports = await dbAll(
        `SELECT id, name, type, format, status, scheduled, last_generated_at, created_at
         FROM reports WHERE organization_id = ? ORDER BY created_at DESC`,
        [orgId],
        { fallback: false }
      );
      res.json(reports || []);
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return respondFeatureUnavailable(res, 'schema missing');
      }
      throw error;
    }
  })
);

// ─── TEMPLATES ─────────────────────────────────────────────────────────
router.get(
  '/templates',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;

    // Try loading organization-specific templates from the DB
    let orgTemplates: any[] = [];
    try {
      orgTemplates = await dbAll(
        `SELECT id, name, category, 0 as isSystem
         FROM report_templates
         WHERE organization_id = ? ORDER BY name`,
        [orgId]
      );
    } catch {
      // Table may not exist — that's fine, fall back to system defaults only
    }

    res.json([...SYSTEM_TEMPLATES, ...orgTemplates]);
  })
);

// ─── CREATE REPORT ─────────────────────────────────────────────────────
router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { name, type, format, config } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const id = uuidv4();
    try {
      const result = await dbRun(
        `INSERT INTO reports (id, organization_id, name, type, format, status, config, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, datetime('now'))`,
        [id, orgId, name, type || 'custom', format || 'pdf', JSON.stringify(config || {}), userId],
        { fallback: false }
      );
      if (!result.success) {
        throw new Error(result.error || 'Failed to create report');
      }
      res.status(201).json({ success: true, id });
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return respondFeatureUnavailable(res, 'schema missing');
      }
      throw error;
    }
  })
);

// ─── GENERATE REPORT ───────────────────────────────────────────────────
router.post(
  '/:id/generate',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    try {
      // Verify report exists and belongs to this organization
      const report = await dbGet<any>(
        `SELECT id, status, type, config FROM reports WHERE id = ? AND organization_id = ?`,
        [id, orgId],
        { fallback: false }
      );
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Mark as generating
      await dbRun(
        `UPDATE reports SET status = 'generating', last_generated_at = datetime('now') WHERE id = ?`,
        [id],
        { fallback: false }
      );

      // Attempt actual generation via AI service
      const mod = await import('../services/ai/llmService.js');
      const llmService = mod.llmService || mod.default;

      if (!llmService) {
        await dbRun(`UPDATE reports SET status = 'failed' WHERE id = ?`, [id], {
          fallback: false,
        });
        return respondFeatureUnavailable(res, 'llm unavailable');
      }

      const config = report.config ? JSON.parse(report.config) : {};
      const result = await llmService.call({
        type: 'text',
        modelConfig: { id: 'standard' },
        systemPrompt:
          'You are a professional report writer. Generate a comprehensive report based on the given parameters. Output in Markdown format.',
        messages: [
          {
            role: 'user',
            content: `Generate a "${report.type}" report. Title: "${report.name || 'Report'}". Config: ${JSON.stringify(config)}`,
          },
        ],
        maxTokens: 4096,
        temperature: 0.7,
      });

      const content = String(result?.content || '');
      if (content.length <= 50) {
        await dbRun(`UPDATE reports SET status = 'failed' WHERE id = ?`, [id], {
          fallback: false,
        });
        return respondFeatureUnavailable(res, 'llm returned empty response');
      }

      await dbRun(`UPDATE reports SET status = 'completed', content = ? WHERE id = ?`, [content, id], {
        fallback: false,
      });

      res.json({ success: true, message: 'Report generation completed', generated: true });
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return respondFeatureUnavailable(res, 'schema missing');
      }
      throw error;
    }
  })
);

// ─── DELETE REPORT ─────────────────────────────────────────────────────
router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    try {
      const result = await dbRun(
        'DELETE FROM reports WHERE id = ? AND organization_id = ?',
        [req.params.id, orgId],
        { fallback: false }
      );
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete report');
      }
      res.json({ success: true });
    } catch (error) {
      if (isSchemaMissingError(error)) {
        return respondFeatureUnavailable(res, 'schema missing');
      }
      throw error;
    }
  })
);

export default router;
