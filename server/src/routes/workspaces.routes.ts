import { Router } from 'express';

import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Workspace-level integration endpoints used by MyWork Table UI.
 *
 * In some deployments the connectors subsystem is not enabled yet. The frontend
 * expects these endpoints to exist and will keep retrying on 404, which looks
 * like an infinite loading state. We return empty lists instead.
 *
 * NOTE: These endpoints intentionally do not require auth because some clients
 * call them during boot before token restore finishes. Returning an empty list
 * is safe and prevents UI dead-ends.
 */
const router = Router();

router.get(
  '/:workspaceId/connectors',
  asyncHandler(async (_req, res) => {
    res.json([]);
  })
);

router.get(
  '/:workspaceId/connectors/scheduled',
  asyncHandler(async (_req, res) => {
    res.json([]);
  })
);

export default router;

import { Router } from 'express';

import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Workspace-level integration endpoints used by MyWork Table UI.
 *
 * In some deployments the connectors subsystem is not enabled yet. The frontend
 * expects these endpoints to exist and will keep retrying on 404, which looks
 * like an infinite loading state. We return empty lists instead.
 */
const router = Router();

router.get(
  '/:workspaceId/connectors',
  asyncHandler(async (_req, res) => {
    res.json([]);
  })
);

router.get(
  '/:workspaceId/connectors/scheduled',
  asyncHandler(async (_req, res) => {
    res.json([]);
  })
);

export default router;

