import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  hasEffectiveCapability,
  resolveEffectiveAccess,
  seedFactoryRoleTemplates,
} from '../services/effectiveAccessService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';

const router = Router();

router.use(verifyToken);

const FORBIDDEN_TEMPLATE_CAPABILITIES = new Set(['superadmin.access']);
const CUSTOM_ROLE_KEY_PREFIX = 'CUSTOM_';

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeRoleKey = (value: unknown): string => normalizeString(value).toUpperCase();

const toCapabilities = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((entry) => normalizeString(entry)).filter((entry) => entry.length > 0))
  );
};

const hasForbiddenCapability = (capabilities: string[]): boolean =>
  capabilities.some((capability) => FORBIDDEN_TEMPLATE_CAPABILITIES.has(capability));

async function requireRoleTemplateManage(req: AuthRequest, res: any): Promise<boolean> {
  const userId = normalizeString(req.user?.id || req.userId || '');
  const organizationId = normalizeString(req.organizationId || req.user?.organizationId || '');
  if (!userId || !organizationId) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return false;
  }

  const access = await resolveEffectiveAccess({
    userId,
    organizationId,
    applicationRole: req.userRole || req.user?.role,
    isImpersonating: Boolean(req.user?.impersonatorId),
  });
  if (!hasEffectiveCapability(access, 'admin.project_roles.manage')) {
    res.status(403).json({
      error: 'Project role management permission required',
      code: 'PROJECT_ROLES_MANAGE_REQUIRED',
      required: 'admin.project_roles.manage',
    });
    return false;
  }
  return true;
}

router.get(
  '/effective',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = String(req.user?.id || req.userId || '').trim();
    const organizationId = String(req.organizationId || req.user?.organizationId || '').trim();
    const projectId = String(req.query.projectId || '').trim() || null;

    if (!userId || !organizationId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    await seedFactoryRoleTemplates(organizationId);
    const access = await resolveEffectiveAccess({
      userId,
      organizationId,
      applicationRole: req.userRole || req.user?.role,
      projectId,
      isImpersonating: Boolean(req.user?.impersonatorId),
    });

    const requestedCapability = String(req.query.capability || '').trim();
    return res.json({
      effectiveAccess: access,
      decision: requestedCapability
        ? {
            capability: requestedCapability,
            allowed: hasEffectiveCapability(access, requestedCapability),
          }
        : undefined,
    });
  })
);

router.post(
  '/project-role-templates/:id/preview',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!(await requireRoleTemplateManage(req, res))) return;
    const templateId = normalizeString(req.params.id);
    const organizationId = normalizeString(req.organizationId || req.user?.organizationId || '');
    const requestedCapabilities = toCapabilities(req.body?.capabilities);
    const template = await queryHelpers.queryOne<{
      id: string;
      organization_id: string | null;
      capabilities_json?: string;
    }>(
      `SELECT id, organization_id, capabilities_json
       FROM project_role_templates
       WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)
       LIMIT 1`,
      [templateId, organizationId]
    );
    if (!template) {
      res.status(404).json({ error: 'ROLE_TEMPLATE_NOT_FOUND' });
      return;
    }

    let existingCapabilities: string[] = [];
    try {
      const parsed = JSON.parse(String(template.capabilities_json || '[]'));
      existingCapabilities = Array.isArray(parsed)
        ? parsed.map((entry) => normalizeString(entry)).filter(Boolean)
        : [];
    } catch {
      existingCapabilities = [];
    }

    const existingSet = new Set(existingCapabilities);
    const requestedSet = new Set(requestedCapabilities);
    const added = requestedCapabilities.filter((capability) => !existingSet.has(capability));
    const removed = existingCapabilities.filter((capability) => !requestedSet.has(capability));

    res.json({
      allowed: true,
      diff: { added, removed },
    });
  })
);

