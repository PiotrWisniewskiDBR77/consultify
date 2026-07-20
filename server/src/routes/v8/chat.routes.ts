import type { Response } from 'express';
import { Router } from 'express';
import { ZodError } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import * as chatExecutionService from '../../services/v8/chatExecutionService.js';
import * as contextConsumerBindingService from '../../services/v8/contextConsumerBindingService.js';
import * as contextSnapshotService from '../../services/v8/contextSnapshotService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

// ==========================================
// Context Snapshots
// ==========================================

router.get(
  '/snapshots',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { conversationId, runId } = req.query;

    if (conversationId && typeof conversationId === 'string') {
      const data = await contextSnapshotService.getSnapshotsByConversation(
        conversationId,
        organizationId
      );
      return res.json({ data, meta: { version: 'v8' } });
    }

    if (runId && typeof runId === 'string') {
      const data = await contextSnapshotService.getSnapshotsByRun(runId, organizationId);
      return res.json({ data, meta: { version: 'v8' } });
    }

    return res.status(400).json({
      error: 'Either conversationId or runId query parameter is required',
      code: 'MISSING_QUERY_PARAM',
    });
  })
);

router.get(
  '/snapshots/:snapshotId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { snapshotId } = req.params;

    const data = await contextSnapshotService.getSnapshot(snapshotId, organizationId);
    if (!data) {
      return res.status(404).json({
        error: `Snapshot ${snapshotId} not found`,
        code: 'SNAPSHOT_NOT_FOUND',
      });
    }

    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/snapshots',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    const merged = {
      ...req.body,
      organizationId,
      initiatorUserId: userId,
    };

    try {
      const data = await contextSnapshotService.captureSnapshot(merged);
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      if (err instanceof ZodError) {
        logger.warn('[V8:Chat] Snapshot validation failed', {
          issues: err.issues,
          received: {
            workspaceId: merged.workspaceId,
            organizationId: merged.organizationId,
            projectId: merged.projectId,
            conversationId: merged.conversationId,
            initiatorUserId: merged.initiatorUserId,
            consumerClass: merged.consumerClass,
            effectiveScopeRef: merged.effectiveScopeRef,
            resolvedRoleRef: merged.resolvedRoleRef,
            artifactRefsLen: Array.isArray(merged.artifactRefs)
              ? merged.artifactRefs.length
              : merged.artifactRefs,
            sourceContextRefsLen: Array.isArray(merged.sourceContextRefs)
              ? merged.sourceContextRefs.length
              : merged.sourceContextRefs,
          },
        });
        return res.status(400).json({
          error: 'Invalid snapshot parameters',
          code: 'VALIDATION_ERROR',
          details: err.issues,
        });
      }
      throw err;
    }
  })
);

// ==========================================
// Chat Execution Handoffs
// ==========================================

router.get(
  '/handoffs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { conversationId } = req.query;

    if (!conversationId || typeof conversationId !== 'string') {
      return res.status(400).json({
        error: 'conversationId query parameter is required',
        code: 'MISSING_QUERY_PARAM',
      });
    }

    const data = await chatExecutionService.getHandoffsByConversation(
      conversationId,
      organizationId
    );
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/handoffs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await chatExecutionService.initiateHandoff({
        ...req.body,
        organizationId,
        userId,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid handoff parameters',
          code: 'VALIDATION_ERROR',
          details: err.issues,
        });
      }
      if (err instanceof Error && err.message.includes('not found')) {
        return res.status(404).json({
          error: 'Resource not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }
      throw err;
    }
  })
);

// ==========================================
// Context Consumer Bindings
// ==========================================

router.post(
  '/bindings/chat',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await contextConsumerBindingService.captureForChat({
        ...req.body,
        organizationId,
        initiatorUserId: userId,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid binding parameters',
          code: 'VALIDATION_ERROR',
          details: err.issues,
        });
      }
      throw err;
    }
  })
);

router.post(
  '/bindings/execution',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await contextConsumerBindingService.captureForExecution({
        ...req.body,
        organizationId,
        initiatorUserId: userId,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid binding parameters',
          code: 'VALIDATION_ERROR',
          details: err.issues,
        });
      }
      throw err;
    }
  })
);

router.post(
  '/bindings/retrieval',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await contextConsumerBindingService.captureForRetrieval({
        ...req.body,
        organizationId,
        initiatorUserId: userId,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid binding parameters',
          code: 'VALIDATION_ERROR',
          details: err.issues,
        });
      }
      throw err;
    }
  })
);

export default router;
