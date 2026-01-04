declare namespace _default {
    export { performanceMetricsMiddleware };
    export { getMetricsSummary };
    export { getMemoryMetrics };
    export { clearMetrics };
    export { clearMetrics as resetMetrics };
    export { metricsStore };
    export { _setDependencies };
}
export default _default;
/**
 * Performance metrics middleware
 * Tracks response time, DB queries, and memory usage
 *
 * DB query tracking is done via queryHelpers wrapper
 */
declare function performanceMetricsMiddleware(req: any, res: any, next: any): void;
/**
 * Get performance metrics summary
 * @param {number} windowMinutes - Time window in minutes (default: 60)
 * @returns {Object} Metrics summary
 */
declare function getMetricsSummary(windowMinutes?: number): Object;
/**
 * Get current memory usage
 * @returns {Object} Memory metrics
 */
declare function getMemoryMetrics(): Object;
/**
 * Clear metrics store (useful for testing or periodic cleanup)
 */
declare function clearMetrics(): void;
declare namespace metricsStore {
    let requests: never[];
    let dbQueries: never[];
    let errors: never[];
}
declare function _setDependencies(deps: any): void;
//# sourceMappingURL=performanceMetrics.d.ts.map