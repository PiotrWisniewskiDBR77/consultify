import type { NextFunction, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  getAgentRunOperationalSnapshot,
  recoverAgentRunTarget,
} from '../../services/v8/agentOperatorConsoleService.js';
import {
  activateA06ForTenant,
  getAgentTenantSettings,
  updateAgentTenantSettings,
} from '../../services/v8/agentTenantSettingsService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

const settingsSchema = z.object({
  projectId: z.string().min(1).max(256).nullable().optional(),
  expectedVersion: z.number().int().min(0),
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  calendarEnabled: z.boolean(),
  cadence: z.enum(['manual', 'daily', 'weekly', 'monthly']),
  timezone: z.string().min(1).max(100),
  autoActions: z.record(z.string(), z.boolean()).default({}),
  legalHold: z.boolean().default(false),
});

function requireOperator(req: AuthRequest, res: Response, next: NextFunction): void {
  const context = getV8Context(req);
  if (
    !context.isSuperAdmin &&
    !['ADMIN', 'OWNER', 'SUPERADMIN'].includes(context.userRole.toUpperCase())
  ) {
    res.status(403).json({ code: 'AGENT_OPERATOR_ROLE_REQUIRED' });
    return;
  }
  next();
}

router.get(
  '/runs/:runId',
  requireOperator,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const data = await getAgentRunOperationalSnapshot({
      executionRunId: String(req.params.runId),
      organizationId,
    });
    if (!data) return res.status(404).json({ code: 'EXECUTION_RUN_NOT_FOUND' });
    return res.json({ data });
  })
);

router.get(
  '/settings',
  requireOperator,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const data = await getAgentTenantSettings({
      organizationId: context.organizationId,
      projectId: typeof req.query.projectId === 'string' ? req.query.projectId : null,
    });
    return res.json({
      data: data ?? {
        version: 0,
        in_app_enabled: true,
        email_enabled: false,
        calendar_enabled: false,
        cadence: 'manual',
        timezone: 'Europe/Warsaw',
        auto_actions_json: {},
        retention_detail_days: 30,
        retention_aggregate_months: 13,
        export_enabled: false,
        purge_enabled: false,
        legal_hold: false,
      },
    });
  })
);

router.put(
  '/settings',
  requireOperator,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: 'INVALID_AGENT_SETTINGS' });
    const context = getV8Context(req);
    try {
      const data = await updateAgentTenantSettings({
        ...parsed.data,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        actorRole: context.userRole,
      });
      return res.json({ data });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'AGENT_SETTINGS_UPDATE_FAILED';
      return res.status(code.endsWith('NOT_FOUND') ? 404 : 409).json({ code });
    }
  })
);

router.post(
  '/activate',
  requireOperator,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const idempotencyKey = String(req.header('Idempotency-Key') || '').trim();
    const parsed = z
      .object({ projectId: z.string().min(1).max(256).nullable().optional() })
      .safeParse(req.body ?? {});
    if (!parsed.success || idempotencyKey.length < 8)
      return res.status(400).json({ code: 'AGENT_ACTIVATION_IDEMPOTENCY_KEY_REQUIRED' });
    const context = getV8Context(req);
    try {
      const data = await activateA06ForTenant({
        organizationId: context.organizationId,
        projectId: parsed.data.projectId ?? null,
        actorUserId: context.userId,
        actorRole: context.userRole,
        idempotencyKey,
      });
      return res.status(data.idempotentReplay ? 200 : 201).json({ data });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'AGENT_ACTIVATION_FAILED';
      return res.status(code.endsWith('NOT_FOUND') ? 404 : 409).json({ code });
    }
  })
);

router.post(
  '/runs/:runId/recover',
  requireOperator,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const context = getV8Context(req);
    const idempotencyKey = String(req.header('Idempotency-Key') || '').trim();
    if (idempotencyKey.length < 8 || idempotencyKey.length > 256)
      return res.status(400).json({ code: 'AGENT_RECOVERY_IDEMPOTENCY_KEY_REQUIRED' });
    const parsed = z
      .object({
        targetId: z.string().min(1).max(256),
        action: z.enum([
          'retry_failed_branch',
          'recover_expired_lease',
          'cancel_graph',
          'expire_stale_review',
        ]),
        reason: z.string().min(1).max(2000),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: 'INVALID_AGENT_RECOVERY' });
    try {
      const data = await recoverAgentRunTarget({
        ...parsed.data,
        executionRunId: String(req.params.runId),
        organizationId: context.organizationId,
        actorUserId: context.userId,
        idempotencyKey,
      });
      return res.json({ data });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'agent_recovery_failed';
      return res.status(code === 'operator_target_not_found' ? 404 : 409).json({ code });
    }
  })
);

export default router;
