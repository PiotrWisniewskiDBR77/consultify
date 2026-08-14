/**
 * actions.routes — U4 — działania korygujące i weryfikacja
 *
 * Trasy statyczne pod `/verification-readiness` i `/verifications*` MUSZĄ być
 * zarejestrowane przed `/:id` — z tego samego powodu co w `findings.routes.ts`.
 */

import { Router } from 'express';

import {
  approveAction,
  getAction,
  linkToInitiative,
  linkToTask,
  listActions,
  proposeAction,
  rejectAction,
  reportImplementation,
  updateAction,
} from '../../services/audits/correctiveActionService.js';
import {
  getVerificationReadiness,
  listVerifications,
  performVerification,
  planVerification,
} from '../../services/audits/verificationService.js';

import { AuditStateError } from '../../services/audits/auditsDb.js';
import type { VerificationKind } from '../../services/audits/types.js';
import { auditActor, assertActor, parsePaging, route } from './context.js';

const router = Router();

function requireProgramId(query: Record<string, unknown>): string {
  const programId = String(query.programId || '').trim();
  if (!programId) throw new AuditStateError('Wymagany parametr zapytania programId');
  return programId;
}

// ---------------------------------------------------------------------------
// Weryfikacje (trasy statyczne — przed `/:id`)
// ---------------------------------------------------------------------------

router.get(
  '/verification-readiness',
  route('GET /actions/verification-readiness', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const programId = requireProgramId(req.query as Record<string, unknown>);
    const data = await getVerificationReadiness(actor.organizationId, programId);
    res.json({ success: true, data });
  })
);

router.get(
  '/verifications',
  route('GET /actions/verifications', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const query = req.query as Record<string, unknown>;
    const data = await listVerifications(actor.organizationId, {
      programId: query.programId ? String(query.programId) : undefined,
      findingId: query.findingId ? String(query.findingId) : undefined,
      correctiveActionId: query.correctiveActionId ? String(query.correctiveActionId) : undefined,
      kind: query.kind ? (String(query.kind) as VerificationKind) : undefined,
    });
    res.json({ success: true, data });
  })
);

router.post(
  '/verifications',
  route('POST /actions/verifications', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await planVerification(actor.organizationId, actor, req.body || {});
    res.status(201).json({ success: true, data });
  })
);

router.post(
  '/verifications/:id/perform',
  route('POST /actions/verifications/:id/perform', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await performVerification(
      actor.organizationId,
      actor,
      req.params.id,
      req.body || {}
    );
    res.json({ success: true, data });
  })
);

// ---------------------------------------------------------------------------
// Działania korygujące
// ---------------------------------------------------------------------------

router.get(
  '/',
  route('GET /actions', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const query = req.query as Record<string, unknown>;
    const { limit, offset } = parsePaging(query);
    const data = await listActions(actor.organizationId, {
      programId: query.programId ? String(query.programId) : undefined,
      findingId: query.findingId ? String(query.findingId) : undefined,
      ownerUserId: query.ownerUserId ? String(query.ownerUserId) : undefined,
      status: query.status ? String(query.status) : undefined,
      limit,
      offset,
    });
    res.json({ success: true, data });
  })
);

router.get(
  '/:id',
  route('GET /actions/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await getAction(actor.organizationId, req.params.id);
    res.json({ success: true, data });
  })
);

router.post(
  '/',
  route('POST /actions', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = (req.body || {}) as Record<string, unknown>;
    const findingId = String(body.findingId || '').trim();
    if (!findingId) {
      throw new AuditStateError('Wymagane pole findingId');
    }
    const { findingId: _omit, ...rest } = body;
    const data = await proposeAction(actor.organizationId, actor, findingId, rest as never);
    res.status(201).json({ success: true, data });
  })
);

router.patch(
  '/:id',
  route('PATCH /actions/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await updateAction(actor.organizationId, actor, req.params.id, req.body || {});
    res.json({ success: true, data });
  })
);

router.post(
  '/:id/approve',
  route('POST /actions/:id/approve', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await approveAction(actor.organizationId, actor, req.params.id);
    res.json({ success: true, data });
  })
);

router.post(
  '/:id/reject',
  route('POST /actions/:id/reject', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const reason = String((req.body || {}).reason || '');
    const data = await rejectAction(actor.organizationId, actor, req.params.id, reason);
    res.json({ success: true, data });
  })
);

router.post(
  '/:id/implementation',
  route('POST /actions/:id/implementation', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await reportImplementation(
      actor.organizationId,
      actor,
      req.params.id,
      req.body || {}
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/:id/link-task',
  route('POST /actions/:id/link-task', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const taskId = String((req.body || {}).taskId || '');
    const data = await linkToTask(actor.organizationId, actor, req.params.id, taskId);
    res.json({ success: true, data });
  })
);

router.post(
  '/:id/link-initiative',
  route('POST /actions/:id/link-initiative', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const initiativeId = String((req.body || {}).initiativeId || '');
    const data = await linkToInitiative(actor.organizationId, actor, req.params.id, initiativeId);
    res.json({ success: true, data });
  })
);

export default router;
