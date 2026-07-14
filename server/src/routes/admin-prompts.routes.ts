/**
 * Admin Prompt Registry Routes (O5.5)
 *
 * Read-only surface over the code-level AI prompt registry
 * (server/src/ai/promptRegistry.ts). Exposes prompt METADATA + checksum drift
 * status only — never the prompt bodies (some encode proprietary consulting
 * doctrine). Gated behind the platform superadmin `ai_ops` capability.
 *
 * @module routes/admin-prompts
 */

import { type Response, Router } from 'express';

import { getPromptRegistrySummary, verifyAllPromptChecksums } from '../ai/promptRegistry.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import {
  requireSuperAdminCapability,
  verifySuperAdmin,
} from '../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(defaultRateLimiter);
router.use(verifyToken);
router.use(verifySuperAdmin);
router.use(requireSuperAdminCapability('ai_ops'));

/**
 * GET /api/admin/prompts/registry
 * Returns the prompt registry inventory (metadata + checksum status), plus a
 * roll-up of any entries whose live source has drifted from its reviewed
 * snapshot. No prompt bodies are returned.
 */
router.get(
  '/registry',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const prompts = getPromptRegistrySummary();
    const checksums = verifyAllPromptChecksums();
    const drifted = checksums.filter((c) => c.status === 'drifted').map((c) => c.id);

    res.json({
      count: prompts.length,
      managedCount: prompts.filter((p) => p.managed).length,
      drifted,
      prompts,
    });
  })
);

export default router;
