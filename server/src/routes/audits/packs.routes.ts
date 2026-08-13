/**
 * packs.routes — U2 — Audit Packs (Library)
 *
 * Montowany pod `/api/audits/packs` (patrz `index.ts`). Odczyt (`pack.read`)
 * ma każdy członek organizacji. Zapis/publikacja/zatwierdzenie eksperckie
 * wymaga `isPlatformAdmin(actor)` — pakiety nie mają programu audytowego, po
 * którym dałoby się sprawdzić rolę audytową (to biblioteka, nie praca w
 * konkretnym audycie), więc bramka jest tu, a nie przez
 * `permissions.requireCapability` (który wymaga `programId`).
 */

import { Router } from 'express';

import { AuditPermissionError } from '../../services/audits/auditsDb.js';
import { isPlatformAdmin } from '../../services/audits/permissions.js';
import { DEMO_PACK_KEY, seedDemoAuditPack } from '../../services/audits/packSeed.js';
import {
  approveByExpert,
  comparePackVersions,
  createNewVersion,
  createPack,
  deletePack,
  getPack,
  listPacks,
  publishPack,
  replaceCriteria,
  updatePack,
  validatePackById,
} from '../../services/audits/packService.js';
import type { AuditActor } from '../../services/audits/types.js';

import { assertActor, auditActor, parsePaging, route } from './context.js';

const router = Router();

function requireAdmin(actor: AuditActor): void {
  if (!isPlatformAdmin(actor)) {
    throw new AuditPermissionError('Zarządzanie biblioteką pakietów audytowych wymaga uprawnień administratora platformy');
  }
}

router.get(
  '/',
  route('GET /packs', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const { limit, offset } = parsePaging(req.query as Record<string, unknown>);
    const result = await listPacks(actor.organizationId, {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      status: typeof req.query.status === 'string' ? (req.query.status as never) : undefined,
      classification:
        typeof req.query.classification === 'string' ? (req.query.classification as never) : undefined,
      limit,
      offset,
    });
    res.json({ success: true, data: result.items, total: result.total });
  }),
);

// Musi być przed `/:id`, żeby `packKey` w ścieżce nie trafiał do handlera po id.
router.get(
  '/:packKey/compare',
  route('GET /packs/:packKey/compare', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const versionA = Number(req.query.a);
    const versionB = Number(req.query.b);
    if (!Number.isFinite(versionA) || !Number.isFinite(versionB)) {
      res.status(400).json({
        success: false,
        error: 'Wymagane parametry liczbowe ?a=<wersja>&b=<wersja>',
        code: 'AUDIT_COMPARE_PARAMS_INVALID',
      });
      return;
    }
    const result = await comparePackVersions(actor.organizationId, req.params.packKey, versionA, versionB);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/seed-demo',
  route('POST /packs/seed-demo', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const pack = await seedDemoAuditPack(actor.organizationId, actor.userId);
    res.json({ success: true, data: pack, packKey: DEMO_PACK_KEY });
  }),
);

router.get(
  '/:id',
  route('GET /packs/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const pack = await getPack(actor.organizationId, req.params.id);
    res.json({ success: true, data: pack });
  }),
);

router.post(
  '/',
  route('POST /packs', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    requireAdmin(actor);
    const pack = await createPack(actor, req.body ?? {});
    res.status(201).json({ success: true, data: pack });
  }),
);

router.patch(
  '/:id',
  route('PATCH /packs/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    requireAdmin(actor);
    const pack = await updatePack(actor, req.params.id, req.body ?? {});
    res.json({ success: true, data: pack });
  }),
);

router.delete(
  '/:id',
  route('DELETE /packs/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    requireAdmin(actor);
    await deletePack(actor, req.params.id);
    res.json({ success: true, data: { id: req.params.id } });
  }),
);

router.put(
  '/:id/criteria',
  route('PUT /packs/:id/criteria', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    requireAdmin(actor);
    const criteria = Array.isArray(req.body) ? req.body : req.body?.criteria;
    if (!Array.isArray(criteria)) {
      res.status(400).json({
        success: false,
        error: 'Oczekiwano tablicy kryteriów (body albo body.criteria)',
        code: 'AUDIT_CRITERIA_PAYLOAD_INVALID',
      });
      return;
    }
    const result = await replaceCriteria(actor, req.params.id, criteria);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/:id/validate',
  route('POST /packs/:id/validate', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const result = await validatePackById(actor.organizationId, req.params.id);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/:id/approve-expert',
  route('POST /packs/:id/approve-expert', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    requireAdmin(actor);
    const pack = await approveByExpert(actor, req.params.id, req.body?.note ?? null);
    res.json({ success: true, data: pack });
  }),
);

router.post(
  '/:id/publish',
  route('POST /packs/:id/publish', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    requireAdmin(actor);
    const pack = await publishPack(actor, req.params.id);
    res.json({ success: true, data: pack });
  }),
);

router.post(
  '/:id/new-version',
  route('POST /packs/:id/new-version', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    requireAdmin(actor);
    // `:id` jest tu ID istniejącego pakietu — jego `pack_key` decyduje o tym,
    // która rodzina wersji jest kontynuowana.
    const current = await getPack(actor.organizationId, req.params.id);
    const pack = await createNewVersion(actor, current.packKey);
    res.status(201).json({ success: true, data: pack });
  }),
);

export default router;
