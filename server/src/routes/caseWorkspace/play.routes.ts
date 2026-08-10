/**
 * Case Workspace HTTP routes — playService
 * (server/src/services/caseWorkspace/playService.ts).
 *
 * Mounted at /api/v8/case-workspace (see caseWorkspace/index.ts). Excludes
 * computeGraphDigest (pure, no-DB helper per the task brief).
 * `isAuthorizedPublisher` IS routed (not in the task's exclusion list, and
 * it is a real DB read, not a pure helper) as a read-only publisher-eligibility
 * check.
 *
 * process_definitions/process_versions are org-scoped
 * (ProcessDefinition.organizationId) but, pre-retrofit, most of playService's
 * OWN functions take no organizationId/actor parameter to check it against
 * for definition-/version-scoped calls (only createProcessDefinition and
 * listProcessDefinitions do). This route file closes that gap itself: every
 * by-id route below first loads the definition (directly, or via the
 * version's processDefinitionId) and 404s (enumeration-safe, mirroring
 * caseWorkspaceAuthContext's case_access_denied posture) if its
 * organizationId does not match the authenticated actor's own org — see
 * `requireOwnOrgDefinition`/`requireOwnOrgVersion` below.
 *
 * RE-WIRE AFTER STREAM A MERGES: createProcessDefinition/
 * createProcessVersionDraft/updateProcessVersionDraft/shareProcessDefinition/
 * proposeProcessVersion/reviewProcessVersion/publishProcessVersion/
 * deprecateProcessVersion/archiveProcessVersion/instantiateProcessVersion all
 * take `actor: CaseActor` already — `actor.actorUserId` is the wiring point
 * throughout. The org-match checks this file performs itself
 * (`requireOwnOrgDefinition`/`requireOwnOrgVersion`) should be revisited once
 * Stream A's retrofit adds a real organizationId parameter to the
 * definition-/version-scoped service functions directly.
 */

import { Router } from 'express';
import { z } from 'zod';

import * as svc from '../../services/caseWorkspace/playService.js';
import { requireCaseAccessForActor, requireOrgMemberForActor } from './_shared/access.js';
import { caseWorkspaceHandler } from './_shared/handler.js';
import { toCaseWorkspaceAppError } from './_shared/errors.js';
import { parseBody, parseParams, parseQuery } from './_shared/validate.js';
import type { CaseWorkspaceActor } from './_shared/handler.js';

const router = Router();

const visibilityEnum = z.enum(['PRIVATE', 'TEAM', 'ORGANIZATION']);
const reviewDecisionEnum = z.enum(['APPROVED', 'CHANGES_REQUESTED']);
const canonicalGraphSchema = z
  .object({
    schemaVersion: z.string().optional(),
    graphId: z.string().optional(),
    entryNodeIds: z.array(z.string()),
    terminalNodeIds: z.array(z.string()),
    // Identity fields are REQUIRED here, not merely passed through: GraphNode
    // needs nodeId, GraphEdge needs edgeId/sourceNodeId/targetNodeId and
    // GraphVariable needs name. Validating them at the boundary turns a
    // malformed graph into a clear 400 instead of an obscure failure deeper
    // in the service, and makes the parsed value genuinely a CanonicalGraph
    // rather than something cast into one.
    nodes: z.array(z.object({ nodeId: z.string().trim().min(1) }).passthrough()),
    edges: z.array(
      z
        .object({
          edgeId: z.string().trim().min(1),
          sourceNodeId: z.string().trim().min(1),
          targetNodeId: z.string().trim().min(1),
        })
        .passthrough()
    ),
    variables: z.array(z.object({ name: z.string().trim().min(1) }).passthrough()).optional(),
    inputSchemaRef: z.string().nullable().optional(),
    outputSchemaRef: z.string().nullable().optional(),
    limits: z.record(z.string(), z.unknown()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const definitionIdParams = z.object({ processDefinitionId: z.string().trim().min(1) });
const versionIdParams = z.object({ processVersionId: z.string().trim().min(1) });

async function requireOwnOrgDefinition(
  actor: CaseWorkspaceActor,
  processDefinitionId: string
): Promise<svc.ProcessDefinition> {
  const definition = await svc.getProcessDefinition(processDefinitionId, actor.actorUserId);
  if (!definition || definition.organizationId !== actor.organizationId) {
    throw toCaseWorkspaceAppError(new Error('process_definition_not_found'), actor.correlationId);
  }
  return definition;
}

async function requireOwnOrgVersion(
  actor: CaseWorkspaceActor,
  processVersionId: string
): Promise<{ version: svc.ProcessVersion; definition: svc.ProcessDefinition }> {
  const version = await svc.getProcessVersion(processVersionId, actor.actorUserId);
  if (!version) {
    throw toCaseWorkspaceAppError(new Error('process_version_not_found'), actor.correlationId);
  }
  const definition = await requireOwnOrgDefinition(actor, version.processDefinitionId);
  return { version, definition };
}

// POST /process-definitions — createProcessDefinition
const createDefinitionBody = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).nullable().optional(),
  ownerActorId: z.string().trim().min(1).optional(),
});

