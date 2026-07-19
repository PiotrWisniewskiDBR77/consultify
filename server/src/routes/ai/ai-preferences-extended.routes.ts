/**
 * AiPreferencesExtended Routes
 * Mounted at /api/user/ai-preferences (Gateway) and /api/ai/preferences-extended.
 *
 * RECOVERY (self-import wrapper family): the previous `createLazyRoute('./ai-preferences-extended.js')`
 * wrapper resolved its relative specifier against utils/ (the loader's dir), so every request
 * returned HTTP 500 "Failed to load route". No real implementation exists anywhere in the tree
 * (only this wrapper + a re-export stub), so there is nothing to load. Following the blessed
 * pattern (see media-ingestion.routes.ts), return an honest 503 "not configured" instead of a
 * hard 500 crash, so callers get a truthful signal that the feature is not implemented.
 */
import { Router } from 'express';

const router = Router();

router.use((_req, res) => {
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Extended AI preferences are not implemented in this deployment.',
  });
});

export default router;
