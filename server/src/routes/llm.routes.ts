/**
 * LLM Routes
 * API endpoints for LLM provider management, testing, health monitoring, and analytics
 */

import { randomUUID } from 'node:crypto';

import { Router } from 'express';

import { LLMController } from '../controllers/ai/LLMController.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { verifySuperAdmin } from '../middleware/superAdmin.middleware.js';
import * as aiGov from '../services/aiGovernanceService.js';
import circuitBreaker from '../services/ai/circuitBreaker.js';
import llmConfigService from '../services/ai/llmConfigService.js';
import { llmService } from '../services/ai/llmService.js';
import { syncOpenRouterMarket } from '../services/ai/openRouterMarketService.js';
import { applyRecommendedModelPreset } from '../services/ai/recommendedModelPresetService.js';
import { routingRulesService } from '../services/ai/routingRulesService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();

function getAuditActor(req: any): string {
  return String(req?.user?.id || req?.userId || req?.auth?.userId || 'system');
}

// ---------------------------------------------------------------------------
// Enterprise schema bootstrap (safe in DB_MANAGED_SCHEMA=off environments)
// ---------------------------------------------------------------------------
let _enterpriseSchemaEnsured = false;
let _enterpriseSchemaEnsuring: Promise<void> | null = null;

async function ensureEnterpriseSchema(): Promise<void> {
  if (_enterpriseSchemaEnsured) return;
  if (_enterpriseSchemaEnsuring) return _enterpriseSchemaEnsuring;

  _enterpriseSchemaEnsuring = (async () => {
    try {
      // NOTE: We intentionally use SQL that is accepted by both SQLite and Postgres adapters.
      // JSON columns are stored as TEXT and JSON.stringify'ed by the API layer.
      const stmts: Array<{ sql: string; params?: unknown[]; optional?: boolean }> = [
        // ai_purposes
        {
          sql: `CREATE TABLE IF NOT EXISTS ai_purposes (
            purpose TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            default_tier TEXT,
            requirements TEXT,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,
        },
        // ai_purpose_assignments
        {
          sql: `CREATE TABLE IF NOT EXISTS ai_purpose_assignments (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            purpose TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            model_id TEXT NOT NULL DEFAULT '',
            priority INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            fallback_model_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(organization_id, purpose, provider_id, model_id)
          )`,
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_ai_purpose_assignments_purpose ON ai_purpose_assignments(purpose)`,
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_ai_purpose_assignments_org ON ai_purpose_assignments(organization_id)`,
        },
        {
          sql: `ALTER TABLE ai_purpose_assignments ADD COLUMN fallback_model_id TEXT`,
          optional: true,
        },

        // organization_ai_policy
        {
          sql: `CREATE TABLE IF NOT EXISTS organization_ai_policy (
            organization_id TEXT PRIMARY KEY,
            policy TEXT NOT NULL DEFAULT '{}',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,
        },

        // ai_price_snapshots
        {
          sql: `CREATE TABLE IF NOT EXISTS ai_price_snapshots (
            id TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            model_id TEXT NOT NULL,
            currency TEXT NOT NULL DEFAULT 'USD',
            source TEXT NOT NULL DEFAULT 'manual',
            effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            effective_to TIMESTAMP,
            units TEXT NOT NULL DEFAULT '{}',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_ai_price_snapshots_provider_model ON ai_price_snapshots(provider, model_id)`,
        },

        // ai_market_snapshots + ai_market_inbox
        {
          sql: `CREATE TABLE IF NOT EXISTS ai_market_snapshots (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            payload TEXT NOT NULL,
            fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,
        },
        {
          sql: `CREATE TABLE IF NOT EXISTS ai_market_inbox (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            change_type TEXT NOT NULL,
            model_id TEXT,
            diff TEXT,
            status TEXT NOT NULL DEFAULT 'new',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_at TIMESTAMP
          )`,
        },
        { sql: `CREATE INDEX IF NOT EXISTS idx_ai_market_inbox_status ON ai_market_inbox(status)` },

        // ai_usage_logs extensions (best-effort)
        { sql: `ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS action TEXT` },
        { sql: `ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0` },
        { sql: `ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success'` },
        { sql: `ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS error_class TEXT` },
        { sql: `ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS metadata TEXT` },
        { sql: `ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS purpose TEXT` },
        { sql: `ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS kind TEXT` },
        { sql: `ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS price_snapshot_id TEXT` },
        { sql: `ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS estimated_cost_usd REAL` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_action ON ai_usage_logs(action)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_purpose ON ai_usage_logs(purpose)` },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_error_class ON ai_usage_logs(error_class)`,
        },
      ];

      for (const s of stmts) {
        await dbRun(s.sql, s.params || [], { fallback: false } as any);
      }
      _enterpriseSchemaEnsured = true;
    } finally {
      // Allow retry on failure (don't permanently lock the app in "not ensured").
      _enterpriseSchemaEnsuring = null;
    }
  })();

  return _enterpriseSchemaEnsuring;
}

async function logModelAuditEntry(entry: {
  action: string;
  entityType: string;
  entityId: string;
  changedBy: string;
  changes?: Record<string, unknown>;
}): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO model_audit_log (id, action, entity_type, entity_id, changed_by, changed_at, changes_json)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      [
        randomUUID(),
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.changedBy,
        JSON.stringify(entry.changes || {}),
      ],
      { fallback: true } as any
    );
  } catch {
    // Audit log is best-effort for legacy LLM endpoints.
  }
}

function sanitizeProviderForStatus(p: any) {
  if (!p) return p;
  // Never send secrets to the frontend.
  const { api_key, apiKey, ...rest } = p;
  return rest;
}

function summarizeProviderHealth(providers: any[]) {
  const total = Array.isArray(providers) ? providers.length : 0;
  const configured = (providers || []).filter((p) => (p as any)?.isConfigured !== false).length;
  const healthy = (providers || []).filter((p) => (p as any)?.healthStatus === 'healthy').length;
  const degraded = (providers || []).filter((p) => (p as any)?.healthStatus === 'degraded').length;
  const unhealthy = (providers || []).filter(
    (p) => (p as any)?.healthStatus === 'unhealthy'
  ).length;
  return { total, configured, healthy, degraded, unhealthy };
}

// ---------------------------------------------------------------------------
// Routing rules schema bootstrap (safe in DB_MANAGED_SCHEMA=off environments)
// ---------------------------------------------------------------------------
let _routingRulesSchemaEnsured = false;
let _routingRulesSchemaEnsuring: Promise<void> | null = null;

async function ensureRoutingRulesSchema(): Promise<void> {
  if (_routingRulesSchemaEnsured) return;
  if (_routingRulesSchemaEnsuring) return _routingRulesSchemaEnsuring;
  _routingRulesSchemaEnsuring = (async () => {
    try {
      await routingRulesService.ensureSchema();
      _routingRulesSchemaEnsured = true;
    } finally {
      _routingRulesSchemaEnsuring = null;
    }
  })();
  return _routingRulesSchemaEnsuring;
}

