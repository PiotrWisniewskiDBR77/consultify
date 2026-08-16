/**
 * Case Workspace HTTP routes — caseCoreService (server/src/services/caseWorkspace/caseCoreService.ts).
 *
 * Mounted at /api/v8/case-workspace/cases (see caseWorkspace/index.ts).
 *
 * RE-WIRE AFTER STREAM A MERGES: every `svc.*` call below passes only the
 * parameters caseCoreService.ts's CURRENT (pre-retrofit) signatures accept.
 * None of createCase/transitionStatus/updateGovernanceTier/
 * updateAutonomyPolicy/updateClosureAxisStatus/recordClosure/cancelCase take
 * an explicit actorUserId separate from the `actor: CaseActor` object they
 * already accept — `{ actorUserId: actor.actorUserId }` below is already
 * threading the authenticated actor through the existing shape, so no
 * structural change is expected here once Stream A retrofits the service
 * itself to also verify tenant/membership internally; this file's own
 * `requireCaseAccessForActor`/`requireOrgMemberForActor` calls simply become
 * redundant (but harmless) defense-in-depth at that point.
 */

import { Router } from 'express';
import { z } from 'zod';

import * as svc from '../../services/caseWorkspace/caseCoreService.js';
import {
  requireCaseAccessForActor,
  requireOrgMemberForActor,
  requireOrgRoleForActor,
} from './_shared/access.js';
import { caseWorkspaceHandler } from './_shared/handler.js';
import { parseBody, parseParams, parseQuery } from './_shared/validate.js';

const router = Router();

const caseProfileEnum = z.enum(['LIGHT', 'STANDARD', 'TRANSFORMATION', 'MONITORING']);
const governanceTierEnum = z.enum(['LIGHTWEIGHT', 'STANDARD', 'CONTROLLED']);
const autonomyPolicyEnum = z.enum([
  'ASK_EACH_ACTION',
  'ASK_MATERIAL_ACTIONS',
  'EXECUTE_APPROVED_PLAN',
]);
const caseStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'BLOCKED', 'CLOSED', 'FAILED', 'CANCELLED']);
const closureTypeEnum = z.enum([
  'DELIVERY_COMPLETED',
  'DECISION_COMPLETED',
  'IMPLEMENTATION_COMPLETED',
  'OUTCOME_VALIDATED',
  'COMPLETED_PARTIAL',
]);
const closureAxisEnum = z.enum(['delivery', 'decision', 'implementation', 'outcome']);
const axisStatusValue = z.enum(['NOT_APPLICABLE', 'PENDING', 'COMPLETED', 'VALIDATED']);

const caseIdParams = z.object({ caseId: z.string().trim().min(1) });

// POST /cases — createCase. organizationId is ALWAYS the authenticated
// actor's own org: createCaseBody below has no `organizationId` field at
// all, so a body-supplied one is stripped by zod before this handler ever
// runs, and svc.createCase is always called with `actor.organizationId`.
const createCaseBody = z.object({
  projectId: z.string().trim().min(1),
  // CW-T-A: the Case's own canonical name/title, distinct from
  // goal/expectedOutcome. OPTIONAL here on purpose: caseCoreService.createCase
  // already derives an honest fallback ("Zlecenie <short id>") when no name is
  // supplied, and the NOT NULL + non-blank CHECK on case_core.case_name is what
  // actually guarantees no Case is ever nameless. Making it required at this
  // route was stricter than the model and turned every existing caller — and 11
  // real tests — into a 400.
  caseName: z.string().trim().min(1).max(200).optional(),
  caseProfile: caseProfileEnum.optional(),
  governanceTier: governanceTierEnum.optional(),
  autonomyPolicy: autonomyPolicyEnum.optional(),
  contractedClosureType: closureTypeEnum,
  sponsorUserId: z.string().trim().min(1).nullable().optional(),
  acceptanceCriteriaRef: z.string().trim().min(1).nullable().optional(),
});

router.post(
  '/cases',
  caseWorkspaceHandler(async (req, res, actor) => {
    const body = parseBody(createCaseBody, req.body);
    await requireOrgMemberForActor(actor);
    const created = await svc.createCase({
      ...body,
      organizationId: actor.organizationId,
      createdByActorId: actor.actorUserId,
    });
    res.status(201).json({ data: created });
  })
);

// GET /cases — listCasesForOrganization, scoped to the authenticated org.
const listCasesQuery = z.object({
  caseStatus: caseStatusEnum.optional(),
  caseProfile: caseProfileEnum.optional(),
  governanceTier: governanceTierEnum.optional(),
});

router.get(
  '/cases',
  caseWorkspaceHandler(async (req, res, actor) => {
    const query = parseQuery(listCasesQuery, req.query);
    await requireOrgMemberForActor(actor);
    const items = await svc.listCasesForOrganization(
      actor.organizationId,
      query,
      actor.actorUserId
    );
    res.status(200).json({ data: items });
  })
);

