/**
 * Case Workspace HTTP routes — migrationReadinessService
 * (server/src/services/caseWorkspace/migrationReadinessService.ts).
 *
 * Mounted at /api/v8/case-workspace (see caseWorkspace/index.ts). Excludes
 * isFlagEnabledForEntity (pure, no-DB helper per the task brief).
 *
 * Flag DEFINITIONS (registerFlagDefinition/getFlagDefinition/
 * listFlagChildren/listFlagDescendants) are platform-global, same posture as
 * capabilityRegistryService — gated ADMIN-role for the one write
 * (registerFlagDefinition), open read for any org member.
 *
 * Flag STATE (setOrgFlagState/getCurrentOrgFlagState/listCurrentOrgFlags/
 * findSmallestEnabledDescendant/rollbackFlag) IS org-scoped — organizationId
 * is always forced to the authenticated actor's own org, never taken from
 * the request body/query.
 *
 * KNOWN GAP, flagged for Stream A (do not silently "fix" by inventing a
 * parameter that doesn't exist yet): getQuarantinedLegacyRecord/
 * listQuarantinedLegacyRecordsForRehearsalRun/
 * listQuarantinedLegacyRecordsForSource/countQuarantinedByReasonCode take NO
 * organizationId parameter at all, even though QuarantinedLegacyRecord rows
 * ARE org-scoped data. getQuarantinedLegacyRecord (by-id) can still be
 * enumeration-safely checked (fetch, then 404 if organizationId mismatches).
 * The three list/count-by-rehearsalRunId-or-source endpoints CANNOT be
 * scoped that way (there's nothing case/org-identifying in the path to check
 * against ahead of the query) — gated to org-role ADMIN as a stopgap, which
 * is NOT real tenant isolation, only a narrower blast radius. RE-WIRE AFTER
 * STREAM A MERGES: once this service gains an organizationId parameter on
 * those three reads, replace the ADMIN-role stopgap with a real
 * requireCaseAccessForActor-equivalent check.
 */

import { Router } from 'express';
import { z } from 'zod';

import * as svc from '../../services/caseWorkspace/migrationReadinessService.js';
import { requireOrgMemberForActor, requireOrgRoleForActor } from './_shared/access.js';
import { caseWorkspaceHandler, readIdempotencyKeyHeader } from './_shared/handler.js';
import { toCaseWorkspaceAppError } from './_shared/errors.js';
import { parseBody, parseParams, parseQuery } from './_shared/validate.js';

const router = Router();

const flagKeyParams = z.object({ flagKey: z.string().trim().min(1) });

// POST /flags/definitions — registerFlagDefinition
const registerFlagDefinitionBody = z.object({
  flagKey: z.string().trim().min(1),
  parentFlagKey: z.string().trim().min(1).nullable().optional(),
  description: z.string().trim().min(1),
});

router.post(
  '/flags/definitions',
  caseWorkspaceHandler(async (req, res, actor) => {
    const body = parseBody(registerFlagDefinitionBody, req.body);
    await requireOrgRoleForActor(actor, 'ADMIN');
    const created = await svc.registerFlagDefinition(
      { ...body, createdBy: actor.actorUserId },
      actor.organizationId
    );
    res.status(201).json({ data: created });
  })
);

// GET /flags/definitions/:flagKey — getFlagDefinition
router.get(
  '/flags/definitions/:flagKey',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(flagKeyParams, req.params);
    await requireOrgMemberForActor(actor);
    const found = await svc.getFlagDefinition(params.flagKey, actor.actorUserId, actor.organizationId);
    if (!found) {
      res.status(404).json({ error: { code: 'FLAG_DEFINITION_NOT_FOUND', message: 'Flag definition not found.' } });
      return;
    }
    res.status(200).json({ data: found });
  })
);

// GET /flags/definitions/:flagKey/children — listFlagChildren
router.get(
  '/flags/definitions/:flagKey/children',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(flagKeyParams, req.params);
    await requireOrgMemberForActor(actor);
    const items = await svc.listFlagChildren(params.flagKey, actor.actorUserId, actor.organizationId);
    res.status(200).json({ data: items });
  })
);

// GET /flags/definitions/:flagKey/descendants — listFlagDescendants
router.get(
  '/flags/definitions/:flagKey/descendants',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(flagKeyParams, req.params);
    await requireOrgMemberForActor(actor);
    const items = await svc.listFlagDescendants(params.flagKey, actor.actorUserId, actor.organizationId);
    res.status(200).json({ data: items });
  })
);

// PUT /flags/org-state/:flagKey — setOrgFlagState
const setOrgFlagStateBody = z.object({
  enabled: z.boolean(),
  cohort: z.string().trim().min(1).nullable().optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  allowList: z.array(z.string()).optional(),
});

router.put(
  '/flags/org-state/:flagKey',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(flagKeyParams, req.params);
    const body = parseBody(setOrgFlagStateBody, req.body);
    await requireOrgRoleForActor(actor, 'ADMIN');
    const updated = await svc.setOrgFlagState({
      ...body,
      organizationId: actor.organizationId,
      flagKey: params.flagKey,
      updatedBy: actor.actorUserId,
    });
    res.status(200).json({ data: updated });
  })
);