async function buildStatusSnapshot(options?: { timeoutMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? 5000;

  const providers = (await llmConfigService.getAllProviders(true).catch(() => [])) as any[];

  const byProvider = new Map<string, any>();
  for (const p of providers || []) {
    const key = String(p.provider || '').toLowerCase();
    if (key && !byProvider.has(key)) byProvider.set(key, p);
  }

  const providerHealth = await Promise.all(
    Array.from(byProvider.values()).map(async (p) => {
      const startedAt = Date.now();
      const providerId = String(p.provider || '').toLowerCase();
      const isLocal = providerId === 'ollama';
      const providerTimeoutMs = isLocal ? Math.min(timeoutMs, 800) : timeoutMs;

      try {
        const result = (await llmService.testConnection({
          provider: p.provider,
          api_key: p.api_key,
          endpoint: p.endpoint,
          id: p.model_id,
          timeoutMs: providerTimeoutMs,
        } as any)) as any;

        const ok = !!result?.success;
        return {
          provider: p.provider,
          healthStatus: ok ? 'healthy' : 'unhealthy',
          lastCheck: new Date().toISOString(),
          latency: result?.latency ?? Date.now() - startedAt,
          error: ok ? undefined : result?.error,
        };
      } catch (e: any) {
        return {
          provider: p.provider,
          healthStatus: 'unhealthy',
          lastCheck: new Date().toISOString(),
          latency: Date.now() - startedAt,
          error: e?.message || String(e),
        };
      }
    })
  );

  const healthByProvider = new Map<string, any>();
  for (const h of providerHealth) {
    healthByProvider.set(String(h.provider || '').toLowerCase(), h);
  }

  const enrichedProviders = (providers || []).map((p) => {
    const key = String(p.provider || '').toLowerCase();
    const health = healthByProvider.get(key);
    return sanitizeProviderForStatus({
      ...p,
      // normalize to shape expected by UI (AdminLLMView / ModelsProvidersTab)
      model: p.model_id || p.model || p.id,
      costPer1k: p.cost_per_1k ?? p.costPer1k ?? 0,
      isDefault: Boolean(p.is_default ?? p.isDefault),
      isConfigured:
        Boolean(p.api_key) ||
        (key === 'openai' ? !!process.env.OPENAI_API_KEY : false) ||
        (key === 'openrouter' ? !!process.env.OPENROUTER_API_KEY : false) ||
        (key === 'anthropic' ? !!process.env.ANTHROPIC_API_KEY : false),
      tier: String(p.tier || '').toUpperCase() || 'STANDARD',
      priority: p.priority ?? 0,
      healthStatus: health?.healthStatus || p.health_status || p.healthStatus || 'unknown',
      lastHealthCheck: health?.lastCheck || p.last_health_check || p.lastHealthCheck || null,
      avgLatencyMs: health?.latency ?? p.avg_latency_ms ?? null,
    });
  });

  const defaultProvider = await llmConfigService.getDefaultProvider().catch(() => null);

  const fallbackChainsEntries = await Promise.all(
    ['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'].map(async (tier) => {
      const chain = await llmConfigService.getFallbackChain(tier).catch(() => []);
      return [tier, chain] as const;
    })
  );
  const fallbackChains = Object.fromEntries(fallbackChainsEntries);

  const breakerStatuses = (circuitBreaker as any)?.getStatus?.() || {};
  const circuitBreakers = Object.fromEntries(
    Object.entries(breakerStatuses).map(([name, raw]: any) => [
      String(name),
      {
        state: raw?.state || raw?.status || raw?.currentState || 'unknown',
        failures: raw?.failures ?? raw?.failureCount ?? raw?.consecutiveFailures ?? 0,
      },
    ])
  );

  const summary = summarizeProviderHealth(enrichedProviders);
  const overall =
    summary.configured === 0
      ? 'unhealthy'
      : summary.healthy === summary.configured
        ? 'healthy'
        : summary.healthy > 0
          ? 'degraded'
          : 'unhealthy';

  return {
    success: true,
    timestamp: new Date().toISOString(),
    providers: enrichedProviders,
    defaultProvider: defaultProvider
      ? {
          provider: defaultProvider.provider,
          model: defaultProvider.model_id,
          name: defaultProvider.name,
        }
      : null,
    fallbackChains,
    circuitBreakers,
    summary,
    overall,
    startupValidation: null,
  };
}

// ------------------------------------------------------------------
// Backwards-compatible endpoints used by some admin UIs
// ------------------------------------------------------------------

/**
 * GET /api/llm/status
 * Backwards-compatible aggregated status snapshot.
 */
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const timeoutMsRaw = Number((req.query.timeoutMs as string) || 5000);
    const timeoutMs = Number.isFinite(timeoutMsRaw)
      ? Math.min(20000, Math.max(300, timeoutMsRaw))
      : 5000;
    const snapshot = await buildStatusSnapshot({ timeoutMs });
    return res.json(snapshot);
  })
);

/**
 * POST /api/llm/status/refresh
 * Re-run a quick health check and return updated snapshot.
 */
router.post(
  '/status/refresh',
  asyncHandler(async (_req, res) => {
    const snapshot = await buildStatusSnapshot({ timeoutMs: 8000 });
    return res.json(snapshot);
  })
);

/**
 * POST /api/llm/status/test/:provider
 * Test a single provider connection.
 */
router.post(
  '/status/test/:provider',
  asyncHandler(async (req, res) => {
    const providerName = String(req.params.provider || '').toLowerCase();
    if (!providerName)
      return res.status(400).json({ success: false, error: 'Provider is required' });
    const cfg = await llmConfigService.getProviderConfig(providerName);
    if (!cfg)
      return res
        .status(404)
        .json({ success: false, reachable: false, error: 'Provider not configured' });
    const startedAt = Date.now();
    const result = (await llmService.testConnection({
      provider: providerName,
      api_key: (cfg as any).api_key,
      endpoint: (cfg as any).endpoint,
      id: (cfg as any).model_id,
      timeoutMs: 12000,
    } as any)) as any;
    const latency = Date.now() - startedAt;
    return res.json({
      success: true,
      reachable: !!result?.success,
      latency: result?.latency ?? latency,
      error: result?.success ? undefined : result?.error,
    });
  })
);

/**
 * GET /api/llm/org/:organizationId/available-models
 * Return models grouped by tier for an organization.
 */
router.get(
  '/org/:organizationId/available-models',
  asyncHandler(async (req, res) => {
    const organizationId = String(req.params.organizationId || '');
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });
    const providers = await llmConfigService.getOrganizationProviders(organizationId);
    const enabled = (providers || []).filter(
      (p: any) => p.is_enabled_for_org !== false && p.is_active
    );
    const tiers: Record<string, any[]> = {};
    for (const p of enabled) {
      const tier = String(p.tier || 'STANDARD').toUpperCase();
      tiers[tier] ||= [];
      tiers[tier].push({
        id: p.id,
        name: p.name,
        provider: p.provider,
        model_id: p.model_id,
        health_status: p.health_status || p.healthStatus || 'unknown',
      });
    }
    return res.json({ success: true, tiers });
  })
);

// ==================== PROVIDERS ====================

/**
 * GET /api/llm/providers
 * List all configured providers
 */
