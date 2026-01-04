/**
 * System Health Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Monitors system health, database connectivity, AI services, and error rates.
 * Fully migrated from server/services/systemHealthService.js
 *
 * Features:
 * - Database health check
 * - AI services status
 * - Error rate monitoring
 * - System metrics (memory, CPU, uptime)
 */

import os from 'os';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface DatabaseStatus {
    connected: boolean;
    latencyMs: number;
}

interface AIServicesStatus {
    status: 'online' | 'no_keys' | 'unknown';
    providers: {
        openai: boolean;
        anthropic: boolean;
        groq: boolean;
    };
}

interface SystemHealth {
    status: string;
    timestamp: string;
    api: {
        status: string;
        responseTime: number;
        version: string;
    };
    database: {
        status: string;
        responseTime: number;
        type: string;
    };
    ai: AIServicesStatus;
    system: {
        nodeVersion: string;
        environment: string;
        uptime: {
            seconds: number;
            formatted: string;
        };
        memory: {
            used: number; // MB
            total: number; // MB
            percent: number;
        };
        loadAvg: number[];
        cpus: number;
    };
}

interface SystemHealthServiceDependencies {
    db?: IDatabase;
}

// ==========================================
// SYSTEM HEALTH SERVICE CLASS
// ==========================================

class SystemHealthServiceClass {
    private db: IDatabase;

    constructor(deps?: SystemHealthServiceDependencies) {
        this.db = deps?.db || getDatabase();
    }

