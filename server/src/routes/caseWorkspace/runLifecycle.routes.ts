/**
 * Case Workspace HTTP routes — runLifecycleService
 * (server/src/services/caseWorkspace/runLifecycleService.ts).
 *
 * NOT MOUNTED YET — this file is built and self-contained (default-exports a
 * Router, same shape every sibling in this directory uses), but wiring it
 * into `server/src/routes/caseWorkspace/index.ts` is explicitly OPUS's job
 * per this packet's brief ("routes/caseWorkspace/index.ts (montaż = OPUS)").
 * The exact two-line change OPUS needs is documented in this packet's
 * handoff report, not made here.
 *
 * Path families (mirrors executionGraph.routes.ts/waitSubscriptions.routes.ts/
 * actionProposals.routes.ts's own established `/cases/:caseId/...` and
 * `/runs/:runId/...` nesting — see caseWorkspace/index.ts's own header for
 * why no router here owns a single top-level prefix):
 *   POST /cases/:caseId/runs                                  -> createRun
 *   GET  /cases/:caseId/runs                                  -> listRunsForCase
 *   GET  /runs/:runId                                         -> getRun
 *   POST /runs/:runId/start                                   -> startRun
 *   POST /runs/:runId/pause                                   -> pauseRun
 *   POST /runs/:runId/resume                                  -> resumeRun
 *   POST /runs/:runId/cancel                                  -> cancelRun
 *   POST /runs/:runId/advance                                 -> advanceRun
 *   POST /runs/:runId/fail                                    -> failRun
 *   POST /runs/:runId/outcome                                 -> recordRunOutcome
 *   POST /runs/:runId/compensate                               -> compensateRun
 *   POST /runs/:runId/nodes/:nodeId/retry                      -> retryNode
 *   POST /runs/:runId/node-runs/:nodeRunId/compensation-outcome -> recordNodeCompensationOutcome
 *   POST /node-runs/:nodeRunId/provide-input                   -> provideNodeInput
 *
 * No route here collides with any already-mounted router: `/run-bindings*`
 * (runBindings.routes.ts), `/runs/:runId/gateway-evaluations` and
 * `/runs/:runId/node-result-acceptances` (executionGraph.routes.ts),
 * `/runs/:runId/waits` and `/waits/:waitId/human-input` (waitSubscriptions.
 * routes.ts — that route satisfies a WAIT directly; this file's
 * `/node-runs/:nodeRunId/provide-input` is the NEW NodeRun-scoped bridge that
 * did not exist before this packet, see runLifecycleService.provideNodeInput's
 * own header), `/runs/:runId/proposals` (actionProposals.routes.ts), and
 * `/cases/:caseId/light-start` (lightStart.routes.ts — LIGHT's route stays
 * exactly as-is; this packet's `runLifecycleService.startLightRun` bridge is
 * NOT routed here to avoid a second, competing LIGHT entry point — see that
 * function's own header. OPUS/a future packet may choose to have
 * lightStart.routes.ts call the bridge instead of lightOneClickService
 * directly, but that edit is out of this packet's allowlist).
 *
 * RE-WIRE AFTER STREAM A MERGES: `runLifecycleService`'s methods already take
 * `actorUserId` as an explicit parameter (this directory's target shape) — no
 * structural change expected once Stream A's retrofit lands elsewhere.
 */

import { Router } from 'express';
import { z } from 'zod';

import * as svc from '../../services/caseWorkspace/runLifecycleService.js';
import { executeGovernedCaseAction, requireCaseAccessForActor } from './_shared/access.js';
import { caseWorkspaceHandler, readIdempotencyKeyHeader } from './_shared/handler.js';
import { toCaseWorkspaceAppError } from './_shared/errors.js';
import { parseBody, parseParams } from './_shared/validate.js';

const router = Router();

const caseIdParams = z.object({ caseId: z.string().trim().min(1) });
const runIdParams = z.object({ runId: z.string().trim().min(1) });
const nodeIdParams = z.object({
  runId: z.string().trim().min(1),
  nodeId: z.string().trim().min(1),
});
const nodeRunIdParams = z.object({
  runId: z.string().trim().min(1),
  nodeRunId: z.string().trim().min(1),
});
const provideInputParams = z.object({ nodeRunId: z.string().trim().min(1) });

const expectedVersionBody = z.object({ expectedVersion: z.number().int() });

// POST /cases/:caseId/runs — createRun
const createRunBody = z.object({
  casePlanVersionId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).optional(),
  correlationId: z.string().trim().min(1).nullable().optional(),
});

router.post(
  '/cases/:caseId/runs',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    const body = parseBody(createRunBody, req.body);
    await requireCaseAccessForActor(actor, params.caseId);
    const idempotencyKey = readIdempotencyKeyHeader(req) ?? body.idempotencyKey;
    if (!idempotencyKey) {
      throw toCaseWorkspaceAppError(
        new Error('run_lifecycle_idempotency_key_required'),
        actor.correlationId
      );
    }
    const run = await svc.createRun(
      {
        caseId: params.caseId,
        casePlanVersionId: body.casePlanVersionId,
        idempotencyKey,
        initiatedBy: actor.actorUserId,
        correlationId: body.correlationId ?? actor.correlationId,
      },
      actor.actorUserId
    );
    res.status(201).json({ data: run });
  })
);

