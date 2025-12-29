/**
 * AI Metrics Service
 * Exposes Prometheus-compatible metrics for Grafana dashboards
 * 
 * Metrics:
 * - ai_requests_total (counter)
 * - ai_request_duration_seconds (histogram)
 * - ai_tokens_total (counter)
 * - ai_cost_usd_total (counter)
 * - ai_errors_total (counter)
 * - ai_cache_hits_total (counter)
 * - ai_circuit_breaker_state (gauge)
 */

const { aiLogger } = require('./logger');

// Metrics storage (in-memory, reset on restart)
const metrics = {
    counters: new Map(),
    gauges: new Map(),
    histograms: new Map()
};

// Histogram buckets for request duration (in seconds)
const DURATION_BUCKETS = [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60];

// Initialize histogram buckets
function initHistogram(name) {
    if (!metrics.histograms.has(name)) {
        metrics.histograms.set(name, {
            buckets: DURATION_BUCKETS.map(b => ({ le: b, count: 0 })),
            sum: 0,
            count: 0
        });
    }
}

/**
 * Increment a counter metric
 */
function incCounter(name, labels = {}, value = 1) {
    const key = formatKey(name, labels);
    const current = metrics.counters.get(key) || 0;
    metrics.counters.set(key, current + value);
}

/**
 * Set a gauge metric
 */
function setGauge(name, labels = {}, value) {
    const key = formatKey(name, labels);
    metrics.gauges.set(key, value);
}

/**
 * Record a histogram observation
 */
function observeHistogram(name, labels = {}, value) {
    const key = formatKey(name, labels);
    
    if (!metrics.histograms.has(key)) {
        metrics.histograms.set(key, {
            buckets: DURATION_BUCKETS.map(b => ({ le: b, count: 0 })),
            sum: 0,
            count: 0
        });
    }

    const histogram = metrics.histograms.get(key);
    histogram.sum += value;
    histogram.count += 1;

    // Update bucket counts
    for (const bucket of histogram.buckets) {
        if (value <= bucket.le) {
            bucket.count++;
        }
    }
}

/**
 * Format metric key with labels
 */
function formatKey(name, labels) {
    if (Object.keys(labels).length === 0) return name;
    const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
    return `${name}{${labelStr}}`;
}

/**
 * Record an AI request (convenience method)
 */
function recordRequest(params) {
    const { 
        capability, 
        model, 
        success, 
        durationSeconds, 
        tokens, 
        costUsd,
        cached = false 
    } = params;

    // Increment request counter
    incCounter('ai_requests_total', { capability, model, success: String(success) });

    // Record duration
    observeHistogram('ai_request_duration_seconds', { capability, model }, durationSeconds);

    // Record tokens
    if (tokens) {
        incCounter('ai_tokens_total', { model }, tokens);
    }

    // Record cost
    if (costUsd) {
        incCounter('ai_cost_usd_total', { model }, costUsd);
    }

    // Record cache hit
    if (cached) {
        incCounter('ai_cache_hits_total', { capability });
    }

    // Record error
    if (!success) {
        incCounter('ai_errors_total', { capability, model });
    }
}

/**
 * Update circuit breaker state gauge
 */
function updateCircuitState(providerId, state) {
    // 0 = CLOSED, 1 = HALF_OPEN, 2 = OPEN
    const stateValue = state === 'CLOSED' ? 0 : state === 'HALF_OPEN' ? 1 : 2;
    setGauge('ai_circuit_breaker_state', { provider: providerId }, stateValue);
}

/**
 * Export metrics in Prometheus format
 */
function exportPrometheus() {
    const lines = [];
    const timestamp = Date.now();

    // Export counters
    for (const [key, value] of metrics.counters) {
        const [name] = key.split('{');
        lines.push(`# TYPE ${name} counter`);
        lines.push(`${key} ${value}`);
    }

    // Export gauges
    for (const [key, value] of metrics.gauges) {
        const [name] = key.split('{');
        lines.push(`# TYPE ${name} gauge`);
        lines.push(`${key} ${value}`);
    }

    // Export histograms
    for (const [key, histogram] of metrics.histograms) {
        const [name, labelsStr] = key.split('{');
        const labels = labelsStr ? `{${labelsStr}` : '';
        
        lines.push(`# TYPE ${name} histogram`);
        
        // Bucket lines
        for (const bucket of histogram.buckets) {
            const bucketLabels = labels 
                ? labels.replace('}', `,le="${bucket.le}"}`)
                : `{le="${bucket.le}"}`;
            lines.push(`${name}_bucket${bucketLabels} ${bucket.count}`);
        }
        
        // +Inf bucket
        const infLabels = labels 
            ? labels.replace('}', ',le="+Inf"}')
            : '{le="+Inf"}';
        lines.push(`${name}_bucket${infLabels} ${histogram.count}`);
        
        // Sum and count
        lines.push(`${name}_sum${labels} ${histogram.sum}`);
        lines.push(`${name}_count${labels} ${histogram.count}`);
    }

    return lines.join('\n');
}

/**
 * Export metrics as JSON (for internal use)
 */
function exportJson() {
    return {
        counters: Object.fromEntries(metrics.counters),
        gauges: Object.fromEntries(metrics.gauges),
        histograms: Object.fromEntries(
            Array.from(metrics.histograms.entries()).map(([key, h]) => [
                key,
                { sum: h.sum, count: h.count, avg: h.count > 0 ? h.sum / h.count : 0 }
            ])
        ),
        timestamp: new Date().toISOString()
    };
}

/**
 * Reset all metrics (for testing)
 */
function reset() {
    metrics.counters.clear();
    metrics.gauges.clear();
    metrics.histograms.clear();
}

/**
 * Get summary statistics
 */
function getSummary() {
    const totalRequests = Array.from(metrics.counters.entries())
        .filter(([k]) => k.startsWith('ai_requests_total'))
        .reduce((sum, [_, v]) => sum + v, 0);

    const totalTokens = Array.from(metrics.counters.entries())
        .filter(([k]) => k.startsWith('ai_tokens_total'))
        .reduce((sum, [_, v]) => sum + v, 0);

    const totalCost = Array.from(metrics.counters.entries())
        .filter(([k]) => k.startsWith('ai_cost_usd_total'))
        .reduce((sum, [_, v]) => sum + v, 0);

    const totalErrors = Array.from(metrics.counters.entries())
        .filter(([k]) => k.startsWith('ai_errors_total'))
        .reduce((sum, [_, v]) => sum + v, 0);

    const cacheHits = Array.from(metrics.counters.entries())
        .filter(([k]) => k.startsWith('ai_cache_hits_total'))
        .reduce((sum, [_, v]) => sum + v, 0);

    return {
        requests: totalRequests,
        tokens: totalTokens,
        costUsd: Math.round(totalCost * 1000000) / 1000000,
        errors: totalErrors,
        errorRate: totalRequests > 0 ? (totalErrors / totalRequests * 100).toFixed(2) : 0,
        cacheHits,
        cacheHitRate: totalRequests > 0 ? (cacheHits / totalRequests * 100).toFixed(2) : 0
    };
}

module.exports = {
    incCounter,
    setGauge,
    observeHistogram,
    recordRequest,
    updateCircuitState,
    exportPrometheus,
    exportJson,
    reset,
    getSummary
};

