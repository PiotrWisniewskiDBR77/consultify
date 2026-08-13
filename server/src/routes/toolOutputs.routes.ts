/**
 * Tool Outputs Routes — READ / LIST / REOPEN surface for the canonical
 * `tool_outputs` snapshot and its derived Reports/Presentations/Initiative
 * Proposals (migrations 946/947/948). Mounted on its OWN path
 * (`/api/tool-outputs`, see Gateway.ts) rather than nested under the existing
 * `/api/tools` router — avoids any path-shape ambiguity with that router's
 * single-segment `GET /:toolId` catch-all and keeps this additive surface's
 * blast radius separately auditable. Same auth middleware stack as
 * `tools.routes.ts` for consistency.
 */
import { Router } from 'express';

import ToolOutputsController from '../controllers/ToolOutputsController.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

router.get('/', ToolOutputsController.listOutputs);
router.get('/reports/:reportId', ToolOutputsController.getReport);
router.get('/:outputId', ToolOutputsController.getOutput);
router.get('/:outputId/reports', ToolOutputsController.listReportsForOutput);
router.get('/:outputId/initiative-proposals', ToolOutputsController.listInitiativeProposalsForOutput);
router.post('/:outputId/reopen', ToolOutputsController.reopenOutput);

export default router;
