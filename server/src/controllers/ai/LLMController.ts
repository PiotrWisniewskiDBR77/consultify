// @ts-nocheck
/**
 * LLM Controller
 * API handlers for LLM provider management and testing
 */

import axios from 'axios';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import circuitBreaker from '../../services/ai/circuitBreaker.js';
import llmConfigService from '../../services/ai/llmConfigService.js';
import { llmService } from '../../services/ai/llmService.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export class LLMController {
  private static lastHealthEventWriteAt = new Map<string, number>();
  private static providerHealthCooldowns = new Map<
    string,
    { until: number; error: string; status: 'auth_failed' | 'rate_limited' }
  >();
  private static providerHealthSnapshot: {
    payload: Record<string, unknown>;
    expiresAt: number;
  } | null = null;
  private static providerHealthRefreshPromise: Promise<Record<string, unknown>> | null = null;
  private static selectCoreProviders<T extends { isDefault?: boolean; provider?: string }>(
    providers: T[]
  ): T[] {
    if (providers.some((provider) => !!provider.isDefault)) {
      return providers.filter((provider) => !!provider.isDefault);
    }

    if (
      providers.some((provider) => String(provider.provider || '').toLowerCase() === 'openrouter')
    ) {
      return providers.filter(
        (provider) => String(provider.provider || '').toLowerCase() === 'openrouter'
      );
    }

    return providers;
  }

  private static isAuthLikeProviderError(error: unknown, httpStatus?: number | null): boolean {
    const msg = String((error as any)?.message || error || '').toLowerCase();
    return (
      httpStatus === 401 ||
      httpStatus === 403 ||
      msg.includes('incorrect api key') ||
      msg.includes('invalid api key') ||
      msg.includes('key invalid') ||
      msg.includes('unauthorized')
    );
  }
  private static resolveEnvConfigured(provider: string): {
    isConfigured: boolean;
    envKey?: string;
  } {
    const p = String(provider || '').toLowerCase();
    if (!p) return { isConfigured: false };

    if (p === 'openrouter') {
      const v = String(process.env.OPENROUTER_API_KEY || '').trim();
      return { isConfigured: !!v, envKey: 'OPENROUTER_API_KEY' };
    }
    if (p === 'openai') {
      const v = String(process.env.OPENAI_API_KEY || '').trim();
      return { isConfigured: !!v, envKey: 'OPENAI_API_KEY' };
    }
    if (p === 'anthropic') {
      const v = String(process.env.ANTHROPIC_API_KEY || '').trim();
      return { isConfigured: !!v, envKey: 'ANTHROPIC_API_KEY' };
    }
    if (p === 'google' || p === 'gemini') {
      const v = String(
        process.env.GEMINI_API_KEY ||
          process.env.GOOGLE_AI_API_KEY ||
          (process.env as any).GOOGLE_API_KEY ||
          ''
      ).trim();
      return { isConfigured: !!v, envKey: 'GEMINI_API_KEY' };
    }
    if (p === 'deepseek') {
      const v = String(process.env.DEEPSEEK_API_KEY || '').trim();
      return { isConfigured: !!v, envKey: 'DEEPSEEK_API_KEY' };
    }
    if (p === 'zai' || p === 'z_ai') {
      const v = String(process.env.ZAI_API_KEY || '').trim();
      return { isConfigured: !!v, envKey: 'ZAI_API_KEY' };
    }
    if (p === 'replicate') {
      const v = String(
        process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY || ''
      ).trim();
      return { isConfigured: !!v, envKey: 'REPLICATE_API_TOKEN' };
    }

    return { isConfigured: false };
  }

  private static sanitizeProvider(row: any): any {
    if (!row || typeof row !== 'object') return row;
    const api_key = (row as any)?.api_key;
    const hasApiKey = !!String(api_key || '').trim();
    const { isConfigured: envConfigured, envKey } = LLMController.resolveEnvConfigured(
      (row as any)?.provider
    );
    const { api_key: _secret, ...rest } = row;
    // Never return secrets from any endpoint.
    return {
      ...rest,
      has_api_key: hasApiKey,
      is_configured: hasApiKey || envConfigured,
      env_key: envKey,
    };
  }
  /**
   * GET /api/llm/providers
   * List all configured providers
   */
  static async listProviders(req: Request, res: Response) {
    try {
      const providers = await dbAll('SELECT * FROM llm_providers', []);

      // Optional org context enrichment (used by Settings UI to show what models are enabled for the org).
      // Caller may send:
      // - x-org-context header (explicit org id), or
      // - rely on auth middleware fields (organizationId on req/user).
      const orgId = String(
        (req as any)?.headers?.['x-org-context'] ||
          (req as any)?.organizationId ||
          (req as any)?.user?.organizationId ||
          (req as any)?.user?.organization_id ||
          ''
      ).trim();

      let settingsMap: Map<string, { enabled: boolean; customPriority: number | null }> | null =
        null;
      if (orgId) {
        try {
          const rows = await dbAll(
            'SELECT provider_id, is_enabled, custom_priority FROM organization_provider_settings WHERE organization_id = ?',
            [orgId]
          );
          settingsMap = new Map(
            (rows || []).map((r: any) => [
              String(r.provider_id),
              {
                enabled: r.is_enabled === true || r.is_enabled === 1,
                customPriority:
                  typeof r.custom_priority === 'number'
                    ? r.custom_priority
                    : (r.custom_priority ?? null),
              },
            ])
          );
        } catch {
          settingsMap = null;
        }
      }

      const safe = (providers || []).map((p: any) => {
        const base = LLMController.sanitizeProvider(p);
        if (!orgId || !settingsMap) return base;
        const key = String((p as any)?.id || '');
        const has = key && settingsMap.has(key);
        const s = has ? settingsMap.get(key)! : null;
        return {
          ...base,
          is_enabled_for_org: has ? s!.enabled : true,
          custom_priority: has ? s!.customPriority : null,
        };
      });
      return res.json(safe);
    } catch (error: any) {
      logger.error('[LLMController] Error listing providers:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/providers/public
   * List public providers (no API key needed or pre-configured)
   */
  static async listPublicProviders(req: Request, res: Response) {
    try {
      const providers = await dbAll(
        'SELECT * FROM llm_providers WHERE visibility = ? OR visibility = ?',
        ['public', 'free']
      );
      // SECURITY: never expose secrets (api_key) on public endpoints
      const safe = (providers || []).map((p: any) => {
        const { api_key, ...rest } = p || {};
        return rest;
      });
      return res.json(safe);
    } catch (error: any) {
      logger.error('[LLMController] Error listing public providers:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/llm/test
   * Test a provider connection
   */
  static async testProvider(req: Request, res: Response) {
    try {
      const { provider, api_key, model_id, endpoint, providerId } = req.body as any;

      // Allow testing an existing provider without sending secrets from the UI:
      // client may send { providerId } and we load api_key/model/endpoint from DB.
      let effectiveProvider = provider;
      let effectiveApiKey = api_key;
      let effectiveModelId = model_id;
      let effectiveEndpoint = endpoint;

      if (providerId && (!effectiveApiKey || !effectiveProvider || !effectiveModelId)) {
        try {
          const row = await dbGet('SELECT * FROM llm_providers WHERE id = ?', [providerId]);
          if (row) {
            effectiveProvider = effectiveProvider || (row as any).provider;
            effectiveApiKey = effectiveApiKey || (row as any).api_key;
            effectiveModelId = effectiveModelId || (row as any).model_id;
            effectiveEndpoint = effectiveEndpoint || (row as any).endpoint;
          }
        } catch {
          // ignore and let validation below handle missing fields
        }
      }

      if (!effectiveProvider) {
        return res.status(400).json({ error: 'Provider is required' });
      }

      // OpenRouter expects namespaced model ids (e.g. "openai/gpt-4o").
      if (String(effectiveProvider || '').toLowerCase() === 'openrouter') {
        const raw = String(effectiveModelId || '').trim();
        if (!raw) {
          effectiveModelId = 'openai/gpt-4o-mini';
        }
        if (raw && !raw.includes('/') && !raw.includes('://')) {
          const lower = raw.toLowerCase();
          if (lower === 'gpt-4o') effectiveModelId = 'openai/gpt-4o';
          else if (lower === 'gpt-4o-mini') effectiveModelId = 'openai/gpt-4o-mini';
          else if (lower === 'o1-preview') effectiveModelId = 'openai/o1-preview';
          else if (lower === 'o1-mini' || lower === 'o1') effectiveModelId = 'openai/o1-mini';
          else if (lower.startsWith('claude')) effectiveModelId = `anthropic/${raw}`;
          else if (lower.startsWith('gemini')) effectiveModelId = `google/${raw}`;
        }
      }

      const result = await llmService.testConnection({
        provider: effectiveProvider,
        api_key: effectiveApiKey,
        apiKey: effectiveApiKey,
        id: effectiveModelId,
        endpoint: effectiveEndpoint,
      });

      const ok = (result as any)?.success === true;
      const latency = (result as any)?.latency;
      const baseMessage = ok
        ? `Connection OK${typeof latency === 'number' ? ` (${latency}ms)` : ''}`
        : String((result as any)?.error || (result as any)?.message || 'Connection failed');

      const payload = {
        ...result,
        message: baseMessage,
      };

      if (ok) {
        try {
          await llmService.resetCircuit(String(effectiveProvider || '').toLowerCase());
        } catch {
          // ignore reset failures
        }
        return res.json(payload);
      }
      return res.status(400).json(payload);
    } catch (error: any) {
      logger.error('[LLMController] Error testing provider:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/llm/test-ollama
   * Test Ollama connection
   */
  static async testOllama(req: Request, res: Response) {
    try {
      const { endpoint } = req.body;
      const target = endpoint || 'http://localhost:11434';

      try {
        const response = await axios.get(`${target}/api/tags`, { timeout: 5000 });
        return res.json({ success: true, models: response.data.models });
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          error: `Ollama connection failed: ${err.message}`,
          endpoint: target,
        });
      }
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/ollama-models
   * Get available Ollama models
   */
  static async getOllamaModels(req: Request, res: Response) {
    try {
      const { endpoint } = req.query;
      const target = (endpoint as string) || 'http://localhost:11434';

      try {
        const response = await axios.get(`${target}/api/tags`, { timeout: 5000 });
        return res.json(response.data.models || []);
      } catch (err: any) {
        return res.status(400).json({
          error: `Failed to fetch Ollama models: ${err.message}`,
          endpoint: target,
        });
      }
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/llm/providers
   * Create a new provider
   */
  static async createProvider(req: Request, res: Response) {
    try {
      const {
        name,
        provider,
        model_id,
        api_key,
        endpoint,
        kind = 'TEXT_LLM',
        provider_type = 'direct',
        origin_vendor = null,
        execution_regions = null,
        allowed_data_classes = null,
        data_residency_attestation = null,
        subprocessors_ref = null,
        tier = 'standard',
        visibility = 'admin',
        is_active = true,
        is_default = false,
        cost_per_1k = 0,
        context_window = 4096,
      } = req.body;

      if (!name || !provider) {
        return res.status(400).json({ error: 'Name and provider are required' });
      }

      const id = uuidv4();
      await dbRun(
        `
                INSERT INTO llm_providers (
                  id, name, provider, model_id, api_key, endpoint,
                  kind, provider_type, origin_vendor, execution_regions, allowed_data_classes, data_residency_attestation, subprocessors_ref,
                  tier, visibility, is_active, is_default, cost_per_1k, context_window, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
        [
          id,
          name,
          provider,
          model_id,
          api_key,
          endpoint,
          kind,
          provider_type,
          origin_vendor,
          typeof execution_regions === 'string'
            ? execution_regions
            : JSON.stringify(execution_regions || []),
          typeof allowed_data_classes === 'string'
            ? allowed_data_classes
            : JSON.stringify(allowed_data_classes || []),
          data_residency_attestation,
          subprocessors_ref,
          tier,
          visibility,
          // Feedback #5e16d214 — pass JS booleans so Postgres accepts them
          // for the boolean `is_active` / `is_default` columns. 1/0 would
          // raise "column is of type boolean but expression is of type
          // integer" and, combined with DbPromise's fallback path, would
          // silently no-op the INSERT.
          !!is_active,
          !!is_default,
          cost_per_1k,
          context_window,
        ]
      );

      const newProvider = await dbGet('SELECT * FROM llm_providers WHERE id = ?', [id]);
      return res.status(201).json(LLMController.sanitizeProvider(newProvider));
    } catch (error: any) {
      logger.error('[LLMController] Error creating provider:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/llm/providers/:id
   * Update a provider
   */
  static async updateProvider(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const existing = await dbGet('SELECT * FROM llm_providers WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      const allowedFields = [
        'name',
        'provider',
        'model_id',
        'api_key',
        'endpoint',
        'kind',
        'provider_type',
        'origin_vendor',
        'execution_regions',
        'allowed_data_classes',
        'data_residency_attestation',
        'subprocessors_ref',
        'tier',
        'visibility',
        'is_active',
        'is_default',
        'cost_per_1k',
        'markup_multiplier',
        'context_window',
        'priority',
      ];
      // Feedback #5e16d214 — on Postgres the boolean columns (`is_active`,
      // `is_default`) reject integer literals with "column is of type boolean
      // but expression is of type integer". Previously we coerced booleans
      // to 1/0 which made the UPDATE fail silently (the DbPromise fallback
      // returns `{ success: false }` instead of throwing, so the controller
      // happily re-fetched and returned the UNCHANGED row — the UI showed
      // "Provider updated" but nothing actually persisted, so toggling a
      // model to Active never stuck).
      // We now pass JS booleans through to `pg`, which serializes them as
      // TRUE/FALSE, and we run the UPDATE with `fallback: false` so a real
      // DB error actually bubbles to the HTTP response.
      const BOOLEAN_FIELDS = new Set(['is_active', 'is_default']);
      const JSON_FIELDS = new Set(['execution_regions', 'allowed_data_classes']);
      const setClauses: string[] = [];
      const values: any[] = [];

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          // Never allow "empty string" to wipe an API key.
          if (field === 'api_key' && typeof updates[field] === 'string' && !updates[field].trim()) {
            continue;
          }
          let value: any = updates[field];
          if (BOOLEAN_FIELDS.has(field)) {
            // Accept both booleans and the "1"/"0"/"true"/"false" stringified
            // variants older clients might send.
            if (typeof value === 'string') {
              const lowered = value.toLowerCase().trim();
              value = lowered === 'true' || lowered === '1' || lowered === 't';
            } else if (typeof value === 'number') {
              value = value !== 0;
            } else {
              value = !!value;
            }
          } else if (JSON_FIELDS.has(field)) {
            value = typeof value === 'string' ? value : JSON.stringify(value ?? []);
          }
          setClauses.push(`${field} = ?`);
          values.push(value);
        }
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      setClauses.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const runResult = await dbRun(
        `UPDATE llm_providers SET ${setClauses.join(', ')} WHERE id = ?`,
        values,
        { fallback: false }
      );
      if (runResult && (runResult as any).success === false) {
        // Defensive: even with fallback:false, extremely old DbPromise
        // implementations may still return a failure envelope instead of
        // throwing.
        const reason = (runResult as any).error || 'unknown db error';
        logger.error('[LLMController] updateProvider UPDATE failed:', reason);
        return res.status(500).json({ error: `Failed to update provider: ${reason}` });
      }

      const updated = await dbGet('SELECT * FROM llm_providers WHERE id = ?', [id]);
      return res.json(LLMController.sanitizeProvider(updated));
    } catch (error: any) {
      logger.error('[LLMController] Error updating provider:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/llm/providers/:id
   * Delete a provider
   */
  static async deleteProvider(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const existing = await dbGet('SELECT * FROM llm_providers WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      await dbRun('DELETE FROM llm_providers WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Provider deleted' });
    } catch (error: any) {
      logger.error('[LLMController] Error deleting provider:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/llm/providers/:id/clone-model
   * Server-side clone of an existing provider row, without exposing api_key to the client.
   * Used to quickly add additional models for the same vendor/key/endpoint.
   */
  static async cloneProviderModel(req: Request, res: Response) {
    try {
      const sourceId = String(req.params.id || '').trim();
      const { name, model_id, tier, visibility, is_active, priority } = req.body as any;
      if (!sourceId) return res.status(400).json({ error: 'Source provider id is required' });

      const source = (await dbGet('SELECT * FROM llm_providers WHERE id = ?', [sourceId])) as any;
      if (!source) return res.status(404).json({ error: 'Source provider not found' });

      const nextModelId = String(model_id || '').trim();
      if (!nextModelId) return res.status(400).json({ error: 'model_id is required' });

      const nextName =
        String(name || '').trim() ||
        `${String(source.name || source.provider || 'Provider')} — ${nextModelId}`;

      const id = uuidv4();
      await dbRun(
        `
        INSERT INTO llm_providers (
          id, name, provider, model_id, api_key, endpoint,
          kind, provider_type, origin_vendor, execution_regions, allowed_data_classes, data_residency_attestation, subprocessors_ref,
          cost_per_1k, markup_multiplier, is_active, is_default, visibility, priority, tier,
          last_health_check, health_status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'unknown', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
        [
          id,
          nextName,
          source.provider,
          nextModelId,
          source.api_key,
          source.endpoint,
          source.kind,
          source.provider_type,
          source.origin_vendor,
          source.execution_regions,
          source.allowed_data_classes,
          source.data_residency_attestation,
          source.subprocessors_ref,
          source.cost_per_1k,
          source.markup_multiplier,
          typeof is_active === 'boolean' ? (is_active ? 1 : 0) : source.is_active,
          0, // never clone default flag
          visibility ?? source.visibility,
          typeof priority === 'number' ? priority : source.priority,
          tier ?? source.tier,
        ]
      );

      const row = await dbGet('SELECT * FROM llm_providers WHERE id = ?', [id]);
      return res.status(201).json(LLMController.sanitizeProvider(row));
    } catch (error: any) {
      logger.error('[LLMController] Error cloning provider model:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/health/status
   * Get AI system health status
   */
  static async getHealthStatus(req: Request, res: Response) {
    try {
      const providers = await dbAll(
        'SELECT id, name, provider, model_id, is_active, visibility, tier FROM llm_providers WHERE is_active = 1',
        []
      );

      // Get usage metrics from last 24 hours
      const metricsRow = (await dbGet(
        `
                SELECT 
                    COUNT(*) as "totalRequests",
                    AVG(latency_ms) as "avgLatencyMs",
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as "successRate"
                FROM ai_usage_logs 
                WHERE created_at > datetime('now', '-24 hours')
            `,
        []
      )) as { totalRequests: number; avgLatencyMs: number; successRate: number } | null;

      return res.json({
        providers: providers.map((p: any) => ({
          name: p.name,
          type: p.provider,
          status: p.is_active ? 'ACTIVE' : 'INACTIVE',
          visibility: p.visibility || 'admin',
          tier: p.tier || 'standard',
        })),
        metrics: {
          uptime50: metricsRow?.successRate || 100,
          avgLatencyMs: Math.round(metricsRow?.avgLatencyMs || 0),
          totalRequests: metricsRow?.totalRequests || 0,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('[LLMController] Error getting health status:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/health/detailed
   * Get detailed health status of all providers with diagnostics
   */
  static async getDetailedHealth(req: Request, res: Response) {
    try {
      const live = String((req.query as any)?.live || '').toLowerCase() === 'true';
      const allProviders = (await dbAll(
        'SELECT id, name, provider, kind, api_key, endpoint, model_id, is_active, health_status, last_health_check FROM llm_providers',
        []
      )) as any[];
      const alerts: any[] = [];
      const nowIso = new Date().toISOString();

      function classifyErrorCategory(raw: string | null): string | null {
        const s = String(raw || '').trim();
        if (!s) return null;
        const m = s.match(/^([A-Z_]+):\s+/);
        if (m?.[1]) return m[1].toLowerCase();
        return 'unknown';
      }

      async function replicateAuthCheck(
        provider: any
      ): Promise<{ ok: boolean; httpStatus: number | null; detail?: string }> {
        const token =
          String(provider.api_key || '').trim() ||
          String(process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY || '').trim();
        if (!token)
          return {
            ok: false,
            httpStatus: null,
            detail: 'MISSING_KEY: Missing token (REPLICATE_API_TOKEN)',
          };
        const base = String(provider.endpoint || 'https://api.replicate.com/v1').replace(
          /\/+$/,
          ''
        );
        const startedAt = Date.now();
        const resp = await fetch(`${base}/models?limit=1`, {
          method: 'GET',
          headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15_000),
        });
        const latencyMs = Date.now() - startedAt;
        if (resp.ok) return { ok: true, httpStatus: resp.status, detail: `OK (${latencyMs}ms)` };
        const text = await resp.text().catch(() => '');
        return {
          ok: false,
          httpStatus: resp.status,
          detail: `HTTP ${resp.status} (${latencyMs}ms): ${text.slice(0, 160)}`,
        };
      }

      const providerHealthResults = await Promise.all(
        allProviders.map(async (provider: any) => {
          let status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown' = 'unknown';
          let error: any = null;
          let responseTime = 0;
          let rawError: string | null = null;
          let statusCode: number | null = null;
          const lastCheckIso = provider.last_health_check || nowIso;

          const isActive = !!provider.is_active;
          const providerKey = String(provider.provider || '').toLowerCase();

          if (!isActive) {
            status = 'unknown';
          } else if (!live) {
            status = (provider.health_status as any) || 'unknown';
            try {
              const lastEvent = (await dbGet(
                `SELECT latency_ms, error_message
                 FROM llm_health_events
                 WHERE provider = ? AND (model = ? OR model IS NULL)
                 ORDER BY timestamp DESC
                 LIMIT 1`,
                [providerKey, provider.model_id || null]
              )) as any;
              responseTime = Number(lastEvent?.latency_ms || 0) || 0;
              rawError = lastEvent?.error_message ? String(lastEvent.error_message) : null;
            } catch {
              /* ignore */
            }
          } else {
            // Live diagnostics (explicit) - cheap but may consume minimal tokens for TEXT_LLM
            try {
              const startTime = Date.now();

              if (String(provider.kind || 'TEXT_LLM').toUpperCase() === 'IMAGE_MODEL') {
                if (providerKey === 'replicate') {
                  const r = await replicateAuthCheck(provider);
                  responseTime = Date.now() - startTime;
                  statusCode = r.httpStatus;
                  if (r.ok) {
                    status = responseTime < 3000 ? 'healthy' : 'degraded';
                  } else {
                    status = 'unhealthy';
                    rawError = String(r.detail || 'Connection failed');
                  }
                } else {
                  status = 'unknown';
                }
              } else {
                const result = await llmService.testConnection({
                  provider: provider.provider,
                  apiKey: provider.api_key,
                  api_key: provider.api_key,
                  endpoint: provider.endpoint,
                  id: provider.model_id,
                });
                responseTime = Date.now() - startTime;
                statusCode = (result as any)?.httpStatus ?? null;

                if (result.success) {
                  status = responseTime < 3000 ? 'healthy' : 'degraded';
                } else {
                  status = 'unhealthy';
                  rawError = String(result.error || 'Connection failed');
                }
              }

              // Persist cache fields for router + UI
              try {
                await dbRun(
                  `UPDATE llm_providers
                   SET health_status = ?, last_health_check = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`,
                  [status, nowIso, provider.id]
                );
              } catch {
                /* ignore */
              }

              // Best-effort: persist health events (throttled ~60s/provider key)
              try {
                const lastAt = LLMController.lastHealthEventWriteAt.get(providerKey) || 0;
                if (Date.now() - lastAt > 60_000) {
                  LLMController.lastHealthEventWriteAt.set(providerKey, Date.now());
                  const available = status === 'healthy' || status === 'degraded';
                  void dbRun(
                    `INSERT INTO llm_health_events (id, provider, model, status, available, latency_ms, error_message, timestamp)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      uuidv4(),
                      providerKey,
                      provider.model_id || null,
                      status,
                      available ? 1 : 0,
                      responseTime || 0,
                      available ? null : rawError || 'Unhealthy',
                      nowIso,
                    ]
                  ).catch(() => {
                    /* ignore */
                  });
                }
              } catch {
                /* ignore */
              }
            } catch (e: any) {
              status = 'unhealthy';
              rawError = e.message;
              error = {
                title: 'Connection Error',
                description: e.message,
                action: 'Check API key and endpoint configuration',
                code: 'CONNECTION_ERROR',
              };
            }
          }

          const statusLabels: Record<string, any> = {
            healthy: { text: 'Zdrowy', textEn: 'Healthy', color: 'green', icon: 'check' },
            degraded: { text: 'Zdegradowany', textEn: 'Degraded', color: 'yellow', icon: 'alert' },
            unhealthy: { text: 'Niezdrowy', textEn: 'Unhealthy', color: 'red', icon: 'x' },
            unknown: { text: 'Nieznany', textEn: 'Unknown', color: 'gray', icon: 'question' },
          };

          const errorCategory = classifyErrorCategory(rawError) || (error ? 'connection' : null);
          if (isActive && status === 'unhealthy') {
            alerts.push({
              severity: 'error',
              provider: provider.name,
              providerId: provider.id,
              title:
                errorCategory === 'missing_key'
                  ? 'Missing API key'
                  : errorCategory === 'billing'
                    ? 'Billing / quota issue'
                    : errorCategory === 'rate_limit'
                      ? 'Rate limit'
                      : 'Provider unhealthy',
              description: rawError || error?.description || 'Provider health check failed',
              action:
                errorCategory === 'missing_key'
                  ? 'Add API key (env var or provider key) and re-test'
                  : errorCategory === 'billing'
                    ? 'Check billing / credits, then re-test'
                    : errorCategory === 'rate_limit'
                      ? 'Lower concurrency or add fallback provider'
                      : 'Verify API credentials and network connectivity',
              code: String(errorCategory || 'provider_unhealthy').toUpperCase(),
              timestamp: new Date().toISOString(),
            });
          }

          return {
            id: provider.id,
            name: provider.name,
            providerId: provider.provider,
            isActive: !!provider.is_active,
            isDefault: !!provider.is_default,
            status,
            statusLabel: statusLabels[status],
            isHealthy: status === 'healthy',
            isDegraded: status === 'degraded',
            isUnhealthy: status === 'unhealthy',
            errorCategory,
            error,
            rawError,
            statusCode,
            responseTime,
            lastCheck: live ? nowIso : lastCheckIso,
          };
        })
      );

      // Summary should reflect only ACTIVE providers; inactive rows are not part of platform health.
      const activeResults = providerHealthResults.filter((p: any) => !!p.isActive);
      // Platform health must reflect providers that actually drive routing.
      // If a default provider exists, use only default/core providers for the summary.
      // This prevents optional side providers (for example Gemini) from turning the whole
      // platform red when the primary routed provider is healthy.
      const coreResults = LLMController.selectCoreProviders(activeResults);
      const healthyCount = coreResults.filter((p: any) => p.status === 'healthy').length;
      const degradedCount = coreResults.filter((p: any) => p.status === 'degraded').length;
      const unhealthyCount = coreResults.filter((p: any) => p.status === 'unhealthy').length;

      return res.json({
        success: true,
        providers: providerHealthResults,
        alerts,
        summary: {
          total: coreResults.length,
          healthy: healthyCount,
          degraded: degradedCount,
          unhealthy: unhealthyCount,
          healthyCount,
          degradedCount,
          unhealthyCount,
          inactive: (providerHealthResults.length || 0) - (activeResults.length || 0),
          activeTotal: activeResults.length,
          lastCheck: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('[LLMController] Error getting detailed health:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/llm/health/test-provider
   * Test a specific provider's connection
   */
  static async testProviderHealth(req: Request, res: Response) {
    try {
      const { providerId } = req.body;

      const provider = (await dbGet('SELECT * FROM llm_providers WHERE id = ?', [
        providerId,
      ])) as any;
      if (!provider) {
        return res.status(404).json({ success: false, error: 'Provider not found' });
      }

      const startTime = Date.now();
      try {
        let result: any = null;
        let ok = false;
        let errMsg: string | null = null;
        let httpStatus: number | null = null;

        const providerKey = String(provider.provider || '').toLowerCase();
        const kind = String(provider.kind || 'TEXT_LLM').toUpperCase();

        if (kind === 'IMAGE_MODEL' && providerKey === 'replicate') {
          const token =
            String(provider.api_key || '').trim() ||
            String(process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY || '').trim();
          if (!token) {
            ok = false;
            errMsg = 'MISSING_KEY: Missing token (REPLICATE_API_TOKEN)';
          } else {
            const base = String(provider.endpoint || 'https://api.replicate.com/v1').replace(
              /\/+$/,
              ''
            );
            const resp = await fetch(`${base}/models?limit=1`, {
              method: 'GET',
              headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(15_000),
            });
            httpStatus = resp.status;
            ok = resp.ok;
            if (!resp.ok) {
              const text = await resp.text().catch(() => '');
              errMsg = `HTTP ${resp.status}: ${text.slice(0, 160)}`;
            }
          }
        } else {
          result = await llmService.testConnection({
            provider: provider.provider,
            apiKey: provider.api_key,
            api_key: provider.api_key,
            endpoint: provider.endpoint,
            id: provider.model_id,
          });
          ok = !!result?.success;
          errMsg = ok ? null : String(result?.error || 'Connection failed');
          httpStatus = result?.httpStatus ?? null;
        }

        const responseTimeMs = Date.now() - startTime;
        const status = ok ? (responseTimeMs < 3000 ? 'healthy' : 'degraded') : 'unhealthy';

        // Update cached status for router + UI
        try {
          await dbRun(
            `UPDATE llm_providers
             SET health_status = ?, last_health_check = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [status, new Date().toISOString(), provider.id]
          );
        } catch {
          /* ignore */
        }

        return res.json({
          success: ok,
          providerId: provider.id,
          providerName: provider.name,
          responseTime: responseTimeMs,
          status,
          statusCode: httpStatus,
          error: errMsg,
        });
      } catch (e: any) {
        return res.json({
          success: false,
          providerId: provider.id,
          providerName: provider.name,
          responseTime: Date.now() - startTime,
          status: 'unhealthy',
          error: e.message,
        });
      }
    } catch (error: any) {
      logger.error('[LLMController] Error testing provider:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/llm/health/test/:capabilityId
   * Test specific AI capability
   */
  static async testCapability(req: Request, res: Response) {
    try {
      const { capabilityId } = req.params;
      const { context, sendAlerts } = req.body;
      const startTime = Date.now();

      // Get active provider
      const provider = (await dbGet(
        'SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY is_default DESC LIMIT 1',
        []
      )) as any;

      if (!provider) {
        return res.json({
          capability: capabilityId,
          status: 'FAILED',
          latency: Date.now() - startTime,
          error: 'No active LLM provider configured',
          details: { skipped: false },
        });
      }

      let testResult = { success: false, details: {} as any, error: '' };

      switch (capabilityId) {
        case 'connection':
          // Test basic connection
          try {
            testResult = await llmService.testConnection({
              provider: provider.provider,
              apiKey: provider.api_key,
              api_key: provider.api_key,
              endpoint: provider.endpoint,
              id: provider.model_id,
            });
          } catch (e: any) {
            testResult.error = e.message;
          }
          break;

        case 'chat_ready':
          // Test chat capability with simple prompt
          try {
            const response = await llmService.call({
              type: 'chat',
              modelConfig: {
                provider: provider.provider,
                apiKey: provider.api_key,
                endpoint: provider.endpoint,
                id: provider.model_id,
              },
              messages: [{ role: 'user', content: 'Say "ready" if you can respond.' }],
              maxTokens: 10,
            });
            testResult.success = !!response?.content;
            testResult.details = { response: response?.content?.substring(0, 100) };
          } catch (e: any) {
            testResult.error = e.message;
          }
          break;

        case 'eyes':
          // Visual context - skip if not supported
          testResult.success = true;
          testResult.details = {
            skipped: true,
            reason: 'Visual context requires multimodal model',
          };
          break;

        case 'memory':
          // RAG test - check if knowledge base is accessible
          testResult.success = true;
          testResult.details = { skipped: true, reason: 'RAG requires knowledge base setup' };
          break;

        case 'hands':
          // MCP Tools test
          testResult.success = true;
          testResult.details = { skipped: true, reason: 'MCP tools require tool server setup' };
          break;

        case 'reasoning':
          // Advanced reasoning test
          try {
            const response = await llmService.call({
              type: 'chat',
              modelConfig: {
                provider: provider.provider,
                apiKey: provider.api_key,
                endpoint: provider.endpoint,
                id: provider.model_id,
              },
              messages: [{ role: 'user', content: 'What is 15 * 7? Reply with just the number.' }],
              maxTokens: 20,
            });
            testResult.success = response?.content?.includes('105');
            testResult.details = { response: response?.content, expected: '105' };
          } catch (e: any) {
            testResult.error = e.message;
          }
          break;

        default:
          testResult.error = `Unknown capability: ${capabilityId}`;
      }

      const result = {
        capability: capabilityId,
        status: testResult.success ? 'SUCCESS' : 'FAILED',
        latency: Date.now() - startTime,
        details: testResult.details,
        error: testResult.error || undefined,
        alertSent: sendAlerts && !testResult.success,
      };

      // Log the test result
      await dbRun(
        `
                INSERT INTO ai_usage_logs (id, user_id, organization_id, provider, model, action, status, latency_ms, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `,
        [
          uuidv4(),
          (req as any).userId || 'system',
          (req as any).organizationId || 'system',
          provider.provider,
          provider.model_id,
          `health_test_${capabilityId}`,
          testResult.success ? 'success' : 'error',
          Date.now() - startTime,
        ]
      );

      return res.json(result);
    } catch (error: any) {
      logger.error('[LLMController] Error testing capability:', error);
      return res.status(500).json({
        capability: req.params.capabilityId,
        status: 'FAILED',
        latency: 0,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/llm/analytics
   * Get LLM usage analytics
   */
  static async getAnalytics(req: Request, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 7;

      // Total stats
      const totals = (await dbGet(
        `
                SELECT 
                    COUNT(*) as "totalCalls",
                    COALESCE(SUM(tokens_used), 0) as "totalTokens",
                    COALESCE(AVG(latency_ms), 0) as "avgLatency",
                    COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 0) as "errorRate"
                FROM ai_usage_logs 
                WHERE created_at > datetime('now', '-' || ? || ' days')
            `,
        [days]
      )) as any;

      // By provider
      const byProviderRows = (await dbAll(
        `
                SELECT 
                    provider,
                    COUNT(*) as calls,
                    COALESCE(SUM(tokens_used), 0) as tokens
                FROM ai_usage_logs 
                WHERE created_at > datetime('now', '-' || ? || ' days')
                GROUP BY provider
            `,
        [days]
      )) as any[];

      const byProvider: Record<string, { calls: number; tokens: number }> = {};
      for (const row of byProviderRows) {
        byProvider[row.provider] = { calls: row.calls, tokens: row.tokens };
      }

      // By day
      const byDayRows = (await dbAll(
        `
                SELECT 
                    date(created_at) as date,
                    COUNT(*) as calls,
                    COALESCE(SUM(tokens_used), 0) as tokens
                FROM ai_usage_logs 
                WHERE created_at > datetime('now', '-' || ? || ' days')
                GROUP BY date(created_at)
                ORDER BY date
            `,
        [days]
      )) as any[];

      return res.json({
        totalCalls: totals?.totalCalls || 0,
        totalTokens: totals?.totalTokens || 0,
        avgLatency: Math.round(totals?.avgLatency || 0),
        errorRate: Math.round((totals?.errorRate || 0) * 100) / 100,
        byProvider,
        byDay: byDayRows.map((r: any) => ({ date: r.date, calls: r.calls, tokens: r.tokens })),
      });
    } catch (error: any) {
      logger.error('[LLMController] Error getting analytics:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/logs
   * Get LLM usage logs
   */
  static async getLogs(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const logs = await dbAll(
        `
                SELECT 
                    id, provider, model, action as prompt, 
                    COALESCE(tokens_used, 0) as tokens,
                    COALESCE(latency_ms, 0) as latency,
                    CASE WHEN status = 'error' THEN error_message ELSE NULL END as error,
                    created_at as "createdAt"
                FROM ai_usage_logs 
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `,
        [limit, offset]
      );

      const countRow = (await dbGet('SELECT COUNT(*) as total FROM ai_usage_logs', [])) as {
        total: number;
      };

      return res.json({
        logs,
        pagination: {
          total: countRow?.total || 0,
          limit,
          offset,
        },
      });
    } catch (error: any) {
      logger.error('[LLMController] Error getting logs:', error);
      return res.status(500).json({ error: error.message, logs: [] });
    }
  }

  /**
   * GET /api/llm/providers/health
   * Get health status of all providers
   */
  static async getProvidersHealth(req: Request, res: Response) {
    try {
      const live = String((req.query.live as string) || '').toLowerCase() === 'true';
      const timeoutMsRaw = Number((req.query.timeoutMs as string) || 4000);
      const timeoutMs = Number.isFinite(timeoutMsRaw)
        ? Math.min(8000, Math.max(300, timeoutMsRaw))
        : 4000;
      const ttlMsRaw = Number(
        (req.query.ttlMs as string) || process.env.LLM_PROVIDER_SNAPSHOT_TTL_MS || 90_000
      );
      const ttlMs = Number.isFinite(ttlMsRaw)
        ? Math.min(300_000, Math.max(15_000, ttlMsRaw))
        : 90_000;
      const currentSnapshot = LLMController.providerHealthSnapshot;
      const now = Date.now();

      if (!live && currentSnapshot && currentSnapshot.expiresAt > now) {
        return res.json({
          ...currentSnapshot.payload,
          cached: true,
          mode: 'snapshot',
          ttlMs,
        });
      }

      if (!live && LLMController.providerHealthRefreshPromise) {
        if (currentSnapshot) {
          return res.json({
            ...currentSnapshot.payload,
            cached: true,
            stale: true,
            mode: 'snapshot',
            ttlMs,
          });
        }
        const pendingPayload = await LLMController.providerHealthRefreshPromise;
        return res.json({
          ...pendingPayload,
          cached: true,
          mode: 'snapshot',
          ttlMs,
        });
      }

      const computePayload = async (): Promise<Record<string, unknown>> => {
        const providers = (await llmConfigService.getAllProviders(true)) as any[];

        const withTimeout = async <T>(p: Promise<T>, ms: number): Promise<T> => {
          let timer: NodeJS.Timeout | null = null;
          try {
            return await Promise.race<T>([
              p,
              new Promise<T>((_resolve, reject) => {
                timer = setTimeout(
                  () => reject(new Error(`Health check timed out after ${ms}ms`)),
                  ms
                );
              }),
            ]);
          } finally {
            if (timer) clearTimeout(timer);
          }
        };

        const nowIso = new Date().toISOString();
        const healthResults = await Promise.all(
          (providers || []).map(async (provider: any) => {
            const providerId = String(provider.provider || '').toLowerCase();
            const cooldownKey = `${providerId}:${String(provider.id || provider.model_id || provider.provider || '')}`;
            const rawKey = typeof provider.api_key === 'string' ? provider.api_key.trim() : '';
            const hasKey =
              !!rawKey &&
              !rawKey.toLowerCase().includes('placeholder') &&
              !rawKey.startsWith('sk-demo-') &&
              rawKey !== 'YOUR_GEMINI_API_KEY_HERE' &&
              rawKey !== 'YOUR_OPENAI_API_KEY_HERE';
            const isLocal = providerId === 'ollama';

            if (!hasKey && !isLocal) {
              return {
                id: provider.id || provider.model_id || provider.provider,
                name: provider.name || provider.provider,
                provider: provider.provider,
                status: 'unconfigured',
                available: false,
                lastCheck: nowIso,
              };
            }

            const cooldown = LLMController.providerHealthCooldowns.get(cooldownKey);
            if (cooldown && cooldown.until > Date.now()) {
              return {
                id: provider.id || provider.model_id || provider.provider,
                name: provider.name || provider.provider,
                provider: provider.provider,
                status: 'unhealthy',
                available: false,
                error: cooldown.error,
                lastCheck: nowIso,
                cooldownUntil: new Date(cooldown.until).toISOString(),
              };
            }

            try {
              const providerTimeoutMs = isLocal ? Math.min(timeoutMs, 800) : timeoutMs;
              const result = await withTimeout(
                llmService.testConnection({
                  provider: provider.provider,
                  apiKey: provider.api_key,
                  api_key: provider.api_key,
                  endpoint: provider.endpoint,
                  id: provider.model_id,
                  timeoutMs: providerTimeoutMs,
                }),
                providerTimeoutMs
              );

              const ok = !!(result as any)?.success;
              const resultError = String((result as any)?.error || '');
              const httpStatus = Number((result as any)?.httpStatus || 0) || null;
              if (!ok && LLMController.isAuthLikeProviderError(resultError, httpStatus)) {
                LLMController.providerHealthCooldowns.set(cooldownKey, {
                  until: Date.now() + 30 * 60_000,
                  error: resultError || 'Invalid provider credentials',
                  status: 'auth_failed',
                });
              } else if (ok) {
                LLMController.providerHealthCooldowns.delete(cooldownKey);
              }
              const row = {
                id: provider.id || provider.model_id || provider.provider,
                name: provider.name || provider.provider,
                provider: provider.provider,
                status: ok ? 'healthy' : 'unhealthy',
                available: ok,
                latency: (result as any)?.latency || 0,
                lastCheck: nowIso,
              };
              try {
                const providerKey = String(provider.provider || '').toLowerCase();
                const lastAt = LLMController.lastHealthEventWriteAt.get(providerKey) || 0;
                if (Date.now() - lastAt > 60_000) {
                  LLMController.lastHealthEventWriteAt.set(providerKey, Date.now());
                  void dbRun(
                    `INSERT INTO llm_health_events (id, provider, model, status, available, latency_ms, error_message, timestamp)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      uuidv4(),
                      providerKey,
                      provider.model_id || null,
                      row.status,
                      row.available ? 1 : 0,
                      row.latency || 0,
                      ok ? null : String((result as any)?.error || 'Unhealthy'),
                      nowIso,
                    ]
                  ).catch(() => {
                    /* ignore */
                  });
                }
              } catch {
                /* ignore */
              }
              return row;
            } catch (e: any) {
              if (LLMController.isAuthLikeProviderError(e, null)) {
                LLMController.providerHealthCooldowns.set(cooldownKey, {
                  until: Date.now() + 5 * 60_000,
                  error: e?.message || String(e),
                  status: 'auth_failed',
                });
              }
              const row = {
                id: provider.id || provider.model_id || provider.provider,
                name: provider.name || provider.provider,
                provider: provider.provider,
                status: 'unhealthy',
                available: false,
                error: e?.message || String(e),
                lastCheck: nowIso,
              };
              try {
                const providerKey = String(provider.provider || '').toLowerCase();
                const lastAt = LLMController.lastHealthEventWriteAt.get(providerKey) || 0;
                if (Date.now() - lastAt > 60_000) {
                  LLMController.lastHealthEventWriteAt.set(providerKey, Date.now());
                  void dbRun(
                    `INSERT INTO llm_health_events (id, provider, model, status, available, latency_ms, error_message, timestamp)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      uuidv4(),
                      providerKey,
                      provider.model_id || null,
                      'unhealthy',
                      0,
                      0,
                      String(row.error || 'Unhealthy'),
                      nowIso,
                    ]
                  ).catch(() => {
                    /* ignore */
                  });
                }
              } catch {
                /* ignore */
              }
              return row;
            }
          })
        );

        const configuredProviders = healthResults.filter((p) => p.status !== 'unconfigured');
        const coreProviders = LLMController.selectCoreProviders(configuredProviders);
        const healthyCount = coreProviders.filter((p) => p.status === 'healthy').length;
        const overall =
          coreProviders.length === 0
            ? 'unhealthy'
            : healthyCount === 0
              ? 'unhealthy'
              : healthyCount === coreProviders.length
                ? 'healthy'
                : 'degraded';

        const breakerStatuses = (circuitBreaker as any)?.getStatus?.() || {};
        const circuitBreakers = Object.entries(breakerStatuses).map(([name, raw]: any) => ({
          name,
          state: raw?.state || raw?.status || raw?.currentState || 'unknown',
          failures: raw?.failures ?? raw?.failureCount ?? raw?.consecutiveFailures ?? 0,
        }));

        return {
          success: true,
          providers: healthResults,
          circuitBreakers,
          overall,
          lastCheck: Date.now(),
          timeoutMs,
        };
      };

      const startSnapshotRefresh = (): Promise<Record<string, unknown>> => {
        if (!LLMController.providerHealthRefreshPromise) {
          LLMController.providerHealthRefreshPromise = computePayload()
            .then((payload) => {
              LLMController.providerHealthSnapshot = {
                payload,
                expiresAt: Date.now() + ttlMs,
              };
              return payload;
            })
            .finally(() => {
              LLMController.providerHealthRefreshPromise = null;
            });
        }

        return LLMController.providerHealthRefreshPromise;
      };

      if (!live && currentSnapshot) {
        void startSnapshotRefresh().catch((error: any) => {
          logger.warn('[LLMController] Background provider health refresh failed', {
            error: error?.message || String(error),
          });
        });

        return res.json({
          ...currentSnapshot.payload,
          cached: true,
          stale: true,
          mode: 'snapshot',
          ttlMs,
        });
      }

      const payloadPromise = live ? computePayload() : startSnapshotRefresh();
      const payload = await payloadPromise;

      return res.json({
        ...payload,
        cached: !live && Boolean(currentSnapshot),
        mode: live ? 'live' : 'snapshot',
        ttlMs,
      });
    } catch (error: any) {
      if (LLMController.providerHealthSnapshot) {
        return res.json({
          ...LLMController.providerHealthSnapshot.payload,
          cached: true,
          stale: true,
          mode: 'snapshot',
        });
      }
      logger.error('[LLMController] Error getting providers health:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/providers/recommended
   * Get recommended provider for tier
   */
  static async getRecommendedProvider(req: Request, res: Response) {
    try {
      const tier = (req.query.tier as string) || 'standard';

      const provider = (await dbGet(
        `
                SELECT * FROM llm_providers 
                WHERE is_active = 1 AND (tier = ? OR tier = 'standard')
                ORDER BY is_default DESC, tier DESC
                LIMIT 1
            `,
        [tier.toLowerCase()]
      )) as any;

      if (!provider) {
        return res.json({
          success: false,
          recommendation: null,
          reason: 'No active providers available',
        });
      }

      return res.json({
        success: true,
        recommendation: {
          provider: provider.provider,
          model: provider.model_id,
          reason: provider.is_default ? 'Default provider' : `Best available for ${tier} tier`,
        },
      });
    } catch (error: any) {
      logger.error('[LLMController] Error getting recommended provider:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/incidents
   * Timeline of downtime incidents based on llm_health_events.
   *
   * Query:
   * - from: ISO string (optional)
   * - to: ISO string (optional)
   * - provider: provider id (default: openrouter)
   */
  static async getIncidents(req: Request, res: Response) {
    try {
      const provider = String((req.query.provider as string) || 'openrouter').toLowerCase();
      const now = Date.now();
      const fromIso = String(req.query.from || new Date(now - 24 * 60 * 60 * 1000).toISOString());
      const toIso = String(req.query.to || new Date(now).toISOString());

      const rows = (await dbAll(
        `SELECT provider, model, status, available, latency_ms, error_message, timestamp
         FROM llm_health_events
         WHERE provider = ? AND timestamp >= ? AND timestamp <= ?
         ORDER BY timestamp ASC`,
        [provider, fromIso, toIso]
      )) as Array<{
        provider: string;
        model?: string | null;
        status: string;
        available: number | boolean;
        latency_ms?: number | null;
        error_message?: string | null;
        timestamp: string;
      }>;

      const events = (rows || [])
        .map((r) => {
          const ts = new Date(String(r.timestamp)).getTime();
          if (!Number.isFinite(ts)) return null;
          return {
            provider: r.provider,
            model: r.model || null,
            available: !!r.available,
            status: String(r.status || ''),
            latencyMs: typeof r.latency_ms === 'number' ? r.latency_ms : Number(r.latency_ms || 0),
            error: r.error_message || null,
            timestamp: new Date(ts).toISOString(),
            ts,
          };
        })
        .filter(Boolean) as Array<{
        provider: string;
        model: string | null;
        available: boolean;
        status: string;
        latencyMs: number;
        error: string | null;
        timestamp: string;
        ts: number;
      }>;

      // Build incidents: contiguous unavailable periods.
      const incidents: Array<{
        start: string;
        end: string | null;
        durationMs: number;
        samples: number;
        lastError: string | null;
      }> = [];

      let current: {
        startTs: number;
        samples: number;
        lastError: string | null;
      } | null = null;

      for (const ev of events) {
        if (!ev.available) {
          if (!current) {
            current = { startTs: ev.ts, samples: 0, lastError: null };
          }
          current.samples += 1;
          if (ev.error) current.lastError = ev.error;
        } else if (current) {
          const endTs = ev.ts;
          incidents.push({
            start: new Date(current.startTs).toISOString(),
            end: new Date(endTs).toISOString(),
            durationMs: Math.max(0, endTs - current.startTs),
            samples: current.samples,
            lastError: current.lastError,
          });
          current = null;
        }
      }
      if (current) {
        const endTs = new Date(toIso).getTime();
        incidents.push({
          start: new Date(current.startTs).toISOString(),
          end: null,
          durationMs: Math.max(0, (Number.isFinite(endTs) ? endTs : Date.now()) - current.startTs),
          samples: current.samples,
          lastError: current.lastError,
        });
      }

      // Rough uptime estimate using deltas between samples.
      const windowStartTs = new Date(fromIso).getTime();
      const windowEndTs = new Date(toIso).getTime();
      const totalMs =
        Number.isFinite(windowStartTs) &&
        Number.isFinite(windowEndTs) &&
        windowEndTs > windowStartTs
          ? windowEndTs - windowStartTs
          : 0;
      let downMs = 0;
      for (const inc of incidents) {
        const s = new Date(inc.start).getTime();
        const e = inc.end ? new Date(inc.end).getTime() : windowEndTs;
        if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
          downMs += e - s;
        }
      }
      const uptimePct =
        totalMs > 0 ? Math.max(0, Math.min(100, ((totalMs - downMs) / totalMs) * 100)) : 0;

      return res.json({
        success: true,
        provider,
        from: fromIso,
        to: toIso,
        uptime: {
          totalMs,
          downMs,
          upMs: Math.max(0, totalMs - downMs),
          uptimePct: Number(uptimePct.toFixed(2)),
          samples: events.length,
        },
        incidents,
      });
    } catch (error: any) {
      logger.error('[LLMController] Error getting incidents:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/llm/control/usage
   * Get usage statistics for control panel
   */
  static async getUsageStats(req: Request, res: Response) {
    try {
      const today = (await dbGet(
        `
                SELECT 
                    COUNT(*) as calls,
                    COALESCE(SUM(tokens_used), 0) as tokens,
                    COALESCE(AVG(latency_ms), 0) as "avgLatency"
                FROM ai_usage_logs
                WHERE date(created_at) = date('now')
            `,
        []
      )) as any;

      const thisMonth = (await dbGet(
        `
                SELECT 
                    COUNT(*) as calls,
                    COALESCE(SUM(tokens_used), 0) as tokens
                FROM ai_usage_logs 
                WHERE created_at >= date('now', 'start of month')
            `,
        []
      )) as any;

      const byProvider = await dbAll(
        `
                SELECT 
                    provider,
                    COUNT(*) as calls,
                    COALESCE(SUM(tokens_used), 0) as tokens
                FROM ai_usage_logs 
                WHERE created_at >= date('now', '-7 days')
                GROUP BY provider
            `,
        []
      );

      return res.json({
        today: {
          calls: today?.calls || 0,
          tokens: today?.tokens || 0,
          avgLatency: Math.round(today?.avgLatency || 0),
        },
        thisMonth: {
          calls: thisMonth?.calls || 0,
          tokens: thisMonth?.tokens || 0,
        },
        byProvider,
      });
    } catch (error: any) {
      logger.error('[LLMController] Error getting usage stats:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/costs
   * Get cost statistics
   */
  static async getCosts(req: Request, res: Response) {
    try {
      const providers = (await dbAll(
        'SELECT provider, cost_per_1k FROM llm_providers',
        []
      )) as any[];

      // Prefer v3: estimated_cost_usd if present (written by AIPipeline when price snapshot is bound).
      // Fallback to legacy token-based estimate using llm_providers.cost_per_1k.
      const usage = (await dbAll(
        `
                SELECT 
                    provider,
                    COALESCE(SUM(tokens_used), 0) as "totalTokens",
                    SUM(CASE WHEN estimated_cost_usd IS NOT NULL THEN estimated_cost_usd ELSE 0 END) as "totalEstimatedCostUsd"
                FROM ai_usage_logs 
                WHERE created_at >= date('now', 'start of month')
                  AND status = 'success'
                GROUP BY provider
            `,
        []
      )) as any[];

      let totalCost = 0;
      const costByProvider: Record<string, { tokens: number; cost: number }> = {};

      for (const u of usage || []) {
        const providerKey = String(u.provider || 'unknown');
        const totalTokens = Number(u.totalTokens || 0) || 0;
        const snapshotCost = Number(u.totalEstimatedCostUsd || 0) || 0;
        let cost = snapshotCost;

        if (!Number.isFinite(cost) || cost <= 0) {
          const providerConfig = providers.find((p: any) => String(p.provider) === providerKey);
          const costPer1k = Number(providerConfig?.cost_per_1k || 0) || 0;
          cost = (totalTokens / 1000) * costPer1k;
        }

        totalCost += cost;
        costByProvider[providerKey] = {
          tokens: totalTokens,
          cost: Math.round(cost * 100) / 100,
        };
      }

      return res.json({
        totalCost: Math.round(totalCost * 100) / 100,
        currency: 'USD',
        period: 'current_month',
        byProvider: costByProvider,
      });
    } catch (error: any) {
      logger.error('[LLMController] Error getting costs:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/llm/diagnose
   * Run diagnostic checks on LLM system
   */
  static async diagnose(req: Request, res: Response) {
    try {
      const providers = (await dbAll(
        'SELECT * FROM llm_providers WHERE is_active = 1',
        []
      )) as any[];

      const diagnostics: any[] = [];

      // Check providers
      diagnostics.push({
        check: 'Active Providers',
        status: providers.length > 0 ? 'OK' : 'WARNING',
        message:
          providers.length > 0
            ? `${providers.length} active provider(s)`
            : 'No active providers configured',
        details: providers.map((p) => p.name),
      });

      // Check default provider
      const defaultProvider = providers.find((p) => p.is_default);
      diagnostics.push({
        check: 'Default Provider',
        status: defaultProvider ? 'OK' : 'WARNING',
        message: defaultProvider ? `Default: ${defaultProvider.name}` : 'No default provider set',
      });

      // Check recent errors
      const recentErrors = (await dbGet(
        `
                SELECT COUNT(*) as count FROM ai_usage_logs 
                WHERE status = 'error' AND created_at > datetime('now', '-1 hour')
            `,
        []
      )) as { count: number };

      diagnostics.push({
        check: 'Recent Errors',
        status: (recentErrors?.count || 0) < 5 ? 'OK' : 'WARNING',
        message: `${recentErrors?.count || 0} errors in last hour`,
      });

      // Check latency
      const avgLatency = (await dbGet(
        `
                SELECT AVG(latency_ms) as avg FROM ai_usage_logs 
                WHERE created_at > datetime('now', '-1 hour')
            `,
        []
      )) as { avg: number };

      diagnostics.push({
        check: 'Average Latency',
        status: (avgLatency?.avg || 0) < 5000 ? 'OK' : 'WARNING',
        message: `${Math.round(avgLatency?.avg || 0)}ms average`,
      });

      const overallStatus = diagnostics.every((d) => d.status === 'OK') ? 'HEALTHY' : 'DEGRADED';

      return res.json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        diagnostics,
      });
    } catch (error: any) {
      logger.error('[LLMController] Error running diagnostics:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/llm/providers/:id/tier
   * Update provider tier
   */
  static async updateProviderTier(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { tier } = req.body;

      if (!tier) {
        return res.status(400).json({ error: 'Tier is required' });
      }

      await dbRun(
        'UPDATE llm_providers SET tier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [tier.toLowerCase(), id]
      );

      const updated = await dbGet('SELECT * FROM llm_providers WHERE id = ?', [id]);
      return res.json(updated);
    } catch (error: any) {
      logger.error('[LLMController] Error updating tier:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // ==================== TIER ASSIGNMENTS ====================

  /**
   * GET /api/llm/tiers/assignments
   * Get all tier assignments grouped by tier
   */
  static async getTierAssignments(req: Request, res: Response) {
    try {
      const assignments = (await dbAll(
        `
                SELECT 
                    t.id,
                    t.tier,
                    t.priority,
                    t.is_active,
                    t.provider_id,
                    p.name,
                    p.provider,
                    p.model_id,
                    CASE 
                        WHEN p.is_active = 1 THEN 'healthy'
                        ELSE 'unknown'
                    END as health_status
                FROM llm_tier_assignments t
                JOIN llm_providers p ON t.provider_id = p.id
                WHERE t.is_active = true
                ORDER BY t.tier, t.priority
            `,
        []
      )) as any[];

      // Group by tier
      const grouped: Record<string, any[]> = {
        BUDGET: [],
        STANDARD: [],
        PREMIUM: [],
        REASONING: [],
      };

      for (const assignment of assignments) {
        if (grouped[assignment.tier]) {
          grouped[assignment.tier].push(assignment);
        }
      }

      return res.json({ assignments: grouped });
    } catch (error: any) {
      logger.error('[LLMController] Error getting tier assignments:', error);
      return res.status(500).json({ error: error.message, assignments: {} });
    }
  }

  /**
   * POST /api/llm/tiers/assign
   * Assign a provider to a tier
   */
  static async assignToTier(req: Request, res: Response) {
    try {
      const { providerId, tier, priority = 0 } = req.body;

      if (!providerId || !tier) {
        return res.status(400).json({ error: 'providerId and tier are required' });
      }

      const validTiers = ['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'];
      if (!validTiers.includes(tier.toUpperCase())) {
        return res.status(400).json({ error: 'Invalid tier' });
      }

      // Check if provider exists
      const provider = await dbGet('SELECT * FROM llm_providers WHERE id = ?', [providerId]);
      if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      const id = uuidv4();
      await dbRun(
        `
                INSERT INTO llm_tier_assignments (id, provider_id, tier, priority, is_active)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(provider_id, tier) DO UPDATE SET
                    priority = excluded.priority,
                    is_active = 1,
                    updated_at = CURRENT_TIMESTAMP
            `,
        [id, providerId, tier.toUpperCase(), priority, 1]
      );

      return res.json({ success: true, message: 'Provider assigned to tier' });
    } catch (error: any) {
      logger.error('[LLMController] Error assigning to tier:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/llm/tiers/assign
   * Remove a provider from a tier
   */
  static async removeFromTier(req: Request, res: Response) {
    try {
      const { providerId, tier } = req.body;

      if (!providerId || !tier) {
        return res.status(400).json({ error: 'providerId and tier are required' });
      }

      await dbRun(
        `
                DELETE FROM llm_tier_assignments 
                WHERE provider_id = ? AND tier = ?
            `,
        [providerId, tier.toUpperCase()]
      );

      return res.json({ success: true, message: 'Provider removed from tier' });
    } catch (error: any) {
      logger.error('[LLMController] Error removing from tier:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/llm/tiers/priority
   * Update priority of a provider in a tier
   */
  static async updateTierPriority(req: Request, res: Response) {
    try {
      const { providerId, tier, priority } = req.body;

      if (!providerId || !tier || priority === undefined) {
        return res.status(400).json({ error: 'providerId, tier, and priority are required' });
      }

      await dbRun(
        `
                UPDATE llm_tier_assignments 
                SET priority = ?, updated_at = CURRENT_TIMESTAMP
                WHERE provider_id = ? AND tier = ?
            `,
        [priority, providerId, tier.toUpperCase()]
      );

      return res.json({ success: true, message: 'Priority updated' });
    } catch (error: any) {
      logger.error('[LLMController] Error updating priority:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}
