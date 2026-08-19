import { Router } from 'express';
import { z } from 'zod';

import * as svc from '../../services/executionBvpService.js';
import { requireCaseAccessForActor, requireOrgRoleForActor } from './_shared/access.js';
import { caseWorkspaceHandler, readIdempotencyKeyHeader } from './_shared/handler.js';
import { parseBody, parseParams } from './_shared/validate.js';

const router = Router();
const id = z.string().trim().min(1);
const expectedVersion = z.number().int().positive();

router.get(
  '/execution-bvp/links/:linkId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ linkId: id }), req.params);
    await requireOrgRoleForActor(actor, 'MEMBER');
    const snapshot = await svc.readExecutionDeliverySnapshot({
      organizationId: actor.organizationId,
      linkId: params.linkId,
    });
    res.status(200).json({ data: snapshot });
  })
);

router.get(
  '/execution-bvp/authority/runtime/:initiativeId/:caseId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ initiativeId: id, caseId: id }), req.params);
    const expected = req.query.expectedVersion == null ? undefined : Number(req.query.expectedVersion);
    if (expected != null && (!Number.isInteger(expected) || expected < 1)) throw new Error('execution_authority_version_invalid');
    await requireOrgRoleForActor(actor, 'MEMBER');
    const projection = await svc.resolveExecutionSpineAuthority({
      organizationId: actor.organizationId,
      runtimeInitiativeId: params.initiativeId,
      runtimeExecutionCaseId: params.caseId,
      expectedVersion: expected,
      requireActive: true,
    });
    res.status(200).json({ data: projection });
  })
);

router.post(
  '/execution-bvp/links',
  caseWorkspaceHandler(async (req, res, actor) => {
    const body = parseBody(
      z.discriminatedUnion('sourceKind', [
        z.object({
          sourceKind: z.literal('RUNTIME_V1'),
          initiativeId: id,
          caseId: id,
          sourceVersion: expectedVersion,
          expectedLinkVersion: expectedVersion.optional(),
          legacyInitiativeId: id.optional(),
          legacyCaseId: id.optional(),
        }),
        z.object({
          sourceKind: z.literal('LEGACY_CASE_CORE').optional().default('LEGACY_CASE_CORE'),
          initiativeId: id,
          caseId: id,
        }),
      ]),
      req.body
    );
    const idempotencyKey = readIdempotencyKeyHeader(req);
    if (!idempotencyKey) throw new Error('execution_idempotency_key_required');
    await requireOrgRoleForActor(actor, 'ADMIN');
    const link =
      body.sourceKind === 'RUNTIME_V1'
        ? await svc.linkRuntimeInitiativeToExecutionCase({
            organizationId: actor.organizationId,
            initiativeId: body.initiativeId,
            caseId: body.caseId,
            sourceVersion: body.sourceVersion,
            actorId: actor.actorUserId,
            idempotencyKey,
            expectedLinkVersion: body.expectedLinkVersion,
            legacyInitiativeId: body.legacyInitiativeId,
            legacyCaseId: body.legacyCaseId,
          })
        : await (async () => {
            await requireCaseAccessForActor(actor, body.caseId);
            try {
              return await svc.linkInitiativeToExecutionCase({
                organizationId: actor.organizationId,
                initiativeId: body.initiativeId,
                caseId: body.caseId,
                actorId: actor.actorUserId,
                idempotencyKey,
              });
            } catch (error) {
              if (error instanceof Error && error.message.startsWith('execution_legacy_writer_retired:')) {
                const linkId = error.message.split(':')[1];
                const successor = await svc.resolveExecutionSpineAuthority({
                  organizationId: actor.organizationId, linkId,
                });
                res.status(410).json({ code: 'EXECUTION_LEGACY_WRITER_RETIRED', data: { successor } });
                return null as never;
              }
              throw error;
            }
          })();
    if (!link) return;
    res.status(201).json({ data: link });
  })
);

router.post(
  '/execution-bvp/links/:linkId/spine',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ linkId: id }), req.params);
    const body = parseBody(
      z.object({ workRef: id, resourceRef: id, controlRef: id, reportRef: id, expectedVersion }),
      req.body
    );
    await requireOrgRoleForActor(actor, 'ADMIN');
    const link = await svc.recordExecutionSpine({
      organizationId: actor.organizationId,
      linkId: params.linkId,
      ...body,
    });
    res.status(200).json({ data: link });
  })
);

router.post(
  '/execution-bvp/links/:linkId/evidence',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ linkId: id }), req.params);
    const body = parseBody(z.object({ artifactLinkId: id, contentDigest: id }), req.body);
    const idempotencyKey = readIdempotencyKeyHeader(req);
    if (!idempotencyKey) throw new Error('execution_evidence_idempotency_required');
    await requireOrgRoleForActor(actor, 'MEMBER');
    const evidence = await svc.submitDeliveryEvidence({
      organizationId: actor.organizationId,
      linkId: params.linkId,
      artifactLinkId: body.artifactLinkId,
      contentDigest: body.contentDigest,
      submittedBy: actor.actorUserId,
      idempotencyKey,
    });
    res.status(201).json({ data: evidence });
  })
);

router.post(
  '/execution-bvp/evidence/:evidenceId/approve',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ evidenceId: id }), req.params);
    const body = parseBody(z.object({ expectedVersion }), req.body);
    await requireOrgRoleForActor(actor, 'ADMIN');
    const evidence = await svc.approveDeliveryEvidence({
      organizationId: actor.organizationId,
      evidenceId: params.evidenceId,
      approvedBy: actor.actorUserId,
      expectedVersion: body.expectedVersion,
    });
    res.status(200).json({ data: evidence });
  })
);

router.post(
  '/execution-bvp/links/:linkId/close',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ linkId: id }), req.params);
    const body = parseBody(z.object({ evidenceId: id, expectedVersion }), req.body);
    const idempotencyKey = readIdempotencyKeyHeader(req);
    if (!idempotencyKey) throw new Error('execution_signal_idempotency_required');
    await requireOrgRoleForActor(actor, 'ADMIN');
    const result = await svc.closeExecutionAndEmitResultsSignal({
      organizationId: actor.organizationId,
      linkId: params.linkId,
      evidenceId: body.evidenceId,
      expectedVersion: body.expectedVersion,
      idempotencyKey,
    });
    res.status(result.replay ? 200 : 201).json({ data: result });
  })
);

export default router;
