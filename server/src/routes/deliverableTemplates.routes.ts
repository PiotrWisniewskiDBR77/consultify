/**
 * Deliverable templates API
 *
 * GET    /api/deliverables/templates?type=doc|deck|table  — lista (T1)
 * POST   /api/deliverables/templates                      — utwórz (T3)
 * GET    /api/deliverables/templates/:id                  — pobierz jeden (T3)
 * PUT    /api/deliverables/templates/:id                  — edytuj (T3)
 * DELETE /api/deliverables/templates/:id                  — usuń (T3)
 *
 * Bezpieczeństwo: verifyToken + requireOrgAccess() na routerze.
 * System templates są read-only — mutacja zwraca 403.
 */

import { Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import type { DeliverableTemplateType } from '../services/deliverableTemplateService.js';
import {
  approveTemplateProvenance,
  createDeliverableTemplate,
  deleteDeliverableTemplate,
  getDeliverableTemplate,
  listPendingTemplateProvenance,
  listDeliverableTemplates,
  syncWorkbookTemplateArtifactLifecycle,
  TemplateForbiddenError,
  TemplateNotFoundError,
  TemplateProvenanceConflictError,
  TemplateProvenanceForbiddenError,
  TemplateProvenanceInvalidError,
  TemplateProvenanceUnsupportedRegistryError,
  updateDeliverableTemplate,
} from '../services/deliverableTemplateService.js';
import { suggestTemplate } from '../services/deliverableTemplateSuggestService.js';
import logger from '../utils/Logger.js';

const router = Router();

router.use(verifyToken);
router.use(requireOrgAccess());

function getOrgId(req: any): string {
  return req.user?.organizationId || req.user?.organization_id || '';
}

function getUserId(req: any): string {
  return req.user?.id || req.user?.userId || '';
}

const VALID_TYPES: ReadonlySet<string> = new Set(['doc', 'deck', 'table']);

// ── GET list ────────────────────────────────────────────────
router.get('/templates', async (req, res) => {
  const type = req.query.type as string;
  if (!VALID_TYPES.has(type)) {
    res.status(400).json({ error: 'Invalid type. Must be doc|deck|table.' });
    return;
  }
  try {
    const templates = await listDeliverableTemplates(
      type as DeliverableTemplateType,
      getOrgId(req),
      getUserId(req)
    );
    res.json({ templates });
  } catch (err) {
    logger.error('[deliverableTemplates] Failed to load templates', { err, type });
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

// Pending provenance never joins the normal template list: those rows remain
// quarantined and unusable until the explicit governed command succeeds.
router.get('/templates-provenance/pending', async (req, res) => {
  try {
    const templates = await listPendingTemplateProvenance({
      organizationId: getOrgId(req),
      actorUserId: getUserId(req),
    });
    res.json({ templates });
  } catch (err) {
    if (err instanceof TemplateProvenanceForbiddenError) {
      res.status(403).json({ error: err.message, code: err.code });
      return;
    }
    logger.error('[deliverableTemplates] Failed to load pending provenance', { err });
    res.status(500).json({ error: 'Failed to load pending template provenance' });
  }
});

// ── POST create ─────────────────────────────────────────────
router.post('/templates', async (req, res) => {
  const { type, name, description, meta } = req.body as {
    type?: string;
    name?: string;
    description?: string;
    meta?: Record<string, unknown>;
  };

  if (!type || !VALID_TYPES.has(type)) {
    res.status(400).json({ error: 'Invalid or missing type. Must be doc|deck|table.' });
    return;
  }
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'name is required and must be a non-empty string.' });
    return;
  }
  if (name.length > 200) {
    res.status(400).json({ error: 'name must not exceed 200 characters.' });
    return;
  }

  try {
    const template = await createDeliverableTemplate(
      type as DeliverableTemplateType,
      name.trim(),
      description,
      meta,
      getOrgId(req),
      getUserId(req)
    );
    res.status(201).json({ template });
  } catch (err) {
    logger.error('[deliverableTemplates] Failed to create template', { err });
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// ── GET single ──────────────────────────────────────────────
router.get('/templates/:id', async (req, res) => {
  try {
    const template = await getDeliverableTemplate(req.params.id, getOrgId(req));
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json({ template });
  } catch (err) {
    logger.error('[deliverableTemplates] Failed to get template', { err, id: req.params.id });
    res.status(500).json({ error: 'Failed to get template' });
  }
});

// ── PUT update ──────────────────────────────────────────────
router.put('/templates/:id', async (req, res) => {
  const { name, description, meta } = req.body as {
    name?: string;
    description?: string;
    meta?: Record<string, unknown>;
  };

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name must be a non-empty string.' });
      return;
    }
    if (name.length > 200) {
      res.status(400).json({ error: 'name must not exceed 200 characters.' });
      return;
    }
  }

  try {
    const template = await updateDeliverableTemplate(
      req.params.id,
      { name: name?.trim(), description, meta },
      getOrgId(req),
      getUserId(req)
    );
    res.json({ template });
  } catch (err) {
    if (err instanceof TemplateForbiddenError) {
      res.status(403).json({ error: err.message });
      return;
    }
    if (err instanceof TemplateNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    logger.error('[deliverableTemplates] Failed to update template', { err, id: req.params.id });
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Org-owned workbook lifecycle facade. The system catalog endpoints remain
// super-admin only; this path first proves tenant ownership, then delegates to
// the existing lifecycle service (same transitions, history and audit trail).
async function mutateWorkbookLifecycle(req: any, res: any, action: 'approve' | 'deprecate') {
  try {
    const existing = await getDeliverableTemplate(req.params.id, getOrgId(req));
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (existing.type !== 'table')
      return res.status(400).json({ error: 'Workbook template required' });
    if (existing.isSystem || existing.organizationId !== getOrgId(req))
      return res
        .status(403)
        .json({ error: 'Only an organization-owned workbook template can be changed' });
    const lifecycleSvc = (await import('../services/tablePlatform/TemplateLifecycleService.js'))
      .default;
    const options = {
      actorUserId: getUserId(req),
      note: typeof req.body?.note === 'string' ? req.body.note : undefined,
    };
    const template =
      action === 'approve'
        ? await lifecycleSvc.approveTemplate(req.params.id, options)
        : await lifecycleSvc.deprecateTemplate(req.params.id, options);
    await syncWorkbookTemplateArtifactLifecycle({
      template: existing,
      status: template.status,
      version: template.version,
      historyCount: template.approval_history.length,
      organizationId: getOrgId(req),
      userId: getUserId(req),
    });
    return res.json(template);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'INVALID_LIFECYCLE_TRANSITION')
      return res.status(409).json({ error: (err as Error).message, code });
    if (code === 'TEMPLATE_NOT_FOUND')
      return res.status(404).json({ error: (err as Error).message, code });
    logger.error('[deliverableTemplates] Workbook lifecycle transition failed', {
      err,
      id: req.params.id,
      action,
    });
    return res.status(500).json({ error: `Failed to ${action} workbook template` });
  }
}

router.post(
  '/templates/:id/approve',
  (req, res) => void mutateWorkbookLifecycle(req, res, 'approve')
);
router.post(
  '/templates/:id/deprecate',
  (req, res) => void mutateWorkbookLifecycle(req, res, 'deprecate')
);

// ── POST suggest ────────────────────────────────────────────
router.post('/templates/suggest', async (req, res) => {
  const { intent, type, useLlm } = req.body as {
    intent?: string;
    type?: string;
    useLlm?: boolean;
  };

  if (!intent || typeof intent !== 'string' || intent.trim().length === 0) {
    res.status(400).json({ error: 'intent is required and must be a non-empty string.' });
    return;
  }
  if (intent.length > 1000) {
    res.status(400).json({ error: 'intent must not exceed 1000 characters.' });
    return;
  }
  if (!type || !VALID_TYPES.has(type)) {
    res.status(400).json({ error: 'Invalid or missing type. Must be doc|deck|table.' });
    return;
  }
  if (useLlm !== undefined && typeof useLlm !== 'boolean') {
    res.status(400).json({ error: 'useLlm must be a boolean.' });
    return;
  }

  try {
    const suggestion = await suggestTemplate(
      intent.trim(),
      type as DeliverableTemplateType,
      getOrgId(req),
      { useLlm: useLlm === true }
    );
    res.json({ suggestion });
  } catch (err) {
    // Fail-open: błąd sugestii nigdy nie jest 500
    logger.warn('[deliverableTemplates] suggest threw unexpectedly, returning null', { err });
    res.json({ suggestion: null });
  }
});

// ── DELETE ──────────────────────────────────────────────────
router.delete('/templates/:id', async (req, res) => {
  try {
    const deleted = await deleteDeliverableTemplate(req.params.id, getOrgId(req), getUserId(req));
    if (!deleted) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    if (err instanceof TemplateForbiddenError) {
      res.status(403).json({ error: err.message });
      return;
    }
    logger.error('[deliverableTemplates] Failed to delete template', { err, id: req.params.id });
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// ── PROVENANCE APPROVAL (MAT-POL / AMD-MAT-PROVENANCE-WRITER-002) ──────────
//
// The actor and tenant come from the verified token only — never from the body.
// A body-supplied organizationId or actor is ignored rather than merged, so a
// spoofed field cannot widen scope or misattribute a rights attestation.
//
// The role check itself lives in the service, inside the same transaction as the
// write, because `requireOrgAccess()` on this router only asserts that an
// organization id is present; it does not read `organization_members` and would
// not deny a platform SUPERADMIN who holds no membership in this tenant.
router.post('/templates/:id/provenance/approve', async (req, res) => {
  // The replay boundary has exactly ONE source. A body fallback would give the
  // same logical request two different identities depending on how it was sent,
  // so the header is required and a body-supplied key is never consulted.
  const idempotencyKey =
    (typeof req.header === 'function' ? req.header('Idempotency-Key') : '') || '';
  try {
    const result = await approveTemplateProvenance({
      organizationId: getOrgId(req),
      actorUserId: getUserId(req),
      idempotencyKey: String(idempotencyKey || ''),
      registry: String(req.body?.registry ?? ''),
      templateId: req.params.id,
      provenance: {
        source: String(req.body?.source ?? ''),
        licenseBasis: String(req.body?.licenseBasis ?? ''),
        authority: String(req.body?.authority ?? ''),
        version: String(req.body?.version ?? ''),
        evidence: String(req.body?.evidence ?? ''),
      },
    });
    res.status(result.replayed ? 200 : 201).json(result);
  } catch (err) {
    if (err instanceof TemplateProvenanceUnsupportedRegistryError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof TemplateProvenanceInvalidError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof TemplateProvenanceForbiddenError) {
      res.status(403).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof TemplateProvenanceConflictError) {
      res.status(409).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof TemplateNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    // The failure detail is logged, never returned: an approval error must not
    // become a channel for registry contents or identifiers.
    logger.error('[deliverableTemplates] Failed to approve template provenance', {
      err,
      id: req.params.id,
    });
    res.status(500).json({ error: 'Failed to approve template provenance' });
  }
});

export default router;
