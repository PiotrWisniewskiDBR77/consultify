declare namespace _default {
    export { incCounter };
    export { setGauge };
    export { observeHistogram };
    export { recordRequest };
    export { updateCircuitState };
    export { exportPrometheus };
    export { exportJson };
    export { reset };
    export { getSummary };
}
export default _default;
/**
 * Increment a counter metric
 */
export function incCounter(name: any, labels?: {}, value?: number): void;
/**
 * Set a gauge metric
 */
export function setGauge(name: any, labels: {} | undefined, value: any): void;
/**
 * Record a histogram observation
 */
export function observeHistogram(name: any, labels: {} | undefined, value: any): void;
/**
 * Record an AI request (convenience method)
 */
export function recordRequest(params: any): void;
/**
 * Update circuit breaker state gauge
 */
export function updateCircuitState(providerId: any, state: any): void;
/**
 * Export metrics in Prometheus format
 */
export function exportPrometheus(): string;
/**
 * Export metrics as JSON (for internal use)
 */
export function exportJson(): {
    counters: any;
    gauges: any;
    histograms: any;
    timestamp: string;
};
/**
 * Reset all metrics (for testing)
 */
export function reset(): void;
/**
 * Get summary statistics
 */
export function getSummary(): {
    requests: number;
    tokens: number;
    costUsd: number;
    errors: number;
    errorRate: string | number;
    cacheHits: number;
    cacheHitRate: string | number;
};
//# sourceMappingURL=metrics.d.ts.map