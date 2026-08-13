/**
 * Case Workspace HTTP routes — runBindingService
 * (server/src/services/caseWorkspace/runBindingService.ts).
 *
 * Mounted at /api/v8/case-workspace/run-bindings (see caseWorkspace/index.ts).
 *
 * RE-WIRE AFTER STREAM A MERGES: bindRunToPlanVersion has no actor-shaped
 * parameter at all today — only `boundByActorId: string` — so
 * `actor.actorUserId` is already threaded verbatim; no structural change
 * expected once Stream A retrofits this service. This route resolves the
 * owning caseId via casePlanVersionService.getPlanVersion(casePlanVersionId)
 * BEFORE calling bindRunToPlanVersion, since the bind input has no caseId of
 * its own to authorize against directly.
 */

import { Router } from 'express';
import { z } from 'zod';

import * as svc from '../../services/caseWorkspace/runBindingService.js';
import * as planVersionSvc from '../../services/caseWorkspace/casePlanVersionService.js';
import { requireCaseAccessForActor } from './_shared/access.js';
import { caseWorkspaceHandler } from './_shared/handler.js';
import { toCaseWorkspaceAppError } from './_shared/errors.js';
import { parseBody, parseParams } from './_shared/validate.js';

const router = Router();

// POST / — bindRunToPlanVersion
const bindRunBody = z.object({
  runId: z.string().trim().min(1),
  casePlanVersionId: z.string().trim().min(1),
});

router.post(
  '/run-bindings',
  caseWorkspaceHandler(async (req, res, actor) => {
    const body = parseBody(bindRunBody, req.body);
    const planVersion = await planVersionSvc.getPlanVersion(body.casePlanVersionId, actor.actorUserId);
    if (!planVersion) {
      throw toCaseWorkspaceAppError(new Error('plan_version_not_found'), actor.correlationId);
    }
    await requireCaseAccessForActor(actor, planVersion.caseId);
    const created = await svc.bindRunToPlanVersion({ ...body, boundByActorId: actor.actorUserId });
    res.status(201).json({ data: created });
  })
);

// GET /:runId — getRunBinding
router.get(
  '/run-bindings/:runId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ runId: z.string().trim().min(1) }), req.params);
    const found = await svc.getRunBinding(params.runId, actor.actorUserId);
    if (!found) {
      res.status(404).json({ error: { code: 'RUN_BINDING_NOT_FOUND', message: 'Run binding not found.' } });
      return;
    }
    await requireCaseAccessForActor(actor, found.caseId);
    res.status(200).json({ data: found });
  })
);

// GET /by-case/:caseId — listRunBindingsForCase
router.get(
  '/run-bindings/by-case/:caseId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ caseId: z.string().trim().min(1) }), req.params);
    await requireCaseAccessForActor(actor, params.caseId);
    const items = await svc.listRunBindingsForCase(params.caseId, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

// GET /by-plan-version/:casePlanVersionId — listRunBindingsForPlanVersion
router.get(
  '/run-bindings/by-plan-version/:casePlanVersionId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ casePlanVersionId: z.string().trim().min(1) }), req.params);
    const planVersion = await planVersionSvc.getPlanVersion(params.casePlanVersionId, actor.actorUserId);
    if (!planVersion) {
      throw toCaseWorkspaceAppError(new Error('plan_version_not_found'), actor.correlationId);
    }
    await requireCaseAccessForActor(actor, planVersion.caseId);
    const items = await svc.listRunBindingsForPlanVersion(params.casePlanVersionId, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

export default router;
