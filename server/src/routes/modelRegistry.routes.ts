/**
 * Model Registry Routes
 * V3-A06: SuperAdmin Model Registry API
 * All routes require SuperAdmin auth. All mutations log to audit.
 */

import { Router } from 'express';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { verifySuperAdmin } from '../middleware/superAdmin.middleware.js';
import llmConfigService from '../services/ai/llmConfigService.js';
import { llmService } from '../services/ai/llmService.js';
import modelRegistryService from '../services/ai/modelRegistryService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const superAdminGuard = [verifyToken, verifySuperAdmin];

function getChangedBy(req: AuthRequest): string {
  return req.user?.id ?? req.userId ?? 'system';
}

// ---------------------------------------------------------------------------
// Models CRUD
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/model-registry/models
 * List all models (optional filters: kind, isActive, healthStatus)
 */
router.get(
  '/models',
  superAdminGuard,
  asyncHandler(async (req, res) => {
    const kind = req.query.kind ? String(req.query.kind) : undefined;
    const isActive =
      req.query.isActive !== undefined
        ? req.query.isActive === 'true' || req.query.isActive === '1'
        : undefined;
    const healthStatus = req.query.healthStatus ? String(req.query.healthStatus) : undefined;

    const models = await modelRegistryService.getModels({
      kind: kind as any,
      isActive,
      healthStatus: healthStatus as any,
    });
    return res.json({ success: true, models });
  })
);

/**
 * POST /api/admin/model-registry/models
 * Create model
 */
router.post(
  '/models',
  superAdminGuard,
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const model = await modelRegistryService.createModel({
      name: String(body.name ?? '').trim(),
      provider: String(body.provider ?? '').trim(),
      providerType: (body.providerType ?? body.provider_type ?? 'aggregator') as any,
      originVendor: String(body.originVendor ?? body.origin_vendor ?? '').trim(),
      modelId: String(body.modelId ?? body.model_id ?? '').trim(),
      kind: (body.kind ?? 'TEXT_LLM') as any,
      isActive: body.isActive !== false && body.is_active !== false,
      healthStatus: (body.healthStatus ?? body.health_status ?? 'unknown') as any,
      capabilities: body.capabilities ?? {
        vision: false,
        tools: false,
        streaming: true,
        jsonMode: false,
        contextWindow: 8192,
      },
      executionRegions: body.executionRegions ?? body.execution_regions ?? [],
      allowedDataClasses: body.allowedDataClasses ?? body.allowed_data_classes ?? [],
    });
    await modelRegistryService.logAuditEntry({
      action: 'created',
      entityType: 'model',
      entityId: model.id,
      changedBy: getChangedBy(req as AuthRequest),
      changes: { model },
    });
    return res.status(201).json({ success: true, model });
  })
);

/**
 * GET /api/admin/model-registry/models/:id
 * Get model by id
 */
router.get(
  '/models/:id',
  superAdminGuard,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id ?? '').trim();
    const model = await modelRegistryService.getModel(id);
    if (!model) return res.status(404).json({ success: false, error: 'Model not found' });
    return res.json({ success: true, model });
  })
);

/**
 * PUT /api/admin/model-registry/models/:id
 * Update model
 */
router.put(
  '/models/:id',
  superAdminGuard,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id ?? '').trim();
    const body = req.body ?? {};
    const before = await modelRegistryService.getModel(id);
    if (!before) return res.status(404).json({ success: false, error: 'Model not found' });

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.provider !== undefined) updates.provider = body.provider;
    if (body.providerType !== undefined) updates.providerType = body.providerType;
    if (body.originVendor !== undefined) updates.originVendor = body.originVendor;
    if (body.modelId !== undefined) updates.modelId = body.modelId;
    if (body.kind !== undefined) updates.kind = body.kind;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.healthStatus !== undefined) updates.healthStatus = body.healthStatus;
    if (body.capabilities !== undefined) updates.capabilities = body.capabilities;
    if (body.executionRegions !== undefined) updates.executionRegions = body.executionRegions;
    if (body.allowedDataClasses !== undefined) updates.allowedDataClasses = body.allowedDataClasses;

    const model = await modelRegistryService.updateModel(id, updates);
    await modelRegistryService.logAuditEntry({
      action: 'updated',
      entityType: 'model',
      entityId: id,
      changedBy: getChangedBy(req as AuthRequest),
      changes: { before, after: model },
    });
    return res.json({ success: true, model });
  })
);

/**
 * DELETE /api/admin/model-registry/models/:id
 * Delete model
 */
router.delete(
  '/models/:id',
  superAdminGuard,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id ?? '').trim();
    const before = await modelRegistryService.getModel(id);
    if (!before) return res.status(404).json({ success: false, error: 'Model not found' });
    await modelRegistryService.deleteModel(id);
    await modelRegistryService.logAuditEntry({
      action: 'deleted',
      entityType: 'model',
      entityId: id,
      changedBy: getChangedBy(req as AuthRequest),
      changes: { deleted: before },
    });
    return res.json({ success: true });
  })
);

// ---------------------------------------------------------------------------
// Purpose assignments
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/model-registry/assignments
 * List assignments (optional filter: kind)
 */
router.get(
  '/assignments',
  superAdminGuard,
  asyncHandler(async (req, res) => {
    const kind = req.query.kind ? String(req.query.kind) : undefined;
    const assignments = await modelRegistryService.getAssignments(kind as any);
    return res.json({ success: true, assignments });
  })
);

/**
 * POST /api/admin/model-registry/assignments
 * Create/update assignment
 */
