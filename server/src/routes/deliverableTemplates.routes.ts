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

import { mapAppErrorResponse } from '../middleware/appErrorMapper.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import type { DeliverableTemplateType } from '../services/deliverableTemplateService.js';
import {
  approveTemplateProvenance,
  createDeliverableTemplate,
  deleteDeliverableTemplate,
  getDeliverableTemplate,
  listDeliverableTemplates,
  listPendingTemplateProvenance,
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
import {
  approveTemplateWorkflow,
  assertTemplateBase,
  assertTemplateWorkflowEditable,
  getTemplateWorkflow,
  nextTemplateVersion,
  recordTemplateWorkflowEdit,
  registerTemplateDraftWorkflow,
  runTemplateLiveTest,
  submitTemplateForApproval,
  type TemplateBaseKind,
  type TemplateTestObjectType,
  TemplateWorkflowError,
} from '../services/deliverableTemplateWorkflowService.js';
import { resolveDocumentTemplateLocale } from '../services/documentStudio/documentTemplateLocale.js';
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
      res.status(403).json({ ...mapAppErrorResponse(err, req, 'error'), code: err.code });
      return;
    }
    logger.error('[deliverableTemplates] Failed to load pending provenance', { err });
    res.status(500).json({ error: 'Failed to load pending template provenance' });
  }
});

// ── POST create ─────────────────────────────────────────────
router.post('/templates', async (req, res) => {
  const { type, name, description, meta, language } = req.body as {
    type?: string;
    name?: string;
    description?: string;
    meta?: Record<string, unknown>;
    language?: unknown;
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
    // DEC-461/DEC-510 (F8b, 2026-09-15): templates used to be authored with
    // `language = 'pl'` hardcoded. The author's locale now decides, and the
    // server default is English.
    const authoringLocale = await resolveDocumentTemplateLocale({
      explicit: language ?? (req.query?.lang as string | undefined),
      userId: getUserId(req),
      organizationId: getOrgId(req),
    });
    const template = await createDeliverableTemplate(
      type as DeliverableTemplateType,
      name.trim(),
      description,
      meta,
      getOrgId(req),
      getUserId(req),
      authoringLocale
    );
    res.status(201).json({ template });
  } catch (err) {
    logger.error('[deliverableTemplates] Failed to create template', { err });
    res.status(500).json({ error: 'Failed to create template' });
  }
});

const ARCHETYPE_META: Record<DeliverableTemplateType, Record<string, unknown>> = {
  doc: {
    sections_json: [
      {
        title: 'Executive summary',
        block: 'paragraph',
        depth: 'medium',
        hint: 'Key conclusion',
        ai_filled: true,
      },
      {
        title: 'Evidence',
        block: 'table',
        depth: 'medium',
        hint: 'Source-backed evidence',
        ai_filled: true,
      },
      {
        title: 'Recommendations',
        block: 'bullets',
        depth: 'medium',
        hint: 'Prioritized actions',
        ai_filled: true,
      },
    ],
  },
  deck: {
    outline_json: [
      { title: 'Cover', archetype: 'cover', hint: 'Title and context', ai_filled: true },
      { title: 'Executive summary', archetype: 'content', hint: 'Key message', ai_filled: true },
      { title: 'Evidence', archetype: 'chart', hint: 'Source-backed evidence', ai_filled: true },
      { title: 'Decision', archetype: 'closing', hint: 'Decision and next step', ai_filled: true },
    ],
  },
  table: {
    schema_snapshot: {
      sheets: [
        {
          name: 'Data',
          columns: [
            { key: 'A', header: 'Item', type: 'text' },
            { key: 'B', header: 'Value', type: 'number' },
          ],
          rows: [{ cells: { A: { value: 'Example' }, B: { value: 0 } } }],
        },
      ],
    },
  },
};

