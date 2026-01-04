/**
 * Metrics Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Prometheus metrics collection and export
 * Provides standard metrics for monitoring and observability
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// ==========================================
// METRICS REGISTRY
// ==========================================

const register = new Registry();

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register });

// ==========================================
// HTTP METRICS
// ==========================================

/**
 * HTTP requests counter
 * Labels: method, route, status_code
 */
export const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
});

/**
 * HTTP request duration histogram
 * Labels: method, route, status_code
 */
export const httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60], // seconds
    registers: [register],
});

// ==========================================
// DATABASE METRICS
// ==========================================

/**
 * Database query duration histogram
 * Labels: query_type, database_type
 */
export const dbQueryDurationSeconds = new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['query_type', 'database_type'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5], // seconds
    registers: [register],
});

/**
 * Database query count counter
 * Labels: query_type, database_type
 */
export const dbQueriesTotal = new Counter({
    name: 'db_queries_total',
    help: 'Total number of database queries',
    labelNames: ['query_type', 'database_type'],
    registers: [register],
});

/**
 * Database connection pool size gauge
 * Labels: database_type
 */
export const dbConnectionsActive = new Gauge({
    name: 'db_connections_active',
    help: 'Number of active database connections',
    labelNames: ['database_type'],
    registers: [register],
});

// ==========================================
// REDIS METRICS
// ==========================================

/**
 * Redis operations counter
 * Labels: operation_type
 */
export const redisOperationsTotal = new Counter({
    name: 'redis_operations_total',
    help: 'Total number of Redis operations',
    labelNames: ['operation_type'],
    registers: [register],
});

/**
 * Redis operation duration histogram
 * Labels: operation_type
 */
export const redisOperationDurationSeconds = new Histogram({
    name: 'redis_operation_duration_seconds',
    help: 'Duration of Redis operations in seconds',
    labelNames: ['operation_type'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5], // seconds
    registers: [register],
});

/**
 * Redis connection status gauge
 */
export const redisConnected = new Gauge({
    name: 'redis_connected',
    help: 'Redis connection status (1 = connected, 0 = disconnected)',
    registers: [register],
});

// ==========================================
// APPLICATION METRICS
// ==========================================

/**
 * Active connections gauge
 */
export const activeConnections = new Gauge({
    name: 'active_connections',
    help: 'Number of active connections',
    registers: [register],
});

/**
 * Memory usage gauge
 * Labels: type (heapUsed, heapTotal, external, rss)
 */
export const memoryUsageBytes = new Gauge({
    name: 'memory_usage_bytes',
    help: 'Memory usage in bytes',
    labelNames: ['type'],
    registers: [register],
});

/**
 * Error counter
 * Labels: error_type, component
 */
export const errorsTotal = new Counter({
    name: 'errors_total',
    help: 'Total number of errors',
    labelNames: ['error_type', 'component'],
    registers: [register],
});

// ==========================================
// BUSINESS METRICS (Optional)
// ==========================================

/**
 * Active users gauge
 */
export const activeUsers = new Gauge({
    name: 'active_users',
    help: 'Number of active users',
    registers: [register],
});

/**
 * API requests by organization counter
 * Labels: organization_id
 */
export const apiRequestsByOrg = new Counter({
    name: 'api_requests_by_org_total',
    help: 'Total API requests by organization',
    labelNames: ['organization_id'],
    registers: [register],
});

// ==========================================
// METRICS SERVICE CLASS
// ==========================================

class MetricsService {
    private register: Registry;

    constructor() {
        this.register = register;
    }

    /**
     * Get metrics in Prometheus format
     */
    async getMetrics(): Promise<string> {
        return this.register.metrics();
    }

    /**
     * Get metrics registry
     */
    getRegistry(): Registry {
        return this.register;
    }

    /**
     * Update memory metrics
     */
    updateMemoryMetrics(): void {
        const usage = process.memoryUsage();
        memoryUsageBytes.set({ type: 'heapUsed' }, usage.heapUsed);
        memoryUsageBytes.set({ type: 'heapTotal' }, usage.heapTotal);
        memoryUsageBytes.set({ type: 'external' }, usage.external);
        memoryUsageBytes.set({ type: 'rss' }, usage.rss);
    }

    /**
     * Update Redis connection status
     */
    updateRedisStatus(connected: boolean): void {
        redisConnected.set(connected ? 1 : 0);
    }

    /**
     * Record HTTP request
     */
    recordHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number): void {
        const status = String(statusCode);
        httpRequestsTotal.inc({ method, route, status_code: status });
        httpRequestDurationSeconds.observe({ method, route, status_code: status }, durationSeconds);
    }

    /**
     * Record database query
     */
    recordDbQuery(queryType: string, databaseType: string, durationSeconds: number): void {
        dbQueriesTotal.inc({ query_type: queryType, database_type: databaseType });
        dbQueryDurationSeconds.observe({ query_type: queryType, database_type: databaseType }, durationSeconds);
    }

    /**
     * Record Redis operation
     */
    recordRedisOperation(operationType: string, durationSeconds: number): void {
        redisOperationsTotal.inc({ operation_type: operationType });
        redisOperationDurationSeconds.observe({ operation_type: operationType }, durationSeconds);
    }

    /**
     * Record error
     */
    recordError(errorType: string, component: string): void {
        errorsTotal.inc({ error_type: errorType, component });
    }

    /**
     * Update active connections
     */
    updateActiveConnections(count: number): void {
        activeConnections.set(count);
    }

    /**
     * Update active users
     */
    updateActiveUsers(count: number): void {
        activeUsers.set(count);
    }

    /**
     * Record API request by organization
     */
    recordApiRequestByOrg(organizationId: string): void {
        apiRequestsByOrg.inc({ organization_id: organizationId });
    }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

let instance: MetricsService | null = null;

export function getMetricsService(): MetricsService {
    if (!instance) {
        instance = new MetricsService();
        // Start periodic memory updates (every 30 seconds)
        setInterval(() => {
            instance?.updateMemoryMetrics();
        }, 30000);
    }
    return instance;
}

// ==========================================
// EXPORTS
// ==========================================

export default MetricsService;
export { register };