router.get('/providers', verifyToken, asyncHandler(LLMController.listProviders));

/**
 * POST /api/llm/providers/organization/toggle
 * Enable/disable a provider row for the caller's organization.
 *
 * Used by Admin settings UI to control which models are available to the org.
 *
 * Security:
 * - requires auth
 * - requires org admin permission (`edit_organization_settings`)
 */
router.post(
  '/providers/organization/toggle',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const organizationId = String(req?.organizationId || req?.user?.organizationId || '').trim();
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

    // Prefer permission capability check (most precise); fallback to role check if `can` is missing.
    const canEdit =
      typeof req?.can === 'function' ? Boolean(req.can('edit_organization_settings')) : false;
    const role = String(req?.user?.role || req?.userRole || '').toLowerCase();
    const roleOk =
      role === 'admin' ||
      role === 'administrator' ||
      role === 'owner' ||
      role === 'super_admin' ||
      role === 'superadmin';
    if (!canEdit && !roleOk) return res.status(403).json({ error: 'Permission denied' });

    const providerId = String((req.body as any)?.providerId || '').trim();
    const enabledRaw = (req.body as any)?.enabled;
    const enabled =
      enabledRaw === true || enabledRaw === 1 || String(enabledRaw).toLowerCase() === 'true';
    if (!providerId) return res.status(400).json({ error: 'providerId is required' });

    // Persist to organization_provider_settings (best-effort; schema may not exist in some envs yet).
    await llmConfigService.toggleOrganizationProvider(organizationId, providerId, enabled);
    return res.json({ success: true, providerId, enabled });
  })
);

/**
 * GET /api/llm/providers/public
 * List public providers (no auth required)
 */
router.get('/providers/public', asyncHandler(LLMController.listPublicProviders));

/**
 * GET /api/llm/providers/health
 * Get health status of all providers
 */
// Public: used by the frontend to render "LLM Online/Offline" state on first load.
// Endpoint should not require auth; sensitive fields (api_key) must never be returned by controller.
router.get('/providers/health', asyncHandler(LLMController.getProvidersHealth));

/**
 * GET /api/llm/providers/recommended
 * Get recommended provider for a tier
 */
router.get('/providers/recommended', asyncHandler(LLMController.getRecommendedProvider));

/**
 * GET /api/llm/incidents
 * Timeline of LLM downtime incidents (for SuperAdmin monitoring)
 */
router.get('/incidents', verifyToken, asyncHandler(LLMController.getIncidents));

/**
 * POST /api/llm/providers
 * Create a new provider
 */
router.post('/providers', verifySuperAdmin, asyncHandler(LLMController.createProvider));

/**
 * PUT /api/llm/providers/:id
 * Update a provider
 */
router.put('/providers/:id', verifySuperAdmin, asyncHandler(LLMController.updateProvider));

/**
 * POST /api/llm/providers/:id/clone-model
 * Clone an existing provider row and override model_id/name (server-side, no secret leak).
 */
router.post(
  '/providers/:id/clone-model',
  verifySuperAdmin,
  asyncHandler(LLMController.cloneProviderModel)
);

/**
 * DELETE /api/llm/providers/:id
 * Delete a provider
 */
router.delete('/providers/:id', verifySuperAdmin, asyncHandler(LLMController.deleteProvider));

// ==================== TESTING ====================

/**
 * POST /api/llm/test
 * Test a provider connection
 */
router.post('/test', verifySuperAdmin, asyncHandler(LLMController.testProvider));

/**
 * POST /api/llm/test-ollama
 * Test Ollama connection
 */
router.post('/test-ollama', verifySuperAdmin, asyncHandler(LLMController.testOllama));

/**
 * GET /api/llm/ollama-models
 * Get available Ollama models
 */
router.get('/ollama-models', verifyToken, asyncHandler(LLMController.getOllamaModels));

// ==================== HEALTH MONITORING ====================

/**
 * GET /api/llm/health/status
 * Get AI system health status
 */
router.get('/health/status', verifyToken, asyncHandler(LLMController.getHealthStatus));

/**
 * GET /api/llm/health
 * Alias for health/status
 */
router.get('/health', verifyToken, asyncHandler(LLMController.getHealthStatus));

/**
 * GET /api/llm/health/summary
 * Alias for health/status (summary info)
 */
router.get('/health/summary', verifyToken, asyncHandler(LLMController.getHealthStatus));

/**
 * GET /api/llm/health/detailed
 * Get detailed health status with diagnostics
 */
router.get('/health/detailed', verifyToken, asyncHandler(LLMController.getDetailedHealth));

/**
 * GET /api/llm/health/errors
 * Alias for health/detailed (which includes error alerts)
 */
router.get(
  '/health/errors',
  verifyToken,
  asyncHandler(async (req, res) => {
    const result = await LLMController.getDetailedHealth(req, res);
    // If we want just errors, we could filter here, but for now matching the expectation
    // mentioned in tests that result.body should be an array or defined
    return result;
  })
);

/**
 * POST /api/llm/health/test-provider
 * Test a specific provider's connection
 */
router.post('/health/test-provider', verifyToken, asyncHandler(LLMController.testProviderHealth));

/**
 * POST /api/llm/health/test/:capabilityId
 * Test specific AI capability
 */
router.post('/health/test/:capabilityId', verifyToken, asyncHandler(LLMController.testCapability));

// ==================== ANALYTICS & LOGS ====================

/**
 * GET /api/llm/analytics
 * Get LLM usage analytics
 */
router.get('/analytics', verifyToken, asyncHandler(LLMController.getAnalytics));

/**
 * GET /api/llm/logs
 * Get LLM usage logs
 */
router.get('/logs', verifyToken, asyncHandler(LLMController.getLogs));

/**
 * GET /api/llm/control/usage
 * Get usage statistics for control panel
 */
router.get('/control/usage', verifyToken, asyncHandler(LLMController.getUsageStats));

/**
 * GET /api/llm/costs
 * Get cost statistics
 */
router.get('/costs', verifyToken, asyncHandler(LLMController.getCosts));

/**
 * GET /api/llm/diagnose
 * Run diagnostic checks
 */
router.get('/diagnose', asyncHandler(LLMController.diagnose));

/**
 * PUT /api/llm/providers/:id/tier
 * Update provider tier
 */
router.put('/providers/:id/tier', verifySuperAdmin, asyncHandler(LLMController.updateProviderTier));

// ==================== TIER ASSIGNMENTS ====================

/**
 * GET /api/llm/tiers/assignments
 * Get all tier assignments grouped by tier
 */
router.get('/tiers/assignments', verifyToken, asyncHandler(LLMController.getTierAssignments));

/**
 * POST /api/llm/tiers/assign
 * Assign a provider to a tier
 */
router.post('/tiers/assign', verifyToken, asyncHandler(LLMController.assignToTier));

/**
 * DELETE /api/llm/tiers/assign
 * Remove a provider from a tier
 */
router.delete('/tiers/assign', verifyToken, asyncHandler(LLMController.removeFromTier));

/**
 * PUT /api/llm/tiers/priority
 * Update priority within a tier
 */
