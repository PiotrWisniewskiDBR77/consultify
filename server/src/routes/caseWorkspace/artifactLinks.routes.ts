/**
 * Case Workspace HTTP routes — artifactLinkService
 * (server/src/services/caseWorkspace/artifactLinkService.ts).
 *
 * Mounted at /api/v8/case-workspace (see caseWorkspace/index.ts).
 * `computeArtifactLinkSetDigest` IS routed — it is a real (composed) DB
 * read, not a pure no-DB helper, so it is not in the task brief's exclusion
 * list.
 *
 * RE-WIRE AFTER STREAM A MERGES: linkArtifactToCase/pinArtifactRevision/
 * markLinkStale/markLinkArtifactUnavailable/unlinkArtifactFromCase all take
 * `actor`-shaped parameters (`linkedByActorId` inside LinkArtifactToCaseInput,
 * or `actor: ArtifactLinkActor` directly) already — `actor.actorUserId` is
 * the wiring point throughout. By-id routes (everything under
 * /artifact-links/:linkId) resolve the owning caseId via svc.getArtifactLink
 * first, since none of those service calls take a caseId directly to
 * authorize against.
 */

import { Router } from 'express';
import { z } from 'zod';

import * as svc from '../../services/caseWorkspace/artifactLinkService.js';
import { executeGovernedCaseAction, requireCaseAccessForActor } from './_shared/access.js';
import { caseWorkspaceHandler, readIdempotencyKeyHeader } from './_shared/handler.js';
import { toCaseWorkspaceAppError } from './_shared/errors.js';
import { parseBody, parseParams, parseQuery } from './_shared/validate.js';
import type { CaseWorkspaceActor } from './_shared/handler.js';

const router = Router();

const relationEnum = z.enum([
  'INPUT',
  'OUTPUT',
  'EVIDENCE',
  'DECISION_BASIS',
  'DELIVERABLE',
  'OUTCOME_MEASUREMENT',
]);
const linkStatusEnum = z.enum(['ACTIVE', 'UNLINKED', 'UNAVAILABLE']);

const caseIdParams = z.object({ caseId: z.string().trim().min(1) });
const linkIdParams = z.object({ linkId: z.string().trim().min(1) });

async function requireCaseAccessForLink(
  actor: CaseWorkspaceActor,
  linkId: string
): Promise<svc.CaseArtifactLink> {
  const link = await svc.getArtifactLink(linkId, actor.actorUserId);
  if (!link) {
    throw toCaseWorkspaceAppError(new Error('artifact_link_not_found'), actor.correlationId);
  }
  await requireCaseAccessForActor(actor, link.caseId);
  return link;
}

// POST /cases/:caseId/artifact-links — linkArtifactToCase
const linkArtifactBody = z.object({
  artifactType: z.string().trim().min(1),
  artifactId: z.string().trim().min(1),
  artifactRevision: z.string().trim().min(1).nullable().optional(),
  relation: relationEnum,
  pinReason: z.string().trim().min(1).nullable().optional(),
  dedupeKey: z.string().trim().min(1).nullable().optional(),
});

router.post(
  '/cases/:caseId/artifact-links',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    const body = parseBody(linkArtifactBody, req.body);
    await requireCaseAccessForActor(actor, params.caseId);
    const dedupeKey = body.dedupeKey ?? readIdempotencyKeyHeader(req) ?? null;
    const created = await svc.linkArtifactToCase({
      ...body,
      dedupeKey,
      caseId: params.caseId,
      linkedByActorId: actor.actorUserId,
    });
    res.status(201).json({ data: created });
  })
);

// GET /cases/:caseId/artifact-links — listArtifactLinksForCase
router.get(
  '/cases/:caseId/artifact-links',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    const query = parseQuery(
      z.object({
        relation: relationEnum.optional(),
        artifactType: z.string().trim().min(1).optional(),
        linkStatus: linkStatusEnum.optional(),
        isStale: z.coerce.boolean().optional(),
      }),
      req.query
    );
    await requireCaseAccessForActor(actor, params.caseId);
    const items = await svc.listArtifactLinksForCase(params.caseId, query, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

// GET /cases/:caseId/artifact-links/digest — computeArtifactLinkSetDigest
router.get(
  '/cases/:caseId/artifact-links/digest',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    await requireCaseAccessForActor(actor, params.caseId);
    const digest = await svc.computeArtifactLinkSetDigest(params.caseId, actor.actorUserId);
    res.status(200).json({ data: digest });
  })
);

