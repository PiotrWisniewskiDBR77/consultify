import { randomUUID } from 'node:crypto';

import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../../middleware/rbac.middleware.js';
import { requireResultsInternalBetaVisibility } from '../../middleware/resultsInternalBetaVisibility.middleware.js';
import { validateBody, validateParams } from '../../middleware/validation.middleware.js';
import { resolveEffectiveAccess } from '../../services/effectiveAccessService.js';
import {
  createRecoveryAction,
  createRecoveryCheckpoint,
  linkRecoveryActionTask,
  resolveRecoveryCheckpoint,
  updateRecoveryAction,
} from '../../services/resultsVnext/kpi/kpiRecoveryChildCommands.js';
import {
  AtomicWriteAggregateNotFoundError,
  AtomicWriteConflictError,
} from '../../services/resultsVnext/platform/atomicWrite.js';
import { CommandCapabilityDeniedError } from '../../services/resultsVnext/platform/commandCapabilityGuard.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import logger from '../../utils/Logger.js';
import { getCorrelationId } from './correlationId.js';

const router = Router();
router.use(apiAuthRateLimiter, verifyToken, requireOrgAccess(), requireResultsInternalBetaVisibility, demoContextMiddleware);

const CardParams = z.object({ cardId: z.string().min(1).max(200) });
const ActionParams = CardParams.extend({ actionId: z.string().min(1).max(200) });
const CheckpointParams = CardParams.extend({ checkpointId: z.string().min(1).max(200) });
const Idempotency = z.string().trim().min(8).max(200).optional();
const Version = z.number().int().positive();

const CreateAction = z.object({
  actionType: z.enum(['IMMEDIATE', 'DURABLE']),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).nullable().optional(),
  ownerUserId: z.string().trim().min(1).max(200).nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  idempotencyKey: Idempotency,
});
const UpdateAction = z.object({
  expectedVersion: Version,
  status: z.enum(['OPEN', 'DONE', 'CANCELLED']).optional(),
  ownerUserId: z.string().trim().min(1).max(200).nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  idempotencyKey: Idempotency,
}).refine((v) => v.status !== undefined || v.ownerUserId !== undefined || v.dueDate !== undefined,
  { message: 'At least one action field is required' });
const LinkTask = z.object({ expectedVersion: Version, idempotencyKey: Idempotency });
const CreateCheckpoint = z.object({
  checkpointDate: z.string().date(),
  notes: z.string().trim().max(5000).nullable().optional(),
  idempotencyKey: Idempotency,
});
const ResolveCheckpoint = z.object({
  expectedVersion: Version,
  status: z.enum(['MET', 'MISSED', 'CANCELLED']),
  kpiTimeSeriesId: z.string().trim().min(1).max(200).nullable().optional(),
  idempotencyKey: Idempotency,
});

function auth(req: AuthenticatedRequest, res: Response) {
  const organizationId = req.user?.organizationId || req.user?.organization_id;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return null;
  }
  return { organizationId, userId, role: String(req.user?.role || 'member') };
}

async function context(req: AuthenticatedRequest, a: NonNullable<ReturnType<typeof auth>>) {
  return {
    organizationId: a.organizationId,
    actorUserId: a.userId,
    actorEffectiveRole: a.role,
    access: await resolveEffectiveAccess({ userId: a.userId, organizationId: a.organizationId,
      applicationRole: req.user?.role }),
    correlationId: getCorrelationId(req),
  };
}

function key(value?: string): string { return value?.trim() || randomUUID(); }
function fail(res: Response, err: unknown, op: string): void {
  if (err instanceof CommandCapabilityDeniedError) {
    res.status(403).json({ error: err.message, code: err.code }); return;
  }
  if (err instanceof AtomicWriteAggregateNotFoundError) {
    res.status(404).json({ error: 'Recovery resource not found', code: 'NOT_FOUND' }); return;
  }
  if (err instanceof AtomicWriteConflictError) {
    res.status(409).json({ error: err.message, code: err.code, ...(err.details || {}) }); return;
  }
  logger.error(`[resultsVnext/kpiRecoveryChildren] ${op} failed`, {
    error: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ error: 'Internal server error', code: 'RECOVERY_CHILD_INTERNAL_ERROR' });
}

