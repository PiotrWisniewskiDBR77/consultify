/**
 * User Goals Routes
 *
 * Persists the onboarding GoalSelector choice. The `user_goals` table is the
 * onboarding model (goal_id references a predefined goal, plus optional metadata
 * and selection timestamp) — NOT a personal goal-tracker. The frontend
 * (src/components/Onboarding/GoalSelector.tsx) posts `{ goalId }`.
 *
 * Schema drift fix (Fala 4): the previous handler was written against a
 * non-existent goal-tracker schema (title/description/target_date/progress_pct),
 * so every POST /api/user/goals failed with "column ... does not exist".
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string };
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(
      (await dbAll(
        `SELECT id, goal_id, metadata, selected_at
    FROM user_goals WHERE user_id = ? ORDER BY selected_at DESC`,
        [req.user?.id]
      )) || []
    );
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { goalId, metadata } = req.body;
    if (!goalId) return res.status(400).json({ error: 'goalId required' });
    const userId = req.user?.id;
    // Idempotent: re-selecting the same goal replaces the prior selection.
    await dbRun('DELETE FROM user_goals WHERE user_id = ? AND goal_id = ?', [userId, goalId]);
    const id = uuidv4();
    await dbRun(
      `INSERT INTO user_goals (id, user_id, goal_id, metadata, selected_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [id, userId, goalId, metadata ? JSON.stringify(metadata) : null]
    );
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { metadata } = req.body;
    if (metadata === undefined) return res.status(400).json({ error: 'No updates' });
    await dbRun('UPDATE user_goals SET metadata = ? WHERE id = ? AND user_id = ?', [
      metadata ? JSON.stringify(metadata) : null,
      req.params.id,
      req.user?.id,
    ]);
    res.json({ success: true });
  })
);

router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await dbRun('DELETE FROM user_goals WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user?.id,
    ]);
    res.json({ success: true });
  })
);

export default router;
