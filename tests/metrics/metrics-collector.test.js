/**
 * Metrics Collection Tests
 * Tests for metrics and monitoring patterns
 * 
 * @module tests/metrics/metrics-collector.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Counter metric
const createCounter = (name, options = {}) => {
    let value = 0;
    const labels = options.labels || [];
    const labelValues = new Map();

    return {
        name,

        inc: (amount = 1, labelVals = {}) => {
            if (Object.keys(labelVals).length > 0) {
                const key = JSON.stringify(labelVals);
                labelValues.set(key, (labelValues.get(key) || 0) + amount);
            } else {
                value += amount;
            }
        },

        get: (labelVals = {}) => {
            if (Object.keys(labelVals).length > 0) {
                return labelValues.get(JSON.stringify(labelVals)) || 0;
            }
            return value;
        },

        reset: () => {
            value = 0;
            labelValues.clear();
        },

        getLabels: () => labels,

        collect: () => {
            const samples = [{ value, labels: {} }];

            for (const [key, val] of labelValues) {
                samples.push({ value: val, labels: JSON.parse(key) });
            }

            return { name, type: 'counter', samples };
        },
    };
};

// Gauge metric
const createGauge = (name, options = {}) => {
    let value = 0;
    const labels = options.labels || [];

    return {
        name,

        set: (val) => {
            value = val;
        },

        inc: (amount = 1) => {
            value += amount;
        },

        dec: (amount = 1) => {
            value -= amount;
        },

        get: () => value,

        setToCurrentTime: () => {
            value = Date.now() / 1000;
        },

        startTimer: () => {
            const start = process.hrtime();
            return () => {
                const [seconds, nanoseconds] = process.hrtime(start);
                value = seconds + nanoseconds / 1e9;
                return value;
            };
        },

        collect: () => ({
            name,
            type: 'gauge',
            samples: [{ value, labels: {} }],
        }),
    };
};

// Histogram metric
const createHistogram = (name, options = {}) => {
    const { buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] } = options;

    let sum = 0;
    let count = 0;
    const bucketCounts = new Map(buckets.map(b => [b, 0]));

    return {
        name,

        observe: (value) => {
            sum += value;
            count++;

            for (const bucket of buckets) {
                if (value <= bucket) {
                    bucketCounts.set(bucket, bucketCounts.get(bucket) + 1);
                }
            }
        },

        startTimer: () => {
            const start = Date.now();
            return () => {
                const duration = (Date.now() - start) / 1000;
                this.observe(duration);
                return duration;
            };
        },

        get: () => ({
            sum,
            count,
            buckets: Object.fromEntries(bucketCounts),
        }),

        reset: () => {
            sum = 0;
            count = 0;
            buckets.forEach(b => bucketCounts.set(b, 0));
        },

        collect: () => ({
            name,
            type: 'histogram',
            samples: {
                sum,
                count,
                buckets: Object.fromEntries(bucketCounts),
            },
        }),
    };
};

// Summary metric (percentiles)
const createSummary = (name, options = {}) => {
    const { percentiles = [0.5, 0.9, 0.99], maxAge = 600000 } = options;

    const values = [];
    let sum = 0;
    let count = 0;

    const calculatePercentile = (p) => {
        if (values.length === 0) return 0;

        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil(p * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    };

    return {
        name,

        observe: (value) => {
            values.push(value);
            sum += value;
            count++;
        },

        get: () => {
            const result = { sum, count, percentiles: {} };

            for (const p of percentiles) {
                result.percentiles[p] = calculatePercentile(p);
            }

            return result;
        },

        reset: () => {
            values.length = 0;
            sum = 0;
            count = 0;
        },

        collect: () => ({
            name,
            type: 'summary',
            samples: this.get(),
        }),
    };
};

// Metrics registry
const createMetricsRegistry = () => {
    const metrics = new Map();

    return {
        register: (metric) => {
            if (metrics.has(metric.name)) {
                throw new Error(`Metric already registered: ${metric.name}`);
            }
            metrics.set(metric.name, metric);
            return metric;
        },

        get: (name) => metrics.get(name),

        unregister: (name) => metrics.delete(name),

        clear: () => metrics.clear(),

        collect: () => {
            const result = [];
            for (const metric of metrics.values()) {
                result.push(metric.collect());
            }
            return result;
        },

        toPrometheus: () => {
            const lines = [];

            for (const metric of metrics.values()) {
                const data = metric.collect();
                lines.push(`# TYPE ${data.name} ${data.type}`);

                if (data.type === 'histogram') {
                    const { sum, count, buckets } = data.samples;
                    for (const [le, val] of Object.entries(buckets)) {
                        lines.push(`${data.name}_bucket{le="${le}"} ${val}`);
                    }
                    lines.push(`${data.name}_sum ${sum}`);
                    lines.push(`${data.name}_count ${count}`);
                } else {
                    for (const sample of data.samples) {
                        const labelStr = Object.entries(sample.labels)
                            .map(([k, v]) => `${k}="${v}"`)
                            .join(',');
                        const suffix = labelStr ? `{${labelStr}}` : '';
                        lines.push(`${data.name}${suffix} ${sample.value}`);
                    }
                }
            }

            return lines.join('\n');
        },
    };
};

describe('Counter Tests', () => {
    let counter;

    beforeEach(() => {
        counter = createCounter('requests_total', { labels: ['method', 'status'] });
    });

    it('should increment', () => {
        counter.inc();
        counter.inc(5);

        expect(counter.get()).toBe(6);
    });

    it('should support labels', () => {
        counter.inc(1, { method: 'GET', status: '200' });
        counter.inc(2, { method: 'POST', status: '201' });

        expect(counter.get({ method: 'GET', status: '200' })).toBe(1);
        expect(counter.get({ method: 'POST', status: '201' })).toBe(2);
    });

    it('should reset', () => {
        counter.inc(10);
        counter.reset();

        expect(counter.get()).toBe(0);
    });

    it('should collect', () => {
        counter.inc(5);
        const data = counter.collect();

        expect(data.name).toBe('requests_total');
        expect(data.type).toBe('counter');
    });
});

describe('Gauge Tests', () => {
    let gauge;

    beforeEach(() => {
        gauge = createGauge('temperature');
    });

    it('should set value', () => {
        gauge.set(42);

        expect(gauge.get()).toBe(42);
    });

    it('should increment and decrement', () => {
        gauge.set(10);
        gauge.inc(5);
        gauge.dec(3);

        expect(gauge.get()).toBe(12);
    });

    it('should time operations', () => {
        const end = gauge.startTimer();
        // Simulate work
        end();

        expect(gauge.get()).toBeGreaterThan(0);
    });
});

describe('Histogram Tests', () => {
    let histogram;

    beforeEach(() => {
        histogram = createHistogram('request_duration', {
            buckets: [0.1, 0.5, 1, 5],
        });
    });

    it('should observe values', () => {
        histogram.observe(0.3);
        histogram.observe(0.7);
        histogram.observe(2);

        const data = histogram.get();
        expect(data.count).toBe(3);
        expect(data.sum).toBeCloseTo(3);
    });

    it('should populate buckets', () => {
        histogram.observe(0.3);

        const data = histogram.get();
        expect(data.buckets[0.5]).toBe(1);
        expect(data.buckets[0.1]).toBe(0);
    });
});

describe('Summary Tests', () => {
    let summary;

    beforeEach(() => {
        summary = createSummary('response_time', {
            percentiles: [0.5, 0.9, 0.99],
        });
    });

    it('should calculate percentiles', () => {
        for (let i = 1; i <= 100; i++) {
            summary.observe(i);
        }

        const data = summary.get();
        expect(data.percentiles[0.5]).toBeCloseTo(50, 0);
        expect(data.percentiles[0.9]).toBeCloseTo(90, 0);
    });
});

describe('Metrics Registry Tests', () => {
    let registry;

    beforeEach(() => {
        registry = createMetricsRegistry();
    });

    it('should register metrics', () => {
        const counter = registry.register(createCounter('test_counter'));

        expect(registry.get('test_counter')).toBe(counter);
    });

    it('should throw on duplicate', () => {
        registry.register(createCounter('test'));

        expect(() => registry.register(createCounter('test'))).toThrow('already registered');
    });

    it('should collect all', () => {
        registry.register(createCounter('counter'));
        registry.register(createGauge('gauge'));

        const collected = registry.collect();

        expect(collected).toHaveLength(2);
    });

    it('should export prometheus format', () => {
        const counter = registry.register(createCounter('requests'));
        counter.inc(10);

        const output = registry.toPrometheus();

        expect(output).toContain('# TYPE requests counter');
        expect(output).toContain('requests 10');
    });
});
