/**
 * LLM Health Routes
 * API endpoints for LLM provider health monitoring
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll } from '../utils/DbPromise.js';

const router = Router();

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
    const healthModule = await import('../../services/ai/llmHealthMonitor.js');
    const module = healthModule.default || healthModule;
    llmHealthMonitor = (module.llmHealthMonitor || module) as typeof llmHealthMonitor;
    HealthStatusEnum = (module.HealthStatus || module) as typeof HealthStatusEnum;
    ErrorMessagesEnum = (module.ErrorMessages || module) as typeof ErrorMessagesEnum;
} catch {
    console.warn('[LLMHealth Routes] llmHealthMonitor not available');
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
    asyncHandler(async (_req, res: Response) => {
        if (!llmHealthMonitor?.checkAllProviders || !llmHealthMonitor?.getSummary) {
            return res.status(503).json({
                success: false,
                error: 'LLM health monitor not available',
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

            res.json({
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
            console.error('[LLMHealth] Error:', error);
            return res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }),
);

/**
 * GET /api/llm/health/:providerId
 * Get health status of a specific provider
 */
router.get(
    '/health/:providerId',
    asyncHandler(async (req, res: Response) => {
        if (!llmHealthMonitor?.testProvider) {
            return res.status(503).json({
                success: false,
                error: 'LLM health monitor not available',
            });
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
                [providerId],
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

            res.json({
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
            console.error('[LLMHealth] Error:', error);
            return res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }),
);

/**
 * POST /api/llm/health/test
 * Test a specific provider connection
 */
router.post(
    '/health/test',
    asyncHandler(async (req, res: Response) => {
        if (!llmHealthMonitor?.testProvider || !HealthStatusEnum) {
            return res.status(503).json({
                success: false,
                error: 'LLM health monitor not available',
            });
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
                success: result.status === HealthStatusEnum.HEALTHY || result.status === HealthStatusEnum.DEGRADED,
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
            console.error('[LLMHealth] Test error:', error);
            return res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }),
);

/**
 * GET /api/llm/health/summary
 * Get summary of all provider health statuses
 */
router.get(
    '/health/summary',
    asyncHandler(async (_req, res: Response) => {
        if (!llmHealthMonitor?.getSummary || !llmHealthMonitor?.getAllCachedStatuses || !HealthStatusEnum) {
            return res.status(503).json({
                success: false,
                error: 'LLM health monitor not available',
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
            return res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }),
);

/**
 * GET /api/llm/health/errors
 * Get all error categories with descriptions
 */
router.get(
    '/health/errors',
    asyncHandler(async (_req, res: Response) => {
        if (!ErrorMessagesEnum) {
            return res.status(503).json({
                success: false,
                error: 'Error messages not available',
            });
        }

        return res.json({
            success: true,
            categories: Object.entries(ErrorMessagesEnum).map(([key, value]) => ({
                code: key,
                ...value,
            })),
        });
    }),
);

export default router;
