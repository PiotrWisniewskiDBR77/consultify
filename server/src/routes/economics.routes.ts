/**
 * Economics Routes
 * API endpoints for digitization maturity analyses
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

console.log('[Economics Routes] Module loaded - TypeScript version');
console.log('[Economics Routes] Router type:', typeof Router);
const router = Router();
console.log('[Economics Routes] Router created. Stack length:', router.stack?.length);

// Helper to safely parse JSON
function safeJsonParse(str: string | null | undefined, fallback: any = {}): any {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * GET /api/economics/analyses
 * List all analyses for organization
 */
router.get(
  '/analyses',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { status, search, projectId } = req.query;

    try {
      let sql = `
        SELECT da.*, 
               p.name as project_name,
               u.first_name, u.last_name
        FROM digitization_analyses da
        LEFT JOIN projects p ON da.project_id = p.id
        LEFT JOIN users u ON da.created_by = u.id
        WHERE da.organization_id = ?
      `;
      const params: any[] = [orgId];

      if (status && status !== 'all') {
        sql += ' AND da.status = ?';
        params.push(status);
      }

      if (search) {
        sql += ' AND (da.name LIKE ? OR da.description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      if (projectId) {
        sql += ' AND da.project_id = ?';
        params.push(projectId);
      }

      sql += ' ORDER BY da.created_at DESC';

      const rows = await dbAll<any>(sql, params);

      const analyses = rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        projectId: row.project_id,
        projectName: row.project_name,
        organizationId: row.organization_id,
        createdBy: row.created_by,
        createdByName: row.first_name && row.last_name 
          ? `${row.first_name} ${row.last_name}` 
          : 'Unknown',
        overallScore: row.overall_score,
        completionPercent: row.completion_percent || 0,
        axisScores: safeJsonParse(row.axis_scores, {}),
        importedFrom: row.imported_from,
        importDate: row.import_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return res.json({ analyses, total: analyses.length });
    } catch (error: any) {
      logger.error('[Economics] Error fetching analyses:', error);
      return res.json({ analyses: [], total: 0 });
    }
  })
);

console.log('[Economics Routes] After /analyses route. Stack length:', router.stack?.length);

/**
 * GET /api/economics/stats
 * Get catalog statistics
 */
router.get(
  '/stats',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const total = await dbGet<{ count: number }>(
        `SELECT COUNT(*) as count FROM digitization_analyses WHERE organization_id = ?`,
        [orgId]
      );

      const draft = await dbGet<{ count: number }>(
        `SELECT COUNT(*) as count FROM digitization_analyses WHERE organization_id = ? AND status = 'draft'`,
        [orgId]
      );

      const inProgress = await dbGet<{ count: number }>(
        `SELECT COUNT(*) as count FROM digitization_analyses WHERE organization_id = ? AND status = 'in_progress'`,
        [orgId]
      );

      const completed = await dbGet<{ count: number }>(
        `SELECT COUNT(*) as count FROM digitization_analyses WHERE organization_id = ? AND status = 'completed'`,
        [orgId]
      );

      const avgScore = await dbGet<{ avg: number }>(
        `SELECT AVG(overall_score) as avg FROM digitization_analyses WHERE organization_id = ? AND overall_score IS NOT NULL`,
        [orgId]
      );

      return res.json({
        total: total?.count || 0,
        draft: draft?.count || 0,
        inProgress: inProgress?.count || 0,
        completed: completed?.count || 0,
        avgScore: avgScore?.avg || 0,
        avgCompletion: 0,
      });
    } catch (error: any) {
      logger.error('[Economics] Error fetching stats:', error);
      return res.json({
        total: 0,
        draft: 0,
        inProgress: 0,
        completed: 0,
        avgScore: 0,
        avgCompletion: 0,
      });
    }
  })
);

/**
 * POST /api/economics/analyses
 * Create new analysis
 */
