/**
 * ai.routes — U6 — propozycje Teresy (Intent → Preview → Confirmation →
 * Commit → Settle).
 *
 * Cienka warstwa nad `aiProposalService`: parsuje wejście, woła serwis, mapuje
 * błąd na kod HTTP przez `route()` z `context.ts`. Cała logika (granice
 * Teresy, filtr antyhalucynacyjny, tryb mock) mieszka w serwisie.
 */

import { Router } from 'express';

import * as aiProposalService from '../../services/audits/aiProposalService.js';
import { requireCapability } from '../../services/audits/permissions.js';

import { assertActor, auditActor, parsePaging, route } from './context.js';

const router = Router();

router.post(
  '/intent',
  route('POST /ai/intent', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = (req.body || {}) as Record<string, unknown>;
    const created = await aiProposalService.createIntent(actor.organizationId, actor, {
      programId: String(body.programId || ''),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      targetType: body.targetType as any,
      targetId: (body.targetId as string | null | undefined) ?? null,
      intent: String(body.intent || ''),
      context: (body.context as Record<string, unknown> | undefined) ?? {},
    });
    res.status(201).json({ success: true, data: created });
  })
);

router.get(
  '/proposals',
  route('GET /ai/proposals', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const query = req.query as Record<string, unknown>;
    const programId = query.programId ? String(query.programId) : '';
    if (!programId) {
      res
        .status(400)
        .json({ success: false, error: 'programId jest wymagany', code: 'AUDIT_MISSING_PROGRAM' });
      return;
    }
    await requireCapability(actor, programId, 'program.read');
    const { limit, offset } = parsePaging(query);
    const items = await aiProposalService.listProposals(actor.organizationId, {
      programId,
      status: query.status ? String(query.status) : undefined,
      targetType: query.targetType ? String(query.targetType) : undefined,
      targetId: query.targetId ? String(query.targetId) : undefined,
      limit,
      offset,
    });
    res.json({ success: true, data: items });
  })
);

router.get(
  '/proposals/:id',
  route('GET /ai/proposals/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await aiProposalService.getProposal(actor.organizationId, req.params.id);
    res.json({ success: true, data });
  })
);

router.get(
  '/proposals/:id/preview',
  route('GET /ai/proposals/:id/preview', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await aiProposalService.getPreview(actor.organizationId, req.params.id);
    res.json({ success: true, data });
  })
);

router.post(
  '/proposals/:id/decide',
  route('POST /ai/proposals/:id/decide', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = (req.body || {}) as Record<string, unknown>;
    const data = await aiProposalService.decide(actor.organizationId, actor, req.params.id, {
      decision: body.decision as 'accept' | 'reject',
      note: (body.note as string | null | undefined) ?? null,
    });
    res.json({ success: true, data });
  })
);

router.post(
  '/proposals/:id/commit',
  route('POST /ai/proposals/:id/commit', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await aiProposalService.commit(actor.organizationId, actor, req.params.id);
    res.json({ success: true, data });
  })
);

router.post(
  '/proposals/:id/settle',
  route('POST /ai/proposals/:id/settle', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const data = await aiProposalService.settle(actor.organizationId, req.params.id);
    res.json({ success: true, data });
  })
);

router.get(
  '/evidence-gaps',
  route('GET /ai/evidence-gaps', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const programId = String((req.query as Record<string, unknown>).programId || '');
    if (!programId) {
      res
        .status(400)
        .json({ success: false, error: 'programId jest wymagany', code: 'AUDIT_MISSING_PROGRAM' });
      return;
    }
    await requireCapability(actor, programId, 'program.read');
    const data = await aiProposalService.detectEvidenceGaps(actor.organizationId, programId);
    res.json({ success: true, data });
  })
);

export default router;
