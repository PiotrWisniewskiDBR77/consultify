// @ts-nocheck
/**
 * Content Routes
 * Main content module routes including Email Templates, Categories, and Tags
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

import emailTemplatesRoutes from './content/email-templates.routes.js';

const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

// Mount email templates routes
router.use('/emails', emailTemplatesRoutes);

// ==========================================
// CATEGORIES
// ==========================================

/**
 * GET /content/categories - get content categories
 */
router.get(
  '/categories',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { contentType } = req.query as { contentType?: string };

      let query = `
                SELECT id, name, slug, description, content_type as contentType,
                       color, icon, sort_order as sortOrder, is_active as isActive
                FROM content_categories
                WHERE is_active = 1
            `;
      const params: (string | number)[] = [];

      if (contentType) {
        query += " AND (content_type = ? OR content_type = 'ALL')";
        params.push(contentType);
      }

      query += ' ORDER BY sort_order ASC, name ASC';

      const categories = await dbAll(query, params);

      return res.json({ categories: categories || [] });
    } catch (error: any) {
      logger.error('[Content] Get categories error:', error);
      // Fallback to demo data
      return res.json({
        categories: [
          { id: 'cat_email_welcome', name: 'Welcome', contentType: 'EMAIL', color: '#10B981' },
          {
            id: 'cat_email_notifications',
            name: 'Notifications',
            contentType: 'EMAIL',
            color: '#6366F1',
          },
          { id: 'cat_email_reports', name: 'Reports', contentType: 'EMAIL', color: '#F59E0B' },
          { id: 'cat_email_security', name: 'Security', contentType: 'EMAIL', color: '#EF4444' },
        ],
      });
    }
  })
);

// ==========================================
// TAGS
// ==========================================

/**
 * GET /content/tags - get content tags
 */
router.get(
  '/tags',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { contentType } = req.query as { contentType?: string };

      let query = `
                SELECT id, name, slug, content_type as contentType, color, usage_count as usageCount
                FROM content_tags
                WHERE is_active = 1
            `;
      const params: (string | number)[] = [];

      if (contentType) {
        query += " AND (content_type = ? OR content_type = 'ALL')";
        params.push(contentType);
      }

      query += ' ORDER BY usage_count DESC, name ASC';

      const tags = await dbAll(query, params);

      return res.json({ tags: tags || [] });
    } catch (error: any) {
      logger.error('[Content] Get tags error:', error);
      // Fallback to demo data
      return res.json({
        tags: [
          { id: 'tag_critical', name: 'Critical', color: '#EF4444' },
          { id: 'tag_automated', name: 'Automated', color: '#3B82F6' },
          { id: 'tag_production', name: 'Production', color: '#10B981' },
        ],
      });
    }
  })
);

export default router;
