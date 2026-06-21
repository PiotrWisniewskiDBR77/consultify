/**
 * GET /api/deliverables/templates?type=doc|deck|table
 *
 * Unified template catalogue — federuje 3 tabele przez deliverableTemplateService.
 * Nie wymaga flagi feature-flag (dostępne zawsze gdy auth OK).
 */

import { Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import { listDeliverableTemplates } from '../services/deliverableTemplateService.js';
import type { DeliverableTemplateType } from '../services/deliverableTemplateService.js';
import logger from '../utils/Logger.js';

const router = Router();

router.use(verifyToken);
router.use(requireOrgAccess());

function getOrgId(req: any): string {
  return req.user?.organizationId || req.user?.organization_id || '';
}

const VALID_TYPES: ReadonlySet<string> = new Set(['doc', 'deck', 'table']);

router.get('/templates', async (req, res) => {
  const type = req.query.type as string;
  if (!VALID_TYPES.has(type)) {
    res.status(400).json({ error: 'Invalid type. Must be doc|deck|table.' });
    return;
  }
  try {
    const templates = await listDeliverableTemplates(
      type as DeliverableTemplateType,
      getOrgId(req)
    );
    res.json({ templates });
  } catch (err) {
    logger.error('[deliverableTemplates] Failed to load templates', { err, type });
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

export default router;
