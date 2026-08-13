/**
 * Case Workspace HTTP routes — capabilityRegistryService
 * (server/src/services/caseWorkspace/capabilityRegistryService.ts).
 *
 * Mounted at /api/v8/case-workspace/capabilities (see caseWorkspace/index.ts).
 * Excludes computeRequestDigest (pure, no-DB helper per the task brief).
 *
 * The capability registry is explicitly PLATFORM-GLOBAL, not tenant-scoped
 * (see the service file's own listCapabilities doc comment: "Platform-global,
 * no tenant filter"). There is no caseId/organizationId column to gate reads
 * by, so these routes gate WRITES (registerCapability/markCapabilityHealth/
 * recordIdempotencyKeyCheck) behind org-role ADMIN (a registry mutation is a
 * platform-governance action, not a per-tenant one) and leave reads open to
 * any authenticated org member — there is no narrower scope available today.
 *
 * RE-WIRE AFTER STREAM A MERGES: registerCapability/markCapabilityHealth
 * take no `actor`-shaped parameter distinct from what's threaded below
 * already (`actor: { actorUserId }` for markCapabilityHealth,
 * `createdByActorId` for registerCapability) — no structural change
 * expected. If Stream A's retrofit adds real per-tenant scoping to this
 * service (an organizationId column), the ADMIN-role-only gate here should
 * be revisited in favor of that.
 */

import { Router } from 'express';
import { z } from 'zod';

import * as svc from '../../services/caseWorkspace/capabilityRegistryService.js';
import { requireOrgMemberForActor, requireOrgRoleForActor } from './_shared/access.js';
import { caseWorkspaceHandler, readIdempotencyKeyHeader } from './_shared/handler.js';
import { parseBody, parseParams, parseQuery } from './_shared/validate.js';

const router = Router();

const providerTypeEnum = z.enum(['INTERNAL', 'MCP', 'HTTP_API', 'CONNECTOR', 'AGENT']);
const operationClassEnum = z.enum(['READ', 'COMPUTE', 'PROPOSE', 'MUTATE', 'PUBLISH', 'NOTIFY']);
const effectClassEnum = z.enum([
  'SAFE_ADDITIVE',
  'SAFE_UPDATE',
  'SENSITIVE_UPDATE',
  'DESTRUCTIVE',
  'GOVERNANCE_TRANSITION',
]);
// The vocabulary is owned by the database, not by this route: the CHECK on
// case_workspace_capabilities.approval_recommendation
// (20260809_case_workspace_capability_registry.sql:185) allows exactly these
// three values, and RegisterCapabilityInput declares the same. This enum
// previously read AUTO | NOTIFY_ONLY | REQUIRE_APPROVAL — words that appear
// nowhere in the schema or the service — so any caller reaching this route
// would have been rejected by the CHECK constraint.
const approvalClassEnum = z.enum(['auto_executable', 'policy_approvable', 'requires_human_approval']);
const healthEnum = z.enum(['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN']);
const lifecycleEnum = z.enum(['ACTIVE', 'DEPRECATED', 'UNAVAILABLE']);

