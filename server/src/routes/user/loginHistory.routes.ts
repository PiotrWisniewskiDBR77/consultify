/**
 * LoginHistory Routes
 * API endpoints for login history tracking
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireActiveMembership } from '../../services/legacyCutover/requireActiveMembership.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// Apply rate limiting
const router = Router();
router.use(verifyToken, requireActiveMembership);

/**
 * Helper function to parse user agent string
 */
function parseUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Unknown Device';

  // Simple parsing - in production use a proper library like ua-parser-js
  if (userAgent.includes('Chrome')) {
    if (userAgent.includes('Mac')) return 'Chrome on MacOS';
    if (userAgent.includes('Windows')) return 'Chrome on Windows';
    if (userAgent.includes('Linux')) return 'Chrome on Linux';
    return 'Chrome';
  }
  if (userAgent.includes('Firefox')) {
    if (userAgent.includes('Mac')) return 'Firefox on MacOS';
    if (userAgent.includes('Windows')) return 'Firefox on Windows';
    return 'Firefox';
  }
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    if (userAgent.includes('iPhone')) return 'Safari on iPhone';
    if (userAgent.includes('iPad')) return 'Safari on iPad';
    return 'Safari on MacOS';
  }
  if (userAgent.includes('Edge')) return 'Edge';

  return 'Unknown Browser';
}

/**
 * GET /api/auth/login-history
 * Get login history for current user
 */
router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const limit = parseInt((req.query.limit as string) || '50', 10);

      const history = (await dbAll(
        `SELECT id, ip_address, user_agent, location, status, created_at
             FROM login_history 
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
        [userId, limit]
      )) as Array<{
        id: string;
        ip_address: string | null;
        user_agent: string | null;
        location: string | null;
        status: string;
        created_at: string;
      }>;

      // Parse user_agent to get device info
      const formattedHistory = history.map((entry) => ({
        ...entry,
        device: parseUserAgent(entry.user_agent),
        time: entry.created_at,
      }));

      return res.json({
        success: true,
        data: formattedHistory,
      });
    } catch (error: unknown) {
      logger.error('Error fetching login history:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch login history' });
    }
  })
);

/**
 * POST /api/auth/login-history
 * Record a login attempt (called by auth middleware)
 */
router.post(
  '/',
  asyncHandler(async (req, res: Response) => {
    try {
      const { userId, ipAddress, userAgent, location, status } = req.body;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID is required' });
      }

      const id = uuidv4();
      const runResult = await dbRun(
        `INSERT INTO login_history (id, user_id, ip_address, user_agent, location, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [id, userId, ipAddress, userAgent, location, status || 'success']
      );

      if (!runResult.success) {
        throw new Error(runResult.error || 'Failed to record login');
      }

      return res.json({
        success: true,
        data: { id },
      });
    } catch (error: unknown) {
      logger.error('Error recording login history:', error);
      return res.status(500).json({ success: false, error: 'Failed to record login' });
    }
  })
);

/**
 * GET /api/auth/login-history/suspicious
 * Get suspicious login attempts
 */
router.get(
  '/suspicious',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const suspicious = await dbAll(
        `SELECT id, ip_address, user_agent, location, status, created_at
             FROM login_history 
             WHERE user_id = ? AND status = 'failed'
             ORDER BY created_at DESC
             LIMIT 10`,
        [userId]
      );

      return res.json({
        success: true,
        data: suspicious,
      });
    } catch (error: unknown) {
      logger.error('Error fetching suspicious logins:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch suspicious logins' });
    }
  })
);

export default router;