// GET /flags/org-state — listCurrentOrgFlags
router.get(
  '/flags/org-state',
  caseWorkspaceHandler(async (req, res, actor) => {
    const query = parseQuery(z.object({ cohort: z.string().trim().min(1).optional() }), req.query);
    await requireOrgMemberForActor(actor);
    const items = await svc.listCurrentOrgFlags(actor.organizationId, query, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

// GET /flags/org-state/:flagKey — getCurrentOrgFlagState
router.get(
  '/flags/org-state/:flagKey',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(flagKeyParams, req.params);
    await requireOrgMemberForActor(actor);
    const found = await svc.getCurrentOrgFlagState(actor.organizationId, params.flagKey, actor.actorUserId);
    if (!found) {
      res.status(404).json({ error: { code: 'FEATURE_FLAG_STATE_NOT_FOUND', message: 'Flag state not found.' } });
      return;
    }
    res.status(200).json({ data: found });
  })
);

// GET /flags/org-state/:flagKey/smallest-enabled-descendant — findSmallestEnabledDescendant
router.get(
  '/flags/org-state/:flagKey/smallest-enabled-descendant',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(flagKeyParams, req.params);
    await requireOrgMemberForActor(actor);
    const items = await svc.findSmallestEnabledDescendant(
      actor.organizationId,
      params.flagKey,
      actor.actorUserId
    );
    res.status(200).json({ data: items });
  })
);

// POST /flags/org-state/:flagKey/rollback — rollbackFlag
router.post(
  '/flags/org-state/:flagKey/rollback',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(flagKeyParams, req.params);
    await requireOrgRoleForActor(actor, 'ADMIN');
    const updated = await svc.rollbackFlag(actor.organizationId, params.flagKey, actor.actorUserId);
    res.status(200).json({ data: updated });
  })
);

// POST /legacy-quarantine — recordQuarantinedLegacyRecord
const recordQuarantineBody = z.object({
  rehearsalRunId: z.string().trim().min(1),
  sourceSystem: z.string().trim().min(1),
  sourceTable: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
  attemptedCaseId: z.string().trim().min(1).nullable().optional(),
  quarantineReasonCode: z.string().trim().min(1),
  quarantineReasonDetail: z.string().trim().min(1),
  recoveryPathRef: z.string().trim().min(1),
  sourceRecordSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
  detectedAt: z.string().trim().min(1),
  dedupeKey: z.string().trim().min(1).nullable().optional(),
});

router.post(
  '/legacy-quarantine',
  caseWorkspaceHandler(async (req, res, actor) => {
    const body = parseBody(recordQuarantineBody, req.body);
    await requireOrgRoleForActor(actor, 'ADMIN');
    const dedupeKey = body.dedupeKey ?? readIdempotencyKeyHeader(req) ?? null;
    const created = await svc.recordQuarantinedLegacyRecord(
      {
        ...body,
        dedupeKey,
        organizationId: actor.organizationId,
      },
      actor.actorUserId
    );
    res.status(201).json({ data: created });
  })
);

// GET /legacy-quarantine/:quarantineId — getQuarantinedLegacyRecord
router.get(
  '/legacy-quarantine/:quarantineId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ quarantineId: z.string().trim().min(1) }), req.params);
    await requireOrgRoleForActor(actor, 'ADMIN');
    const found = await svc.getQuarantinedLegacyRecord(params.quarantineId, actor.actorUserId);
    if (!found || found.organizationId !== actor.organizationId) {
      // Enumeration-safe: see this file's top-of-file "known gap" note.
      throw toCaseWorkspaceAppError(new Error('legacy_quarantine_not_found'), actor.correlationId);
    }
    res.status(200).json({ data: found });
  })
);

// GET /legacy-quarantine/rehearsal-runs/:rehearsalRunId — listQuarantinedLegacyRecordsForRehearsalRun
router.get(
  '/legacy-quarantine/rehearsal-runs/:rehearsalRunId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ rehearsalRunId: z.string().trim().min(1) }), req.params);
    const query = parseQuery(
      z.object({ afterId: z.string().trim().min(1).optional(), limit: z.coerce.number().int().positive().max(1000).optional() }),
      req.query
    );
    // Stopgap ADMIN-role gate — see this file's top-of-file "known gap" note;
    // this service has no organizationId parameter on this read yet.
    await requireOrgRoleForActor(actor, 'ADMIN');
    const items = await svc.listQuarantinedLegacyRecordsForRehearsalRun(
      params.rehearsalRunId,
      query,
      actor.actorUserId,
      actor.organizationId
    );
    res.status(200).json({ data: items.filter((item) => item.organizationId === actor.organizationId) });
  })
);

// GET /legacy-quarantine/rehearsal-runs/:rehearsalRunId/counts — countQuarantinedByReasonCode
router.get(
  '/legacy-quarantine/rehearsal-runs/:rehearsalRunId/counts',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ rehearsalRunId: z.string().trim().min(1) }), req.params);
    // Stopgap ADMIN-role gate — see this file's top-of-file "known gap" note.
    // Unlike the list route above, this is a pure GROUP BY count with no rows
    // to post-filter by organizationId, so the ADMIN-role gate is the only
    // mitigation available today.
    await requireOrgRoleForActor(actor, 'ADMIN');
    const counts = await svc.countQuarantinedByReasonCode(
      params.rehearsalRunId,
      actor.actorUserId,
      actor.organizationId
    );
    res.status(200).json({ data: counts });
  })
);

// GET /legacy-quarantine/source/:sourceTable/:sourceId — listQuarantinedLegacyRecordsForSource
router.get(
  '/legacy-quarantine/source/:sourceTable/:sourceId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(
      z.object({ sourceTable: z.string().trim().min(1), sourceId: z.string().trim().min(1) }),
      req.params
    );
    // Stopgap ADMIN-role gate — see this file's top-of-file "known gap" note.
    await requireOrgRoleForActor(actor, 'ADMIN');
    const items = await svc.listQuarantinedLegacyRecordsForSource(
      params.sourceTable,
      params.sourceId,
      actor.actorUserId,
      actor.organizationId
    );
    res.status(200).json({ data: items.filter((item) => item.organizationId === actor.organizationId) });
  })
);

export default router;
