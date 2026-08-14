/**
 * findings.routes — U4 — ustalenia i odpowiedzi właściciela
 *
 * Trasy statyczne (`/statistics`, `/systemic`) MUSZĄ być zarejestrowane przed
 * `/:id` — inaczej Express dopasuje je do parametru `:id` i żadna z nich nie
 * zostanie osiągnięta.
 */

import { Router } from 'express';

import {
  acceptResidualRisk,
  closeFinding,
  createFinding,
  detectSystemicFindings,
  getFinding,
  getFindingStatistics,
  listFindings,
  reviewFinding,
  reviewManagementResponse,
  submitManagementResponse,
  updateFinding,
} from '../../services/audits/findingService.js';

import { AuditStateError } from '../../services/audits/auditsDb.js';
import { auditActor, assertActor, parsePaging, route } from './context.js';

const router = Router();

function requireProgramId(query: Record<string, unknown>): string {
  const programId = String(query.programId || '').trim();
  if (!programId) throw new AuditStateError('Wymagany parametr zapytania programId');
  return programId;
}

router.get(
  '/statistics',
  route('GET /findings/statistics', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const programId = requireProgramId(req.query as Record<string, unknown>);
    const data = await getFindingStatistics(actor.organizationId, programId);
    res.json({ success: true, data });
  })
);

router.get(
  '/systemic',
  route('GET /findings/systemic', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const programId = requireProgramId(req.query as Record<string, unknown>);
    const data = await detectSystemicFindings(actor.organizationId, programId);
    res.json({ success: true, data });
  })
);

router.get(
  '/',
  route('GET /findings', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const query = req.query as Record<string, unknown>;
    const programId = requireProgramId(query);
    const { limit, offset } = parsePaging(query);
    const data = await listFindings(actor.organizationId, {
      programId,
      status: query.status ? String(query.status) : undefined,
      classification: query.classification ? String(query.classification) : undefined,
      severity: query.severity ? String(query.severity) : undefined,
      ownerUserId: query.ownerUserId ? String(query.ownerUserId) : undefined,
      criterionId: query.criterionId ? String(query.criterionId) : undefined,
      search: query.search ? String(query.search) : undefined,
      limit,
      offset,
    });
    res.json({ success: true, data });
  })
);

router.get(
  '/:id',
  route('GET /findings/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await getFinding(actor.organizationId, req.params.id);
    res.json({ success: true, data });
  })
);

router.post(
  '/',
  route('POST /findings', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await createFinding(actor.organizationId, actor, req.body || {});
    res.status(201).json({ success: true, data });
  })
);

router.patch(
  '/:id',
  route('PATCH /findings/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await updateFinding(actor.organizationId, actor, req.params.id, req.body || {});
    res.json({ success: true, data });
  })
);

router.post(
  '/:id/review',
  route('POST /findings/:id/review', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await reviewFinding(actor.organizationId, actor, req.params.id, req.body || {});
    res.json({ success: true, data });
  })
);

router.post(
  '/:id/response',
  route('POST /findings/:id/response', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await submitManagementResponse(
      actor.organizationId,
      actor,
      req.params.id,
      req.body || {}
    );
    res.status(201).json({ success: true, data });
  })
);

router.post(
  '/responses/:responseId/review',
  route('POST /findings/responses/:responseId/review', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await reviewManagementResponse(
      actor.organizationId,
      actor,
      req.params.responseId,
      req.body || {}
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/:id/accept-risk',
  route('POST /findings/:id/accept-risk', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await acceptResidualRisk(
      actor.organizationId,
      actor,
      req.params.id,
      req.body || {}
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/:id/close',
  route('POST /findings/:id/close', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await closeFinding(actor.organizationId, actor, req.params.id, req.body || {});
    res.json({ success: true, data });
  })
);

export default router;