// POST / — registerCapability
const registerCapabilityBody = z.object({
  capabilityId: z.string().trim().min(1),
  capabilityVersion: z.string().trim().min(1),
  ownerModule: z.string().trim().min(1),
  providerType: providerTypeEnum,
  operation: z.string().trim().min(1),
  owningCommandRef: z.string().trim().min(1),
  inputSchemaRef: z.string().trim().min(1),
  outputSchemaRef: z.string().trim().min(1),
  operationClass: operationClassEnum,
  effectClass: effectClassEnum,
  requiredRoles: z.array(z.string()).optional(),
  dataClassification: z.string().trim().min(1),
  residency: z.string().trim().min(1).nullable().optional(),
  idempotencyStrategy: z.string().trim().min(1),
  reversibility: z.string().trim().min(1),
  approvalRecommendation: approvalClassEnum,
  eventsEmitted: z.array(z.string()).optional(),
  rateLimit: z.record(z.string(), z.unknown()).nullable().optional(),
  costPolicy: z.record(z.string(), z.unknown()).nullable().optional(),
  timeoutDefaults: z.record(z.string(), z.unknown()).optional(),
  readbackQuery: z.string().trim().min(1).nullable().optional(),
  health: healthEnum.optional(),
  lifecycle: lifecycleEnum.optional(),
  testFixtureRef: z.string().trim().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

router.post(
  '/capabilities',
  caseWorkspaceHandler(async (req, res, actor) => {
    const body = parseBody(registerCapabilityBody, req.body);
    // Idempotency-Key header noted for parity with the task brief's
    // idempotent-create list; registerCapability's own dedup key is the
    // natural (capabilityId, capabilityVersion) pair (capability_already_
    // registered on a retry with the same pair is the safe-replay signal a
    // client should treat as success, not a hard failure) — recordIdempotencyKeyCheck
    // (routed separately below) is the service's actual idempotencyKey-based
    // primitive, applied post-registration.
    readIdempotencyKeyHeader(req);
    await requireOrgRoleForActor(actor, 'ADMIN');
    const created = await svc.registerCapability(
      { ...body, createdByActorId: actor.actorUserId },
      actor.organizationId
    );
    res.status(201).json({ data: created });
  })
);

// GET / — listCapabilities
const listCapabilitiesQuery = z.object({
  ownerModule: z.string().trim().min(1).optional(),
  lifecycle: lifecycleEnum.optional(),
  capabilityId: z.string().trim().min(1).optional(),
});

router.get(
  '/capabilities',
  caseWorkspaceHandler(async (req, res, actor) => {
    const query = parseQuery(listCapabilitiesQuery, req.query);
    await requireOrgMemberForActor(actor);
    const items = await svc.listCapabilities(query, actor.actorUserId, actor.organizationId);
    res.status(200).json({ data: items });
  })
);

// GET /active — listActiveCapabilities
router.get(
  '/capabilities/active',
  caseWorkspaceHandler(async (req, res, actor) => {
    const query = parseQuery(z.object({ ownerModule: z.string().trim().min(1).optional() }), req.query);
    await requireOrgMemberForActor(actor);
    const items = await svc.listActiveCapabilities(query, actor.actorUserId, actor.organizationId);
    res.status(200).json({ data: items });
  })
);

// GET /by-id/:capabilityRegistryId — getCapabilityByRegistryId
router.get(
  '/capabilities/by-id/:capabilityRegistryId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ capabilityRegistryId: z.string().trim().min(1) }), req.params);
    await requireOrgMemberForActor(actor);
    const found = await svc.getCapabilityByRegistryId(
      params.capabilityRegistryId,
      actor.actorUserId,
      actor.organizationId
    );
    if (!found) {
      res.status(404).json({ error: { code: 'CAPABILITY_NOT_FOUND', message: 'Capability not found.' } });
      return;
    }
    res.status(200).json({ data: found });
  })
);

// GET /:capabilityId/versions/:capabilityVersion — getCapabilityVersion
router.get(
  '/capabilities/:capabilityId/versions/:capabilityVersion',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(
      z.object({ capabilityId: z.string().trim().min(1), capabilityVersion: z.string().trim().min(1) }),
      req.params
    );
    await requireOrgMemberForActor(actor);
    const found = await svc.getCapabilityVersion(
      params.capabilityId,
      params.capabilityVersion,
      actor.actorUserId,
      actor.organizationId
    );
    if (!found) {
      res.status(404).json({ error: { code: 'CAPABILITY_NOT_FOUND', message: 'Capability not found.' } });
      return;
    }
    res.status(200).json({ data: found });
  })
);

// POST /by-id/:capabilityRegistryId/health — markCapabilityHealth
const markHealthBody = z.object({
  health: healthEnum,
  detail: z.string().trim().min(1).nullable().optional(),
  expectedVersion: z.number().int(),
});

router.post(
  '/capabilities/by-id/:capabilityRegistryId/health',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ capabilityRegistryId: z.string().trim().min(1) }), req.params);
    const body = parseBody(markHealthBody, req.body);
    await requireOrgRoleForActor(actor, 'ADMIN');
    const updated = await svc.markCapabilityHealth(
      params.capabilityRegistryId,
      body.health,
      { actorUserId: actor.actorUserId },
      body.detail ?? null,
      body.expectedVersion,
      actor.organizationId
    );
    res.status(200).json({ data: updated });
  })
);

// POST /by-id/:capabilityRegistryId/idempotency-check — recordIdempotencyKeyCheck
const idempotencyCheckBody = z.object({ requestPayload: z.unknown() });

router.post(
  '/capabilities/by-id/:capabilityRegistryId/idempotency-check',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ capabilityRegistryId: z.string().trim().min(1) }), req.params);
    const body = parseBody(idempotencyCheckBody, req.body);
    const idempotencyKey = readIdempotencyKeyHeader(req) ?? (req.body as { idempotencyKey?: unknown })?.idempotencyKey;
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Idempotency-Key header (or body.idempotencyKey) is required.' },
      });
      return;
    }
    await requireOrgRoleForActor(actor, 'ADMIN');
    const result = await svc.recordIdempotencyKeyCheck(
      {
        capabilityRegistryId: params.capabilityRegistryId,
        idempotencyKey,
        requestPayload: body.requestPayload,
        actorId: actor.actorUserId,
      },
      actor.organizationId
    );
    res.status(result.isDuplicate ? 200 : 201).json({ data: result });
  })
);

export default router;
