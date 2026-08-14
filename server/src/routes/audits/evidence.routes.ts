/**
 * evidence.routes — U3 — evidence requests i dowody
 *
 * Cienka warstwa HTTP nad `evidenceService`.
 */

import { Router } from 'express';

import * as evidenceService from '../../services/audits/evidenceService.js';
import type { EvidenceKind, EvidenceRequestStatus } from '../../services/audits/types.js';

import { auditActor, assertActor, route } from './context.js';

const router = Router();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

router.get(
  '/requests',
  route('GET /evidence/requests', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const requests = await evidenceService.listRequests(actor.organizationId, {
      programId: asString(req.query.programId),
      criterionId: asString(req.query.criterionId),
      status: asString(req.query.status) as EvidenceRequestStatus | undefined,
      requestedFromUserId: asString(req.query.requestedFromUserId),
    });
    res.json({ success: true, data: requests });
  })
);

router.post(
  '/requests',
  route('POST /evidence/requests', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = asRecord(req.body);
    const request = await evidenceService.createRequest(actor.organizationId, actor, {
      programId: String(body.programId ?? ''),
      criterionId: (body.criterionId as string) ?? null,
      title: String(body.title ?? ''),
      description: (body.description as string) ?? null,
      expectedEvidenceKind: (body.expectedEvidenceKind as EvidenceKind) ?? null,
      requestedFromUserId: (body.requestedFromUserId as string) ?? null,
      dueDate: (body.dueDate as string) ?? null,
    });
    res.status(201).json({ success: true, data: request });
  })
);

router.patch(
  '/requests/:id',
  route('PATCH /evidence/requests/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = asRecord(req.body);
    const request = await evidenceService.updateRequestStatus(
      actor.organizationId,
      actor,
      req.params.id,
      body.status as EvidenceRequestStatus
    );
    res.json({ success: true, data: request });
  })
);

router.post(
  '/requests/:id/cancel',
  route('POST /evidence/requests/:id/cancel', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const request = await evidenceService.cancelRequest(actor.organizationId, actor, req.params.id);
    res.json({ success: true, data: request });
  })
);

router.get(
  '/gaps',
  route('GET /evidence/gaps', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const programId = asString(req.query.programId);
    if (!programId) {
      res
        .status(400)
        .json({
          success: false,
          error: 'Parametr programId jest wymagany',
          code: 'AUDIT_PROGRAM_ID_REQUIRED',
        });
      return;
    }
    const gaps = await evidenceService.getEvidenceGaps(actor.organizationId, programId);
    res.json({ success: true, data: gaps });
  })
);

router.get(
  '/',
  route('GET /evidence', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const accepted = req.query.accepted;
    const evidence = await evidenceService.listEvidence(actor.organizationId, {
      programId: asString(req.query.programId),
      criterionId: asString(req.query.criterionId),
      kind: asString(req.query.kind) as EvidenceKind | undefined,
      accepted: accepted === undefined ? undefined : accepted === 'true',
    });
    res.json({ success: true, data: evidence });
  })
);

router.post(
  '/',
  route('POST /evidence', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = asRecord(req.body);
    const evidence = await evidenceService.submitEvidence(actor.organizationId, actor, {
      programId: String(body.programId ?? ''),
      criterionId: (body.criterionId as string) ?? null,
      requestId: (body.requestId as string) ?? null,
      kind: body.kind as EvidenceKind,
      title: String(body.title ?? ''),
      description: (body.description as string) ?? null,
      materialId: (body.materialId as string) ?? null,
      materialVersion: (body.materialVersion as string) ?? null,
      interviewAssignmentId: (body.interviewAssignmentId as string) ?? null,
      externalReference: (body.externalReference as string) ?? null,
      contentSnapshot: (body.contentSnapshot as string) ?? null,
      periodFrom: (body.periodFrom as string) ?? null,
      periodTo: (body.periodTo as string) ?? null,
    });
    res.status(201).json({ success: true, data: evidence });
  })
);

router.post(
  '/:id/review',
  route('POST /evidence/:id/review', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = asRecord(req.body);
    const evidence = await evidenceService.reviewEvidence(
      actor.organizationId,
      actor,
      req.params.id,
      {
        sufficiency: (body.sufficiency as 'sufficient' | 'insufficient' | 'unknown') ?? null,
        reliability: (body.reliability as 'reliable' | 'questionable' | 'unknown') ?? null,
        currencyStatus: (body.currencyStatus as 'current' | 'outdated' | 'unknown') ?? null,
        supportsConformity:
          body.supportsConformity === undefined ? undefined : Boolean(body.supportsConformity),
        accepted: body.accepted === undefined ? undefined : Boolean(body.accepted),
        reviewNote: (body.reviewNote as string) ?? null,
        rejectionReason: (body.rejectionReason as string) ?? null,
      }
    );
    res.json({ success: true, data: evidence });
  })
);

export default router;