// GET /artifact-links/:linkId
router.get(
  '/artifact-links/:linkId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(linkIdParams, req.params);
    const link = await requireCaseAccessForLink(actor, params.linkId);
    res.status(200).json({ data: link });
  })
);

// GET /artifact-links/:linkId/open — resolveArtifactLinkOpen (CW-P09 packet
// B5, closes SCOPE_ADJUDICATION.md Golden Case item 12's PARTIAL:
// "opening it in the module" / "returning to the Case" had no
// case-workspace API call to back it). Resolves the canonical deep-link
// target (artifactType/artifactId/artifactRevision) plus an explicit
// AVAILABLE/STALE/UNAVAILABLE/DELETED state and a Case-side return context
// (caseId + casePhase + resultsGroup, doc 03 §5's "same Case phase and
// selected step"), or 404s — with the SAME code used for a missing linkId —
// when the actor's Case access does not cover this link (SEC-009: cross-
// tenant must stay indistinguishable from nonexistent; see
// artifactLinkService.ts's ArtifactLinkOpenState doc comment).
router.get(
  '/artifact-links/:linkId/open',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(linkIdParams, req.params);
    // Defense-in-depth pass, same convention as every other by-id route in
    // this file (see this file's "RE-WIRE AFTER STREAM A MERGES" header
    // note) — svc.resolveArtifactLinkOpen() re-does the same access check
    // internally via getArtifactLink().
    const resolution = await svc.resolveArtifactLinkOpen(params.linkId, actor.actorUserId);
    if (!resolution) {
      // Reachable only if the link was concurrently unlinked/access-revoked
      // between the two checks above — same 404 code as every other
      // not-found/inaccessible linkId in this file, per SEC-009.
      throw toCaseWorkspaceAppError(new Error('artifact_link_not_found'), actor.correlationId);
    }
    res.status(200).json({ data: resolution });
  })
);

// POST /artifact-links/:linkId/pin — pinArtifactRevision
const pinBody = z.object({
  revision: z.string().trim().min(1),
  reason: z.string().trim().min(1).nullable().optional(),
});

router.post(
  '/artifact-links/:linkId/pin',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(linkIdParams, req.params);
    const body = parseBody(pinBody, req.body);
    await requireCaseAccessForLink(actor, params.linkId);
    const updated = await svc.pinArtifactRevision(
      params.linkId,
      body.revision,
      { actorUserId: actor.actorUserId },
      body.reason ?? null
    );
    res.status(200).json({ data: updated });
  })
);

// POST /artifact-links/:linkId/mark-stale — markLinkStale
const reasonOnlyBody = z.object({ reason: z.string().trim().min(1).nullable().optional() });

router.post(
  '/artifact-links/:linkId/mark-stale',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(linkIdParams, req.params);
    const body = parseBody(reasonOnlyBody, req.body);
    await requireCaseAccessForLink(actor, params.linkId);
    const updated = await svc.markLinkStale(
      params.linkId,
      { actorUserId: actor.actorUserId },
      body.reason ?? null
    );
    res.status(200).json({ data: updated });
  })
);

// POST /artifact-links/:linkId/mark-unavailable — markLinkArtifactUnavailable
router.post(
  '/artifact-links/:linkId/mark-unavailable',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(linkIdParams, req.params);
    const body = parseBody(reasonOnlyBody, req.body);
    await requireCaseAccessForLink(actor, params.linkId);
    const updated = await svc.markLinkArtifactUnavailable(
      params.linkId,
      { actorUserId: actor.actorUserId },
      body.reason ?? null
    );
    res.status(200).json({ data: updated });
  })
);

// DELETE /artifact-links/:linkId — unlinkArtifactFromCase
router.delete(
  '/artifact-links/:linkId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(linkIdParams, req.params);
    const body = parseBody(reasonOnlyBody, req.body);
    const updated = await executeGovernedCaseAction({
      actor, actionId: 'case.artifact.unlink', targetId: params.linkId,
      operation: async () => {
        await requireCaseAccessForLink(actor, params.linkId);
        return svc.unlinkArtifactFromCase(params.linkId, { actorUserId: actor.actorUserId }, body.reason ?? null);
      },
    });
    res.status(200).json({ data: updated });
  })
);

export default router;
