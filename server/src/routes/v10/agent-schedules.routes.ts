import { type Request, type Response, Router } from 'express';

import verifyToken from '../../middleware/auth.middleware.js';
import { agentScheduleRegistryService } from '../../services/v10/agent-schedules/agentScheduleRegistryService.js';
import type { AgentScheduleDraftInput } from '../../services/v10/agent-schedules/types.js';

const router = Router();

router.use(verifyToken);

interface TenantScopedRequest extends Request {
  readonly user?: {
    readonly organizationId?: string;
    readonly organization_id?: string;
  };
  readonly organizationId?: string;
  readonly body: Record<string, unknown>;
  readonly query: Request['query'] & { tenantId?: string };
  readonly params: Request['params'] & { scheduleId?: string };
}

function resolveTenantId(req: TenantScopedRequest): string {
  const scopedTenant =
    req.query?.tenantId ??
    req.body?.tenantId ??
    req.user?.organizationId ??
    req.user?.organization_id ??
    req.organizationId;

  if (typeof scopedTenant === 'string' && scopedTenant.trim()) {
    return scopedTenant.trim();
  }

  return 'default-tenant';
}

function handleError(res: Response, error: unknown, fallbackMessage: string): void {
  const message = error instanceof Error ? error.message : fallbackMessage;
  res.status(400).json({
    success: false,
    error: message,
  });
}

router.get('/', (req: TenantScopedRequest, res: Response) => {
  const tenantId = resolveTenantId(req);
  res.json({
    success: true,
    data: agentScheduleRegistryService.listSchedules(tenantId),
  });
});

router.post('/plan', (req: TenantScopedRequest, res: Response) => {
  const tenantId = resolveTenantId(req);
  try {
    const result = agentScheduleRegistryService.planSchedule(
      tenantId,
      req.body as AgentScheduleDraftInput
    );
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(res, error, 'Failed to build schedule plan');
  }
});

router.post('/preview', (req: TenantScopedRequest, res: Response) => {
  const tenantId = resolveTenantId(req);
  try {
    const result = agentScheduleRegistryService.previewSchedule(
      tenantId,
      req.body as AgentScheduleDraftInput
    );
    res.json({
      success: true,
      data: result.preview,
    });
  } catch (error) {
    handleError(res, error, 'Failed to preview schedule');
  }
});

router.post('/', (req: TenantScopedRequest, res: Response) => {
  const tenantId = resolveTenantId(req);
  try {
    const result = agentScheduleRegistryService.createSchedule(
      tenantId,
      req.body as AgentScheduleDraftInput
    );
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(res, error, 'Failed to create schedule');
  }
});

router.get('/preferences', (req: TenantScopedRequest, res: Response) => {
  const tenantId = resolveTenantId(req);
  res.json({
    success: true,
    data: agentScheduleRegistryService.getNotificationPreferences(tenantId),
  });
});

router.put('/preferences', (req: TenantScopedRequest, res: Response) => {
  const tenantId = resolveTenantId(req);
  try {
    const result = agentScheduleRegistryService.updateNotificationPreferences(tenantId, req.body);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(res, error, 'Failed to update notification preferences');
  }
});

router.get('/:scheduleId/timeline', (req: TenantScopedRequest, res: Response) => {
  const tenantId = resolveTenantId(req);
  const timeline = agentScheduleRegistryService.getRunTimelineSummary(
    tenantId,
    String(req.params.scheduleId)
  );

  if (!timeline) {
    res.status(404).json({
      success: false,
      error: 'Schedule timeline not found',
    });
    return;
  }

  res.json({
    success: true,
    data: timeline,
  });
});

export default router;