router.post(
  '/project-role-templates',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!(await requireRoleTemplateManage(req, res))) return;
    const organizationId = normalizeString(req.organizationId || req.user?.organizationId || '');
    const roleKey = normalizeRoleKey(req.body?.roleKey);
    const fallbackRoleKey = normalizeRoleKey(req.body?.fallbackRoleKey);
    const capabilities = toCapabilities(req.body?.capabilities);
    const label = normalizeString(req.body?.label) || roleKey || 'Custom Role';

    if (!roleKey) {
      res.status(400).json({ code: 'ROLE_KEY_REQUIRED' });
      return;
    }
    if (roleKey.startsWith(CUSTOM_ROLE_KEY_PREFIX) && !fallbackRoleKey) {
      res.status(400).json({ code: 'FALLBACK_ROLE_REQUIRED' });
      return;
    }
    if (hasForbiddenCapability(capabilities)) {
      res.status(400).json({ code: 'ROLE_TEMPLATE_GUARDRAIL' });
      return;
    }

    const id = `org_${organizationId}_${roleKey.toLowerCase()}_${uuidv4().slice(0, 8)}`;
    await queryHelpers.queryRun(
      `INSERT INTO project_role_templates (
         id, organization_id, role_key, label, description, is_factory, is_required, is_enabled, capabilities_json
       ) VALUES (?, ?, ?, ?, ?, 0, 0, 1, ?)`,
      [id, organizationId, roleKey, label, null, JSON.stringify(capabilities)]
    );

    res.status(200).json({ id, roleKey, capabilities });
  })
);

router.put(
  '/project-role-templates/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    if (!(await requireRoleTemplateManage(req, res))) return;
    const sourceTemplateId = normalizeString(req.params.id);
    const organizationId = normalizeString(req.organizationId || req.user?.organizationId || '');
    const capabilities = toCapabilities(req.body?.capabilities);
    const labelRaw = req.body?.label;
    const label = typeof labelRaw === 'string' ? labelRaw.trim() : undefined;

    if (hasForbiddenCapability(capabilities)) {
      res.status(400).json({ code: 'ROLE_TEMPLATE_GUARDRAIL' });
      return;
    }

    const existing = await queryHelpers.queryOne<{
      id: string;
      organization_id: string | null;
      role_key: string;
      label?: string | null;
      description?: string | null;
      is_required?: number | null;
      is_enabled?: number | null;
      capabilities_json?: string | null;
    }>(
      `SELECT id, organization_id, role_key, label, description, is_required, is_enabled, capabilities_json
       FROM project_role_templates
       WHERE id = ?
       LIMIT 1`,
      [sourceTemplateId]
    );
    if (!existing) {
      res.status(404).json({ error: 'ROLE_TEMPLATE_NOT_FOUND' });
      return;
    }

    let writableId = existing.id;
    if (!existing.organization_id) {
      const orgTemplateId = `org_${organizationId}_${normalizeRoleKey(existing.role_key).toLowerCase()}_${uuidv4().slice(0, 8)}`;
      await queryHelpers.queryRun(
        `INSERT INTO project_role_templates (
           id, organization_id, role_key, label, description, is_factory, is_required, is_enabled, capabilities_json
         ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [
          orgTemplateId,
          organizationId,
          normalizeRoleKey(existing.role_key),
          existing.label || normalizeRoleKey(existing.role_key),
          existing.description || null,
          Number(existing.is_required || 0) ? 1 : 0,
          Number(existing.is_enabled ?? 1) ? 1 : 0,
          existing.capabilities_json || '[]',
        ]
      );
      writableId = orgTemplateId;
    }

    await queryHelpers.queryRun(
      `UPDATE project_role_templates
       SET label = COALESCE(?, label),
           capabilities_json = COALESCE(?, capabilities_json),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [
        label ?? null,
        capabilities.length > 0 ? JSON.stringify(capabilities) : null,
        writableId,
        organizationId,
      ]
    );

    res.status(200).json({ id: writableId });
  })
);

export default router;