router.post(
  '/analyses',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, description, projectId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    try {
      await dbRun(
        `INSERT INTO digitization_analyses (
          id, name, description, status, project_id, organization_id, created_by,
          overall_score, completion_percent, axis_scores, created_at, updated_at
        ) VALUES (?, ?, ?, 'draft', ?, ?, ?, NULL, 0, '{}', ?, ?)`,
        [id, name, description || null, projectId || null, orgId, userId, now, now]
      );

      return res.status(201).json({
        success: true,
        analysis: {
          id,
          name,
          description,
          status: 'draft',
          projectId,
          organizationId: orgId,
          createdBy: userId,
          overallScore: null,
          completionPercent: 0,
          axisScores: {},
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (error: any) {
      logger.error('[Economics] Error creating analysis:', error);
      return res.status(500).json({ error: 'Failed to create analysis' });
    }
  })
);

/**
 * GET /api/economics/analyses/:id
 * Get single analysis
 */
router.get(
  '/analyses/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const row = await dbGet<any>(
        `SELECT da.*, p.name as project_name, u.first_name, u.last_name
         FROM digitization_analyses da
         LEFT JOIN projects p ON da.project_id = p.id
         LEFT JOIN users u ON da.created_by = u.id
         WHERE da.id = ? AND da.organization_id = ?`,
        [id, orgId]
      );

      if (!row) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      return res.json({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        projectId: row.project_id,
        projectName: row.project_name,
        organizationId: row.organization_id,
        createdBy: row.created_by,
        createdByName: row.first_name && row.last_name 
          ? `${row.first_name} ${row.last_name}` 
          : 'Unknown',
        overallScore: row.overall_score,
        completionPercent: row.completion_percent || 0,
        axisScores: safeJsonParse(row.axis_scores, {}),
        importedFrom: row.imported_from,
        importDate: row.import_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    } catch (error: any) {
      logger.error('[Economics] Error fetching analysis:', error);
      return res.status(500).json({ error: 'Failed to fetch analysis' });
    }
  })
);

/**
 * PUT /api/economics/analyses/:id
 * Update analysis
 */
router.put(
  '/analyses/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const { id } = req.params;
    const { name, description, status, axisScores, overallScore, completionPercent } = req.body;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const existing = await dbGet<any>(
        'SELECT id FROM digitization_analyses WHERE id = ? AND organization_id = ?',
        [id, orgId]
      );

      if (!existing) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);
      }
      if (axisScores !== undefined) {
        updates.push('axis_scores = ?');
        params.push(JSON.stringify(axisScores));
      }
      if (overallScore !== undefined) {
        updates.push('overall_score = ?');
        params.push(overallScore);
      }
      if (completionPercent !== undefined) {
        updates.push('completion_percent = ?');
        params.push(completionPercent);
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);

      await dbRun(
        `UPDATE digitization_analyses SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      return res.json({ success: true, message: 'Analysis updated' });
    } catch (error: any) {
      logger.error('[Economics] Error updating analysis:', error);
      return res.status(500).json({ error: 'Failed to update analysis' });
    }
  })
);

/**
 * DELETE /api/economics/analyses/:id
 * Delete analysis
 */
router.delete(
  '/analyses/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const result = await dbRun(
        'DELETE FROM digitization_analyses WHERE id = ? AND organization_id = ?',
        [id, orgId]
      );

      if (!result.changes) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      return res.json({ success: true, message: 'Analysis deleted' });
    } catch (error: any) {
      logger.error('[Economics] Error deleting analysis:', error);
      return res.status(500).json({ error: 'Failed to delete analysis' });
    }
  })
);

/**
 * POST /api/economics/analyses/:id/duplicate
 * Duplicate an analysis
 */
router.post(
  '/analyses/:id/duplicate',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const userId = req.user?.id || (req.user as any)?.user_id;
    const { id } = req.params;
    const { name } = req.body;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const source = await dbGet<any>(
        'SELECT * FROM digitization_analyses WHERE id = ? AND organization_id = ?',
        [id, orgId]
      );

      if (!source) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      const newId = uuidv4();
      const now = new Date().toISOString();

      await dbRun(
        `INSERT INTO digitization_analyses (
          id, name, description, status, project_id, organization_id, created_by,
          overall_score, completion_percent, axis_scores, created_at, updated_at
        ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          name || `${source.name} (Copy)`,
          source.description,
          source.project_id,
          orgId,
          userId,
          source.overall_score,
          source.completion_percent,
          source.axis_scores,
          now,
          now,
        ]
      );

      return res.status(201).json({
        success: true,
        analysisId: newId,
        message: 'Analysis duplicated',
      });
    } catch (error: any) {
      logger.error('[Economics] Error duplicating analysis:', error);
      return res.status(500).json({ error: 'Failed to duplicate analysis' });
    }
  })
);

/**
 * GET /api/economics/analyses/:id/export
 * Export analysis to file
 */
router.get(
  '/analyses/:id/export',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId || (req.user as any)?.organization_id;
    const { id } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const row = await dbGet<any>(
        'SELECT * FROM digitization_analyses WHERE id = ? AND organization_id = ?',
        [id, orgId]
      );

      if (!row) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      // Return data for client-side export
      return res.json({
        success: true,
        data: {
          id: row.id,
          name: row.name,
          description: row.description,
          status: row.status,
          overallScore: row.overall_score,
          completionPercent: row.completion_percent,
          axisScores: safeJsonParse(row.axis_scores, {}),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        downloadUrl: null, // Client will generate file
      });
    } catch (error: any) {
      logger.error('[Economics] Error exporting analysis:', error);
      return res.status(500).json({ error: 'Failed to export analysis' });
    }
  })
);

export default router;
