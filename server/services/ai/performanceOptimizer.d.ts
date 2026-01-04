declare namespace _default {
    export { PerformanceOptimizer };
    export { performanceOptimizer };
}
export default _default;
export class PerformanceOptimizer {
    metrics: {
        responseTime: never[];
        tokenUsage: never[];
        errorRate: number;
        totalRequests: number;
        cachedResponses: number;
    };
    maxHistorySize: number;
    thresholds: {
        slowResponse: number;
        highTokenUsage: number;
        errorRateAlert: number;
    };
    /**
     * Record performance metrics for a request
     */
    recordMetrics(requestId: any, metrics: any): void;
    /**
     * Get performance recommendations
     */
    getRecommendations(): {
        type: string;
        severity: string;
        message: string;
        suggestions: string[];
    }[];
    /**
     * Get average response time
     */
    getAverageResponseTime(): number;
    /**
     * Get average token usage
     */
    getAverageTokenUsage(): number;
    /**
     * Get cache hit rate
     */
    getCacheHitRate(): number;
    /**
     * Get percentile response time
     */
    getPercentileResponseTime(percentile?: number): any;
    /**
     * Get performance summary
     */
    getSummary(): {
        totalRequests: number;
        responseTime: {
            average: number;
            p95: any;
            p99: any;
            samples: number;
        };
        tokenUsage: {
            average: number;
            total: number;
            samples: number;
        };
        cache: {
            hitRate: number;
            hits: number;
        };
        errors: {
            rate: number;
            estimated: number;
        };
        recommendations: {
            type: string;
            severity: string;
            message: string;
            suggestions: string[];
        }[];
    };
    /**
     * Get optimization settings based on current performance
     */
    getOptimalSettings(): {
        maxTokens: number;
        temperature: number;
        preferredModel: string;
        enableCache: boolean;
        cacheTTL: number;
        enableBatching: boolean;
        batchSize: number;
    };
    /**
     * Reset metrics
     */
    reset(): void;
}
export const performanceOptimizer: PerformanceOptimizer;
//# sourceMappingURL=performanceOptimizer.d.ts.map