router.post(
  '/process-definitions',
  caseWorkspaceHandler(async (req, res, actor) => {
    const body = parseBody(createDefinitionBody, req.body);
    await requireOrgMemberForActor(actor);
    const created = await svc.createProcessDefinition({
      ...body,
      organizationId: actor.organizationId,
      ownerActorId: body.ownerActorId ?? actor.actorUserId,
      createdByActorId: actor.actorUserId,
    });
    res.status(201).json({ data: created });
  })
);

// GET /process-definitions — listProcessDefinitions (native cursor pagination)
const listDefinitionsQuery = z.object({
  visibility: visibilityEnum.optional(),
  ownerActorId: z.string().trim().min(1).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

router.get(
  '/process-definitions',
  caseWorkspaceHandler(async (req, res, actor) => {
    const query = parseQuery(listDefinitionsQuery, req.query);
    await requireOrgMemberForActor(actor);
    const page = await svc.listProcessDefinitions(
      actor.organizationId,
      { visibility: query.visibility, ownerActorId: query.ownerActorId },
      { cursor: query.cursor, limit: query.limit },
      actor.actorUserId
    );
    res.status(200).json({ data: page.items, nextCursor: page.nextCursor });
  })
);

// GET /process-definitions/:processDefinitionId
router.get(
  '/process-definitions/:processDefinitionId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(definitionIdParams, req.params);
    const definition = await requireOwnOrgDefinition(actor, params.processDefinitionId);
    res.status(200).json({ data: definition });
  })
);

// GET /process-definitions/:processDefinitionId/publisher-check — isAuthorizedPublisher
router.get(
  '/process-definitions/:processDefinitionId/publisher-check',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(definitionIdParams, req.params);
    await requireOwnOrgDefinition(actor, params.processDefinitionId);
    const authorized = await svc.isAuthorizedPublisher(actor.actorUserId, actor.organizationId);
    res.status(200).json({ data: { authorized } });
  })
);

// POST /process-definitions/:processDefinitionId/share — shareProcessDefinition
const shareBody = z.object({
  targetVisibility: z.enum(['TEAM', 'ORGANIZATION']),
  expectedVersion: z.number().int(),
});

router.post(
  '/process-definitions/:processDefinitionId/share',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(definitionIdParams, req.params);
    const body = parseBody(shareBody, req.body);
    await requireOwnOrgDefinition(actor, params.processDefinitionId);
    const updated = await svc.shareProcessDefinition(
      params.processDefinitionId,
      body.targetVisibility,
      { actorUserId: actor.actorUserId },
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// POST /process-definitions/:processDefinitionId/versions — createProcessVersionDraft
const createVersionBody = z.object({
  semanticGraph: canonicalGraphSchema,
  capabilityVersions: z.array(z.unknown()).optional(),
  policyRef: z.string().trim().min(1).nullable().optional(),
  requiredBindings: z.array(z.unknown()).optional(),
  changeReason: z.string().trim().min(1).nullable().optional(),
});

router.post(
  '/process-definitions/:processDefinitionId/versions',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(definitionIdParams, req.params);
    const body = parseBody(createVersionBody, req.body);
    await requireOwnOrgDefinition(actor, params.processDefinitionId);
    const created = await svc.createProcessVersionDraft({
      ...body,
      processDefinitionId: params.processDefinitionId,
      createdByActorId: actor.actorUserId,
    });
    res.status(201).json({ data: created });
  })
);