// GET /cases/:caseId/runs — listRunsForCase
router.get(
  '/cases/:caseId/runs',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    await requireCaseAccessForActor(actor, params.caseId);
    const items = await svc.listRunsForCase(params.caseId, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

// GET /runs/:runId — getRun
router.get(
  '/runs/:runId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(runIdParams, req.params);
    const found = await svc.getRun(params.runId, actor.actorUserId);
    if (!found) {
      res.status(404).json({ error: { code: 'RUN_NOT_FOUND', message: 'Run not found.' } });
      return;
    }
    await requireCaseAccessForActor(actor, found.caseId);
    res.status(200).json({ data: found });
  })
);

// POST /runs/:runId/start — startRun
router.post(
  '/runs/:runId/start',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(runIdParams, req.params);
    const result = await svc.startRun(params.runId, actor.actorUserId, {
      correlationId: actor.correlationId,
    });
    res.status(200).json({ data: result });
  })
);

// POST /runs/:runId/pause — pauseRun
router.post(
  '/runs/:runId/pause',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(runIdParams, req.params);
    const body = parseBody(expectedVersionBody, req.body);
    const run = await svc.pauseRun(params.runId, actor.actorUserId, body.expectedVersion);
    res.status(200).json({ data: run });
  })
);

// POST /runs/:runId/resume — resumeRun
router.post(
  '/runs/:runId/resume',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(runIdParams, req.params);
    const body = parseBody(expectedVersionBody, req.body);
    const run = await svc.resumeRun(params.runId, actor.actorUserId, body.expectedVersion);
    res.status(200).json({ data: run });
  })
);

// POST /runs/:runId/cancel — cancelRun
const cancelRunBody = expectedVersionBody.extend({ reason: z.string().trim().min(1).optional() });
router.post(
  '/runs/:runId/cancel',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(runIdParams, req.params);
    const body = parseBody(cancelRunBody, req.body);
    const run = await executeGovernedCaseAction({
      actor, actionId: 'case.run.cancel', targetId: params.runId,
      operation: () => svc.cancelRun(params.runId, actor.actorUserId, body.expectedVersion, body.reason),
    });
    res.status(200).json({ data: run });
  })
);

// POST /runs/:runId/advance — advanceRun
router.post(
  '/runs/:runId/advance',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(runIdParams, req.params);
    const result = await svc.advanceRun(params.runId, actor.actorUserId);
    res.status(200).json({ data: result });
  })
);

// POST /runs/:runId/fail — failRun
const failRunBody = expectedVersionBody.extend({ reason: z.string().trim().min(1) });
router.post(
  '/runs/:runId/fail',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(runIdParams, req.params);
    const body = parseBody(failRunBody, req.body);
    const run = await svc.failRun(
      params.runId,
      actor.actorUserId,
      body.expectedVersion,
      body.reason
    );
    res.status(200).json({ data: run });
  })
);

// POST /runs/:runId/outcome — recordRunOutcome
const outcomeBody = expectedVersionBody.extend({
  outcomeStatus: z.enum([
    'PENDING_REVIEW',
    'ACCEPTED',
    'REJECTED',
    'PARTIALLY_ACCEPTED',
    'NOT_APPLICABLE',
  ]),
});
router.post(
  '/runs/:runId/outcome',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(runIdParams, req.params);
    const body = parseBody(outcomeBody, req.body);
    const run = await svc.recordRunOutcome(
      params.runId,
      body.outcomeStatus,
      actor.actorUserId,
      body.expectedVersion
    );
    res.status(200).json({ data: run });
  })
);

// POST /runs/:runId/compensate — compensateRun
router.post(
  '/runs/:runId/compensate',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(runIdParams, req.params);
    const body = parseBody(expectedVersionBody, req.body);
    const result = await svc.compensateRun(params.runId, actor.actorUserId, body.expectedVersion);
    res.status(200).json({ data: result });
  })
);

// POST /runs/:runId/nodes/:nodeId/retry — retryNode
const retryNodeBody = z.object({
  idempotencyKey: z.string().trim().min(1).optional(),
  maxAttempts: z.number().int().min(1).optional(),
});
router.post(
  '/runs/:runId/nodes/:nodeId/retry',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(nodeIdParams, req.params);
    const body = parseBody(retryNodeBody, req.body);
    const idempotencyKey = readIdempotencyKeyHeader(req) ?? body.idempotencyKey;
    const result = await svc.retryNode(params.runId, params.nodeId, actor.actorUserId, {
      idempotencyKey,
      maxAttempts: body.maxAttempts,
    });
    res.status(200).json({ data: result });
  })
);

// POST /runs/:runId/node-runs/:nodeRunId/compensation-outcome — recordNodeCompensationOutcome
const compensationOutcomeBody = z.object({ outcome: z.enum(['COMPLETED', 'FAILED']) });
router.post(
  '/runs/:runId/node-runs/:nodeRunId/compensation-outcome',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(nodeRunIdParams, req.params);
    const body = parseBody(compensationOutcomeBody, req.body);
    const run = await svc.recordNodeCompensationOutcome(
      params.runId,
      params.nodeRunId,
      body.outcome,
      actor.actorUserId
    );
    res.status(200).json({ data: run });
  })
);

// POST /node-runs/:nodeRunId/provide-input — provideNodeInput
const provideInputBody = z.object({ inputRef: z.string().trim().min(1) });
router.post(
  '/node-runs/:nodeRunId/provide-input',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(provideInputParams, req.params);
    const body = parseBody(provideInputBody, req.body);
    const result = await svc.provideNodeInput({
      nodeRunId: params.nodeRunId,
      inputRef: body.inputRef,
      actorUserId: actor.actorUserId,
    });
    res.status(200).json({ data: result });
  })
);

export default router;