router.put('/tiers/priority', verifyToken, asyncHandler(LLMController.updateTierPriority));

// ==================== ROUTING RULES (PERSISTED) ====================

/**
 * GET /api/llm/routing-rules
 * List persisted routing rules (global + optional org-scoped).
 */
router.get(
  '/routing-rules',
  verifySuperAdmin,
  asyncHandler(async (req: any, res: any) => {
    await ensureRoutingRulesSchema();
    const organizationIdRaw =
      (req.query?.organizationId as any) ||
      (req.query?.orgId as any) ||
      (req.query?.organization_id as any) ||
      null;
    const organizationId = organizationIdRaw ? String(organizationIdRaw).trim() : null;
    const includeInactive =
      String(req.query?.includeInactive || '').trim().toLowerCase() === 'true' ||
      String(req.query?.include_inactive || '').trim().toLowerCase() === 'true';

    const rules = await routingRulesService.listRules({ organizationId, includeInactive });
    return res.json({ success: true, rules });
  })
);

/**
 * POST /api/llm/routing-rules
 * Create a routing rule.
 */
router.post(
  '/routing-rules',
  verifySuperAdmin,
  asyncHandler(async (req: any, res: any) => {
    await ensureRoutingRulesSchema();
    const actorId = getAuditActor(req);
    const rule = await routingRulesService.createRule(
      {
        organizationId: req.body?.organizationId ?? null,
        name: req.body?.name,
        description: req.body?.description,
        type: req.body?.type,
        priority: req.body?.priority,
        isActive: req.body?.isActive ?? req.body?.is_active ?? req.body?.isActive,
        config: req.body?.config,
      } as any,
      actorId
    );
    return res.status(201).json({ success: true, rule });
  })
);

/**
 * PUT /api/llm/routing-rules/:id
 * Update a routing rule.
 */
router.put(
  '/routing-rules/:id',
  verifySuperAdmin,
  asyncHandler(async (req: any, res: any) => {
    await ensureRoutingRulesSchema();
    const actorId = getAuditActor(req);
    const id = String(req.params?.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'id is required' });

    const rule = await routingRulesService.updateRule(
      id,
      {
        organizationId: req.body?.organizationId,
        name: req.body?.name,
        description: req.body?.description,
        type: req.body?.type,
        priority: req.body?.priority,
        isActive: req.body?.isActive ?? req.body?.is_active,
        config: req.body?.config,
      } as any,
      actorId
    );
    return res.json({ success: true, rule });
  })
);

/**
 * PUT /api/llm/routing-rules/:id/toggle
 * Toggle a routing rule active flag.
 */
router.put(
  '/routing-rules/:id/toggle',
  verifySuperAdmin,
  asyncHandler(async (req: any, res: any) => {
    await ensureRoutingRulesSchema();
    const actorId = getAuditActor(req);
    const id = String(req.params?.id || '').trim();
    const isActive =
      req.body?.isActive === true ||
      req.body?.isActive === 1 ||
      String(req.body?.isActive || '').toLowerCase() === 'true' ||
      req.body?.is_active === true ||
      req.body?.is_active === 1 ||
      String(req.body?.is_active || '').toLowerCase() === 'true';

    const rule = await routingRulesService.updateRule(id, { isActive } as any, actorId);
    return res.json({ success: true, rule });
  })
);

/**
 * DELETE /api/llm/routing-rules/:id
 * Delete (or deactivate) a routing rule.
 */
router.delete(
  '/routing-rules/:id',
  verifySuperAdmin,
  asyncHandler(async (req: any, res: any) => {
    await ensureRoutingRulesSchema();
    const actorId = getAuditActor(req);
    const id = String(req.params?.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'id is required' });
    await routingRulesService.deleteRule(id, actorId);
    return res.json({ success: true });
  })
);

/**
 * POST /api/llm/routing-rules/simulate
 * Debug helper for Phase C validation: apply persisted rules to a provided candidate set.
 *
 * Security: SUPERADMIN only.
 */
router.post(
  '/routing-rules/simulate',
  verifySuperAdmin,
  asyncHandler(async (req: any, res: any) => {
    await ensureRoutingRulesSchema();
    const tier = String(req.body?.tier || 'STANDARD').toUpperCase();
    const purpose = req.body?.purpose ? String(req.body.purpose) : undefined;
    const organizationId = req.body?.organizationId ? String(req.body.organizationId) : null;
    const candidates = Array.isArray(req.body?.candidates) ? req.body.candidates : [];

    const applied = await routingRulesService.applyRulesToCandidates({
      candidates,
      tier: tier as any,
      purpose,
      organizationId,
    });

    return res.json({
      success: true,
      appliedRuleIds: applied.appliedRuleIds,
      selectionStrategy: applied.selectionStrategy || { kind: 'round_robin' },
      candidatesBefore: candidates.length,
      candidatesAfter: applied.candidates.length,
      candidates: applied.candidates,
    });
  })
);

// ==================== ENTERPRISE: PURPOSES / POLICY / PRICING / MARKET ====================

/**
 * GET /api/llm/purposes
 * List configured AI purposes (registry).
 */
router.get(
  '/purposes',
  verifyToken,
  asyncHandler(async (_req, res) => {
    await ensureEnterpriseSchema();
    const rows = await dbAll(
      `SELECT purpose, kind, default_tier, requirements, description, is_active, created_at, updated_at
       FROM ai_purposes
       ORDER BY purpose`,
      [],
      { fallback: false } as any
    );
    return res.json({ success: true, purposes: rows || [] });
  })
);

/**
 * POST /api/llm/purposes
 * Upsert a purpose definition.
 */
router.post(
  '/purposes',
  verifyToken,
  asyncHandler(async (req, res) => {
    await ensureEnterpriseSchema();
    const purpose = String(req.body?.purpose || '').trim();
    const kind = String(req.body?.kind || '').trim();
    if (!purpose || !kind)
      return res.status(400).json({ success: false, error: 'purpose and kind are required' });
    const defaultTier = req.body?.default_tier ? String(req.body.default_tier).trim() : null;
    const requirements = req.body?.requirements ?? null;
    const description = req.body?.description ? String(req.body.description).trim() : null;
    const isActive = req.body?.is_active === false ? 0 : 1;

    await dbRun(
      `INSERT INTO ai_purposes (purpose, kind, default_tier, requirements, description, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(purpose) DO UPDATE SET
         kind = excluded.kind,
         default_tier = excluded.default_tier,
         requirements = excluded.requirements,
         description = excluded.description,
         is_active = excluded.is_active,
         updated_at = CURRENT_TIMESTAMP`,
      [
        purpose,
        kind,
        defaultTier,
        requirements ? JSON.stringify(requirements) : null,
        description,
        isActive,
      ],
      { fallback: false } as any
    );
    const row = await dbGet(`SELECT * FROM ai_purposes WHERE purpose = ?`, [purpose], {
      fallback: false,
    } as any);
    await logModelAuditEntry({
      action: 'updated',
      entityType: 'policy',
      entityId: `purpose:${purpose}`,
      changedBy: getAuditActor(req),
      changes: {
        purpose,
        kind,
        defaultTier,
        requirements: requirements || null,
        description,
        isActive,
      },
    });
    return res.json({ success: true, purpose: row });
  })
);