router.post(
  '/assignments',
  superAdminGuard,
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const purpose = String(body.purpose ?? '').trim();
    const kind = (body.kind ?? 'TEXT_LLM') as any;
    const registryModelId = String(body.registryModelId ?? body.registry_model_id ?? '').trim();
    if (!purpose || !registryModelId) {
      return res
        .status(400)
        .json({ success: false, error: 'purpose and registryModelId are required' });
    }
    const assignment = await modelRegistryService.setAssignment({
      purpose,
      kind,
      registryModelId,
      tier: body.tier ? String(body.tier) : undefined,
      priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0,
      isActive: body.isActive !== false && body.is_active !== false,
      fallbackModelId: body.fallbackModelId ?? body.fallback_model_id ?? undefined,
    });
    await modelRegistryService.logAuditEntry({
      action: 'assignment_changed',
      entityType: 'assignment',
      entityId: assignment.id,
      changedBy: getChangedBy(req as AuthRequest),
      changes: { assignment },
    });
    return res.status(201).json({ success: true, assignment });
  })
);

/**
 * DELETE /api/admin/model-registry/assignments/:id
 * Delete assignment
 */
router.delete(
  '/assignments/:id',
  superAdminGuard,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id ?? '').trim();
    await modelRegistryService.removeAssignment(id);
    await modelRegistryService.logAuditEntry({
      action: 'deleted',
      entityType: 'assignment',
      entityId: id,
      changedBy: getChangedBy(req as AuthRequest),
      changes: { assignmentId: id },
    });
    return res.json({ success: true });
  })
);

/**
 * PUT /api/admin/model-registry/assignments/reorder
 * Reorder assignments for a purpose (body: { purpose, orderedIds })
 */
router.put(
  '/assignments/reorder',
  superAdminGuard,
  asyncHandler(async (req, res) => {
    const purpose = String(req.body?.purpose ?? '').trim();
    const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map(String) : [];
    if (!purpose || orderedIds.length === 0) {
      return res.status(400).json({ success: false, error: 'purpose and orderedIds are required' });
    }
    await modelRegistryService.reorderAssignments(purpose, orderedIds);
    return res.json({ success: true });
  })
);

// ---------------------------------------------------------------------------
// Resolve (test endpoint)
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/model-registry/resolve
 * Resolve model for purpose (test endpoint)
 */
router.post(
  '/resolve',
  superAdminGuard,
  asyncHandler(async (req, res) => {
    const organizationId = String(req.body?.organizationId ?? '').trim();
    const purpose = String(req.body?.purpose ?? '').trim();
    if (!organizationId || !purpose) {
      return res
        .status(400)
        .json({ success: false, error: 'organizationId and purpose are required' });
    }
    const result = await modelRegistryService.resolveModel({
      organizationId,
      purpose,
      requirements: req.body?.requirements ?? undefined,
      options: req.body?.options ?? undefined,
    });
    return res.json({ success: true, result });
  })
);

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/model-registry/audit-log
 * Get audit log (optional filters: entityType, from, to, limit)
 */
router.get(
  '/audit-log',
  superAdminGuard,
  asyncHandler(async (req, res) => {
    const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const entries = await modelRegistryService.getAuditLog({
      entityType,
      from: isNaN(from?.getTime() ?? NaN) ? undefined : from,
      to: isNaN(to?.getTime() ?? NaN) ? undefined : to,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return res.json({ success: true, entries });
  })
);

// ---------------------------------------------------------------------------
// Test connection
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/model-registry/models/:id/test-connection
 * Test model connection (uses llm_providers for api_key/endpoint)
 */
router.post(
  '/models/:id/test-connection',
  superAdminGuard,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id ?? '').trim();
    const model = await modelRegistryService.getModel(id);
    if (!model) return res.status(404).json({ success: false, error: 'Model not found' });

    const providerConfig = await llmConfigService.getProviderConfig(model.provider);
    const apiKey =
      (providerConfig as any)?.api_key ??
      (providerConfig as any)?.apiKey ??
      process.env[`${model.provider.toUpperCase()}_API_KEY`] ??
      process.env.OPENROUTER_API_KEY;

    const startedAt = Date.now();
    const result = (await llmService.testConnection({
      provider: model.provider,
      api_key: apiKey,
      apiKey,
      endpoint: (providerConfig as any)?.endpoint,
      id: model.modelId,
      timeoutMs: 8000,
    } as any)) as Record<string, unknown>;

    const latency = Date.now() - startedAt;
    return res.json({
      success: !!result?.success,
      reachable: !!result?.success,
      latency: result?.latency ?? latency,
      error: result?.success ? undefined : result?.error,
    });
  })
);

// ---------------------------------------------------------------------------
// Update health status
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/model-registry/models/:id/health
 * Update health status (body: { status, latencyMs? })
 */
router.post(
  '/models/:id/health',
  superAdminGuard,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id ?? '').trim();
    const status = String(req.body?.status ?? 'unknown').trim() as any;
    const latencyMs = typeof req.body?.latencyMs === 'number' ? req.body.latencyMs : undefined;

    const model = await modelRegistryService.getModel(id);
    if (!model) return res.status(404).json({ success: false, error: 'Model not found' });

    const validStatuses = ['healthy', 'degraded', 'unhealthy', 'unknown'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    await modelRegistryService.updateHealthStatus(id, status, latencyMs);
    const updated = await modelRegistryService.getModel(id);
    return res.json({ success: true, model: updated });
  })
);

export default router;
