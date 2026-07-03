/**
 * Initiative materialize routes (F5 — „Zrób materiał").
 *
 * Standalone, additive router. One click on an initiative / the portfolio →
 * deck/report/table generated through the M17 deliverables engine and streamed
 * back as a real Office file (Content-Disposition: attachment).
 *
 *   POST /initiatives/:id/materialize          { format: 'deck'|'report'|'table' }
 *   POST /initiatives/portfolio/materialize    { format: 'deck'|'report'|'table' }
 *
 * Mounted at /api/initiatives (see Gateway.ts) — mirrors the auth/permission
 * chain of initiatives-additive.routes.ts. Strictly org-scoped.
 */
import { type Response, Router } from 'express';
import { z } from 'zod';

import { verifyToken } from '../middleware/auth.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import {
  materializeInitiative,
  materializePortfolio,
  type MaterializeFormat,
} from '../services/initiative/initiativeMaterializeService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import logger from '../utils/Logger.js';

const router = Router();

router.use(verifyToken);
router.use(requireOrgAccess());

function getOrgId(req: any): string | null {
  const orgId = req.user?.organizationId || req.organizationId;
  return orgId ? String(orgId) : null;
}

const MaterializeSchema = z.object({
  format: z.enum(['deck', 'report', 'table']),
});

/** Org name for material headers/titles (best-effort, never blocks). */
async function orgName(orgId: string): Promise<string | undefined> {
  try {
    const row = await queryHelpers.queryOne<{ name?: string }>(
      `SELECT name FROM organizations WHERE id = ? LIMIT 1`,
      [orgId],
    );
    return row?.name?.trim() || undefined;
  } catch {
    return undefined;
  }
}

// POST /initiatives/portfolio/materialize — whole org portfolio → file
// Registered BEFORE /:id/materialize so "portfolio" is not captured as an :id.
router.post(
  '/portfolio/materialize',
  validateBody(MaterializeSchema),
  asyncHandler(async (req: any, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const format = req.body.format as MaterializeFormat;

    const company = await orgName(orgId);
    const result = await materializePortfolio(queryHelpers, orgId, format, { company });
    if (!result) {
      return res
        .status(422)
        .json({ error: 'materialize_failed', message: 'Portfel jest pusty lub generacja materiału nie powiodła się.' });
    }

    logger.info('[initiativeMaterialize] portfolio generated', { orgId, format, bytes: result.buffer.length });
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', String(result.buffer.length));
    return res.status(200).send(result.buffer);
  }),
);

// POST /initiatives/:id/materialize — one initiative → file
router.post(
  '/:id/materialize',
  validateBody(MaterializeSchema),
  asyncHandler(async (req: any, res: Response) => {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const initiativeId = String(req.params.id);
    const format = req.body.format as MaterializeFormat;

    const company = await orgName(orgId);
    const result = await materializeInitiative(queryHelpers, initiativeId, format, { orgId, company });
    if (!result) {
      // Fail-soft: initiative missing OR generation degraded → 422 (no buffer).
      return res
        .status(422)
        .json({ error: 'materialize_failed', message: 'Nie udało się wygenerować materiału (brak inicjatywy lub dane niewystarczające).' });
    }

    logger.info('[initiativeMaterialize] generated', { initiativeId, format, bytes: result.buffer.length });
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', String(result.buffer.length));
    return res.status(200).send(result.buffer);
  }),
);

export default router;
