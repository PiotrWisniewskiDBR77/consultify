/**
 * trail.routes — U6 — ścieżka audytowa domeny (`audit_domain_events`).
 *
 * Cienka warstwa nad `auditTrailService`. Trasy z `programId` wymagają
 * `program.read` — kto nie ma dostępu do programu, nie widzi jego dziennika
 * zdarzeń ani kontroli niezależności.
 */

import { Router } from 'express';

import { AuditDomainError } from '../../services/audits/auditsDb.js';
import * as auditTrailService from '../../services/audits/auditTrailService.js';
import { requireCapability } from '../../services/audits/permissions.js';

import { assertActor, auditActor, parsePaging, route } from './context.js';

const router = Router();

function requireProgramId(query: Record<string, unknown>): string {
  const programId = String(query.programId || '');
  if (!programId) {
    throw new AuditDomainError('programId jest wymagany', 400, 'AUDIT_MISSING_PROGRAM');
  }
  return programId;
}

router.get(
  '/events',
  route('GET /trail/events', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const query = req.query as Record<string, unknown>;
    const programId = query.programId ? String(query.programId) : undefined;
    if (programId) await requireCapability(actor, programId, 'program.read');
    const { limit, offset } = parsePaging(query);
    const data = await auditTrailService.listEvents(actor.organizationId, {
      programId,
      entityType: query.entityType ? String(query.entityType) : undefined,
      entityId: query.entityId ? String(query.entityId) : undefined,
      eventType: query.eventType ? String(query.eventType) : undefined,
      actorId: query.actorId ? String(query.actorId) : undefined,
      from: query.from ? String(query.from) : undefined,
      to: query.to ? String(query.to) : undefined,
      limit,
      offset,
    });
    res.json({ success: true, data });
  }),
);

router.get(
  '/history',
  route('GET /trail/history', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const query = req.query as Record<string, unknown>;
    const entityType = String(query.entityType || '');
    const entityId = String(query.entityId || '');
    if (!entityType || !entityId) {
      res.status(400).json({ success: false, error: 'entityType i entityId są wymagane', code: 'AUDIT_MISSING_ENTITY' });
      return;
    }
    const data = await auditTrailService.getEntityHistory(actor.organizationId, entityType, entityId);
    res.json({ success: true, data });
  }),
);

router.get(
  '/timeline',
  route('GET /trail/timeline', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const query = req.query as Record<string, unknown>;
    const programId = requireProgramId(query);
    await requireCapability(actor, programId, 'program.read');
    const data = await auditTrailService.getProgramTimeline(actor.organizationId, programId);
    res.json({ success: true, data });
  }),
);

router.get(
  '/export',
  route('GET /trail/export', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const query = req.query as Record<string, unknown>;
    const programId = requireProgramId(query);
    await requireCapability(actor, programId, 'program.read');
    const data = await auditTrailService.exportTrail(actor.organizationId, programId);
    res.json({ success: true, data });
  }),
);

router.get(
  '/independence',
  route('GET /trail/independence', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const query = req.query as Record<string, unknown>;
    const programId = requireProgramId(query);
    await requireCapability(actor, programId, 'program.read');
    const data = await auditTrailService.getIndependenceReport(actor.organizationId, programId);
    res.json({ success: true, data });
  }),
);

export default router;
