/**
 * Case Workspace HTTP routes — waitSubscriptionService
 * (server/src/services/caseWorkspace/waitSubscriptionService.ts).
 *
 * Mounted at /api/v8/case-workspace (see caseWorkspace/index.ts).
 *
 * EXCLUDED per the task brief (internal scheduler-only, never route-exposed):
 * claimTimerWait, renewTimerWaitClaimLease, expireWait,
 * listDueTimerWaitsForClaim. Also excludes computeWaitOverdueState (pure,
 * no-DB helper).
 *
 * RE-WIRE AFTER STREAM A MERGES: createWait/resolveWait/provideHumanInput/
 * cancelWait all take `actor: CaseActor`-shaped parameters already (or, for
 * createWait, no actor at all today — see its own doc comment) —
 * `actor.actorUserId` is the wiring point throughout; no structural change
 * expected. By-id routes (everything under /waits/:waitId) resolve the
 * owning caseId via svc.getWait first, since none of resolveWait/
 * provideHumanInput/cancelWait take a caseId directly to authorize against.
 */

import { Router } from 'express';
import { z } from 'zod';

import * as svc from '../../services/caseWorkspace/waitSubscriptionService.js';
import { requireCaseAccessForActor } from './_shared/access.js';
import { caseWorkspaceHandler, readIdempotencyKeyHeader } from './_shared/handler.js';
import { toCaseWorkspaceAppError } from './_shared/errors.js';
import { parseBody, parseParams, parseQuery } from './_shared/validate.js';
import type { CaseWorkspaceActor } from './_shared/handler.js';

const router = Router();

const waitTypeEnum = z.enum(['HUMAN', 'TIMER', 'DOMAIN_EVENT', 'EXTERNAL_CALLBACK']);
const waitStatusEnum = z.enum(['ACTIVE', 'SATISFIED', 'EXPIRED', 'CANCELLED']);

const waitIdParams = z.object({ waitId: z.string().trim().min(1) });

async function requireCaseAccessForWait(actor: CaseWorkspaceActor, waitId: string): Promise<svc.CaseWait> {
  const wait = await svc.getWait(waitId, actor.actorUserId);
  if (!wait) {
    throw toCaseWorkspaceAppError(new Error('wait_not_found'), actor.correlationId);
  }
  await requireCaseAccessForActor(actor, wait.caseId);
  return wait;
}

// POST /cases/:caseId/waits — createWait
const createWaitBody = z.object({
  runId: z.string().trim().min(1).nullable().optional(),
  actionProposalId: z.string().trim().min(1).nullable().optional(),
  nodeRunId: z.string().trim().min(1).nullable().optional(),
  waitType: waitTypeEnum,
  correlationKey: z.string().trim().min(1).optional(),
  expectedEventType: z.string().trim().min(1).nullable().optional(),
  predicateRef: z.string().trim().min(1).nullable().optional(),
  dueAt: z.string().trim().min(1).nullable().optional(),
  timeoutAt: z.string().trim().min(1).nullable().optional(),
  resumeTokenHash: z.string().trim().min(1).nullable().optional(),
});

router.post(
  '/cases/:caseId/waits',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ caseId: z.string().trim().min(1) }), req.params);
    const body = parseBody(createWaitBody, req.body);
    // createWait's own idempotency primitive is `correlationKey` (unique per
    // (caseId, correlationKey) at the DB layer), not a separate
    // idempotencyKey/dedupeKey field. An `Idempotency-Key` header is threaded
    // through as the correlationKey when the body does not already supply
    // one distinctly.
    const correlationKey = body.correlationKey ?? readIdempotencyKeyHeader(req);
    if (!correlationKey) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'body.correlationKey (or an Idempotency-Key header) is required.',
        },
      });
      return;
    }
    await requireCaseAccessForActor(actor, params.caseId);
    const created = await svc.createWait(
      { ...body, correlationKey, caseId: params.caseId },
      actor.actorUserId
    );
    res.status(201).json({ data: created });
  })
);

// GET /cases/:caseId/waits — listWaitsForCase
router.get(
  '/cases/:caseId/waits',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ caseId: z.string().trim().min(1) }), req.params);
    const query = parseQuery(
      z.object({ status: waitStatusEnum.optional(), waitType: waitTypeEnum.optional() }),
      req.query
    );
    await requireCaseAccessForActor(actor, params.caseId);
    const items = await svc.listWaitsForCase(params.caseId, query, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

// GET /runs/:runId/waits — listWaitsForRun
router.get(
  '/runs/:runId/waits',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ runId: z.string().trim().min(1) }), req.params);
    const items = await svc.listWaitsForRun(params.runId, actor.actorUserId);
    // Same all-or-nothing, no-native-scope posture as
    // actionProposals.routes.ts's listActionProposalsForRun — see this
    // file's top-of-file "re-wire after A merges" note.
    const caseIds = new Set(items.map((item) => item.caseId));
    for (const caseId of caseIds) {
      await requireCaseAccessForActor(actor, caseId);
    }
    res.status(200).json({ data: items });
  })
);

// GET /waits/:waitId
router.get(
  '/waits/:waitId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(waitIdParams, req.params);
    const wait = await requireCaseAccessForWait(actor, params.waitId);
    res.status(200).json({ data: wait });
  })
);

// POST /waits/:waitId/resolve — resolveWait
const resolveWaitBody = z.object({
  satisfiedByEventId: z.string().trim().min(1),
  timerClaim: z
    .object({ ownerToken: z.string().trim().min(1), fencingToken: z.number().int() })
    .optional(),
  expectedVersion: z.number().int(),
});

router.post(
  '/waits/:waitId/resolve',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(waitIdParams, req.params);
    const body = parseBody(resolveWaitBody, req.body);
    await requireCaseAccessForWait(actor, params.waitId);
    const { expectedVersion, ...input } = body;
    const updated = await svc.resolveWait(params.waitId, input, expectedVersion);
    res.status(200).json({ data: updated });
  })
);

// POST /waits/:waitId/human-input — provideHumanInput
const humanInputBody = z.object({
  inputRef: z.string().trim().min(1),
  expectedVersion: z.number().int(),
});

router.post(
  '/waits/:waitId/human-input',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(waitIdParams, req.params);
    const body = parseBody(humanInputBody, req.body);
    await requireCaseAccessForWait(actor, params.waitId);
    const updated = await svc.provideHumanInput(
      params.waitId,
      { inputRef: body.inputRef, actorUserId: actor.actorUserId },
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// POST /waits/:waitId/cancel — cancelWait
const cancelWaitBody = z.object({
  reason: z.string().trim().min(1),
  expectedVersion: z.number().int(),
});

router.post(
  '/waits/:waitId/cancel',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(waitIdParams, req.params);
    const body = parseBody(cancelWaitBody, req.body);
    await requireCaseAccessForWait(actor, params.waitId);
    const updated = await svc.cancelWait(
      params.waitId,
      { actorUserId: actor.actorUserId },
      body.reason,
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

export default router;
