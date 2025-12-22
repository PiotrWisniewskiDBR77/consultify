/**
 * Frontend Metrics Utility
 * 
 * FAZA 5: Monitoring - Tracks Web Vitals and frontend performance metrics
 * 
 * Collects:
 * - Web Vitals (LCP, FID, CLS, FCP, TTFB)
 * - Component render times
 * - API call durations
 * - Error rates
 */

interface WebVitals {
    lcp?: number; // Largest Contentful Paint
    fid?: number; // First Input Delay
    cls?: number; // Cumulative Layout Shift
    fcp?: number; // First Contentful Paint
    ttfb?: number; // Time to First Byte
}

interface ComponentMetric {
    componentName: string;
    renderTime: number;
    timestamp: number;
}

interface ApiMetric {
    endpoint: string;
    method: string;
    duration: number;
    statusCode: number;
    timestamp: number;
}

class FrontendMetrics {
    private webVitals: WebVitals = {};
    private componentMetrics: ComponentMetric[] = [];
    private apiMetrics: ApiMetric[] = [];
    private errors: Error[] = [];

    /**
     * Initialize Web Vitals tracking
     */
    initWebVitals() {
        if (typeof window === 'undefined') return;

        // LCP - Largest Contentful Paint
        if ('PerformanceObserver' in window) {
            try {
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number };
                    if (lastEntry.renderTime) {
                        this.webVitals.lcp = lastEntry.renderTime;
                        this.reportMetric('lcp', lastEntry.renderTime);
                    }
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (e) {
                console.warn('[Metrics] LCP tracking not supported', e);
            }

            // FCP - First Contentful Paint
            try {
                const fcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const fcpEntry = entries.find(
                        (entry) => entry.name === 'first-contentful-paint'
                    );
                    if (fcpEntry) {
                        this.webVitals.fcp = fcpEntry.startTime;
                        this.reportMetric('fcp', fcpEntry.startTime);
                    }
                });
                fcpObserver.observe({ entryTypes: ['paint'] });
            } catch (e) {
                console.warn('[Metrics] FCP tracking not supported', e);
            }

            // CLS - Cumulative Layout Shift
            try {
                let clsValue = 0;
                const clsObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!(entry as any).hadRecentInput) {
                            clsValue += (entry as any).value;
                        }
                    }
                    this.webVitals.cls = clsValue;
                    this.reportMetric('cls', clsValue);
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
            } catch (e) {
                console.warn('[Metrics] CLS tracking not supported', e);
            }
        }

        // FID - First Input Delay (requires user interaction)
        if ('PerformanceObserver' in window) {
            try {
                const fidObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const fidEntry = entries[0] as PerformanceEventTiming;
                    if (fidEntry.processingStart && fidEntry.startTime) {
                        const fid = fidEntry.processingStart - fidEntry.startTime;
                        this.webVitals.fid = fid;
                        this.reportMetric('fid', fid);
                    }
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
            } catch (e) {
                console.warn('[Metrics] FID tracking not supported', e);
            }
        }

        // TTFB - Time to First Byte
        if (performance.timing) {
            const ttfb = performance.timing.responseStart - performance.timing.requestStart;
            this.webVitals.ttfb = ttfb;
            this.reportMetric('ttfb', ttfb);
        }
    }

    /**
     * Track component render time
     */
    trackComponentRender(componentName: string, renderTime: number) {
        this.componentMetrics.push({
            componentName,
            renderTime,
            timestamp: Date.now()
        });

        // Keep only last 100 entries
        if (this.componentMetrics.length > 100) {
            this.componentMetrics.shift();
        }

        // Log slow renders (>100ms)
        if (renderTime > 100) {
            console.warn(`[Metrics] Slow component render: ${componentName} took ${renderTime}ms`);
        }
    }

    /**
     * Track API call duration
     */
    trackApiCall(endpoint: string, method: string, duration: number, statusCode: number) {
        this.apiMetrics.push({
            endpoint,
            method,
            duration,
            statusCode,
            timestamp: Date.now()
        });

        // Keep only last 100 entries
        if (this.apiMetrics.length > 100) {
            this.apiMetrics.shift();
        }

        // Log slow API calls (>1s) or errors
        if (duration > 1000 || statusCode >= 400) {
            console.warn(`[Metrics] ${method} ${endpoint} took ${duration}ms (status: ${statusCode})`);
        }
    }

    /**
     * Track error
     */
    trackError(error: Error, context?: Record<string, any>) {
        this.errors.push(error);
        
        // Keep only last 50 errors
        if (this.errors.length > 50) {
            this.errors.shift();
        }

        console.error('[Metrics] Error tracked:', error.message, context);
    }

    /**
     * Report metric to backend (optional)
     */
    private async reportMetric(name: string, value: number) {
        // In production, you might want to send this to your backend
        if (process.env.NODE_ENV === 'production') {
            try {
                // await fetch('/api/metrics/frontend', {
                //     method: 'POST',
                //     headers: { 'Content-Type': 'application/json' },
                //     body: JSON.stringify({ name, value, timestamp: Date.now() })
                // });
            } catch (e) {
                // Silently fail - metrics shouldn't break the app
            }
        }
    }

    /**
     * Get metrics summary
     */
    getSummary() {
        const avgComponentRender = this.componentMetrics.length > 0
            ? this.componentMetrics.reduce((sum, m) => sum + m.renderTime, 0) / this.componentMetrics.length
            : 0;

        const avgApiDuration = this.apiMetrics.length > 0
            ? this.apiMetrics.reduce((sum, m) => sum + m.duration, 0) / this.apiMetrics.length
            : 0;

        const errorRate = this.apiMetrics.length > 0
            ? (this.apiMetrics.filter(m => m.statusCode >= 400).length / this.apiMetrics.length) * 100
            : 0;

        return {
            webVitals: this.webVitals,
            avgComponentRender: Math.round(avgComponentRender),
            avgApiDuration: Math.round(avgApiDuration),
            errorRate: Math.round(errorRate * 100) / 100,
            totalComponentRenders: this.componentMetrics.length,
            totalApiCalls: this.apiMetrics.length,
            totalErrors: this.errors.length
        };
    }

    /**
     * Get slowest components
     */
    getSlowestComponents(limit = 10) {
        return this.componentMetrics
            .sort((a, b) => b.renderTime - a.renderTime)
            .slice(0, limit)
            .map(m => ({
                component: m.componentName,
                renderTime: m.renderTime
            }));
    }

    /**
     * Get slowest API calls
     */
    getSlowestApiCalls(limit = 10) {
        return this.apiMetrics
            .sort((a, b) => b.duration - a.duration)
            .slice(0, limit)
            .map(m => ({
                endpoint: `${m.method} ${m.endpoint}`,
                duration: m.duration,
                statusCode: m.statusCode
            }));
    }
}

// Export singleton instance
export const frontendMetrics = new FrontendMetrics();

// Auto-initialize Web Vitals if in browser
if (typeof window !== 'undefined') {
    frontendMetrics.initWebVitals();
}


