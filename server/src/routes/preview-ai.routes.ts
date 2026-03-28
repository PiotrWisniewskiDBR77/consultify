import { type Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { generateContextualHints } from '../services/previewAIHintsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(verifyToken);

const requireUser = (req: AuthRequest, res: Response): { userId: string; orgId: string } | null => {
  const userId = req.user?.id;
  const orgId = req.user?.organizationId;
  if (!userId || !orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return { userId, orgId };
};

const entityStateSchema = z.object({
  entityType: z.string().min(1).max(64),
  entityId: z.string().max(128).optional(),
  status: z.string().max(64).optional(),
  priority: z.string().max(32).optional(),
  progress: z.number().min(0).max(100).optional(),
  dueDate: z.string().max(64).optional(),
  hasOwner: z.boolean().optional(),
  hasDescription: z.boolean().optional(),
  completeness: z.number().min(0).max(100).optional(),
  daysSinceLastUpdate: z.number().optional(),
});

router.post(
  '/hints',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;

    const parsed = entityStateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Invalid entity state', details: parsed.error.flatten() });
    }

    const result = generateContextualHints(parsed.data);
    return res.json(result);
  })
);

export default router;