// GET /process-definitions/:processDefinitionId/versions — listProcessVersionsForDefinition
router.get(
  '/process-definitions/:processDefinitionId/versions',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(definitionIdParams, req.params);
    await requireOwnOrgDefinition(actor, params.processDefinitionId);
    const items = await svc.listProcessVersionsForDefinition(params.processDefinitionId, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

// GET /process-versions/:processVersionId
router.get(
  '/process-versions/:processVersionId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(versionIdParams, req.params);
    const { version } = await requireOwnOrgVersion(actor, params.processVersionId);
    res.status(200).json({ data: version });
  })
);

// PUT /process-versions/:processVersionId — updateProcessVersionDraft
const updateVersionBody = z.object({
  semanticGraph: canonicalGraphSchema,
  capabilityVersions: z.array(z.unknown()).optional(),
  policyRef: z.string().trim().min(1).nullable().optional(),
  requiredBindings: z.array(z.unknown()).optional(),
  expectedVersion: z.number().int(),
});

router.put(
  '/process-versions/:processVersionId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(versionIdParams, req.params);
    const body = parseBody(updateVersionBody, req.body);
    await requireOwnOrgVersion(actor, params.processVersionId);
    const updated = await svc.updateProcessVersionDraft(
      params.processVersionId,
      body,
      { actorUserId: actor.actorUserId }
    );
    res.status(200).json({ data: updated });
  })
);

const expectedVersionBody = z.object({ expectedVersion: z.number().int() });

// POST /process-versions/:processVersionId/propose
router.post(
  '/process-versions/:processVersionId/propose',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(versionIdParams, req.params);
    const body = parseBody(expectedVersionBody, req.body);
    await requireOwnOrgVersion(actor, params.processVersionId);
    const updated = await svc.proposeProcessVersion(
      params.processVersionId,
      { actorUserId: actor.actorUserId },
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// POST /process-versions/:processVersionId/review
const reviewBody = z.object({
  decision: reviewDecisionEnum,
  reason: z.string().trim().min(1).optional(),
  expectedVersion: z.number().int(),
});

router.post(
  '/process-versions/:processVersionId/review',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(versionIdParams, req.params);
    const body = parseBody(reviewBody, req.body);
    await requireOwnOrgVersion(actor, params.processVersionId);
    const updated = await svc.reviewProcessVersion(
      params.processVersionId,
      { actorUserId: actor.actorUserId },
      body.decision,
      body.reason,
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// POST /process-versions/:processVersionId/publish
router.post(
  '/process-versions/:processVersionId/publish',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(versionIdParams, req.params);
    const body = parseBody(expectedVersionBody, req.body);
    await requireOwnOrgVersion(actor, params.processVersionId);
    const updated = await svc.publishProcessVersion(
      params.processVersionId,
      { actorUserId: actor.actorUserId },
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// POST /process-versions/:processVersionId/deprecate
const deprecateBody = z.object({ reason: z.string().trim().min(1), expectedVersion: z.number().int() });

router.post(
  '/process-versions/:processVersionId/deprecate',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(versionIdParams, req.params);
    const body = parseBody(deprecateBody, req.body);
    await requireOwnOrgVersion(actor, params.processVersionId);
    const updated = await svc.deprecateProcessVersion(
      params.processVersionId,
      { actorUserId: actor.actorUserId },
      body.reason,
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// POST /process-versions/:processVersionId/archive
router.post(
  '/process-versions/:processVersionId/archive',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(versionIdParams, req.params);
    const body = parseBody(expectedVersionBody, req.body);
    await requireOwnOrgVersion(actor, params.processVersionId);
    const updated = await svc.archiveProcessVersion(
      params.processVersionId,
      { actorUserId: actor.actorUserId },
      body.expectedVersion
    );
    res.status(200).json({ data: updated });
  })
);

// POST /process-versions/:processVersionId/instantiate — instantiateProcessVersion
const instantiateBody = z.object({
  caseId: z.string().trim().min(1),
  changeReason: z.string().trim().min(1).nullable().optional(),
});

router.post(
  '/process-versions/:processVersionId/instantiate',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(versionIdParams, req.params);
    const body = parseBody(instantiateBody, req.body);
    await requireOwnOrgVersion(actor, params.processVersionId);
    await requireCaseAccessForActor(actor, body.caseId);
    const planDraft = await svc.instantiateProcessVersion(
      params.processVersionId,
      body.caseId,
      { actorUserId: actor.actorUserId },
      { changeReason: body.changeReason }
    );
    res.status(201).json({ data: planDraft });
  })
);

export default router;
