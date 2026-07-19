/**
 * Help Routes
 * API endpoints for help system and playbooks
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

let ensured = false;
async function ensureHelpSchema() {
  if (ensured) return;
  ensured = true;
  try {
    await dbRun(
      `CREATE TABLE IF NOT EXISTS help_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      []
    );
    await dbRun(
      `CREATE TABLE IF NOT EXISTS help_articles (
        id TEXT PRIMARY KEY,
        category_id TEXT,
        title TEXT NOT NULL,
        body TEXT,
        status TEXT DEFAULT 'published',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      []
    );
    await dbRun(
      `CREATE TABLE IF NOT EXISTS help_playbooks (
        id TEXT PRIMARY KEY,
        key TEXT,
        title TEXT,
        content TEXT,
        status TEXT DEFAULT 'published',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      []
    );
    await dbRun(
      `CREATE TABLE IF NOT EXISTS help_events (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        organization_id TEXT,
        event_type TEXT,
        article_id TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      []
    );
  } catch (e) {
    logger.warn('[Help] ensureHelpSchema failed (continuing)', {
      error: (e as Error)?.message || e,
    });
  }
}

/**
 * GET /api/help/playbooks
 * List all help playbooks
 */
router.get(
  '/playbooks',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      await ensureHelpSchema();
      const playbooks = await dbAll<any>(
        `SELECT * FROM help_playbooks WHERE status = 'published' ORDER BY created_at DESC`,
        []
      );
      return res.json({
        success: true,
        playbooks: playbooks || [],
        recommendedKey: playbooks?.[0]?.key || 'getting-started',
      });
    } catch (error: any) {
      logger.error('[Help] Error fetching playbooks:', error);
      return res.json({
        success: true,
        playbooks: [],
        recommendedKey: 'getting-started',
      });
    }
  })
);

/**
 * GET /api/help/playbooks/:id
 * Get single playbook
 */
router.get(
  '/playbooks/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      await ensureHelpSchema();
      const playbooks = await dbAll<any>(`SELECT * FROM help_playbooks WHERE id = ?`, [id]);

      if (!playbooks || playbooks.length === 0) {
        return res.status(404).json({ error: 'Playbook not found' });
      }

      return res.json({ success: true, data: playbooks[0] });
    } catch (error: any) {
      logger.error('[Help] Error fetching playbook:', error);
      return res.status(500).json({ error: 'Failed to fetch playbook' });
    }
  })
);

/**
 * GET /api/help/articles
 * Search help articles
 */
router.get(
  '/articles',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { q } = req.query;
    await ensureHelpSchema();

    const query = String(q || '').trim();
    if (!query) {
      const data = await dbAll<any>(
        `SELECT id, category_id as "categoryId", title, status, created_at as "createdAt", updated_at as "updatedAt"
         FROM help_articles
         WHERE status = 'published'
         ORDER BY updated_at DESC
         LIMIT 50`,
        []
      ).catch(() => []);
      return res.json({ success: true, data: data || [], query: '' });
    }

    const like = `%${query}%`;
    const data = await dbAll<any>(
      `SELECT id, category_id as "categoryId", title, status, created_at as "createdAt", updated_at as "updatedAt"
       FROM help_articles
       WHERE status = 'published' AND (title LIKE ? OR body LIKE ?)
       ORDER BY updated_at DESC
       LIMIT 50`,
      [like, like]
    ).catch(() => []);
    return res.json({ success: true, data: data || [], query });
  })
);

/**
 * GET /api/help/categories
 * List help categories
 */
router.get(
  '/categories',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureHelpSchema();

    const categories = await dbAll<any>(
      `SELECT id, name, sort_order as "sortOrder" FROM help_categories ORDER BY sort_order ASC, name ASC`,
      []
    ).catch(() => []);

    const counts = await dbAll<{ category_id: string; count: number }>(
      `SELECT category_id, COUNT(1) as count
       FROM help_articles
       WHERE status = 'published' AND category_id IS NOT NULL
       GROUP BY category_id`,
      []
    ).catch(() => []);

    const countMap = new Map<string, number>();
    for (const r of counts || []) {
      if (r?.category_id) countMap.set(String(r.category_id), Number((r as any).count || 0));
    }

    const data = (categories || []).map((c: any) => ({
      id: String(c.id),
      name: String(c.name),
      count: countMap.get(String(c.id)) || 0,
    }));

    return res.json({
      success: true,
      data,
    });
  })
);

/**
 * POST /api/help/events
 * Log help event (e.g., user viewed article, clicked help button)
 */
