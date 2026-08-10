/**
 * Metrics Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Prometheus metrics collection and export
 * Provides standard metrics for monitoring and observability
 */

import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

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
 * Buckets include percentiles: 0.01, 0.05, 0.1, 0.5, 0.9, 0.95, 0.99
 */
export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1, 2, 5, 10, 30, 60], // seconds with percentile buckets
  registers: [register],
});

// ==========================================
// DATABASE METRICS
// ==========================================

/**
 * Database query duration histogram
 * Labels: query_type, database_type
 * Buckets include percentiles: 0.01, 0.05, 0.1, 0.5, 0.9, 0.95, 0.99
 */
export const dbQueryDurationSeconds = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'database_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1, 2, 5], // seconds with percentile buckets
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
 * Buckets include percentiles: 0.01, 0.05, 0.1, 0.5, 0.9, 0.95, 0.99
 */
export const redisOperationDurationSeconds = new Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Duration of Redis operations in seconds',
  labelNames: ['operation_type'],
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1], // seconds with percentile buckets
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

/**
 * KPI-E007 — Legacy Archive read-only adapter hit counter.
 * Labels: source_table (kpis | kpi_definitions | v8_kpi_definitions | tp_kpi_definitions)
 *
 * Design: docs/product/results-vnext/KPI_E007_DESIGN.md §9. Minimal
 * monitoring scope — one counter, incremented once per successful response
 * in `kpiLegacyArchive.routes.ts`. No dashboard, no alerting rule.
 */
export const resultsVnextLegacyArchiveHitsTotal = new Counter({
  name: 'results_vnext_legacy_archive_hits_total',
  help: 'Requests served by the KPI legacy archive read-only adapter, by source table',
  labelNames: ['source_table'],
  registers: [register],
});

/**
 * ROI-E008 — Legacy Archive read-only adapter hit counter.
 * Labels: source_table (analysis_financials | digitization_analyses |
 *   initiative_benefits | roi_assumptions | roi_realized_values |
 *   benefits_register | v8_roi_realization_entries)
 *
 * Design: docs/product/results-vnext/ROI_E008_DESIGN.md §3/B4. Minimal
 * monitoring scope — one counter, incremented once per successful response
 * in `roiLegacyArchive.routes.ts`. No dashboard, no alerting rule (mirrors
 * KPI-E007's own minimal-monitoring precedent above).
 */
export const resultsVnextRoiLegacyArchiveHitsTotal = new Counter({
  name: 'results_vnext_roi_legacy_archive_hits_total',
  help: 'Requests served by the ROI legacy archive read-only adapter, by source table',
  labelNames: ['source_table'],
  registers: [register],
});

/**
 * OKR-E008 Half C — Legacy Archive minimal monitoring (design §5.6). Same
 * shape/scope as the KPI/ROI counters above — one counter, incremented once
 * per successful response in `okrLegacyArchive.routes.ts`. No dashboard, no
 * alerting rule.
 */
export const resultsVnextOkrLegacyArchiveHitsTotal = new Counter({
  name: 'results_vnext_okr_legacy_archive_hits_total',
  help: 'Requests served by the OKR legacy archive read-only adapter, by source table',
  labelNames: ['source_table'],
  registers: [register],
});

// ==========================================
// THROUGHPUT METRICS
// ==========================================

/**
 * HTTP requests per second gauge
 * Calculated over a rolling window
 */
export const httpRequestsPerSecond = new Gauge({
  name: 'http_requests_per_second',
  help: 'HTTP requests per second (calculated over rolling window)',
  registers: [register],
});

/**
 * Database queries per second gauge
 */
export const dbQueriesPerSecond = new Gauge({
  name: 'db_queries_per_second',
  help: 'Database queries per second (calculated over rolling window)',
  registers: [register],
});

/**
 * LLM requests per second gauge
 */
