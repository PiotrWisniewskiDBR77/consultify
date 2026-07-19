/**
 * AiActions Routes — mounted at /api/ai/actions.
 *
 * RECOVERY (self-import wrapper family): the previous `createLazyRoute('./aiActions.js')` wrapper
 * resolved its relative specifier against utils/ (the loader's dir), so every request returned
 * HTTP 500 "Failed to load route". No real implementation exists in the tree (only this wrapper +
 * a re-export stub). Following the blessed pattern (see media-ingestion.routes.ts), return an
 * honest 503 "not configured" instead of a hard 500 crash.
 */
import { Router } from 'express';

const router = Router();

router.use((_req, res) => {
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'AI actions endpoints are not implemented in this deployment.',
  });
});

export default router;