// TPL-1b canonical authoring entry. Kept separate from the legacy POST so old
// integrations remain compatible while this route enforces a non-empty base.
router.post('/templates/drafts', async (req, res) => {
  const type = String(req.body?.type || '') as DeliverableTemplateType;
  const name = String(req.body?.name || '').trim();
  const baseKind = String(req.body?.baseKind || '') as TemplateBaseKind;
  const baseTemplateId = String(req.body?.baseTemplateId || '').trim() || undefined;
  if (!VALID_TYPES.has(type) || !name || !['archetype', 'system', 'own'].includes(baseKind)) {
    res.status(400).json({ error: 'BASE_REQUIRED', code: 'BASE_REQUIRED' });
    return;
  }
  try {
    const base = await assertTemplateBase({
      organizationId: getOrgId(req),
      baseKind,
      baseTemplateId,
      type,
    });
    const language = await resolveDocumentTemplateLocale({
      explicit: req.body?.language ?? 'en',
      userId: getUserId(req),
      organizationId: getOrgId(req),
    });
    const submittedMeta =
      req.body?.meta && typeof req.body.meta === 'object' && !Array.isArray(req.body.meta)
        ? req.body.meta
        : {};
    const inheritedMeta = base ? { ...base.meta } : { ...ARCHETYPE_META[type] };
    const sourceBindings =
      req.body?.sourceBindings && typeof req.body.sourceBindings === 'object'
        ? req.body.sourceBindings
        : {};
    const template = await createDeliverableTemplate(
      type,
      name,
      typeof req.body?.description === 'string'
        ? req.body.description
        : (base?.description ?? undefined),
      {
        ...inheritedMeta,
        ...submittedMeta,
        __workflowDraft: true,
        scope: 'org',
        language,
        source_bindings: sourceBindings,
      },
      getOrgId(req),
      getUserId(req),
      language
    );
    const workflow = await registerTemplateDraftWorkflow({
      organizationId: getOrgId(req),
      authorUserId: getUserId(req),
      template,
      baseKind,
      baseTemplateId,
      language,
      documentType: String(req.body?.documentType || 'custom'),
      audience: typeof req.body?.audience === 'string' ? req.body.audience : undefined,
      confidentiality: String(req.body?.confidentiality || 'internal'),
      sourceBindings,
    });
    res.status(201).json({ template, workflow });
  } catch (err) {
    if (err instanceof TemplateWorkflowError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    logger.error('[deliverableTemplates] Failed to create governed draft', { err });
    res.status(500).json({ error: 'TEMPLATE_DRAFT_CREATE_FAILED' });
  }
});

router.get('/templates/:id/workflow', async (req, res) => {
  try {
    const workflow = await getTemplateWorkflow(req.params.id, getOrgId(req));
    if (!workflow) return res.status(404).json({ error: 'WORKFLOW_NOT_FOUND' });
    res.json({ workflow });
  } catch (err) {
    logger.error('[deliverableTemplates] Failed to load template workflow', { err });
    res.status(500).json({ error: 'WORKFLOW_LOAD_FAILED' });
  }
});

router.post('/templates/:id/test-runs', async (req, res) => {
  try {
    const result = await runTemplateLiveTest({
      organizationId: getOrgId(req),
      actorUserId: getUserId(req),
      templateId: req.params.id,
      objectType: String(req.body?.objectType || '') as TemplateTestObjectType,
      objectId: String(req.body?.objectId || ''),
    });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof TemplateWorkflowError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    logger.error('[deliverableTemplates] Template live test failed', { err, id: req.params.id });
    res.status(500).json({ error: 'TEMPLATE_TEST_FAILED' });
  }
});

router.post('/templates/:id/submit', async (req, res) => {
  try {
    const workflow = await submitTemplateForApproval({
      organizationId: getOrgId(req),
      actorUserId: getUserId(req),
      templateId: req.params.id,
    });
    res.json({ workflow });
  } catch (err) {
    if (err instanceof TemplateWorkflowError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    logger.error('[deliverableTemplates] Template submit failed', { err, id: req.params.id });
    res.status(500).json({ error: 'TEMPLATE_SUBMIT_FAILED' });
  }
});

router.post('/templates/:id/workflow/approve', async (req, res) => {
  try {
    const workflow = await approveTemplateWorkflow({
      organizationId: getOrgId(req),
      actorUserId: getUserId(req),
      templateId: req.params.id,
      setAsDefault: req.body?.setAsDefault === true,
    });
    res.json({ workflow });
  } catch (err) {
    if (err instanceof TemplateWorkflowError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof TemplateProvenanceForbiddenError) {
      res.status(403).json({ error: err.message, code: err.code });
      return;
    }
    logger.error('[deliverableTemplates] Template workflow approval failed', {
      err,
      id: req.params.id,
    });
    res.status(500).json({ error: 'TEMPLATE_APPROVAL_FAILED' });
  }
});

// Editing an approved template creates a new draft identity and minor version.
// The approved row remains immutable so already generated artifacts retain an
// exact template/version reference.
router.post('/templates/:id/revisions', async (req, res) => {
  try {
    const previous = await getTemplateWorkflow(req.params.id, getOrgId(req));
    if (!previous || previous.status !== 'approved') {
      throw new TemplateWorkflowError(
        'APPROVED_TEMPLATE_REQUIRES_REVISION',
        'Only an approved template can start a revision',
        409
      );
    }
    const base = await getDeliverableTemplate(req.params.id, getOrgId(req));
    if (!base || base.isSystem || base.organizationId !== getOrgId(req)) {
      throw new TemplateWorkflowError('BASE_FORBIDDEN', 'Template is unavailable', 404);
    }
    const template = await createDeliverableTemplate(
      base.type,
      typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : base.name,
      base.description ?? undefined,
      { ...base.meta, __workflowDraft: true, scope: 'org' },
      getOrgId(req),
      getUserId(req),
      previous.language
    );
    const workflow = await registerTemplateDraftWorkflow({
      organizationId: getOrgId(req),
      authorUserId: getUserId(req),
      template,
      baseKind: 'own',
      baseTemplateId: base.id,
      parentWorkflowId: previous.id,
      version: nextTemplateVersion(previous.version),
      language: previous.language,
      documentType: previous.documentType,
      audience: previous.audience ?? undefined,
      confidentiality: previous.confidentiality,
      sourceBindings: previous.sourceBindings,
    });
    res.status(201).json({ template, workflow });
  } catch (err) {
    if (err instanceof TemplateWorkflowError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    logger.error('[deliverableTemplates] Failed to create template revision', {
      err,
      id: req.params.id,
    });
    res.status(500).json({ error: 'TEMPLATE_REVISION_CREATE_FAILED' });
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
    await assertTemplateWorkflowEditable(req.params.id, getOrgId(req), getUserId(req));
    const template = await updateDeliverableTemplate(
      req.params.id,
      { name: name?.trim(), description, meta },
      getOrgId(req),
      getUserId(req)
    );
    const sourceBindings =
      meta?.source_bindings &&
      typeof meta.source_bindings === 'object' &&
      !Array.isArray(meta.source_bindings)
        ? (meta.source_bindings as Record<string, unknown>)
        : undefined;
    await recordTemplateWorkflowEdit({
      templateId: req.params.id,
      organizationId: getOrgId(req),
      sourceBindings,
    });
    res.json({ template });
  } catch (err) {
    if (err instanceof TemplateWorkflowError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof TemplateForbiddenError) {
      res.status(403).json({ ...mapAppErrorResponse(err, req, 'error') });
      return;
    }
    if (err instanceof TemplateNotFoundError) {
      res.status(404).json({ ...mapAppErrorResponse(err, req, 'error') });
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
      return res.status(409).json({ ...mapAppErrorResponse(err as Error, req, 'error'), code });
    if (code === 'TEMPLATE_NOT_FOUND')
      return res.status(404).json({ ...mapAppErrorResponse(err as Error, req, 'error'), code });
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
      res.status(403).json({ ...mapAppErrorResponse(err, req, 'error') });
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
      res.status(400).json({ ...mapAppErrorResponse(err, req, 'error'), code: err.code });
      return;
    }
    if (err instanceof TemplateProvenanceInvalidError) {
      res.status(400).json({ ...mapAppErrorResponse(err, req, 'error'), code: err.code });
      return;
    }
    if (err instanceof TemplateProvenanceForbiddenError) {
      res.status(403).json({ ...mapAppErrorResponse(err, req, 'error'), code: err.code });
      return;
    }
    if (err instanceof TemplateProvenanceConflictError) {
      res.status(409).json({ ...mapAppErrorResponse(err, req, 'error'), code: err.code });
      return;
    }
    if (err instanceof TemplateNotFoundError) {
      res.status(404).json({ ...mapAppErrorResponse(err, req, 'error') });
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
