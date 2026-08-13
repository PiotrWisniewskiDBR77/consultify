/**
 * outputs.routes — U5 — niezmienne Outputy
 *
 * Montowane pod `/api/audits/outputs`. Każda trasa opiera się na
 * `route()`/`auditActor()` z `context.ts`, więc błędy domenowe (403/404/409)
 * i błędy nieoczekiwane (500, bez wycieku treści SQL) mają jeden, wspólny
 * kształt odpowiedzi `{ success, error, code }`.
 */

import { Router } from 'express';

import * as outputService from '../../services/audits/outputService.js';

import { auditActor, assertActor, route } from './context.js';

const router = Router();

router.get(
  '/',
  route('GET /outputs', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const programId = typeof req.query.programId === 'string' ? req.query.programId : undefined;
    const outputs = await outputService.listOutputs(actor.organizationId, { programId });
    res.json({ success: true, data: outputs });
  }),
);

// Musi być zarejestrowane PRZED `/:id`, inaczej `/diff` dopasowałoby się jako id.
router.get(
  '/diff',
  route('GET /outputs/diff', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const a = typeof req.query.a === 'string' ? req.query.a : '';
    const b = typeof req.query.b === 'string' ? req.query.b : '';
    if (!a || !b) {
      res
        .status(400)
        .json({ success: false, error: 'Parametry a i b są wymagane', code: 'AUDIT_DIFF_PARAMS_MISSING' });
      return;
    }
    const diff = await outputService.diffOutputs(actor.organizationId, a, b);
    res.json({ success: true, data: diff });
  }),
);

router.get(
  '/:id',
  route('GET /outputs/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const output = await outputService.getOutput(actor.organizationId, req.params.id);
    if (!output) {
      res.status(404).json({ success: false, error: 'Output nie został znaleziony', code: 'AUDIT_NOT_FOUND' });
      return;
    }
    res.json({ success: true, data: output });
  }),
);

router.post(
  '/finalize',
  route('POST /outputs/finalize', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const { programId, title } = req.body || {};
    if (!programId || typeof programId !== 'string') {
      res.status(400).json({ success: false, error: 'programId jest wymagany', code: 'AUDIT_PROGRAM_ID_REQUIRED' });
      return;
    }
    const output = await outputService.finalizeOutput(actor.organizationId, actor, programId, {
      title: typeof title === 'string' ? title : undefined,
    });
    res.status(201).json({ success: true, data: output });
  }),
);

router.post(
  '/:id/supersede',
  route('POST /outputs/:id/supersede', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const { newOutputId } = req.body || {};
    if (!newOutputId || typeof newOutputId !== 'string') {
      res
        .status(400)
        .json({ success: false, error: 'newOutputId jest wymagany', code: 'AUDIT_NEW_OUTPUT_ID_REQUIRED' });
      return;
    }
    const output = await outputService.supersedeOutput(actor.organizationId, actor, req.params.id, newOutputId);
    res.json({ success: true, data: output });
  }),
);

export default router;