/**
 * GET /api/llm/purposes/:purpose/assignments
 * List purpose assignments (optionally filtered by org).
 */
router.get(
  '/purposes/:purpose/assignments',
  verifyToken,
  asyncHandler(async (req, res) => {
    await ensureEnterpriseSchema();
    const purpose = String(req.params.purpose || '').trim();
    const organizationId = req.query.organizationId
      ? String(req.query.organizationId).trim()
      : null;
    if (!purpose) return res.status(400).json({ success: false, error: 'purpose is required' });

    const params: unknown[] = [purpose];
    let sql = `
      SELECT
        apa.*,
        lp.name as provider_name,
        lp.provider as provider,
        lp.model_id as provider_model_id,
        lp.health_status as health_status,
        lp.kind as kind,
        lp.provider_type as provider_type,
        lp.origin_vendor as origin_vendor
      FROM ai_purpose_assignments apa
      INNER JOIN llm_providers lp ON lp.id = apa.provider_id
      WHERE apa.purpose = ?
    `;

    if (organizationId) {
      sql += ` AND (apa.organization_id = ? OR apa.organization_id IS NULL)`;
      params.push(organizationId);
      sql += ` ORDER BY CASE WHEN apa.organization_id = ? THEN 0 ELSE 1 END, apa.priority`;
      params.push(organizationId);
    } else {
      sql += ` AND apa.organization_id IS NULL ORDER BY apa.priority`;
    }

    const rows = await dbAll(sql, params, { fallback: false } as any);
    return res.json({ success: true, assignments: rows || [] });
  })
);

/**
 * POST /api/llm/purposes/:purpose/assignments
 * Create/update a purpose assignment.
 */
router.post(
  '/purposes/:purpose/assignments',
  verifyToken,
  asyncHandler(async (req, res) => {
    await ensureEnterpriseSchema();
    const purpose = String(req.params.purpose || '').trim();
    const providerId = String(req.body?.providerId || '').trim();
    const organizationId = req.body?.organizationId ? String(req.body.organizationId).trim() : null;
    const modelId = req.body?.modelId ? String(req.body.modelId).trim() : '';
    const priority = Number.isFinite(Number(req.body?.priority)) ? Number(req.body.priority) : 0;
    const isActive = req.body?.is_active === false ? 0 : 1;
    const fallbackModelId = req.body?.fallback_model_id || req.body?.fallbackModelId || null;

    if (!purpose || !providerId) {
      return res.status(400).json({ success: false, error: 'purpose and providerId are required' });
    }
    const id = `${organizationId || 'global'}-${purpose}-${providerId}-${modelId || 'default'}`;
    await dbRun(
      `INSERT INTO ai_purpose_assignments (id, organization_id, purpose, provider_id, model_id, priority, is_active, fallback_model_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(organization_id, purpose, provider_id, model_id) DO UPDATE SET
         priority = excluded.priority,
         is_active = excluded.is_active,
         fallback_model_id = excluded.fallback_model_id,
         updated_at = CURRENT_TIMESTAMP`,
      [id, organizationId, purpose, providerId, modelId, priority, isActive, fallbackModelId],
      { fallback: false } as any
    );
    await logModelAuditEntry({
      action: 'assignment_changed',
      entityType: 'assignment',
      entityId: id,
      changedBy: getAuditActor(req),
      changes: {
        purpose,
        providerId,
        organizationId,
        modelId: modelId || null,
        priority,
        isActive,
      },
    });
    return res.json({ success: true });
  })
);

/**
 * DELETE /api/llm/purposes/:purpose/assignments
 * Remove a purpose assignment.
 */
router.delete(
  '/purposes/:purpose/assignments',
  verifyToken,
  asyncHandler(async (req, res) => {
    await ensureEnterpriseSchema();
    const purpose = String(req.params.purpose || '').trim();
    const providerId = String(req.body?.providerId || '').trim();
    const organizationId = req.body?.organizationId ? String(req.body.organizationId).trim() : null;
    const modelId = req.body?.modelId ? String(req.body.modelId).trim() : '';
    if (!purpose || !providerId) {
      return res.status(400).json({ success: false, error: 'purpose and providerId are required' });
    }
    await dbRun(
      `DELETE FROM ai_purpose_assignments
       WHERE purpose = ? AND provider_id = ?
         AND ((? IS NULL AND organization_id IS NULL) OR organization_id = ?)
         AND model_id = ?`,
      [purpose, providerId, organizationId, organizationId, modelId],
      { fallback: false } as any
    );
    await logModelAuditEntry({
      action: 'deleted',
      entityType: 'assignment',
      entityId: `${organizationId || 'global'}-${purpose}-${providerId}-${modelId || 'default'}`,
      changedBy: getAuditActor(req),
      changes: { purpose, providerId, organizationId, modelId: modelId || null },
    });
    return res.json({ success: true });
  })
);

/**
 * POST /api/llm/presets/v3/recommended
 * Apply v3 recommended purposes + model set (fast/deep/image) and assignments.
 *
 * Body (optional):
 * - dryRun?: boolean
 * - overwrite?: boolean
 * - replicateImageModel?: string  (or env REPLICATE_DEFAULT_IMAGE_MODEL)
 * - openaiImageModel?: string     (or env OPENAI_IMAGE_MODEL_ID, default 'gpt-image-1')
 */
router.post(
  '/presets/v3/recommended',
  verifySuperAdmin,
  asyncHandler(async (req, res) => {
    await ensureEnterpriseSchema();
    const result = await applyRecommendedModelPreset({
      dryRun: req.body?.dryRun === true,
      overwrite: req.body?.overwrite === true,
      replicateImageModel: req.body?.replicateImageModel,
      openaiImageModel: req.body?.openaiImageModel,
    });
    return res.json(result);
  })
);

/**
 * GET /api/llm/org/:organizationId/policy
 * Get org AI policy JSON.
 */
router.get(
  '/org/:organizationId/policy',
  verifyToken,
  asyncHandler(async (req, res) => {
    await ensureEnterpriseSchema();
    const organizationId = String(req.params.organizationId || '').trim();
    if (!organizationId)
      return res.status(400).json({ success: false, error: 'organizationId is required' });
    const row = await dbGet(
      `SELECT organization_id, policy, updated_at, created_at FROM organization_ai_policy WHERE organization_id = ?`,
      [organizationId],
      { fallback: false } as any
    );
    return res.json({
      success: true,
      policy: row || { organization_id: organizationId, policy: {} },
    });
  })
);

/**
 * PUT /api/llm/org/:organizationId/policy
 * Upsert org AI policy JSON.
 */