export const llmRequestsPerSecond = new Gauge({
  name: 'llm_requests_per_second',
  help: 'LLM API requests per second (calculated over rolling window)',
  registers: [register],
});

// ==========================================
// LLM METRICS
// ==========================================

/**
 * LLM API call duration histogram
 * Labels: provider, model
 * Buckets include percentiles: 0.01, 0.05, 0.1, 0.5, 0.9, 0.95, 0.99
 */
export const llmCallDurationSeconds = new Histogram({
  name: 'llm_call_duration_seconds',
  help: 'Duration of LLM API calls in seconds',
  labelNames: ['provider', 'model'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120], // seconds with percentile buckets
  registers: [register],
});

/**
 * LLM API call counter
 * Labels: provider, model, status
 */
export const llmCallsTotal = new Counter({
  name: 'llm_calls_total',
  help: 'Total number of LLM API calls',
  labelNames: ['provider', 'model', 'status'],
  registers: [register],
});

// ==========================================
// METRICS SERVICE CLASS
// ==========================================

class MetricsService {
  private register: Registry;
  private throughputWindow: {
    http: Array<{ timestamp: number; count: number }>;
    db: Array<{ timestamp: number; count: number }>;
    llm: Array<{ timestamp: number; count: number }>;
  };
  private throughputWindowSize: number;
  private throughputUpdateInterval: NodeJS.Timeout | null = null;
  private lastCounts: {
    http: number;
    db: number;
    llm: number;
  };

  constructor() {
    this.register = register;
    this.throughputWindow = {
      http: [],
      db: [],
      llm: [],
    };
    this.throughputWindowSize = 60; // 60 seconds window
    this.lastCounts = {
      http: 0,
      db: 0,
      llm: 0,
    };
    this.startThroughputCalculation();
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
    redisConnected.set({}, connected ? 1 : 0);
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number
  ): void {
    const status = String(statusCode);
    httpRequestsTotal.inc({ method, route, status_code: status });
    httpRequestDurationSeconds.observe({ method, route, status_code: status }, durationSeconds);
  }

  /**
   * Record database query
   */
  recordDbQuery(queryType: string, databaseType: string, durationSeconds: number): void {
    dbQueriesTotal.inc({ query_type: queryType, database_type: databaseType });
    dbQueryDurationSeconds.observe(
      { query_type: queryType, database_type: databaseType },
      durationSeconds
    );
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
    activeConnections.set({}, count);
  }

  /**
   * Update active users
   */
  updateActiveUsers(count: number): void {
    activeUsers.set({}, count);
  }

  /**
   * Record API request by organization
   */
  recordApiRequestByOrg(organizationId: string): void {
    apiRequestsByOrg.inc({ organization_id: organizationId });
  }

  /**
   * Record LLM API call
   */
  recordLlmCall(provider: string, model: string, durationSeconds: number, success: boolean): void {
    const status = success ? 'success' : 'error';
    llmCallsTotal.inc({ provider, model, status });
    llmCallDurationSeconds.observe({ provider, model }, durationSeconds);
  }

  /**
   * Get percentile values from histogram
   * Note: Prometheus histograms automatically calculate percentiles
   * This method extracts them from the metrics
   */
  async getPercentiles(
    histogramName: string,
    labels?: Record<string, string>
  ): Promise<{
    p50: number;
    p95: number;
    p99: number;
  }> {
    const metrics = await this.register.getSingleMetricAsString(histogramName);
    // Prometheus histograms expose percentiles as separate metrics
    // Format: metric_name_bucket{le="value"} or metric_name{quantile="0.95"}
    // For now, return 0s - actual percentile calculation requires querying Prometheus
    // In production, use Prometheus query: histogram_quantile(0.95, rate(metric_name_bucket[5m]))
    return {
      p50: 0,
      p95: 0,
      p99: 0,
    };
  }