    /**
     * Database helper: Get single row
     */
    private async dbGet<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
        return new Promise((resolve, reject) => {
            this.db.get<T>(sql, params, (err: Error | null, row: unknown) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    /**
     * Database helper: Get all rows
     */
    private async dbAll<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
        return new Promise((resolve, reject) => {
            this.db.all<T>(sql, params, (err: Error | null, rows: unknown) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    /**
     * Get detailed health status
     */
    async getDetailedHealth(): Promise<SystemHealth> {
        const [dbStatus, _errorRate, aiServicesStatus] = await Promise.all([
            this.checkDb(),
            this.getErrorRate(),
            this.checkAIServices(),
        ]);

        const memoryUsage = process.memoryUsage();
        const memoryTotal = os.totalmem();
        const memoryUsed = memoryUsage.heapUsed;
        const memoryPercent = (memoryUsed / memoryTotal) * 100;

        return {
            status: 'operational',
            timestamp: new Date().toISOString(),
            api: {
                status: 'healthy',
                responseTime: 0,
                version: process.env.npm_package_version || '2.5.0',
            },
            database: {
                status: dbStatus.connected ? 'healthy' : 'error',
                responseTime: dbStatus.latencyMs,
                type: 'SQLite',
            },
            ai: aiServicesStatus,
            system: {
                nodeVersion: process.version,
                environment: process.env.NODE_ENV || 'development',
                uptime: {
                    seconds: Math.floor(process.uptime()),
                    formatted: this.formatUptime(process.uptime()),
                },
                memory: {
                    used: Math.round(memoryUsed / 1024 / 1024), // MB
                    total: Math.round(memoryTotal / 1024 / 1024), // MB
                    percent: Math.round(memoryPercent * 100) / 100,
                },
                loadAvg: os.loadavg(),
                cpus: os.cpus().length,
            },
        };
    }

    /**
     * Check database connectivity
     */
    async checkDb(): Promise<DatabaseStatus> {
        const start = Date.now();
        try {
            await this.dbGet('SELECT 1');
            const duration = Date.now() - start;
            return {
                connected: true,
                latencyMs: duration,
            };
        } catch (err: unknown) {
            const duration = Date.now() - start;
            return {
                connected: false,
                latencyMs: duration,
            };
        }
    }

    /**
     * Check AI services status
     */
    async checkAIServices(): Promise<AIServicesStatus> {
        try {
            const rows = await this.dbAll<{ provider: string; api_key: string | null }>(
                `SELECT provider, api_key FROM llm_providers WHERE is_active = 1`,
            );

            const providers = {
                openai: false,
                anthropic: false,
                groq: false,
            };

            rows.forEach((row) => {
                if (row.provider === 'openai' && row.api_key) providers.openai = true;
                if (row.provider === 'anthropic' && row.api_key) providers.anthropic = true;
                if (row.provider === 'groq' && row.api_key) providers.groq = true;
            });

            const hasAnyProvider = Object.values(providers).some((v) => v);

            return {
                status: hasAnyProvider ? 'online' : 'no_keys',
                providers,
            };
        } catch (err: unknown) {
            logger.warn('[SystemHealth] Error checking AI services:', err);
            return {
                status: 'unknown',
                providers: { openai: false, anthropic: false, groq: false },
            };
        }
    }

    /**
     * Get error rate from recent logs
     */
    async getErrorRate(): Promise<number> {
        try {
            // Check error logs from last hour
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

            const errorCount = await this.dbGet<{ count: number }>(
                `SELECT COUNT(*) as count FROM error_logs WHERE created_at > ?`,
                [oneHourAgo],
            );

            const totalRequests = await this.dbGet<{ count: number }>(
                `SELECT COUNT(*) as count FROM request_logs WHERE created_at > ?`,
                [oneHourAgo],
            );

            if (!totalRequests || totalRequests.count === 0) {
                return 0;
            }

            return ((errorCount?.count || 0) / totalRequests.count) * 100;
        } catch (err: unknown) {
            logger.warn('[SystemHealth] Error calculating error rate:', err);
            return 0;
        }
    }

    /**
     * Format uptime in human-readable format
     */
    private formatUptime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    /**
     * Get system metrics
     */
    async getMetrics(): Promise<{
        database: { total_queries: number; queries_last_hour: number };
        api: { total_requests: number; requests_last_hour: number };
        ai: { total_requests: number; total_input_tokens: number; total_output_tokens: number; avg_latency: number };
        timestamp: string;
    }> {
        const [dbMetrics, apiMetrics, aiMetrics] = await Promise.all([
            this.getDatabaseMetrics(),
            this.getAPIMetrics(),
            this.getAIMetrics(),
        ]);

        return {
            database: dbMetrics,
            api: apiMetrics,
            ai: aiMetrics,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Get database metrics
     */
    async getDatabaseMetrics(): Promise<{ total_queries: number; queries_last_hour: number }> {
        try {
            const row = await this.dbGet<{ total_queries: number; queries_last_hour: number }>(
                `SELECT 
                    COUNT(*) as total_queries,
                    AVG(CASE WHEN timestamp > datetime('now', '-1 hour') THEN 1 ELSE 0 END) as queries_last_hour
                FROM audit_logs`,
            );

            return {
                total_queries: row?.total_queries || 0,
                queries_last_hour: row?.queries_last_hour || 0,
            };
        } catch (err: unknown) {
            logger.warn('[SystemHealth] Error getting database metrics:', err);
            return { total_queries: 0, queries_last_hour: 0 };
        }
    }

    /**
     * Get API metrics
     */
    async getAPIMetrics(): Promise<{ total_requests: number; requests_last_hour: number }> {
        try {
            const row = await this.dbGet<{ total_requests: number; requests_last_hour: number }>(
                `SELECT 
                    COUNT(*) as total_requests,
                    COUNT(CASE WHEN timestamp > datetime('now', '-1 hour') THEN 1 END) as requests_last_hour
                FROM audit_logs
                WHERE action_type LIKE 'api_%'`,
            );

            return {
                total_requests: row?.total_requests || 0,
                requests_last_hour: row?.requests_last_hour || 0,
            };
        } catch (err: unknown) {
            logger.warn('[SystemHealth] Error getting API metrics:', err);
            return { total_requests: 0, requests_last_hour: 0 };
        }
    }

    /**
     * Get AI metrics
     */
    async getAIMetrics(): Promise<{
        total_requests: number;
        total_input_tokens: number;
        total_output_tokens: number;
        avg_latency: number;
    }> {
        try {
            const row = await this.dbGet<{
                total_requests: number;
                total_input_tokens: number;
                total_output_tokens: number;
                avg_latency: number;
            }>(
                `SELECT 
                    COUNT(*) as total_requests,
                    SUM(input_tokens) as total_input_tokens,
                    SUM(output_tokens) as total_output_tokens,
                    AVG(latency_ms) as avg_latency
                FROM ai_logs
                WHERE created_at > datetime('now', '-24 hours')`,
            );

            return {
                total_requests: row?.total_requests || 0,
                total_input_tokens: row?.total_input_tokens || 0,
                total_output_tokens: row?.total_output_tokens || 0,
                avg_latency: Math.round(row?.avg_latency || 0),
            };
        } catch (err: unknown) {
            logger.warn('[SystemHealth] Error getting AI metrics:', err);
            return {
                total_requests: 0,
                total_input_tokens: 0,
                total_output_tokens: 0,
                avg_latency: 0,
            };
        }
    }

    /**
     * Get service status
     */
    async getServiceStatus(): Promise<{
        api: { status: string; responseTime: number };
        database: { status: string; latency: number };
        ai: { status: string; providers: { openai: boolean; anthropic: boolean; groq: boolean } };
        storage: { status: string };
    }> {
        const [dbStatus, aiStatus] = await Promise.all([this.checkDb(), this.checkAIServices()]);

        return {
            api: { status: 'up', responseTime: 0 },
            database: {
                status: dbStatus.connected ? 'up' : 'down',
                latency: dbStatus.latencyMs,
            },
            ai: {
                status: aiStatus.status === 'online' ? 'up' : 'down',
                providers: aiStatus.providers,
            },
            storage: { status: 'up' },
        };
    }
}

// ==========================================
// EXPORTS
// ==========================================

// Export singleton instance (for backward compatibility)
const systemHealthService = new SystemHealthServiceClass();

// Export class for testing
export { SystemHealthServiceClass };

// Export default instance
export default systemHealthService;

// Export individual methods for backward compatibility
export const getDetailedHealth = () => systemHealthService.getDetailedHealth();
export const checkDb = () => systemHealthService.checkDb();
export const checkAIServices = () => systemHealthService.checkAIServices();
export const getErrorRate = () => systemHealthService.getErrorRate();
export const getMetrics = () => systemHealthService.getMetrics();
export const getDatabaseMetrics = () => systemHealthService.getDatabaseMetrics();
export const getAPIMetrics = () => systemHealthService.getAPIMetrics();
export const getAIMetrics = () => systemHealthService.getAIMetrics();
export const getServiceStatus = () => systemHealthService.getServiceStatus();
