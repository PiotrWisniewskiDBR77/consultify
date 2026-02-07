/**
 * Help Feedback Routes
 * API endpoints for help system feedback collection
 */
import { Router, Request, Response } from 'express';
import { verifyToken, isAuthenticated } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request { user?: { id: string; organizationId: string }; }

router.post('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { category, message, helpArticleId, rating, pageUrl } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });
  const id = uuidv4();
  await dbRun(`
    INSERT INTO help_feedback (id, user_id, category, message, help_article_id, rating, page_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `, [id, userId, category || 'general', message, helpArticleId, rating, pageUrl]);
  logger.info(`[HelpFeedback] Received from user ${userId}`);
  res.status(201).json({ success: true, id });
}));

router.get('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const feedback = await dbAll(`
    SELECT id, category, message, rating, status, created_at
    FROM help_feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
  `, [userId]);
  res.json(feedback || []);
}));

export default router;
