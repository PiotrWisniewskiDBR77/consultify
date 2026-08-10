/**
 * Case Workspace HTTP routes — casePlanVersionService
 * (server/src/services/caseWorkspace/casePlanVersionService.ts).
 *
 * Mounted at /api/v8/case-workspace/plan-versions (see caseWorkspace/index.ts).
 * Excludes computeGraphDigest/computeValidationBlockers (pure, no-DB helpers
 * per the task brief's exclusion list) — validatePlanVersion (the service
 * method that calls computeValidationBlockers internally) IS routed.
 *
 * RE-WIRE AFTER STREAM A MERGES: createPlanDraft/updatePlanDraft/
 * proposePlanVersion/requestChangesOnPlanVersion/publishPlanVersion/
 * withdrawPlanVersion/putViewState all take an `actor: CaseActor` object
 * already — `{ actorUserId: actor.actorUserId }` below is the wiring point;
 * no structural change expected. This file resolves a plan version's owning
 * caseId via `svc.getPlanVersion` before authorizing by-id routes (the
 * service has no case-scoped variant of getPlanVersion/loadForUpdate) —
 * once Stream A's retrofit adds tenant checks inside the service itself,
 * this route-level resolve-then-check becomes redundant defense-in-depth.
 */

import { Router } from 'express';
import { z } from 'zod';

import * as svc from '../../services/caseWorkspace/casePlanVersionService.js';
import { requireCaseAccessForActor } from './_shared/access.js';
import { caseWorkspaceHandler } from './_shared/handler.js';
import { toCaseWorkspaceAppError } from './_shared/errors.js';
import { parseBody, parseParams, parseQuery } from './_shared/validate.js';
import type { CaseWorkspaceActor } from './_shared/handler.js';

const router = Router();

const viewTypeEnum = z.enum(['SIMPLE', 'EXPERT', 'LIST']);
// CanonicalGraph is intentionally loosely typed in the service itself (see
// its own comment) — this schema only pins the fields the service actually
// dereferences (requireGraph checks nodes/edges/entryNodeIds/terminalNodeIds
// are arrays), leaving the rest as passthrough unknown fields.
const canonicalGraphSchema = z
  .object({
    schemaVersion: z.string().optional(),
    graphId: z.string().optional(),
    entryNodeIds: z.array(z.string()),
    terminalNodeIds: z.array(z.string()),
    nodes: z.array(z.record(z.string(), z.unknown())),
    edges: z.array(z.record(z.string(), z.unknown())),
    variables: z.array(z.record(z.string(), z.unknown())).optional(),
    inputSchemaRef: z.string().nullable().optional(),
    outputSchemaRef: z.string().nullable().optional(),
    limits: z.record(z.string(), z.unknown()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const planVersionIdParams = z.object({ planVersionId: z.string().trim().min(1) });
const caseIdParams = z.object({ caseId: z.string().trim().min(1) });

async function requireCaseAccessForPlanVersion(
  actor: CaseWorkspaceActor,
  planVersionId: string
): Promise<svc.CasePlanVersion> {
  const planVersion = await svc.getPlanVersion(planVersionId, actor.actorUserId);
  if (!planVersion) {
    throw toCaseWorkspaceAppError(new Error('plan_version_not_found'), actor.correlationId);
  }
  await requireCaseAccessForActor(actor, planVersion.caseId);
  return planVersion;
}

// POST /cases/:caseId/plan-versions — createPlanDraft
const createPlanDraftBody = z.object({
  sourceProcessVersionId: z.string().trim().min(1).nullable().optional(),
  supersedesPlanVersionId: z.string().trim().min(1).nullable().optional(),
  semanticGraph: canonicalGraphSchema,
  changeReason: z.string().trim().min(1).nullable().optional(),
});

router.post(
  '/cases/:caseId/plan-versions',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    const body = parseBody(createPlanDraftBody, req.body);
    await requireCaseAccessForActor(actor, params.caseId);
    const created = await svc.createPlanDraft({
      ...body,
      caseId: params.caseId,
      createdByActorId: actor.actorUserId,
    });
    res.status(201).json({ data: created });
  })
);

// GET /cases/:caseId/plan-versions — listPlanVersionsForCase
router.get(
  '/cases/:caseId/plan-versions',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    await requireCaseAccessForActor(actor, params.caseId);
    const items = await svc.listPlanVersionsForCase(params.caseId, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

// GET /cases/:caseId/plan-versions/:planVersionId/diff — diffPlanVersions
router.get(
  '/cases/:caseId/plan-versions/:planVersionId/diff',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams.merge(planVersionIdParams), req.params);
    const query = parseQuery(z.object({ against: z.string().trim().min(1).optional() }), req.query);
    await requireCaseAccessForActor(actor, params.caseId);
    const diff = await svc.diffPlanVersions(params.caseId, params.planVersionId, query, actor.actorUserId);
    res.status(200).json({ data: diff });
  })
);

// GET /plan-versions/:planVersionId
router.get(
  '/plan-versions/:planVersionId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(planVersionIdParams, req.params);
    const planVersion = await requireCaseAccessForPlanVersion(actor, params.planVersionId);
    res.status(200).json({ data: planVersion });
  })
);

