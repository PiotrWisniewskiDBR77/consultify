import { type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  executeWave8AgentTool,
  launchWave8Agent,
  listWave8AgentDefinitions,
  listWave8AgentNotifications,
  listWave8AgentRuns,
  listWave8AgentSchedules,
  processDueWave8AgentSchedules,
} from '../services/wave8AgentRuntimeService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function getAuthContext(req: AuthRequest): { userId: string; organizationId: string } {
  const user = req.user as any;
  const userId = user?.id || user?.userId || req.userId;
  const organizationId = user?.organizationId || user?.organization_id || req.organizationId;
  if (!userId) throw new Error('Unauthorized');
  if (!organizationId) throw new Error('Organization context is required');
  return { userId, organizationId };
}

router.get(
  '/catalog',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const agents = await listWave8AgentDefinitions();
    return res.json({ success: true, agents });
  })
);

router.post(
  '/launch',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    const result = await launchWave8Agent({
      organizationId,
      userId,
      agentId: String(req.body.agentId || ''),
      goal: String(req.body.goal || ''),
      projectId: req.body.projectId || null,
      requestedTools: Array.isArray(req.body.requestedTools)
        ? req.body.requestedTools.map(String)
        : [],
      schedule:
        req.body.schedule && typeof req.body.schedule === 'object' ? req.body.schedule : null,
      swarm: req.body.swarm && typeof req.body.swarm === 'object' ? req.body.swarm : null,
      approval:
        req.body.approval && typeof req.body.approval === 'object' ? req.body.approval : null,
    });
    return res.status(result.allowed ? 201 : 403).json({ success: result.allowed, ...result });
  })
);

router.post(
  '/tool',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    const result = await executeWave8AgentTool({
      organizationId,
      userId,
      agentId: String(req.body.agentId || ''),
      toolName: String(req.body.toolName || ''),
      toolInput:
        req.body.toolInput && typeof req.body.toolInput === 'object' ? req.body.toolInput : {},
      projectId: req.body.projectId || null,
      runId: req.body.runId || null,
      aiRunId: req.body.aiRunId || null,
      budgetApproved: req.body.budgetApproved === true,
    });
    return res.status(result.allowed ? 200 : 403).json({ success: result.allowed, ...result });
  })
);

router.get(
  '/runs',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const runs = await listWave8AgentRuns({
      organizationId,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    return res.json({ success: true, runs });
  })
);

router.get(
  '/schedules',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const schedules = await listWave8AgentSchedules({ organizationId });
    return res.json({ success: true, schedules });
  })
);

router.post(
  '/schedules/process-due',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const processed = await processDueWave8AgentSchedules({
      organizationId,
      now: req.body.now || undefined,
    });
    return res.json({ success: true, processed });
  })
);

router.get(
  '/notifications',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const notifications = await listWave8AgentNotifications({
      organizationId,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    return res.json({ success: true, notifications });
  })
);

export default router;
