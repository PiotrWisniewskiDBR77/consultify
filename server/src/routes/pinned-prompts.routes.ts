/**
 * Pinned Prompts Routes
 * API endpoints for user pinned AI prompts
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string };
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const prompts = await dbAll(
      `
    SELECT id, title, prompt, category, is_favorite, display_order, created_at
    FROM pinned_prompts WHERE user_id = ? ORDER BY display_order ASC, created_at DESC
  `,
      [req.user?.id]
    );
    res.json(prompts || []);
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, prompt, category } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt text required' });
    const id = uuidv4();
    await dbRun(
      `
    INSERT INTO pinned_prompts (id, user_id, title, prompt, category, is_favorite, display_order, created_at)
    VALUES (?, ?, ?, ?, ?, 0, 0, datetime('now'))
  `,
      [id, req.user?.id, title || 'Untitled', prompt, category || 'general']
    );
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, prompt, category, isFavorite, displayOrder } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (prompt !== undefined) {
      updates.push('prompt = ?');
      params.push(prompt);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (isFavorite !== undefined) {
      updates.push('is_favorite = ?');
      params.push(isFavorite ? 1 : 0);
    }
    if (displayOrder !== undefined) {
      updates.push('display_order = ?');
      params.push(displayOrder);
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates' });
    params.push(req.params.id, req.user?.id);
    await dbRun(
      `UPDATE pinned_prompts SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );
    res.json({ success: true });
  })
);

router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await dbRun('DELETE FROM pinned_prompts WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user?.id,
    ]);
    res.json({ success: true });
  })
);

export default router;