// GET /cases/by-project/:projectId — getCase({ projectId }).
router.get(
  '/cases/by-project/:projectId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ projectId: z.string().trim().min(1) }), req.params);
    const found = await svc.getCase({ projectId: params.projectId }, actor.actorUserId);
    if (!found || found.organizationId !== actor.organizationId) {
      // Enumeration-safe: a cross-tenant projectId reads identically to one
      // that doesn't exist — mirrors caseWorkspaceAuthContext.requireCaseAccess's
      // own case_access_denied posture (this route has no caseId yet to
      // delegate that check to).
      res.status(404).json({ error: { code: 'CASE_NOT_FOUND', message: 'Case not found.' } });
      return;
    }
    res.status(200).json({ data: found });
  })
);

// GET /cases/:caseId
router.get(
  '/cases/:caseId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    await requireCaseAccessForActor(actor, params.caseId);
    const found = await svc.getCase({ caseId: params.caseId }, actor.actorUserId);
    if (!found) {
      res.status(404).json({ error: { code: 'CASE_NOT_FOUND', message: 'Case not found.' } });
      return;
    }
    res.status(200).json({ data: found });
  })
);

// POST /cases/:caseId/status — transitionStatus
const transitionStatusBody = z.object({
  targetStatus: caseStatusEnum,
  reason: z.string().trim().min(1).optional(),
});

router.post(
  '/cases/:caseId/status',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    const body = parseBody(transitionStatusBody, req.body);
    await requireCaseAccessForActor(actor, params.caseId);
    if (body.targetStatus === 'CLOSED' || body.targetStatus === 'CANCELLED') {
      await requireOrgRoleForActor(actor, 'ADMIN');
    }
    const updated = await svc.transitionStatus(
      params.caseId,
      body.targetStatus,
      { actorUserId: actor.actorUserId },
      body.reason
    );
    res.status(200).json({ data: updated });
  })
);

// POST /cases/:caseId/governance-tier — updateGovernanceTier
const updateGovernanceTierBody = z.object({
  tier: governanceTierEnum,
  reason: z.string().trim().min(1),
});

router.post(
  '/cases/:caseId/governance-tier',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    const body = parseBody(updateGovernanceTierBody, req.body);
    await requireCaseAccessForActor(actor, params.caseId);
    const updated = await svc.updateGovernanceTier(
      params.caseId,
      body.tier,
      { actorUserId: actor.actorUserId },
      body.reason
    );
    res.status(200).json({ data: updated });
  })
);

// POST /cases/:caseId/autonomy-policy — updateAutonomyPolicy
const updateAutonomyPolicyBody = z.object({
  policy: autonomyPolicyEnum,
  orgMaxAutonomyPolicy: autonomyPolicyEnum.nullable().optional(),
});

router.post(
  '/cases/:caseId/autonomy-policy',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    const body = parseBody(updateAutonomyPolicyBody, req.body);
    await requireCaseAccessForActor(actor, params.caseId);
    const updated = await svc.updateAutonomyPolicy(
      params.caseId,
      body.policy,
      { actorUserId: actor.actorUserId },
      body.orgMaxAutonomyPolicy ?? null
    );
    res.status(200).json({ data: updated });
  })
);

// POST /cases/:caseId/closure-axis — updateClosureAxisStatus
const updateClosureAxisBody = z.object({
  axis: closureAxisEnum,
  status: axisStatusValue,
});

router.post(
  '/cases/:caseId/closure-axis',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    const body = parseBody(updateClosureAxisBody, req.body);
    await requireCaseAccessForActor(actor, params.caseId);
    const updated = await svc.updateClosureAxisStatus(params.caseId, body.axis, body.status, {
      actorUserId: actor.actorUserId,
    });
    res.status(200).json({ data: updated });
  })
);

// POST /cases/:caseId/closure — recordClosure
const recordClosureBody = z.object({
  closureType: closureTypeEnum,
  evidenceRef: z.string().trim().min(1).nullable().optional(),
});

router.post(
  '/cases/:caseId/closure',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    const body = parseBody(recordClosureBody, req.body);
    await requireCaseAccessForActor(actor, params.caseId);
    await requireOrgRoleForActor(actor, 'ADMIN');
    const updated = await svc.recordClosure(
      params.caseId,
      body.closureType,
      { actorUserId: actor.actorUserId },
      body.evidenceRef ?? null
    );
    res.status(200).json({ data: updated });
  })
);

// POST /cases/:caseId/cancel — cancelCase
const cancelCaseBody = z.object({ reason: z.string().trim().min(1) });

router.post(
  '/cases/:caseId/cancel',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    const body = parseBody(cancelCaseBody, req.body);
    await requireCaseAccessForActor(actor, params.caseId);
    await requireOrgRoleForActor(actor, 'ADMIN');
    const updated = await svc.cancelCase(
      params.caseId,
      { actorUserId: actor.actorUserId },
      body.reason
    );
    res.status(200).json({ data: updated });
  })
);

export default router;
