/**
 * LLM Health Routes
 * API endpoints for LLM provider health monitoring
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { aiRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

const serviceFallback = (_req: any, res: Response, _readPayload?: Record<string, unknown>) => {
  return res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });
};

// Apply rate limiting
router.use(aiRateLimiter);

// Service interfaces
interface LLMHealthMonitorInterface {
  checkAllProviders?: (providers: unknown[]) => Promise<unknown[]>;
  getSummary?: () => unknown;
  testProvider?: (provider: unknown) => Promise<unknown>;
  getAllCachedStatuses?: () => unknown[];
}

interface HealthStatus {
  HEALTHY: string;
  DEGRADED: string;
  UNHEALTHY: string;
}

interface ErrorMessages {
  [key: string]: { title: string; action: string };
}

// Dynamic imports for services (may not be migrated yet)
let llmHealthMonitor: LLMHealthMonitorInterface | null = null;
let HealthStatusEnum: HealthStatus | null = null;
let ErrorMessagesEnum: ErrorMessages | null = null;

try {
  const healthModule = (await import('../services/ai/llmHealthMonitor.js')) as any;
  const module = healthModule.default || healthModule;
  llmHealthMonitor = module.llmHealthMonitor || module;
  HealthStatusEnum = module.HealthStatus || module;
  ErrorMessagesEnum = module.ErrorMessages || module;
} catch {
  logger.warn('[LLMHealth Routes] llmHealthMonitor not available');
}

// Helper function
function getStatusLabel(status: string): { text: string; color: string } {
  if (!HealthStatusEnum) {
    return { text: 'Nieznany', color: 'gray' };
  }

  switch (status) {
    case HealthStatusEnum.HEALTHY:
      return { text: 'Zdrowy', color: 'green' };
    case HealthStatusEnum.DEGRADED:
      return { text: 'Spowolniony', color: 'yellow' };
    case HealthStatusEnum.UNHEALTHY:
      return { text: 'Niedostępny', color: 'red' };
    default:
      return { text: 'Nieznany', color: 'gray' };
  }
}

/**
 * GET /api/llm/health
 * Get health status of all LLM providers
 */
