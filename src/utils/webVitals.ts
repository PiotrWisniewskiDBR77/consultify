/**
 * Web Vitals Tracking
 * Enterprise SaaS Architecture - Core Web Vitals Monitoring
 * 
 * Tracks LCP, FID, CLS, FCP, TTFB for performance monitoring.
 * Google-level quality standards.
 */

// ==========================================
// TYPES
// ==========================================

export type WebVitalName = 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP';

export interface WebVitalMetric {
    name: WebVitalName;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    delta: number;
    id: string;
    navigationType: string;
    entries: PerformanceEntry[];
}

export interface WebVitalsReport {
    timestamp: number;
    url: string;
    metrics: Partial<Record<WebVitalName, WebVitalMetric>>;
    deviceInfo: DeviceInfo;
    connectionInfo?: ConnectionInfo;
}

export interface DeviceInfo {
    userAgent: string;
    viewport: { width: number; height: number };
    devicePixelRatio: number;
    memory?: number;
    cpuCores?: number;
}

export interface ConnectionInfo {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
}

// ==========================================
// THRESHOLDS (Google Core Web Vitals)
// ==========================================

const THRESHOLDS: Record<WebVitalName, { good: number; poor: number }> = {
    LCP: { good: 2500, poor: 4000 },     // Largest Contentful Paint (ms)
    FID: { good: 100, poor: 300 },        // First Input Delay (ms)
    CLS: { good: 0.1, poor: 0.25 },       // Cumulative Layout Shift (score)
    FCP: { good: 1800, poor: 3000 },      // First Contentful Paint (ms)
    TTFB: { good: 800, poor: 1800 },      // Time to First Byte (ms)
    INP: { good: 200, poor: 500 },        // Interaction to Next Paint (ms)
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get rating based on metric value
 */
const getRating = (name: WebVitalName, value: number): 'good' | 'needs-improvement' | 'poor' => {
    const threshold = THRESHOLDS[name];
    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
};

/**
 * Generate unique metric ID
 */
const generateId = (): string => {
    return `v1-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Get device information
 */
const getDeviceInfo = (): DeviceInfo => {
    const nav = navigator as Navigator & {
        deviceMemory?: number;
        hardwareConcurrency?: number;
    };

    return {
        userAgent: navigator.userAgent,
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
        },
        devicePixelRatio: window.devicePixelRatio,
        memory: nav.deviceMemory,
        cpuCores: nav.hardwareConcurrency,
    };
};

/**
 * Get connection information
 */
const getConnectionInfo = (): ConnectionInfo | undefined => {
    const nav = navigator as Navigator & {
        connection?: {
            effectiveType?: string;
            downlink?: number;
            rtt?: number;
            saveData?: boolean;
        };
    };

    if (!nav.connection) return undefined;

    return {
        effectiveType: nav.connection.effectiveType,
        downlink: nav.connection.downlink,
        rtt: nav.connection.rtt,
        saveData: nav.connection.saveData,
    };
};

// ==========================================
// METRIC COLLECTION
// ==========================================

type MetricCallback = (metric: WebVitalMetric) => void;

let collectedMetrics: Partial<Record<WebVitalName, WebVitalMetric>> = {};
let callbacks: MetricCallback[] = [];

/**
 * Report a metric
 */
const reportMetric = (
    name: WebVitalName,
    value: number,
    entries: PerformanceEntry[] = []
): void => {
    const metric: WebVitalMetric = {
        name,
        value,
        rating: getRating(name, value),
        delta: value - (collectedMetrics[name]?.value || 0),
        id: generateId(),
        navigationType: performance.getEntriesByType('navigation')[0]?.entryType || 'navigate',
        entries,
    };

    collectedMetrics[name] = metric;
    callbacks.forEach(cb => cb(metric));
};

/**
 * Observe LCP (Largest Contentful Paint)
 */
const observeLCP = (): void => {
    if (!('PerformanceObserver' in window)) return;

    try {
        const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
            if (lastEntry) {
                reportMetric('LCP', lastEntry.startTime, entries);
            }
        });

        observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
        console.warn('[WebVitals] LCP observation not supported');
    }
};

/**
 * Observe FID (First Input Delay)
 */
const observeFID = (): void => {
    if (!('PerformanceObserver' in window)) return;

    try {
        const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const firstEntry = entries[0] as PerformanceEventTiming;
            if (firstEntry) {
                const value = firstEntry.processingStart - firstEntry.startTime;
                reportMetric('FID', value, entries);
            }
        });

        observer.observe({ type: 'first-input', buffered: true });
    } catch (e) {
        console.warn('[WebVitals] FID observation not supported');
    }
};

/**
 * Observe CLS (Cumulative Layout Shift)
 */
const observeCLS = (): void => {
    if (!('PerformanceObserver' in window)) return;

    let clsValue = 0;
    let clsEntries: PerformanceEntry[] = [];
    let sessionValue = 0;
    let sessionEntries: PerformanceEntry[] = [];

    try {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const layoutShift = entry as PerformanceEntry & {
                    value: number;
                    hadRecentInput: boolean;
                };

                // Only count layout shifts without recent user input
                if (!layoutShift.hadRecentInput) {
                    const firstSessionEntry = sessionEntries[0] as PerformanceEntry | undefined;
                    const lastSessionEntry = sessionEntries[sessionEntries.length - 1] as PerformanceEntry | undefined;

                    // If the entry occurred less than 1 second after the previous entry
                    // and less than 5 seconds after the first entry in the session
                    if (
                        sessionValue &&
                        lastSessionEntry &&
                        firstSessionEntry &&
                        entry.startTime - lastSessionEntry.startTime < 1000 &&
                        entry.startTime - firstSessionEntry.startTime < 5000
                    ) {
                        sessionValue += layoutShift.value;
                        sessionEntries.push(entry);
                    } else {
                        sessionValue = layoutShift.value;
                        sessionEntries = [entry];
                    }

                    if (sessionValue > clsValue) {
                        clsValue = sessionValue;
                        clsEntries = [...sessionEntries];
                        reportMetric('CLS', clsValue, clsEntries);
                    }
                }
            }
        });

        observer.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
        console.warn('[WebVitals] CLS observation not supported');
    }
};

/**
 * Observe FCP (First Contentful Paint)
 */
const observeFCP = (): void => {
    if (!('PerformanceObserver' in window)) return;

    try {
        const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const fcpEntry = entries.find(e => e.name === 'first-contentful-paint') as PerformanceEntry & { startTime: number };
            if (fcpEntry) {
                reportMetric('FCP', fcpEntry.startTime, entries);
                observer.disconnect();
            }
        });

        observer.observe({ type: 'paint', buffered: true });
    } catch (e) {
        console.warn('[WebVitals] FCP observation not supported');
    }
};

/**
 * Observe TTFB (Time to First Byte)
 */
const observeTTFB = (): void => {
    try {
        const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navEntry) {
            const ttfb = navEntry.responseStart - navEntry.requestStart;
            reportMetric('TTFB', ttfb, [navEntry]);
        }
    } catch (e) {
        console.warn('[WebVitals] TTFB measurement not supported');
    }
};

/**
 * Observe INP (Interaction to Next Paint)
 */
const observeINP = (): void => {
    if (!('PerformanceObserver' in window)) return;

    let maxINP = 0;

    try {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const eventEntry = entry as PerformanceEventTiming;
                const inp = eventEntry.duration;

                if (inp > maxINP) {
                    maxINP = inp;
                    reportMetric('INP', inp, [entry]);
                }
            }
        });

        observer.observe({ type: 'event', buffered: true, durationThreshold: 40 } as any);
    } catch (e) {
        console.warn('[WebVitals] INP observation not supported');
    }
};

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Subscribe to web vitals updates
 */
export const onWebVital = (callback: MetricCallback): (() => void) => {
    callbacks.push(callback);

    // Return unsubscribe function
    return () => {
        callbacks = callbacks.filter(cb => cb !== callback);
    };
};

/**
 * Initialize web vitals collection
 */
export const initWebVitals = (): void => {
    if (typeof window === 'undefined') return;

    observeLCP();
    observeFID();
    observeCLS();
    observeFCP();
    observeTTFB();
    observeINP();
};

/**
 * Get current metrics snapshot
 */
export const getMetrics = (): WebVitalsReport => {
    return {
        timestamp: Date.now(),
        url: window.location.href,
        metrics: { ...collectedMetrics },
        deviceInfo: getDeviceInfo(),
        connectionInfo: getConnectionInfo(),
    };
};

/**
 * Send metrics to analytics endpoint
 */
export const sendMetrics = async (endpoint?: string): Promise<void> => {
    const report = getMetrics();
    const url = endpoint || '/api/analytics/web-vitals';

    try {
        // Use sendBeacon for reliability on page unload
        if (navigator.sendBeacon) {
            navigator.sendBeacon(url, JSON.stringify(report));
        } else {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(report),
                keepalive: true,
            });
        }
    } catch (e) {
        console.warn('[WebVitals] Failed to send metrics:', e);
    }
};

/**
 * Reset collected metrics
 */
export const resetMetrics = (): void => {
    collectedMetrics = {};
};

/**
 * Check if all metrics meet "good" threshold
 */
export const areMetricsGood = (): boolean => {
    const required: WebVitalName[] = ['LCP', 'FID', 'CLS'];

    for (const name of required) {
        const metric = collectedMetrics[name];
        if (metric && metric.rating !== 'good') {
            return false;
        }
    }

    return true;
};

/**
 * Get performance score (0-100)
 */
export const getPerformanceScore = (): number => {
    const weights: Record<WebVitalName, number> = {
        LCP: 25,
        FID: 25,
        CLS: 25,
        FCP: 10,
        TTFB: 10,
        INP: 5,
    };

    let totalWeight = 0;
    let weightedScore = 0;

    for (const [name, metric] of Object.entries(collectedMetrics)) {
        const weight = weights[name as WebVitalName] || 0;
        const score = metric.rating === 'good' ? 100 : metric.rating === 'needs-improvement' ? 50 : 0;

        totalWeight += weight;
        weightedScore += score * weight;
    }

    return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
};

// ==========================================
// AUTO-INIT AND REPORTING
// ==========================================

// Auto-initialize on module load
if (typeof window !== 'undefined') {
    // Initialize after DOM is ready
    if (document.readyState === 'complete') {
        initWebVitals();
    } else {
        window.addEventListener('load', initWebVitals);
    }

    // Send metrics before page unload
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            sendMetrics();
        }
    });
}

export default {
    onWebVital,
    initWebVitals,
    getMetrics,
    sendMetrics,
    resetMetrics,
    areMetricsGood,
    getPerformanceScore,
};


