import { type Request, type Response, Router } from 'express';

import verifyToken, { requireOrganization } from '../../middleware/auth.middleware.js';
import { getAISettings } from '../../services/organizationService.js';
import { agentScheduleRegistryService } from '../../services/v10/agent-schedules/agentScheduleRegistryService.js';
import type { AgentScheduleDraftInput } from '../../services/v10/agent-schedules/types.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { respondWithData, runtimeMeta, scopeFromAuthRequest } from './runtimeRouteUtils.js';

const router = Router();
const V10_AGENT_SCHEDULES_CONTRACT = 'agent_schedules_v1';

router.use(verifyToken);
router.use(requireOrganization);

interface TenantScopedRequest extends Request {
  readonly user?: {
    readonly id?: string;
    readonly organizationId?: string;
    readonly organization_id?: string;
    readonly role?: string;
  };
  readonly organizationId?: string;
  readonly userId?: string;
  readonly userRole?: string;
  readonly body: Record<string, unknown>;
  readonly params: Request['params'] & { scheduleId?: string };
}

function resolveTenantId(req: TenantScopedRequest): string {
  const scopedTenant = req.user?.organizationId ?? req.user?.organization_id ?? req.organizationId;

  if (typeof scopedTenant === 'string' && scopedTenant.trim()) {
    return scopedTenant.trim();
  }

  throw new Error('Authenticated tenant scope is required');
}

function handleError(res: Response, error: unknown, fallbackMessage: string): Response {
  const status = typeof (error as any)?.status === 'number' ? Number((error as any).status) : 400;
  const code = typeof (error as any)?.code === 'string' ? String((error as any).code) : undefined;
  const message = error instanceof Error ? error.message : fallbackMessage;
  return res.status(status).json({
    error: message,
    ...(code ? { code } : {}),
    meta: runtimeMeta(V10_AGENT_SCHEDULES_CONTRACT),
  });
}

router.get(
  '/',
  asyncHandler(async (req: TenantScopedRequest, res: Response) => {
    return await respondWithData(res, V10_AGENT_SCHEDULES_CONTRACT, () =>
      agentScheduleRegistryService.listSchedules(resolveTenantId(req))
    );
  })
);

router.post(
  '/plan',
  asyncHandler(async (req: TenantScopedRequest, res: Response) => {
    try {
      return await respondWithData(res, V10_AGENT_SCHEDULES_CONTRACT, () =>
        agentScheduleRegistryService.planSchedule(resolveTenantId(req), req.body as unknown as AgentScheduleDraftInput)
      );
    } catch (error) {
      return handleError(res, error, 'Failed to build schedule plan');
    }
  })
);

router.post(
  '/preview',
  asyncHandler(async (req: TenantScopedRequest, res: Response) => {
    try {
      return await respondWithData(res, V10_AGENT_SCHEDULES_CONTRACT, () =>
        agentScheduleRegistryService.previewSchedule(resolveTenantId(req), req.body as unknown as AgentScheduleDraftInput).preview
      );
    } catch (error) {
      return handleError(res, error, 'Failed to preview schedule');
    }
  })
);

router.post(
  '/',
  asyncHandler(async (req: TenantScopedRequest, res: Response) => {
    try {
      return await respondWithData(
        res,
        V10_AGENT_SCHEDULES_CONTRACT,
        () => agentScheduleRegistryService.createSchedule(resolveTenantId(req), req.body as unknown as AgentScheduleDraftInput),
        201
      );
    } catch (error) {
      return handleError(res, error, 'Failed to create schedule');
    }
  })
);

router.get(
  '/preferences',
  asyncHandler(async (req: TenantScopedRequest, res: Response) => {
    return await respondWithData(res, V10_AGENT_SCHEDULES_CONTRACT, () =>
      agentScheduleRegistryService.getNotificationPreferences(resolveTenantId(req))
    );
  })
);

router.put(
  '/preferences',
  asyncHandler(async (req: TenantScopedRequest, res: Response) => {
    try {
      return await respondWithData(res, V10_AGENT_SCHEDULES_CONTRACT, () =>
        agentScheduleRegistryService.updateNotificationPreferences(resolveTenantId(req), req.body)
      );
    } catch (error) {
      return handleError(res, error, 'Failed to update notification preferences');
    }
  })
);

router.get(
  '/:scheduleId/timeline',
  asyncHandler(async (req: TenantScopedRequest, res: Response) => {
    const timeline = await agentScheduleRegistryService.getRunTimelineSummary(
      resolveTenantId(req),
      String(req.params.scheduleId)
    );

    if (!timeline) {
      return res.status(404).json({
        error: 'Schedule timeline not found',
        code: 'AGENT_SCHEDULE_TIMELINE_NOT_FOUND',
        meta: runtimeMeta(V10_AGENT_SCHEDULES_CONTRACT),
      });
    }

    return await respondWithData(res, V10_AGENT_SCHEDULES_CONTRACT, () => timeline);
  })
);

router.post(
  '/:scheduleId/trigger',
  asyncHandler(async (req: TenantScopedRequest, res: Response) => {
    const tenantId = resolveTenantId(req);
    const scope = scopeFromAuthRequest(req as any);

    try {
      const aiSettings = await getAISettings(tenantId);
      return await respondWithData(
        res,
        V10_AGENT_SCHEDULES_CONTRACT,
        () =>
          agentScheduleRegistryService.triggerSchedule(tenantId, String(req.params.scheduleId), {
            requestedBy: scope.userId,
            autonomyLevel: aiSettings?.ai_autonomy_level || 'SUGGEST_ONLY',
          }),
        201
      );
    } catch (error) {
      return handleError(res, error, 'Failed to trigger schedule run');
    }
  })
);

export default router;
