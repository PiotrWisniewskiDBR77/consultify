import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import * as executionSpineService from '../../services/v8/executionSpineService.js';
import {
  cancelWorkGraph,
  createWorkGraph,
  executeReadyWorkGraphBranches,
  getWorkGraph,
  proposeWorkGraphSynthesis,
  resolveWorkGraphContradiction,
  retryBranchTask,
  synthesizeWorkGraph,
} from '../../services/v8/multiAgentWorkManagerService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

const taskSchema = z.object({
  key: z.string().min(1).max(100),
  specialistAgentId: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  objective: z.string().min(1).max(4000),
  dependsOn: z.array(z.string().min(1).max(100)).max(30).optional(),
  expectedOutputSchema: z.record(z.string(), z.unknown()).optional(),
  toolScope: z.array(z.string().min(1).max(200)).max(50).optional(),
  budget: z
    .object({
      maxTokens: z.number().int().positive().max(2_000_000).optional(),
      maxCostUsd: z.number().nonnegative().max(100_000).optional(),
      timeoutSeconds: z.number().int().positive().max(86_400).optional(),
    })
    .optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
});

const createSchema = z.object({
  executionRunId: z.string().min(1).max(256),
  leadAgentId: z.string().min(1).max(200),
  mode: z.enum(['sequential', 'hierarchical', 'router_parallel']),
  budget: z.record(z.string(), z.unknown()).optional(),
  tasks: z.array(taskSchema).min(1).max(30),
});

router.post(
  '/graphs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ code: 'INVALID_MULTI_AGENT_GRAPH', details: parsed.error.issues });
    }
    const run = await executionSpineService.getRun(
      parsed.data.executionRunId,
      context.organizationId
    );
    if (!run) return res.status(404).json({ code: 'RUN_NOT_FOUND' });
    try {
      const data = await createWorkGraph({
        ...parsed.data,
        organizationId: context.organizationId,
        createdBy: context.userId,
      });
      return res.status(201).json({ data });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'multi_agent_graph_creation_failed';
      return res.status(409).json({ code });
    }
  })
);

router.get(
  '/graphs/:graphId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const data = await getWorkGraph(String(req.params.graphId), organizationId);
    if (!data) return res.status(404).json({ code: 'WORK_GRAPH_NOT_FOUND' });
    return res.json({ data });
  })
);

router.post(
  '/graphs/:graphId/synthesize',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    try {
      const data = await synthesizeWorkGraph({
        graphId: String(req.params.graphId),
        organizationId,
      });
      return res.status(data.status === 'blocked' ? 409 : 200).json({ data });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'multi_agent_synthesis_failed';
      const status = code === 'work_graph_not_found' ? 404 : 409;
      return res.status(status).json({ code });
    }
  })
);

router.post(
  '/graphs/:graphId/propose-synthesis',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    try {
      const data = await proposeWorkGraphSynthesis({
        graphId: String(req.params.graphId),
        organizationId: context.organizationId,
        actorUserId: context.userId,
      });
      return res.status(201).json({ data });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'synthesis_proposal_failed';
      return res.status(code.includes('not_found') ? 404 : 409).json({ code });
    }
  })
);

router.post(
  '/graphs/:graphId/resolve-contradiction',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const graphId = String(req.params.graphId);
    const graph = await getWorkGraph(graphId, context.organizationId);
    if (!graph) return res.status(404).json({ code: 'WORK_GRAPH_NOT_FOUND' });
    const privileged = ['ADMIN', 'OWNER', 'SUPERADMIN'].includes(context.userRole.toUpperCase());
    if (!privileged && graph.graph.created_by !== context.userId) {
      return res.status(404).json({ code: 'WORK_GRAPH_NOT_FOUND' });
    }
    const parsed = z
      .object({
        claimKey: z.string().min(1).max(300),
        resolutionType: z.enum(['choose_branch', 'human_judgement']),
        sourceTaskId: z.string().min(1).max(256).optional(),
        selectedValue: z.unknown(),
        rationale: z.string().min(1).max(4000),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'INVALID_CONTRADICTION_RESOLUTION' });
    }
    try {
      const data = await resolveWorkGraphContradiction({
        ...parsed.data,
        graphId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
      });
      return res.json({ data });
    } catch (error) {
      return res.status(409).json({
        code: error instanceof Error ? error.message : 'contradiction_resolution_failed',
      });
    }
  })
);

router.post(
  '/graphs/:graphId/execute-ready',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const graphId = String(req.params.graphId);
    const graph = await getWorkGraph(graphId, context.organizationId);
    if (!graph) return res.status(404).json({ code: 'WORK_GRAPH_NOT_FOUND' });
    const privileged = ['ADMIN', 'OWNER', 'SUPERADMIN'].includes(context.userRole.toUpperCase());
    if (!privileged && graph.graph.created_by !== context.userId) {
      return res.status(404).json({ code: 'WORK_GRAPH_NOT_FOUND' });
    }
    const data = await executeReadyWorkGraphBranches({
      graphId,
      organizationId: context.organizationId,
      userId: context.userId,
      workerId: `api-${context.userId}-${Date.now()}`,
      limit: Math.min(Math.max(Number(req.body?.limit || 8), 1), 8),
    });
    return res.json({ data });
  })
);

router.post(
  '/graphs/:graphId/cancel',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const graphId = String(req.params.graphId);
    const graph = await getWorkGraph(graphId, context.organizationId);
    if (!graph) return res.status(404).json({ code: 'WORK_GRAPH_NOT_FOUND' });
    const privileged = ['ADMIN', 'OWNER', 'SUPERADMIN'].includes(context.userRole.toUpperCase());
    if (!privileged && graph.graph.created_by !== context.userId)
      return res.status(404).json({ code: 'WORK_GRAPH_NOT_FOUND' });
    try {
      await cancelWorkGraph({ graphId, organizationId: context.organizationId });
      return res.json({ data: { graphId, status: 'cancelled' } });
    } catch (error) {
      return res
        .status(409)
        .json({ code: error instanceof Error ? error.message : 'work_graph_cancel_failed' });
    }
  })
);

router.post(
  '/graphs/:graphId/tasks/:taskId/retry',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const graphId = String(req.params.graphId);
    const graph = await getWorkGraph(graphId, context.organizationId);
    if (!graph) return res.status(404).json({ code: 'WORK_GRAPH_NOT_FOUND' });
    const privileged = ['ADMIN', 'OWNER', 'SUPERADMIN'].includes(context.userRole.toUpperCase());
    if (!privileged && graph.graph.created_by !== context.userId)
      return res.status(404).json({ code: 'WORK_GRAPH_NOT_FOUND' });
    const belongs = graph.tasks.some((task: any) => task.task_id === String(req.params.taskId));
    if (!belongs) return res.status(404).json({ code: 'BRANCH_TASK_NOT_FOUND' });
    try {
      await retryBranchTask({
        taskId: String(req.params.taskId),
        organizationId: context.organizationId,
      });
      return res.json({ data: { taskId: String(req.params.taskId), status: 'pending' } });
    } catch (error) {
      return res
        .status(409)
        .json({ code: error instanceof Error ? error.message : 'branch_retry_failed' });
    }
  })
);

export default router;
