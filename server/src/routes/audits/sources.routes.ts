/**
 * sources.routes — U2 — rejestr źródeł normatywnych
 *
 * Montowany pod `/api/audits/sources` (patrz `index.ts`). Odczyt wymaga
 * `pack.read` (ma go każdy członek organizacji — patrz `permissions.ts`
 * `ORG_MEMBER_CAPABILITIES`); zapis/weryfikacja/usunięcie wymaga
 * `isPlatformAdmin(actor)`, bo źródła nie mają programu audytowego, po
 * którym dałoby się sprawdzić rolę audytową — rejestr jest zasobem
 * biblioteki, nie pracą w konkretnym audycie.
 */

import { Router } from 'express';

import { isPlatformAdmin } from '../../services/audits/permissions.js';
import {
  createSource,
  deleteSource,
  getSource,
  listSources,
  updateSource,
  verifySource,
} from '../../services/audits/normSourceService.js';
import { AuditPermissionError } from '../../services/audits/auditsDb.js';
import type { AuditActor } from '../../services/audits/types.js';

import { assertActor, auditActor, parsePaging, route } from './context.js';

const router = Router();

function requireAdmin(actor: AuditActor): void {
  if (!isPlatformAdmin(actor)) {
    throw new AuditPermissionError(
      'Zarządzanie rejestrem źródeł normatywnych wymaga uprawnień administratora platformy'
    );
  }
}

router.get(
  '/',
  route('GET /sources', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const { limit, offset } = parsePaging(req.query as Record<string, unknown>);
    const result = await listSources(actor.organizationId, {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      sourceKind: typeof req.query.sourceKind === 'string' ? req.query.sourceKind : undefined,
      verificationStatus:
        typeof req.query.verificationStatus === 'string' ? req.query.verificationStatus : undefined,
      limit,
      offset,
    });
    res.json({ success: true, data: result.items, total: result.total });
  })
);

router.get(
  '/:id',
  route('GET /sources/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const source = await getSource(actor.organizationId, req.params.id);
    res.json({ success: true, data: source });
  })
);

router.post(
  '/',
  route('POST /sources', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    requireAdmin(actor);
    const source = await createSource(actor, req.body ?? {});
    res.status(201).json({ success: true, data: source });
  })
);

router.patch(
  '/:id',
  route('PATCH /sources/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    requireAdmin(actor);
    const source = await updateSource(actor, req.params.id, req.body ?? {});
    res.json({ success: true, data: source });
  })
);

router.post(
  '/:id/verify',
  route('POST /sources/:id/verify', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    requireAdmin(actor);
    const source = await verifySource(actor, req.params.id, req.body ?? {});
    res.json({ success: true, data: source });
  })
);

router.delete(
  '/:id',
  route('DELETE /sources/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    requireAdmin(actor);
    await deleteSource(actor, req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  })
);

export default router;