router.get(
  '/health',
  asyncHandler(async (req, res: Response) => {
    if (!llmHealthMonitor?.checkAllProviders || !llmHealthMonitor?.getSummary) {
      return serviceFallback(req, res, {
        summary: { total: 0, healthy: 0, degraded: 0, unhealthy: 0 },
        providers: [],
      });
    }

    try {
      // Get providers from database
      const providers = (await dbAll(`
            SELECT id, name, provider, api_key, endpoint, model_id, is_active 
            FROM llm_providers 
            WHERE is_active = 1
        `)) as Array<{
        id: string;
        name: string;
        provider: string;
        api_key: string | null;
        endpoint: string | null;
        model_id: string | null;
        is_active: number;
      }>;

      if (providers.length === 0) {
        return res.json({
          success: true,
          summary: { total: 0, healthy: 0, degraded: 0, unhealthy: 0 },
          providers: [],
          lastCheck: new Date().toISOString(),
        });
      }

      // Check all providers
      const results = (await llmHealthMonitor.checkAllProviders(providers)) as Array<{
        id: string;
        provider: string;
        providerId: string;
        status: string;
        errorCategory?: string;
        error?: unknown;
        rawError?: unknown;
        statusCode?: number;
        responseTime?: number;
        lastCheck?: string;
      }>;
      const summary = llmHealthMonitor.getSummary() as {
        total: number;
        healthy: number;
        degraded: number;
        unhealthy: number;
        lastCheck: string;
      };

      return res.json({
        success: true,
        summary,
        providers: results.map((r) => ({
          id: r.id,
          name: r.provider,
          providerId: r.providerId,
          status: r.status,
          statusLabel: getStatusLabel(r.status),
          errorCategory: r.errorCategory,
          error: r.error,
          rawError: r.rawError,
          statusCode: r.statusCode,
          responseTime: r.responseTime,
          lastCheck: r.lastCheck,
        })),
        lastCheck: summary.lastCheck,
      });
    } catch (error: unknown) {
      logger.error('[LLMHealth] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/llm/health/:providerId
 * Get health status of a specific provider
 */
router.get(
  '/health/:providerId',
  asyncHandler(async (req, res: Response) => {
    if (!llmHealthMonitor?.testProvider) {
      return serviceFallback(req, res, { provider: null });
    }

    try {
      const { providerId } = req.params;

      // Get provider from database
      const providers = (await dbAll(
        `
            SELECT id, name, provider, api_key, endpoint, model_id, is_active 
            FROM llm_providers 
            WHERE id = ?
        `,
        [providerId]
      )) as Array<{
        id: string;
        name: string;
        provider: string;
        api_key: string | null;
        endpoint: string | null;
        model_id: string | null;
        is_active: number;
      }>;

      if (providers.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Provider not found',
        });
      }

      const result = (await llmHealthMonitor.testProvider(providers[0])) as {
        provider: string;
        providerId: string;
        status: string;
        errorCategory?: string;
        error?: unknown;
        rawError?: unknown;
        statusCode?: number;
        responseTime?: number;
        lastCheck?: string;
      };

      return res.json({
        success: true,
        provider: {
          id: providerId,
          name: result.provider,
          providerId: result.providerId,
          status: result.status,
          statusLabel: getStatusLabel(result.status),
          errorCategory: result.errorCategory,
          error: result.error,
          rawError: result.rawError,
          statusCode: result.statusCode,
          responseTime: result.responseTime,
          lastCheck: result.lastCheck,
        },
      });
    } catch (error: unknown) {
      logger.error('[LLMHealth] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/llm/health/test
 * Test a specific provider connection
 */
router.post(
  '/health/test',
  asyncHandler(async (req, res: Response) => {
    if (!llmHealthMonitor?.testProvider || !HealthStatusEnum) {
      return serviceFallback(req, res);
    }

    try {
      const { provider, api_key, endpoint, model_id, name } = req.body;

      if (!provider) {
        return res.status(400).json({
          success: false,
          error: 'Provider is required',
        });
      }

      const result = (await llmHealthMonitor.testProvider({
        provider,
        api_key,
        endpoint,
        model_id,
        name,
      })) as {
        status: string;
        errorCategory?: string;
        error?: unknown;
        rawError?: unknown;
        statusCode?: number;
        responseTime?: number;
        lastCheck?: string;
      };

      return res.json({
        success:
          result.status === HealthStatusEnum.HEALTHY || result.status === HealthStatusEnum.DEGRADED,
        result: {
          status: result.status,
          statusLabel: getStatusLabel(result.status),
          errorCategory: result.errorCategory,
          error: result.error,
          rawError: result.rawError,
          statusCode: result.statusCode,
          responseTime: result.responseTime,
          lastCheck: result.lastCheck,
        },
      });
    } catch (error: unknown) {
      logger.error('[LLMHealth] Test error:', error);
      return res.status(500).json({
        success: false,
        error: 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/llm/health/summary
 * Get summary of all provider health statuses
 */
router.get(
  '/health/summary',
  asyncHandler(async (req, res: Response) => {
    if (
      !llmHealthMonitor?.getSummary ||
      !llmHealthMonitor?.getAllCachedStatuses ||
      !HealthStatusEnum
    ) {
      return serviceFallback(req, res, {
        summary: { total: 0, healthy: 0, degraded: 0, unhealthy: 0, byCategory: {} },
        alerts: [],
      });
    }

    try {
      const summary = llmHealthMonitor.getSummary() as {
        total: number;
        healthy: number;
        degraded: number;
        unhealthy: number;
        lastCheck: string;
      };
      const cachedStatuses = llmHealthMonitor.getAllCachedStatuses() as Array<{
        provider: string;
        status: string;
        errorCategory?: string;
        error?: { title?: string; action?: string };
      }>;

      // Group by error category
      const byCategory: Record<string, string[]> = {};
      cachedStatuses.forEach((s) => {
        if (s.errorCategory) {
          if (!byCategory[s.errorCategory]) {
            byCategory[s.errorCategory] = [];
          }
          byCategory[s.errorCategory].push(s.provider);
        }
      });

      return res.json({
        success: true,
        summary: {
          ...summary,
          byCategory,
        },
        alerts: cachedStatuses
          .filter((s) => s.status === HealthStatusEnum.UNHEALTHY)
          .map((s) => ({
            provider: s.provider,
            category: s.errorCategory,
            message: s.error?.title || 'Unknown error',
            action: s.error?.action || 'Check configuration',
          })),
      });
    } catch (error: unknown) {
      logger.error('[LLM Health] Error building summary:', error);
      return res.status(500).json({
        success: false,
        error: 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/llm/health/errors
 * Get all error categories with descriptions
 */
router.get(
  '/health/errors',
  asyncHandler(async (req, res: Response) => {
    if (!ErrorMessagesEnum) {
      return serviceFallback(req, res, { categories: [] });
    }

    return res.json({
      success: true,
      categories: Object.entries(ErrorMessagesEnum).map(([key, value]) => ({
        code: key,
        ...value,
      })),
    });
  })
);

/**
 * GET /api/llm/health/status
 * Alias for /api/llm/health - used by frontend HealthMonitoringTab
 */
router.get(
  '/health/status',
  asyncHandler(async (_req, res: Response) => {
    try {
      // Get providers from database
      const providers = (await dbAll(`
                SELECT id, name, provider, api_key, endpoint, model_id, is_active, visibility 
                FROM llm_providers 
                WHERE is_active = 1
            `)) as Array<{
        id: string;
        name: string;
        provider: string;
        api_key: string | null;
        endpoint: string | null;
        model_id: string | null;
        is_active: number;
        visibility: string;
      }>;

      // Get basic metrics from llm_logs
      const metricsResult = (await dbAll(`
                SELECT
                    COUNT(*) as "totalRequests",
                    AVG(latency_ms) as "avgLatencyMs",
                    SUM(CASE WHEN error IS NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as uptime50
                FROM (
                    SELECT latency_ms, error FROM llm_logs 
                    ORDER BY created_at DESC LIMIT 50
                )
            `)) as Array<{ totalRequests: number; avgLatencyMs: number; uptime50: number }>;

      const metrics = metricsResult[0] || { totalRequests: 0, avgLatencyMs: 0, uptime50: 100 };

      return res.json({
        providers: providers.map((p) => ({
          name: p.name,
          type: p.provider,
          status: 'ACTIVE',
          visibility: p.visibility || 'internal',
        })),
        metrics: {
          uptime50: metrics.uptime50 || 100,
          avgLatencyMs: Math.round(metrics.avgLatencyMs || 0),
          totalRequests: metrics.totalRequests || 0,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('[LLMHealth] Status error:', error);
      return res.status(500).json({
        success: false,
        error: 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/llm/health/detailed
 * Detailed health info for LLMHealthPanel
 */
router.get(
  '/health/detailed',
  asyncHandler(async (_req, res: Response) => {
    try {
      // Get active providers with real sentinel health_status
      const providers = (await dbAll(`
                SELECT 
                    id, name, provider, is_active, visibility,
                    health_status,
                    api_key,
                    COALESCE(
                        (SELECT AVG(latency_ms) FROM llm_logs WHERE provider = lp.provider ORDER BY created_at DESC LIMIT 10),
                        0
                    ) as "avgLatency"
                FROM llm_providers lp
                WHERE is_active = 1
            `)) as Array<{
        id: string;
        name: string;
        provider: string;
        is_active: number;
        visibility: string;
        health_status: string | null;
        api_key: string | null;
        avgLatency: number;
      }>;

      // Only count providers that have a key configured (env or DB)
      const envKeys: Record<string, string | undefined> = {
        openrouter: process.env.OPENROUTER_API_KEY,
        openai: process.env.OPENAI_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
        google: process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY,
        gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY,
        deepseek: process.env.DEEPSEEK_API_KEY,
      };

      const configuredProviders = providers.filter(
        (p) => !!String(p.api_key || '').trim() || !!envKeys[p.provider]?.trim()
      );

      const healthyCount = configuredProviders.filter(
        (p) => p.health_status === 'healthy' || p.health_status === 'degraded'
      ).length;

      // If never tested (health_status null) but has key → treat as degraded (not dead)
      const neverTestedWithKey = configuredProviders.filter(
        (p) => p.health_status === null || p.health_status === undefined
      ).length;

      const effectiveHealthy = healthyCount + neverTestedWithKey;
      const total = configuredProviders.length;

      return res.json({
        success: true,
        providers: providers.map((p) => {
          const hasKey = !!String(p.api_key || '').trim() || !!envKeys[p.provider]?.trim();
          const hs = p.health_status;
          const status = !hasKey
            ? 'no_key'
            : hs === 'healthy' || hs === 'degraded'
              ? 'healthy'
              : hs === 'unhealthy'
                ? 'unhealthy'
                : 'unknown';
          return {
            id: p.id,
            name: p.name,
            provider: p.provider,
            status,
            latency: Math.round(p.avgLatency || 0),
            visibility: p.visibility || 'internal',
          };
        }),
        alerts: [],
        summary: {
          total,
          healthy: effectiveHealthy,
          degraded: 0,
          unhealthy: total - effectiveHealthy,
        },
      });
    } catch (error: unknown) {
      logger.error('[LLMHealth] Detailed error:', error);
      return res.status(500).json({
        success: false,
        error: 'Unknown error',
      });
    }
  })
);

export default router;