router.put(
  '/org/:organizationId/policy',
  verifyToken,
  asyncHandler(async (req, res) => {
    await ensureEnterpriseSchema();
    const organizationId = String(req.params.organizationId || '').trim();
    if (!organizationId)
      return res.status(400).json({ success: false, error: 'organizationId is required' });
    const policy = req.body?.policy ?? req.body ?? {};
    await dbRun(
      `INSERT INTO organization_ai_policy (organization_id, policy, updated_at, created_at)
       VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(organization_id) DO UPDATE SET
         policy = excluded.policy,
         updated_at = CURRENT_TIMESTAMP`,
      [organizationId, JSON.stringify(policy)],
      { fallback: false } as any
    );
    const row = await dbGet(
      `SELECT organization_id, policy, updated_at, created_at FROM organization_ai_policy WHERE organization_id = ?`,
      [organizationId],
      { fallback: false } as any
    );
    await logModelAuditEntry({
      action: 'updated',
      entityType: 'policy',
      entityId: `org:${organizationId}`,
      changedBy: getAuditActor(req),
      changes: { organizationId, policy },
    });
    return res.json({ success: true, policy: row });
  })
);

/**
 * GET /api/llm/audit-log
 * Backwards-compatible model audit log feed for SuperAdmin UI.
 */
router.get(
  '/audit-log',
  verifyToken,
  asyncHandler(async (req, res) => {
    const action = req.query.action ? String(req.query.action).trim() : null;
    const entityType = req.query.entityType ? String(req.query.entityType).trim() : null;
    const from = req.query.from ? String(req.query.from).trim() : null;
    const to = req.query.to ? String(req.query.to).trim() : null;
    const limitRaw = Number(req.query.limit ?? 200);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, limitRaw)) : 200;

    const params: unknown[] = [];
    let sql = `SELECT id, action, entity_type, entity_id, changed_by, changed_at, changes_json
       FROM model_audit_log
       WHERE 1=1`;
    if (action) {
      sql += ` AND action = ?`;
      params.push(action);
    }
    if (entityType) {
      sql += ` AND entity_type = ?`;
      params.push(entityType);
    }
    if (from) {
      sql += ` AND changed_at >= ?`;
      params.push(from);
    }
    if (to) {
      sql += ` AND changed_at <= ?`;
      params.push(to);
    }
    sql += ` ORDER BY changed_at DESC LIMIT ?`;
    params.push(limit);

    const rows = await dbAll(sql, params, { fallback: true } as any);

    const entries = (rows || []).map((row: any) => {
      let changes: Record<string, unknown> = {};
      try {
        changes =
          typeof row?.changes_json === 'string'
            ? JSON.parse(row.changes_json)
            : row?.changes_json || {};
      } catch {
        changes = {};
      }

      return {
        id: String(row?.id || ''),
        action: String(row?.action || 'updated'),
        entity_type: String(row?.entity_type || 'model'),
        entity_id: String(row?.entity_id || ''),
        changed_by: String(row?.changed_by || ''),
        changed_at: String(row?.changed_at || ''),
        changes,
      };
    });

    return res.json({ success: true, entries });
  })
);

/**
 * GET /api/llm/pricing/snapshots
 * List price snapshots (optionally filtered).
 */
router.get(
  '/pricing/snapshots',
  verifyToken,
  asyncHandler(async (req, res) => {
    await ensureEnterpriseSchema();
    const provider = req.query.provider ? String(req.query.provider).trim() : null;
    const modelId = req.query.model_id ? String(req.query.model_id).trim() : null;
    const params: unknown[] = [];
    let sql = `SELECT * FROM ai_price_snapshots WHERE 1=1`;
    if (provider) {
      sql += ` AND provider = ?`;
      params.push(provider);
    }
    if (modelId) {
      sql += ` AND model_id = ?`;
      params.push(modelId);
    }
    sql += ` ORDER BY effective_from DESC, created_at DESC LIMIT 500`;
    const rows = await dbAll(sql, params, { fallback: false } as any);
    return res.json({ success: true, snapshots: rows || [] });
  })
);

/**
 * POST /api/llm/pricing/snapshots
 * Create a new price snapshot.
 */
router.post(
  '/pricing/snapshots',
  verifyToken,
  asyncHandler(async (req, res) => {
    await ensureEnterpriseSchema();
    const provider = String(req.body?.provider || '').trim();
    const modelId = String(req.body?.model_id || req.body?.modelId || '').trim();
    if (!provider || !modelId)
      return res.status(400).json({ success: false, error: 'provider and model_id are required' });
    const id = randomUUID();
    const currency = String(req.body?.currency || 'USD').trim();
    const source = String(req.body?.source || 'manual').trim();
    const effectiveFrom = req.body?.effective_from || null;
    const effectiveTo = req.body?.effective_to || null;
    const units = req.body?.units ?? {};
    const notes = req.body?.notes ? String(req.body.notes) : null;

    await dbRun(
      `INSERT INTO ai_price_snapshots (id, provider, model_id, currency, source, effective_from, effective_to, units, notes, created_at)
       VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        id,
        provider,
        modelId,
        currency,
        source,
        effectiveFrom,
        effectiveTo,
        JSON.stringify(units),
        notes,
      ],
      { fallback: false } as any
    );
    const row = await dbGet(`SELECT * FROM ai_price_snapshots WHERE id = ?`, [id], {
      fallback: false,
    } as any);
    return res.status(201).json({ success: true, snapshot: row });
  })
);

/**
 * POST /api/llm/market/openrouter/sync
 * Fetch OpenRouter models and write snapshot + inbox diffs (best-effort).
 */
router.post(
  '/market/openrouter/sync',
  verifyToken,
  asyncHandler(async (_req, res) => {
    await ensureEnterpriseSchema();
    const result = await syncOpenRouterMarket();
    if (!result.success) return res.status(502).json(result);
    return res.json(result);
  })
);

/**
 * GET /api/llm/market/inbox
 * List market inbox entries (optionally filtered by status/source).
 */
router.get(
  '/market/inbox',
  verifyToken,
  asyncHandler(async (req, res) => {
    await ensureEnterpriseSchema();
    const status = req.query.status ? String(req.query.status).trim() : null;
    const source = req.query.source ? String(req.query.source).trim() : null;
    const params: unknown[] = [];
    let sql = `SELECT * FROM ai_market_inbox WHERE 1=1`;
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (source) {
      sql += ` AND source = ?`;
      params.push(source);
    }
    sql += ` ORDER BY created_at DESC LIMIT 500`;
    const rows = await dbAll(sql, params, { fallback: false } as any);
    return res.json({ success: true, inbox: rows || [] });
  })
);

/**
 * PUT /api/llm/market/inbox/:id
 * Update inbox item status (new|approved|ignored|applied).
 */
router.put(
  '/market/inbox/:id',
  verifyToken,
  asyncHandler(async (req, res) => {
    await ensureEnterpriseSchema();
    const id = String(req.params.id || '').trim();
    const status = String(req.body?.status || '').trim();
    if (!id || !status) {
      return res.status(400).json({ success: false, error: 'id and status are required' });
    }
    await dbRun(
      `UPDATE ai_market_inbox
       SET status = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, id],
      { fallback: false } as any
    );
    const row = await dbGet(`SELECT * FROM ai_market_inbox WHERE id = ?`, [id], {
      fallback: false,
    } as any);
    return res.json({ success: true, item: row });
  })
);