router.post(
  '/events',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { eventType, articleId, metadata } = req.body;
    const userId = req.user?.id;
    const organizationId = (req as any).organizationId || req.user?.organizationId || null;

    await ensureHelpSchema();

    let stored = false;
    const eventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await dbRun(
        `INSERT INTO help_events (id, user_id, organization_id, event_type, article_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          userId || null,
          organizationId ? String(organizationId) : null,
          String(eventType || ''),
          articleId ? String(articleId) : null,
          metadata ? JSON.stringify(metadata) : null,
        ]
      );
      stored = true;
    } catch (e) {
      logger.warn('[Help] Failed to persist help event (continuing)', {
        error: (e as Error)?.message || e,
      });
    }

    return res.json({
      success: true,
      message: 'Event logged',
      eventId,
      stored,
    });
  })
);

// ==================== MICRO-VIDEO HELP (T073) ====================

const MicroVideoDismissSchema = z.object({
  moduleId: z.string().min(1).max(100),
  action: z.enum(['watched', 'skipped', 'dont_show_again']),
});

const MicroVideoEventSchema = z.object({
  moduleId: z.string().min(1).max(100),
  videoId: z.string().min(1).max(200),
  eventType: z.enum(['view_started', 'view_completed', 'view_skipped', 'dont_show_again']),
  watchTimeSeconds: z.number().optional(),
  progressPercent: z.number().min(0).max(100).optional(),
});

/**
 * GET /api/help/micro-video/dismissed
 */
router.get(
  '/micro-video/dismissed',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const rows = await dbAll<{ module_id: string; action: string }>(
        'SELECT module_id, action FROM help_micro_video_dismissals WHERE user_id = ?',
        [userId]
      );

      const dismissed: Record<string, string> = {};
      for (const row of rows || []) {
        dismissed[row.module_id] = row.action;
      }

      return res.json({ success: true, dismissed });
    } catch (err: any) {
      logger.error('[Help MicroVideo] Error fetching dismissals:', err);
      return res.json({ success: true, dismissed: {} });
    }
  })
);

/**
 * POST /api/help/micro-video/dismiss
 */
router.post(
  '/micro-video/dismiss',
  verifyToken,
  validateBody(MicroVideoDismissSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { moduleId, action } = req.body;

    try {
      await dbRun(
        `INSERT INTO help_micro_video_dismissals (id, user_id, module_id, action, created_at, updated_at)
         VALUES (gen_random_uuid()::TEXT, ?, ?, ?, NOW(), NOW())
         ON CONFLICT (user_id, module_id)
         DO UPDATE SET action = EXCLUDED.action, updated_at = NOW()`,
        [userId, moduleId, action]
      );

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[Help MicroVideo] Error saving dismissal:', err);
      return res.status(500).json({ error: 'Failed to save preference' });
    }
  })
);

/**
 * POST /api/help/micro-video/event
 */
router.post(
  '/micro-video/event',
  verifyToken,
  validateBody(MicroVideoEventSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    const orgId = req.organizationId || null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { moduleId, videoId, eventType, watchTimeSeconds, progressPercent } = req.body;

    try {
      await dbRun(
        `INSERT INTO help_analytics (id, user_id, organization_id, event_type, content_type, content_id, metadata, duration_ms, created_at)
         VALUES (gen_random_uuid()::TEXT, ?, ?, ?, 'video', ?, ?, ?, NOW())`,
        [
          userId,
          orgId,
          eventType,
          videoId,
          JSON.stringify({ moduleId, progressPercent: progressPercent || 0 }),
          watchTimeSeconds ? watchTimeSeconds * 1000 : null,
        ]
      );

      if (eventType === 'view_completed' || eventType === 'dont_show_again') {
        const action = eventType === 'view_completed' ? 'watched' : 'dont_show_again';
        await dbRun(
          `INSERT INTO help_micro_video_dismissals (id, user_id, module_id, action, created_at, updated_at)
           VALUES (gen_random_uuid()::TEXT, ?, ?, ?, NOW(), NOW())
           ON CONFLICT (user_id, module_id)
           DO UPDATE SET action = EXCLUDED.action, updated_at = NOW()`,
          [userId, moduleId, action]
        );
      }

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[Help MicroVideo] Error tracking event:', err);
      return res.status(500).json({ error: 'Failed to track event' });
    }
  })
);

/**
 * GET /api/help/micro-video/status/:moduleId
 */
router.get(
  '/micro-video/status/:moduleId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { moduleId } = req.params;

    try {
      const row = await dbGet<{ action: string } | null>(
        'SELECT action FROM help_micro_video_dismissals WHERE user_id = ? AND module_id = ?',
        [userId, moduleId]
      );

      return res.json({
        success: true,
        moduleId,
        shouldShow: !row,
        dismissedAction: row?.action || null,
      });
    } catch (err: any) {
      logger.error('[Help MicroVideo] Error checking status:', err);
      return res.json({ success: true, moduleId, shouldShow: false, dismissedAction: null });
    }
  })
);

export default router;
