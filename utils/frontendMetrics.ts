// Frontend Metrics Service
// Tracks frontend performance metrics and sends them to backend

interface MetricData {
    name: string;
    value: number;
    timestamp: number;
    context?: Record<string, unknown>;
}

export const frontendMetrics = {
    /**
     * Track a performance metric
     */
    track: (name: string, value: number, context?: Record<string, unknown>): void => {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[Metrics] ${name}:`, value, context);
            return;
        }

        // In production, send to backend
        const metric: MetricData = {
            name,
            value,
            timestamp: Date.now(),
            context
        };

        // Send asynchronously without blocking
        fetch('/api/metrics/frontend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metric)
        }).catch(err => {
            // Silently fail - don't want metrics to cause errors
            console.error('[Metrics] Failed to send metric:', err);
        });
    },

    /**
     * Track page load time
     */
    trackPageLoad: (pageName: string, loadTime: number): void => {
        frontendMetrics.track('page_load', loadTime, { page: pageName });
    },

    /**
     * Track API call duration
     */
    trackApiCall: (endpoint: string, duration: number, success: boolean): void => {
        frontendMetrics.track('api_call', duration, { endpoint, success });
    }
};