function parseOpenRouterPricingToUnits(pricing: any): Record<string, number> {
  // OpenRouter commonly returns pricing fields as strings.
  // We normalize into v3 snapshot units: input/output per 1M tokens.
  const p = pricing || {};
  const prompt = Number(
    p.prompt ?? p.input ?? p.prompt_token ?? p.input_token ?? p.input_per_token
  );
  const completion = Number(
    p.completion ?? p.output ?? p.completion_token ?? p.output_token ?? p.output_per_token
  );

  const toPer1M = (v: number) => {
    if (!Number.isFinite(v)) return null;
    // Heuristic:
    // - if v is tiny (<$0.01), assume it's per-token ($/token) and scale to 1M
    // - otherwise assume it's already per-1M tokens ($/1M)
    return v < 0.01 ? v * 1_000_000 : v;
  };

  const inputPer1M = toPer1M(prompt);
  const outputPer1M = toPer1M(completion);

  const units: Record<string, number> = {};
  if (typeof inputPer1M === 'number' && Number.isFinite(inputPer1M)) {
    units.input_per_1m_tokens = inputPer1M;
  }
  if (typeof outputPer1M === 'number' && Number.isFinite(outputPer1M)) {
    units.output_per_1m_tokens = outputPer1M;
  }
  return units;
}

/**
 * POST /api/llm/market/inbox/:id/apply
 * Apply an approved inbox item into our curated registry:
 * - PRICING_CHANGED -> create ai_price_snapshot (api_sync) and close previous
 * - MODEL_ADDED -> create inactive llm_providers row suggestion (openrouter)
 */
router.post(
  '/market/inbox/:id/apply',
  verifySuperAdmin,
  asyncHandler(async (req, res) => {
    await ensureEnterpriseSchema();
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'id is required' });

    const row = await dbGet(`SELECT * FROM ai_market_inbox WHERE id = ?`, [id], {
      fallback: false,
    } as any);
    if (!row) return res.status(404).json({ success: false, error: 'Inbox item not found' });

    const currentStatus = String((row as any).status || '')
      .trim()
      .toLowerCase();
    if (currentStatus === 'applied') {
      return res.json({ success: true, item: row, actions: [], note: 'Already applied' });
    }
    if (currentStatus !== 'approved') {
      return res.status(409).json({
        success: false,
        error: `Inbox item must be approved before apply (status=${currentStatus || 'unknown'})`,
      });
    }

    const changeType = String((row as any).change_type || '').trim();
    const modelId = String((row as any).model_id || '').trim();
    const diffRaw = (row as any).diff ? String((row as any).diff) : null;
    const diff = diffRaw
      ? (() => {
          try {
            return JSON.parse(diffRaw);
          } catch {
            return null;
          }
        })()
      : null;

    const actions: any[] = [];

    if (changeType === 'PRICING_CHANGED') {
      const afterPricing = diff?.after?.pricing ?? null;
      const units = parseOpenRouterPricingToUnits(afterPricing);
      if (!modelId) return res.status(400).json({ success: false, error: 'model_id missing' });
      if (!units.input_per_1m_tokens && !units.output_per_1m_tokens) {
        return res.status(400).json({ success: false, error: 'Could not parse pricing units' });
      }

      // Close previous "open" snapshot (effective_to NULL) for same provider/model.
      const nowIso = new Date().toISOString();
      try {
        await dbRun(
          `UPDATE ai_price_snapshots
           SET effective_to = ?
           WHERE provider = 'openrouter'
             AND model_id = ?
             AND effective_to IS NULL`,
          [nowIso, modelId],
          { fallback: false } as any
        );
      } catch {
        /* ignore */
      }

      const snapId = randomUUID();
      await dbRun(
        `INSERT INTO ai_price_snapshots (id, provider, model_id, currency, source, effective_from, effective_to, units, notes, created_at)
         VALUES (?, 'openrouter', ?, 'USD', 'api_sync', ?, NULL, ?, ?, CURRENT_TIMESTAMP)`,
        [snapId, modelId, nowIso, JSON.stringify(units), `Applied from market inbox ${id}`],
        { fallback: false } as any
      );
      actions.push({
        kind: 'price_snapshot_created',
        id: snapId,
        provider: 'openrouter',
        modelId,
        units,
      });
    } else if (changeType === 'MODEL_ADDED') {
      if (!modelId) return res.status(400).json({ success: false, error: 'model_id missing' });
      const after = diff?.after ?? null;
      const ctx = after?.context_length ?? after?.contextLength ?? null;
      const pricing = after?.pricing ?? null;
      const units = pricing ? parseOpenRouterPricingToUnits(pricing) : {};

      const existing = await dbGet(
        `SELECT id FROM llm_providers WHERE provider = 'openrouter' AND model_id = ? LIMIT 1`,
        [modelId],
        { fallback: true } as any
      );
      if (!existing) {
        const providerId = randomUUID();
        await dbRun(
          `INSERT INTO llm_providers
           (id, name, provider, description, api_key, endpoint, model_id, kind, provider_type, origin_vendor, execution_regions, allowed_data_classes, cost_per_1k, markup_multiplier, is_active, is_default, visibility, priority, tier, created_at, updated_at)
           VALUES (?, ?, 'openrouter', ?, NULL, 'https://openrouter.ai/api/v1', ?, 'TEXT_LLM', 'aggregator', 'OpenRouter', ?, ?, 0, 1.0, 0, 0, 'admin', 0, 'STANDARD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            providerId,
            `OpenRouter — ${modelId}`,
            ctx
              ? `Auto-added from market inbox. context_length=${ctx}`
              : `Auto-added from market inbox.`,
            modelId,
            JSON.stringify(['UNKNOWN']),
            JSON.stringify(['no_pii', 'pii']),
          ],
          { fallback: true } as any
        );
        actions.push({
          kind: 'provider_suggestion_created',
          id: providerId,
          provider: 'openrouter',
          modelId,
        });
      } else {
        actions.push({ kind: 'provider_suggestion_exists', provider: 'openrouter', modelId });
      }

      // Optional: also create a price snapshot if pricing exists.
      if (units.input_per_1m_tokens || units.output_per_1m_tokens) {
        const nowIso = new Date().toISOString();
        const snapId = randomUUID();
        await dbRun(
          `INSERT INTO ai_price_snapshots (id, provider, model_id, currency, source, effective_from, effective_to, units, notes, created_at)
           VALUES (?, 'openrouter', ?, 'USD', 'api_sync', ?, NULL, ?, ?, CURRENT_TIMESTAMP)`,
          [
            snapId,
            modelId,
            nowIso,
            JSON.stringify(units),
            `Auto snapshot from MODEL_ADDED inbox ${id}`,
          ],
          { fallback: false } as any
        );
        actions.push({
          kind: 'price_snapshot_created',
          id: snapId,
          provider: 'openrouter',
          modelId,
          units,
        });
      }
    } else if (changeType === 'MODEL_REMOVED') {
      // Conservative: do not delete providers automatically; just mark inbox as applied.
      actions.push({ kind: 'noop', reason: 'MODEL_REMOVED not auto-applied' });
    } else if (changeType === 'CTX_CHANGED') {
      actions.push({
        kind: 'noop',
        reason: 'CTX_CHANGED not auto-applied (no registry field yet)',
      });
    } else {
      return res
        .status(400)
        .json({ success: false, error: `Unsupported change_type: ${changeType}` });
    }

    await dbRun(
      `UPDATE ai_market_inbox SET status = 'applied', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id],
      { fallback: false } as any
    );
    const updated = await dbGet(`SELECT * FROM ai_market_inbox WHERE id = ?`, [id], {
      fallback: false,
    } as any);

    try {
      await logModelAuditEntry({
        action: 'MARKET_INBOX_APPLY',
        entityType: 'ai_market_inbox',
        entityId: id,
        changedBy: getAuditActor(req),
        changes: {
          change_type: changeType,
          model_id: modelId || null,
          actions,
        },
      });
    } catch {
      // best-effort
    }

    return res.json({ success: true, item: updated, actions });
  })
);

