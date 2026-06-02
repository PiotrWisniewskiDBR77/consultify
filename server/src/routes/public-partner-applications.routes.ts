import { type Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import {
  createPartnerApplication,
  ensurePartnerApplicationSchema,
} from '../services/partnerApplicationIntakeService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();
router.use(defaultRateLimiter);

const PublicPartnerApplicationSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email().max(200),
  company: z.string().min(1).max(160),
  website: z.string().max(200).optional().default(''),
  country: z.string().max(120).optional().default(''),
  role: z.string().max(120).optional().default(''),
  teamSize: z.string().max(80).optional().default(''),
  focusArea: z.string().max(160).optional().default(''),
  message: z.string().max(4000).optional().default(''),
  locale: z.string().max(20).optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res: Response) => {
    const parsed = PublicPartnerApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Invalid partner application', details: parsed.error.flatten() });
    }

    await ensurePartnerApplicationSchema();

    try {
      const id = uuidv4();
      await createPartnerApplication(id, parsed.data);
      return res.status(201).json({ success: true, id, status: 'pending' });
    } catch (error: any) {
      logger.error('[PartnerApplications] Failed to record application', error?.message || error);
      return res.status(500).json({ error: 'Failed to record partner application' });
    }
  })
);

export default router;
