import { Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { coreDocsService } from '../services/ai/coreDocsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

router.use(verifyToken as any);
router.use(requireRole('super_admin') as any);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const docs = await coreDocsService.listCoreDocs();
    res.json({ success: true, data: docs });
  })
);

router.post(
  '/reindex',
  asyncHandler(async (_req, res) => {
    logger.info('[CoreDocsRoutes] Reindex triggered by super_admin');
    const result = await coreDocsService.ingestAll();
    res.json({ success: true, data: result });
  })
);

router.get(
  '/drift',
  asyncHandler(async (_req, res) => {
    const report = await coreDocsService.detectDrift();
    res.json({ success: true, data: report });
  })
);

router.get(
  '/:id/snippets',
  asyncHandler(async (req, res) => {
    const snippets = await coreDocsService.getDocSnippets(req.params.id);
    res.json({ success: true, data: snippets });
  })
);

export default router;
