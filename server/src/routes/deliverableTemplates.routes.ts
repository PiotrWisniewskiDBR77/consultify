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
import {
  listDeliverableTemplates,
  createDeliverableTemplate,
  updateDeliverableTemplate,
  deleteDeliverableTemplate,
  getDeliverableTemplate,
  TemplateForbiddenError,
  TemplateNotFoundError,
} from '../services/deliverableTemplateService.js';
import type { DeliverableTemplateType } from '../services/deliverableTemplateService.js';
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
      getOrgId(req)
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
    const deleted = await deleteDeliverableTemplate(req.params.id, getOrgId(req));
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

export default router;