// PUT /plan-versions/:planVersionId — updatePlanDraft
const updatePlanDraftBody = z.object({
  semanticGraph: canonicalGraphSchema,
  expectedVersion: z.number().int(),
});

router.put(
  '/plan-versions/:planVersionId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(planVersionIdParams, req.params);
    const body = parseBody(updatePlanDraftBody, req.body);
    await requireCaseAccessForPlanVersion(actor, params.planVersionId);
    const updated = await svc.updatePlanDraft(
      params.planVersionId,
      body,
      { actorUserId: actor.actorUserId }
    );
    res.status(200).json({ data: updated });
  })
);

// GET /plan-versions/:planVersionId/validate — validatePlanVersion
router.get(
  '/plan-versions/:planVersionId/validate',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(planVersionIdParams, req.params);
    await requireCaseAccessForPlanVersion(actor, params.planVersionId);
    const result = await svc.validatePlanVersion(params.planVersionId, actor.actorUserId);
    res.status(200).json({ data: result });
  })
);

// GET /plan-versions/:planVersionId/graph — getGraph
router.get(
  '/plan-versions/:planVersionId/graph',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(planVersionIdParams, req.params);
    await requireCaseAccessForPlanVersion(actor, params.planVersionId);
    const graph = await svc.getGraph(params.planVersionId, actor.actorUserId);
    if (!graph) {
      res.status(404).json({ error: { code: 'PLAN_VERSION_NOT_FOUND', message: 'Plan version not found.' } });
      return;
    }
    res.status(200).json({ data: graph });
  })
);

const expectedVersionBody = z.object({ expectedVersion: z.number().int() });

// POST /plan-versions/:planVersionId/propose — proposePlanVersion
router.post(
  '/plan-versions/:planVersionId/propose',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(planVersionIdParams, req.params);
    const body = parseBody(expectedVersionBody, req.body);
    await requireCaseAccessForPlanVersion(actor, params.planVersionId);
    const updated = await svc.proposePlanVersion(
      params.planVersionId,
      { actorUserId: actor.actorUserId },
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// POST /plan-versions/:planVersionId/request-changes — requestChangesOnPlanVersion
const requestChangesBody = z.object({
  reason: z.string().trim().min(1),
  expectedVersion: z.number().int(),
});

router.post(
  '/plan-versions/:planVersionId/request-changes',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(planVersionIdParams, req.params);
    const body = parseBody(requestChangesBody, req.body);
    await requireCaseAccessForPlanVersion(actor, params.planVersionId);
    const updated = await svc.requestChangesOnPlanVersion(
      params.planVersionId,
      { actorUserId: actor.actorUserId },
      body.reason,
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// POST /plan-versions/:planVersionId/publish — publishPlanVersion
router.post(
  '/plan-versions/:planVersionId/publish',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(planVersionIdParams, req.params);
    const body = parseBody(expectedVersionBody, req.body);
    await requireCaseAccessForPlanVersion(actor, params.planVersionId);
    const updated = await svc.publishPlanVersion(
      params.planVersionId,
      { actorUserId: actor.actorUserId },
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// POST /plan-versions/:planVersionId/withdraw — withdrawPlanVersion
const withdrawBody = z.object({
  reason: z.string().trim().min(1),
  expectedVersion: z.number().int(),
});

router.post(
  '/plan-versions/:planVersionId/withdraw',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(planVersionIdParams, req.params);
    const body = parseBody(withdrawBody, req.body);
    await requireCaseAccessForPlanVersion(actor, params.planVersionId);
    const updated = await svc.withdrawPlanVersion(
      params.planVersionId,
      { actorUserId: actor.actorUserId },
      body.reason,
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// GET /plan-versions/:planVersionId/view-state/:viewType — getViewState
const viewTypeParams = z.object({ viewType: viewTypeEnum });

router.get(
  '/plan-versions/:planVersionId/view-state/:viewType',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(planVersionIdParams.merge(viewTypeParams), req.params);
    await requireCaseAccessForPlanVersion(actor, params.planVersionId);
    const state = await svc.getViewState(params.planVersionId, params.viewType, actor.actorUserId);
    if (!state) {
      res.status(404).json({ error: { code: 'PLAN_VIEW_STATE_NOT_FOUND', message: 'View state not found.' } });
      return;
    }
    res.status(200).json({ data: state });
  })
);

// PUT /plan-versions/:planVersionId/view-state/:viewType — putViewState
const putViewStateBody = z.object({ viewState: z.unknown() });

router.put(
  '/plan-versions/:planVersionId/view-state/:viewType',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(planVersionIdParams.merge(viewTypeParams), req.params);
    const body = parseBody(putViewStateBody, req.body);
    await requireCaseAccessForPlanVersion(actor, params.planVersionId);
    const state = await svc.putViewState(params.planVersionId, params.viewType, body.viewState, {
      actorUserId: actor.actorUserId,
    });
    res.status(200).json({ data: state });
  })
);

export default router;
