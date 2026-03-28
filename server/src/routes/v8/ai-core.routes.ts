import type { Response } from 'express';
import { Router } from 'express';
import { ZodError } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import * as aiOperatingEnvironmentService from '../../services/v8/aiOperatingEnvironmentService.js';
import * as toolGovernanceService from '../../services/v8/toolGovernanceService.js';
import * as trustAuditService from '../../services/v8/trustAuditService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

// ==========================================
// AI Operating Environment
// ==========================================

router.get(
  '/environment',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    const data = await aiOperatingEnvironmentService.getOperatingEnvironmentStatus(organizationId);
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.post(
  '/chat-turn',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    const {
      conversationId,
      workspaceId,
      projectId,
      message,
      artifactRefs,
      effectiveScopeRef,
      resolvedRoleRef,
    } = req.body;

    if (!conversationId || !workspaceId || !message) {
      return res.status(400).json({
        error: 'conversationId, workspaceId, and message are required',
        code: 'VALIDATION_ERROR',
      });
    }

    try {
      const data = await aiOperatingEnvironmentService.processChatTurn({
        conversationId,
        workspaceId,
        organizationId,
        projectId: projectId ?? null,
        message,
        userId,
        artifactRefs: artifactRefs ?? [],
        effectiveScopeRef: effectiveScopeRef ?? 'workspace',
        resolvedRoleRef: resolvedRoleRef ?? 'user',
      });
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid chat turn parameters',
          code: 'VALIDATION_ERROR',
          details: err.issues,
        });
      }
      throw err;
    }
  })
);

// ==========================================
// Trust & Audit
// ==========================================

router.get(
  '/trust/audit-trail',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { snapshotId } = req.query;

    if (!snapshotId || typeof snapshotId !== 'string') {
      return res.status(400).json({
        error: 'snapshotId query parameter is required',
        code: 'MISSING_QUERY_PARAM',
      });
    }

    const supportTraces = await trustAuditService.getSupportTracesByRun(snapshotId, organizationId);
    const provenanceEntries = await trustAuditService.getProvenanceByOutput(
      snapshotId,
      organizationId
    );

    return res.json({
      data: { supportTraces, provenanceEntries },
      meta: { version: 'v8' },
    });
  })
);

router.get(
  '/trust/provenance',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { snapshotId } = req.query;

    if (!snapshotId || typeof snapshotId !== 'string') {
      return res.status(400).json({
        error: 'snapshotId query parameter is required',
        code: 'MISSING_QUERY_PARAM',
      });
    }

    const data = await trustAuditService.buildProvenanceLedger(snapshotId, organizationId);
    return res.json({ data, meta: { version: 'v8' } });
  })
);

// ==========================================
// Tool Governance
// ==========================================

router.get(
  '/tools',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    const data = await toolGovernanceService.getToolCatalog(organizationId);
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.get(
  '/tools/:toolId/policy',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { toolId } = req.params;
    const consumerClass = (req.query.consumerClass as string) || 'chat';
    const projectId = req.query.projectId as string | undefined;

    const tool = await toolGovernanceService.getTool(toolId, organizationId);
    if (!tool) {
      return res.status(404).json({
        error: `Tool ${toolId} not found`,
        code: 'TOOL_NOT_FOUND',
      });
    }

    const effectivePolicy = await toolGovernanceService.getEffectivePolicy(
      toolId,
      consumerClass as any,
      organizationId,
      projectId ?? null
    );

    return res.json({
      data: { tool, effectivePolicy },
      meta: { version: 'v8' },
    });
  })
);

export default router;