router.post('/:cardId/actions', validateParams(CardParams), validateBody(CreateAction), async (req: AuthenticatedRequest, res) => {
  const a = auth(req, res); if (!a) return;
  try {
    const b = req.body as z.infer<typeof CreateAction>;
    const outcome = await createRecoveryAction({ ...(await context(req, a)), cardId: req.params.cardId!,
      actionType: b.actionType, title: b.title, description: b.description,
      ownerUserId: b.ownerUserId, dueDate: b.dueDate, idempotencyKey: key(b.idempotencyKey) });
    res.status(outcome.outcome === 'applied' ? 201 : 200).json({ ...outcome, action: outcome.result });
  } catch (err) { fail(res, err, 'createRecoveryAction'); }
});

router.patch('/:cardId/actions/:actionId', validateParams(ActionParams), validateBody(UpdateAction), async (req: AuthenticatedRequest, res) => {
  const a = auth(req, res); if (!a) return;
  try {
    const b = req.body as z.infer<typeof UpdateAction>;
    const outcome = await updateRecoveryAction({ ...(await context(req, a)), cardId: req.params.cardId!,
      actionId: req.params.actionId!, expectedVersion: b.expectedVersion, status: b.status,
      ownerUserId: b.ownerUserId, dueDate: b.dueDate, idempotencyKey: key(b.idempotencyKey) });
    res.status(200).json({ ...outcome, action: outcome.result });
  } catch (err) { fail(res, err, 'updateRecoveryAction'); }
});

router.post('/:cardId/actions/:actionId/link-task', validateParams(ActionParams), validateBody(LinkTask), async (req: AuthenticatedRequest, res) => {
  const a = auth(req, res); if (!a) return;
  try {
    const b = req.body as z.infer<typeof LinkTask>;
    const outcome = await linkRecoveryActionTask({ ...(await context(req, a)), cardId: req.params.cardId!,
      actionId: req.params.actionId!, expectedVersion: b.expectedVersion,
      idempotencyKey: key(b.idempotencyKey) });
    res.status(200).json({ ...outcome, ...outcome.result });
  } catch (err) { fail(res, err, 'linkRecoveryActionTask'); }
});

router.post('/:cardId/checkpoints', validateParams(CardParams), validateBody(CreateCheckpoint), async (req: AuthenticatedRequest, res) => {
  const a = auth(req, res); if (!a) return;
  try {
    const b = req.body as z.infer<typeof CreateCheckpoint>;
    const outcome = await createRecoveryCheckpoint({ ...(await context(req, a)), cardId: req.params.cardId!,
      checkpointDate: b.checkpointDate, notes: b.notes, idempotencyKey: key(b.idempotencyKey) });
    res.status(outcome.outcome === 'applied' ? 201 : 200).json({ ...outcome, checkpoint: outcome.result });
  } catch (err) { fail(res, err, 'createRecoveryCheckpoint'); }
});

router.patch('/:cardId/checkpoints/:checkpointId', validateParams(CheckpointParams), validateBody(ResolveCheckpoint), async (req: AuthenticatedRequest, res) => {
  const a = auth(req, res); if (!a) return;
  try {
    const b = req.body as z.infer<typeof ResolveCheckpoint>;
    const outcome = await resolveRecoveryCheckpoint({ ...(await context(req, a)), cardId: req.params.cardId!,
      checkpointId: req.params.checkpointId!, expectedVersion: b.expectedVersion,
      status: b.status, kpiTimeSeriesId: b.kpiTimeSeriesId,
      idempotencyKey: key(b.idempotencyKey) });
    res.status(200).json({ ...outcome, checkpoint: outcome.result });
  } catch (err) { fail(res, err, 'resolveRecoveryCheckpoint'); }
});

export default router;
