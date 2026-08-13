/**
 * proposals.routes — U5 — Initiative Proposal Drafts
 *
 * Montowane pod `/api/audits/proposals`. `POST /suggest` NIE zapisuje nic —
 * zwraca treść sugerowanych propozycji do przeglądu przed jawnym `POST /`.
 */

import { Router } from 'express';

import * as proposalService from '../../services/audits/proposalService.js';
import type { ProposalStatus } from '../../services/audits/types.js';

import { auditActor, assertActor, route } from './context.js';

const router = Router();

router.get(
  '/',
  route('GET /proposals', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const programId = typeof req.query.programId === 'string' ? req.query.programId : undefined;
    const status = typeof req.query.status === 'string' ? (req.query.status as ProposalStatus) : undefined;
    const proposals = await proposalService.listProposals(actor.organizationId, { programId, status });
    res.json({ success: true, data: proposals });
  }),
);

router.get(
  '/:id',
  route('GET /proposals/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const proposal = await proposalService.getProposal(actor.organizationId, req.params.id);
    if (!proposal) {
      res.status(404).json({ success: false, error: 'Propozycja nie została znaleziona', code: 'AUDIT_NOT_FOUND' });
      return;
    }
    res.json({ success: true, data: proposal });
  }),
);

router.get(
  '/:id/overlap',
  route('GET /proposals/:id/overlap', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const overlap = await proposalService.checkOverlap(actor.organizationId, req.params.id);
    res.json({ success: true, data: overlap });
  }),
);

router.post(
  '/',
  route('POST /proposals', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = req.body || {};
    if (!body.programId || !Array.isArray(body.findingIds) || body.findingIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'programId i findingIds (niepusta lista) są wymagane',
        code: 'AUDIT_PROPOSAL_INPUT_INVALID',
      });
      return;
    }
    const proposals = await proposalService.draftProposalsFromFindings(
      actor.organizationId,
      actor,
      String(body.programId),
      {
        findingIds: body.findingIds.map(String),
        splitBy: body.splitBy === 'criterion' ? 'criterion' : 'none',
        title: typeof body.title === 'string' ? body.title : undefined,
      },
    );
    res.status(201).json({ success: true, data: proposals });
  }),
);

router.patch(
  '/:id',
  route('PATCH /proposals/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const proposal = await proposalService.updateProposal(actor.organizationId, actor, req.params.id, req.body || {});
    res.json({ success: true, data: proposal });
  }),
);

router.post(
  '/suggest',
  route('POST /proposals/suggest', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const programId =
      typeof req.query.programId === 'string' ? req.query.programId : String((req.body || {}).programId || '');
    if (!programId) {
      res.status(400).json({ success: false, error: 'programId jest wymagany', code: 'AUDIT_PROGRAM_ID_REQUIRED' });
      return;
    }
    const suggestions = await proposalService.suggestSystemicProposals(actor.organizationId, programId);
    res.json({ success: true, data: suggestions });
  }),
);

router.post(
  '/:id/register',
  route('POST /proposals/:id/register', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const proposal = await proposalService.registerAsInitiative(actor.organizationId, actor, req.params.id);
    res.json({ success: true, data: proposal });
  }),
);

router.post(
  '/:id/dismiss',
  route('POST /proposals/:id/dismiss', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const reason = typeof (req.body || {}).reason === 'string' ? req.body.reason : null;
    const proposal = await proposalService.dismissProposal(actor.organizationId, actor, req.params.id, reason);
    res.json({ success: true, data: proposal });
  }),
);

router.post(
  '/:id/defer',
  route('POST /proposals/:id/defer', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const reason = typeof (req.body || {}).reason === 'string' ? req.body.reason : null;
    const proposal = await proposalService.deferProposal(actor.organizationId, actor, req.params.id, reason);
    res.json({ success: true, data: proposal });
  }),
);

export default router;