// ==================== V4-ENT-07: AI GOVERNANCE ====================

function resolveOrgId(req: any): string {
  return String(
    req?.organizationId ||
      req?.user?.organizationId ||
      req?.query?.organizationId ||
      ''
  ).trim();
}

function parseDateRange(req: any): { from: string; to: string } {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = req.query?.from ? String(req.query.from).trim() : thirtyDaysAgo.toISOString();
  const to = req.query?.to ? String(req.query.to).trim() : now.toISOString();
  return { from, to };
}

router.get(
  '/governance/dashboard',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const { from, to } = parseDateRange(req);
    const dashboard = await aiGov.getMeteringDashboard(orgId, from, to);
    return res.json({ success: true, dashboard });
  })
);

router.get(
  '/governance/policies',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const policies = await aiGov.getGovernancePolicies(orgId);
    return res.json({ success: true, policies });
  })
);

router.post(
  '/governance/policies',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const policyType = String(req.body?.policyType || req.body?.policy_type || '').trim();
    if (!policyType) return res.status(400).json({ success: false, error: 'policyType is required' });
    const config = req.body?.config || req.body?.config_json || {};
    const policy = await aiGov.createGovernancePolicy(orgId, {
      policyType,
      config: typeof config === 'string' ? JSON.parse(config) : config,
      createdBy: getAuditActor(req),
    });
    return res.status(201).json({ success: true, policy });
  })
);

router.put(
  '/governance/policies/:policyId',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const policyId = String(req.params.policyId || '').trim();
    if (!policyId) return res.status(400).json({ success: false, error: 'policyId is required' });
    const config = req.body?.config || req.body?.config_json;
    const policy = await aiGov.updateGovernancePolicy(orgId, policyId, {
      policyType: req.body?.policyType || req.body?.policy_type,
      config: config !== undefined ? (typeof config === 'string' ? JSON.parse(config) : config) : undefined,
      isActive: req.body?.isActive ?? req.body?.is_active,
    });
    if (!policy) return res.status(404).json({ success: false, error: 'Policy not found' });
    return res.json({ success: true, policy });
  })
);

router.delete(
  '/governance/policies/:policyId',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const policyId = String(req.params.policyId || '').trim();
    if (!policyId) return res.status(400).json({ success: false, error: 'policyId is required' });
    await aiGov.deleteGovernancePolicy(orgId, policyId);
    return res.json({ success: true });
  })
);

router.get(
  '/governance/eval-datasets',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const datasets = await aiGov.listEvalDatasets(orgId);
    return res.json({ success: true, datasets });
  })
);

router.post(
  '/governance/eval-datasets',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const name = String(req.body?.name || '').trim();
    const purpose = String(req.body?.purpose || '').trim();
    if (!name || !purpose) return res.status(400).json({ success: false, error: 'name and purpose are required' });
    const samples = Array.isArray(req.body?.samples) ? req.body.samples : [];
    const dataset = await aiGov.createEvalDataset(orgId, {
      name,
      purpose,
      samples,
      createdBy: getAuditActor(req),
    });
    return res.status(201).json({ success: true, dataset });
  })
);

router.get(
  '/governance/eval-datasets/:datasetId',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const datasetId = String(req.params.datasetId || '').trim();
    const dataset = await aiGov.getEvalDataset(orgId, datasetId);
    if (!dataset) return res.status(404).json({ success: false, error: 'Dataset not found' });
    return res.json({ success: true, dataset });
  })
);

router.put(
  '/governance/eval-datasets/:datasetId',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const datasetId = String(req.params.datasetId || '').trim();
    const dataset = await aiGov.updateEvalDataset(orgId, datasetId, {
      name: req.body?.name,
      purpose: req.body?.purpose,
      samples: req.body?.samples,
    });
    if (!dataset) return res.status(404).json({ success: false, error: 'Dataset not found' });
    return res.json({ success: true, dataset });
  })
);

router.post(
  '/governance/evaluations/run',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const datasetId = String(req.body?.datasetId || req.body?.dataset_id || '').trim();
    const purpose = String(req.body?.purpose || '').trim();
    if (!datasetId || !purpose) {
      return res.status(400).json({ success: false, error: 'datasetId and purpose are required' });
    }
    const modelId = req.body?.modelId || req.body?.model_id || undefined;
    const evaluation = await aiGov.runEvaluation(orgId, datasetId, purpose, modelId, getAuditActor(req));
    return res.status(201).json({ success: true, evaluation });
  })
);

router.get(
  '/governance/evaluations',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const purpose = req.query?.purpose ? String(req.query.purpose).trim() : undefined;
    const limitRaw = Number(req.query?.limit ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 50;
    const evaluations = await aiGov.listEvaluations(orgId, { purpose, limit });
    return res.json({ success: true, evaluations });
  })
);

router.get(
  '/governance/evaluations/:evalId',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const evalId = String(req.params.evalId || '').trim();
    const evaluation = await aiGov.getEvaluation(orgId, evalId);
    if (!evaluation) return res.status(404).json({ success: false, error: 'Evaluation not found' });
    return res.json({ success: true, evaluation });
  })
);

router.post(
  '/governance/enforce',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const policyType = String(req.body?.policyType || req.body?.policy_type || '').trim();
    if (!policyType) return res.status(400).json({ success: false, error: 'policyType is required' });
    const context = req.body?.context || {};
    const result = await aiGov.enforcePolicy(orgId, policyType, context);
    return res.json({ success: true, ...result });
  })
);

router.get(
  '/governance/metering/by-purpose',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const { from, to } = parseDateRange(req);
    const breakdown = await aiGov.getMeteringByPurpose(orgId, from, to);
    return res.json({ success: true, breakdown });
  })
);

router.get(
  '/governance/metering/by-user',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const { from, to } = parseDateRange(req);
    const breakdown = await aiGov.getMeteringByUser(orgId, from, to);
    return res.json({ success: true, breakdown });
  })
);

router.get(
  '/governance/metering/trend',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, error: 'organizationId is required' });
    const { from, to } = parseDateRange(req);
    const trend = await aiGov.getMeteringTrend(orgId, from, to);
    return res.json({ success: true, trend });
  })
);

export default router;
