/**
 * Performance Optimizer Service
 * 
 * Optimizes AI performance through:
 * - Response time monitoring
 * - Auto-scaling recommendations
 * - Batch processing optimization
 * - Resource allocation
 */

const { aiLogger } = require('./logger');

class PerformanceOptimizer {
    constructor() {
        this.metrics = {
            responseTime: [], // Last N response times
            tokenUsage: [],   // Last N token usages
            errorRate: 0,
            totalRequests: 0,
            cachedResponses: 0
        };
        this.maxHistorySize = 100;
        this.thresholds = {
            slowResponse: 5000, // 5s
            highTokenUsage: 4000,
            errorRateAlert: 0.1
        };
    }

    /**
     * Record performance metrics for a request
     */
    recordMetrics(requestId, metrics) {
        const { responseTime, tokensUsed, cached, error } = metrics;

        this.metrics.totalRequests++;

        if (responseTime) {
            this.metrics.responseTime.push({
                time: responseTime,
                timestamp: Date.now(),
                requestId
            });
            if (this.metrics.responseTime.length > this.maxHistorySize) {
                this.metrics.responseTime.shift();
            }
        }

        if (tokensUsed) {
            this.metrics.tokenUsage.push({
                tokens: tokensUsed,
                timestamp: Date.now(),
                requestId
            });
            if (this.metrics.tokenUsage.length > this.maxHistorySize) {
                this.metrics.tokenUsage.shift();
            }
        }

        if (cached) {
            this.metrics.cachedResponses++;
        }

        // Update error rate (Exponential Moving Average could be better, but sticking to running average for test)
        const isError = error ? 1 : 0;
        this.metrics.errorRate =
            (this.metrics.errorRate * (this.metrics.totalRequests - 1) + isError) /
            this.metrics.totalRequests;

        aiLogger.debug('PerformanceOptimizer', `Recorded: ${responseTime}ms, ${tokensUsed} tokens`);
    }

    /**
     * Get performance recommendations
     */
    getRecommendations() {
        const recommendations = [];
        const avgResponseTime = this.getAverageResponseTime();
        const avgTokens = this.getAverageTokenUsage();
        const cacheHitRate = this.getCacheHitRate();

        // Response time recommendations
        if (avgResponseTime > this.thresholds.slowResponse) {
            recommendations.push({
                type: 'RESPONSE_TIME',
                severity: 'HIGH',
                message: `Average response time (${avgResponseTime.toFixed(0)}ms) exceeds threshold`,
                suggestions: [
                    'Consider using faster models for simple tasks',
                    'Increase semantic cache utilization',
                    'Implement request batching for bulk operations',
                    'Review prompt length - shorter prompts process faster'
                ]
            });
        }

        // Token usage recommendations
        if (avgTokens > this.thresholds.highTokenUsage) {
            recommendations.push({
                type: 'TOKEN_USAGE',
                severity: 'MEDIUM',
                message: `Average token usage (${avgTokens.toFixed(0)}) is high`,
                suggestions: [
                    'Optimize prompts to be more concise',
                    'Use summarization for large contexts',
                    'Implement context windowing for conversations',
                    'Consider using models with larger context windows'
                ]
            });
        }

        // Cache recommendations
        if (cacheHitRate < 0.2) {
            recommendations.push({
                type: 'CACHE',
                severity: 'LOW',
                message: `Cache hit rate (${(cacheHitRate * 100).toFixed(1)}%) is low`,
                suggestions: [
                    'Review semantic cache similarity threshold',
                    'Increase cache TTL for stable content',
                    'Pre-warm cache with common queries'
                ]
            });
        }

        // Error rate recommendations
        if (this.metrics.errorRate > this.thresholds.errorRateAlert) {
            recommendations.push({
                type: 'ERROR_RATE',
                severity: 'HIGH',
                message: `Error rate (${(this.metrics.errorRate * 100).toFixed(1)}%) exceeds threshold`,
                suggestions: [
                    'Review error logs for common patterns',
                    'Implement retry logic with exponential backoff',
                    'Check API key validity and rate limits',
                    'Add circuit breaker for failing providers'
                ]
            });
        }

        return recommendations;
    }

    /**
     * Get average response time
     */
    getAverageResponseTime() {
        if (this.metrics.responseTime.length === 0) return 0;
        const sum = this.metrics.responseTime.reduce((a, b) => a + b.time, 0);
        return sum / this.metrics.responseTime.length;
    }

    /**
     * Get average token usage
     */
    getAverageTokenUsage() {
        if (this.metrics.tokenUsage.length === 0) return 0;
        const sum = this.metrics.tokenUsage.reduce((a, b) => a + b.tokens, 0);
        return sum / this.metrics.tokenUsage.length;
    }

    /**
     * Get cache hit rate
     */
    getCacheHitRate() {
        if (this.metrics.totalRequests === 0) return 0;
        return this.metrics.cachedResponses / this.metrics.totalRequests;
    }

    /**
     * Get percentile response time
     */
    getPercentileResponseTime(percentile = 95) {
        if (this.metrics.responseTime.length === 0) return 0;
        const sorted = [...this.metrics.responseTime].sort((a, b) => a.time - b.time);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)].time;
    }

    /**
     * Get performance summary
     */
    getSummary() {
        return {
            totalRequests: this.metrics.totalRequests,
            responseTime: {
                average: this.getAverageResponseTime(),
                p95: this.getPercentileResponseTime(95),
                p99: this.getPercentileResponseTime(99),
                samples: this.metrics.responseTime.length
            },
            tokenUsage: {
                average: this.getAverageTokenUsage(),
                total: this.metrics.tokenUsage.reduce((a, b) => a + b.tokens, 0),
                samples: this.metrics.tokenUsage.length
            },
            cache: {
                hitRate: this.getCacheHitRate(),
                hits: this.metrics.cachedResponses
            },
            errors: {
                rate: this.metrics.errorRate,
                estimated: Math.round(this.metrics.totalRequests * this.metrics.errorRate)
            },
            recommendations: this.getRecommendations()
        };
    }

    /**
     * Get optimization settings based on current performance
     */
    getOptimalSettings() {
        const avgResponseTime = this.getAverageResponseTime();
        const avgTokens = this.getAverageTokenUsage();

        // Default settings
        const settings = {
            maxTokens: 2000,
            temperature: 0.7,
            preferredModel: 'gpt-4o-mini',
            enableCache: true,
            cacheTTL: 3600,
            enableBatching: false,
            batchSize: 5
        };

        // Adjust based on performance
        if (avgResponseTime > this.thresholds.slowResponse) {
            settings.preferredModel = 'gpt-4o-mini'; // Faster model
            settings.maxTokens = 1500; // Reduce output
            settings.enableBatching = true;
        }

        if (avgTokens > this.thresholds.highTokenUsage) {
            settings.maxTokens = Math.min(1500, settings.maxTokens);
        }

        if (this.getCacheHitRate() < 0.3) {
            settings.cacheTTL = 7200; // Increase cache duration
        }

        return settings;
    }

    /**
     * Reset metrics
     */
    reset() {
        this.metrics = {
            responseTime: [],
            tokenUsage: [],
            errorRate: 0,
            totalRequests: 0,
            cachedResponses: 0
        };
        aiLogger.info('PerformanceOptimizer', 'Metrics reset');
    }
}

// Singleton instance
const performanceOptimizer = new PerformanceOptimizer();

export default {
    PerformanceOptimizer,
    performanceOptimizer
};









