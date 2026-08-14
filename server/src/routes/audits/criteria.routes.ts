/**
 * criteria.routes — U3 — kryteria w programie i praca audytora
 *
 * Cienka warstwa HTTP nad `criterionService`. Pola odpowiedzi audytowanego,
 * wykonanej procedury i wniosku są OSOBNYMI endpointami (`/auditee-response`,
 * `/test`, `/conclude`) — nie łączymy ich w jeden PATCH, żeby nie zachęcać do
 * zlania ich w jedną "odpowiedź" po stronie klienta.
 */

import { Router } from 'express';

import * as criterionService from '../../services/audits/criterionService.js';
import type { ConformityStatus, TestResult } from '../../services/audits/types.js';

import { auditActor, assertActor, route } from './context.js';

const router = Router();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

router.get(
  '/',
  route('GET /criteria', async (req, res) => {
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
    const tree = await criterionService.listCriteria(actor.organizationId, programId, {
      conformityStatus: asString(req.query.conformityStatus) as ConformityStatus | undefined,
      assignedTo: asString(req.query.assignedTo),
      search: asString(req.query.search),
    });
    res.json({ success: true, data: tree });
  })
);

router.get(
  '/:id',
  route('GET /criteria/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const detail = await criterionService.getCriterion(actor.organizationId, req.params.id);
    if (!detail) {
      res
        .status(404)
        .json({
          success: false,
          error: 'Kryterium audytu nie zostało znalezione',
          code: 'AUDIT_NOT_FOUND',
        });
      return;
    }
    res.json({ success: true, data: detail });
  })
);

router.patch(
  '/:id/applicability',
  route('PATCH /criteria/:id/applicability', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = asRecord(req.body);
    const criterion = await criterionService.updateApplicability(
      actor.organizationId,
      actor,
      req.params.id,
      {
        applicable: Boolean(body.applicable),
        reason: (body.reason as string) ?? null,
      }
    );
    res.json({ success: true, data: criterion });
  })
);

router.patch(
  '/:id/assign',
  route('PATCH /criteria/:id/assign', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = asRecord(req.body);
    const criterion = await criterionService.assignCriterion(
      actor.organizationId,
      actor,
      req.params.id,
      {
        auditorId: body.auditorId === undefined ? undefined : ((body.auditorId as string) ?? null),
        auditeeId: body.auditeeId === undefined ? undefined : ((body.auditeeId as string) ?? null),
      }
    );
    res.json({ success: true, data: criterion });
  })
);

router.post(
  '/:id/auditee-response',
  route('POST /criteria/:id/auditee-response', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = asRecord(req.body);
    const criterion = await criterionService.submitAuditeeResponse(
      actor.organizationId,
      actor,
      req.params.id,
      String(body.text ?? '')
    );
    res.json({ success: true, data: criterion });
  })
);

router.post(
  '/:id/test',
  route('POST /criteria/:id/test', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = asRecord(req.body);
    const criterion = await criterionService.recordTest(
      actor.organizationId,
      actor,
      req.params.id,
      {
        procedurePerformed: (body.procedurePerformed as string) ?? null,
        sampleDescription: (body.sampleDescription as string) ?? null,
        testPerformed: (body.testPerformed as string) ?? null,
        testResult: (body.testResult as TestResult) ?? null,
        auditorNote: (body.auditorNote as string) ?? null,
      }
    );
    res.json({ success: true, data: criterion });
  })
);

router.post(
  '/:id/conclude',
  route('POST /criteria/:id/conclude', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = asRecord(req.body);
    const criterion = await criterionService.concludeCriterion(
      actor.organizationId,
      actor,
      req.params.id,
      {
        auditorConclusion: (body.auditorConclusion as string) ?? null,
        conformityStatus: body.conformityStatus as ConformityStatus,
      }
    );
    res.json({ success: true, data: criterion });
  })
);

export default router;
