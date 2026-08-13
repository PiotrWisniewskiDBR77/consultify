/**
 * programs.routes — U3 — programy audytowe (Processes)
 *
 * Cienka warstwa HTTP nad `programService`/`criterionService`: parsuje wejście,
 * woła serwis, mapuje wynik na `{ success, data }` (błędy przechodzą przez
 * `route()`/`handleAuditError` z context.ts — patrz ten plik po kod statusu).
 */

import { Router } from 'express';

import * as criterionService from '../../services/audits/criterionService.js';
import * as programService from '../../services/audits/programService.js';
import type { AuditLifecycleState } from '../../services/audits/types.js';

import { auditActor, assertActor, parsePaging, route } from './context.js';

const router = Router();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

router.get(
  '/',
  route('GET /programs', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const { limit, offset } = parsePaging(req.query as Record<string, unknown>);
    const result = await programService.listPrograms(actor.organizationId, {
      search: asString(req.query.search),
      lifecycleState: asString(req.query.lifecycleState) as AuditLifecycleState | undefined,
      status: asString(req.query.status),
      limit,
      offset,
    });
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/:id',
  route('GET /programs/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const detail = await programService.getProgram(actor.organizationId, req.params.id);
    if (!detail) {
      res
        .status(404)
        .json({ success: false, error: 'Program audytowy nie został znaleziony', code: 'AUDIT_NOT_FOUND' });
      return;
    }
    res.json({ success: true, data: detail });
  }),
);

router.post(
  '/',
  route('POST /programs', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = asRecord(req.body);
    const detail = await programService.createProgramFromPack(actor.organizationId, actor, {
      packId: String(body.packId ?? ''),
      name: String(body.name ?? ''),
      objective: (body.objective as string) ?? null,
      scopeText: (body.scopeText as string) ?? null,
      plannedStart: (body.plannedStart as string) ?? null,
      plannedEnd: (body.plannedEnd as string) ?? null,
      projectId: (body.projectId as string) ?? null,
    });
    res.status(201).json({ success: true, data: detail });
  }),
);

router.patch(
  '/:id',
  route('PATCH /programs/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const program = await programService.updateProgram(
      actor.organizationId,
      actor,
      req.params.id,
      asRecord(req.body),
    );
    res.json({ success: true, data: program });
  }),
);

router.delete(
  '/:id',
  route('DELETE /programs/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    await programService.deleteProgram(actor.organizationId, actor, req.params.id);
    res.json({ success: true, data: { deleted: true } });
  }),
);

router.get(
  '/:id/lifecycle',
  route('GET /programs/:id/lifecycle', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const status = await programService.getLifecycleStatus(actor.organizationId, req.params.id);
    if (!status) {
      res
        .status(404)
        .json({ success: false, error: 'Program audytowy nie został znaleziony', code: 'AUDIT_NOT_FOUND' });
      return;
    }
    res.json({ success: true, data: status });
  }),
);

router.post(
  '/:id/transition',
  route('POST /programs/:id/transition', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = asRecord(req.body);
    const program = await programService.transitionLifecycle(
      actor.organizationId,
      actor,
      req.params.id,
      body.targetState as AuditLifecycleState,
      (body.reason as string) ?? null,
    );
    res.json({ success: true, data: program });
  }),
);

router.post(
  '/:id/next-cycle',
  route('POST /programs/:id/next-cycle', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const detail = await programService.startNextCycle(actor.organizationId, actor, req.params.id);
    res.status(201).json({ success: true, data: detail });
  }),
);

router.get(
  '/:id/members',
  route('GET /programs/:id/members', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const members = await programService.listMembers(actor.organizationId, req.params.id);
    res.json({ success: true, data: members });
  }),
);

router.post(
  '/:id/members',
  route('POST /programs/:id/members', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = asRecord(req.body);
    const member = await programService.addMember(actor.organizationId, actor, req.params.id, {
      userId: String(body.userId ?? ''),
      memberRole: body.memberRole as programService.AddMemberInput['memberRole'],
      scopeNote: (body.scopeNote as string) ?? null,
      independenceDeclared: Boolean(body.independenceDeclared),
      conflictNote: (body.conflictNote as string) ?? null,
      competenceNote: (body.competenceNote as string) ?? null,
    });
    res.status(201).json({ success: true, data: member });
  }),
);

router.patch(
  '/:id/members/:memberId',
  route('PATCH /programs/:id/members/:memberId', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const member = await programService.updateMember(
      actor.organizationId,
      actor,
      req.params.id,
      req.params.memberId,
      asRecord(req.body),
    );
    res.json({ success: true, data: member });
  }),
);

router.delete(
  '/:id/members/:memberId',
  route('DELETE /programs/:id/members/:memberId', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    await programService.removeMember(actor.organizationId, actor, req.params.id, req.params.memberId);
    res.json({ success: true, data: { removed: true } });
  }),
);

router.get(
  '/:id/coverage',
  route('GET /programs/:id/coverage', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const coverage = await criterionService.getCoverage(actor.organizationId, req.params.id);
    res.json({ success: true, data: coverage });
  }),
);

export default router;