  /**
   * Start throughput calculation
   * Calculates requests per second over rolling window
   */
  private startThroughputCalculation(): void {
    // Update throughput every second
    this.throughputUpdateInterval = setInterval(() => {
      this.calculateThroughput();
    }, 1000);
    // Do not keep the Node.js event loop alive (important for tests/CLI runs).
    this.throughputUpdateInterval.unref?.();
  }

  /**
   * Calculate throughput over rolling window
   * Uses counter deltas to calculate requests per second
   */
  private calculateThroughput(): void {
    const now = Date.now();
    const oneSecondAgo = now - 1000;

    // Get current counter values (using get() method if available, otherwise approximate)
    // Note: Prometheus counters are cumulative, so we track deltas
    const currentHttpCount = this.getCounterValue(httpRequestsTotal);
    const currentDbCount = this.getCounterValue(dbQueriesTotal);
    const currentLlmCount = this.getCounterValue(llmCallsTotal);

    // Calculate delta from last second
    const httpDelta = currentHttpCount - this.lastCounts.http;
    const dbDelta = currentDbCount - this.lastCounts.db;
    const llmDelta = currentLlmCount - this.lastCounts.llm;

    // Update last counts
    this.lastCounts.http = currentHttpCount;
    this.lastCounts.db = currentDbCount;
    this.lastCounts.llm = currentLlmCount;

    // Add to rolling window
    this.throughputWindow.http.push({ timestamp: now, count: httpDelta });
    this.throughputWindow.db.push({ timestamp: now, count: dbDelta });
    this.throughputWindow.llm.push({ timestamp: now, count: llmDelta });

    // Remove old entries (older than window size)
    this.throughputWindow.http = this.throughputWindow.http.filter(
      (entry) => now - entry.timestamp < this.throughputWindowSize * 1000
    );
    this.throughputWindow.db = this.throughputWindow.db.filter(
      (entry) => now - entry.timestamp < this.throughputWindowSize * 1000
    );
    this.throughputWindow.llm = this.throughputWindow.llm.filter(
      (entry) => now - entry.timestamp < this.throughputWindowSize * 1000
    );

    // Calculate average throughput over window
    if (this.throughputWindow.http.length > 0) {
      const httpSum = this.throughputWindow.http.reduce((sum, entry) => sum + entry.count, 0);
      const httpThroughput = httpSum / this.throughputWindow.http.length;
      httpRequestsPerSecond.set({}, Math.max(0, httpThroughput));
    }

    if (this.throughputWindow.db.length > 0) {
      const dbSum = this.throughputWindow.db.reduce((sum, entry) => sum + entry.count, 0);
      const dbThroughput = dbSum / this.throughputWindow.db.length;
      dbQueriesPerSecond.set({}, Math.max(0, dbThroughput));
    }

    if (this.throughputWindow.llm.length > 0) {
      const llmSum = this.throughputWindow.llm.reduce((sum, entry) => sum + entry.count, 0);
      const llmThroughput = llmSum / this.throughputWindow.llm.length;
      llmRequestsPerSecond.set({}, Math.max(0, llmThroughput));
    }
  }

  /**
   * Get counter value (helper method)
   * In production, Prometheus counters expose their values via metrics endpoint
   */
  private getCounterValue(counter: Counter): number {
    // Simplified: return 0 for now
    // In production, this would query the counter's current value
    // Prometheus counters are cumulative, so we track them separately
    return 0;
  }

  /**
   * Stop throughput calculation
   */
  stopThroughputCalculation(): void {
    if (this.throughputUpdateInterval) {
      clearInterval(this.throughputUpdateInterval);
      this.throughputUpdateInterval = null;
    }
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
    const memoryInterval = setInterval(() => {
      instance?.updateMemoryMetrics();
    }, 30000);
    // Do not keep the Node.js event loop alive (important for tests/CLI runs).
    memoryInterval.unref?.();
  }
  return instance;
}

// ==========================================
// EXPORTS
// ==========================================

export default MetricsService;
export { register };
