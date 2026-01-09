/**
 * Metrics Persistence Service Unit Tests
 * 
 * Tests for metrics storage and retrieval.
 * 
 * @module tests/unit/backend/metricsPersistenceService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create metrics persistence service implementation
const createMetricsPersistenceService = () => {
    const metrics = [];
    const aggregations = new Map();

    // Internal helper: store metric
    const storeInternal = (data) => {
        const metric = {
            id: `metric-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: data.name,
            value: data.value,
            unit: data.unit || 'count',
            tags: data.tags || {},
            timestamp: data.timestamp || new Date().toISOString()
        };

        metrics.push(metric);
        return metric;
    };

    // Internal helper: query metrics
    const queryInternal = (filters = {}) => {
        let result = [...metrics];

        if (filters.name) {
            result = result.filter(m => m.name === filters.name);
        }
        if (filters.from) {
            result = result.filter(m => new Date(m.timestamp) >= new Date(filters.from));
        }
        if (filters.to) {
            result = result.filter(m => new Date(m.timestamp) <= new Date(filters.to));
        }
        if (filters.tags) {
            for (const [key, value] of Object.entries(filters.tags)) {
                result = result.filter(m => m.tags[key] === value);
            }
        }

        return result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    };

    return {
        // Store metric
        store: async (data) => {
            return storeInternal(data);
        },

        // Store batch of metrics
        storeBatch: async (metricsList) => {
            const stored = [];
            for (const data of metricsList) {
                const metric = storeInternal(data);
                stored.push(metric);
            }
            return stored;
        },

        // Query metrics
        query: async (filters = {}) => {
            return queryInternal(filters);
        },

        // Aggregate metrics
        aggregate: async (name, aggregation, filters = {}) => {
            const data = queryInternal({ ...filters, name }).map(m => m.value);

            if (data.length === 0) return null;

            switch (aggregation) {
                case 'sum': return data.reduce((a, b) => a + b, 0);
                case 'avg': return data.reduce((a, b) => a + b, 0) / data.length;
                case 'min': return Math.min(...data);
                case 'max': return Math.max(...data);
                case 'count': return data.length;
                case 'last': return data[data.length - 1];
                default: throw new Error('Unknown aggregation');
            }
        },

        // Get time series
        getTimeSeries: async (name, interval, filters = {}) => {
            const data = queryInternal({ ...filters, name });
            const buckets = new Map();

            for (const metric of data) {
                const date = new Date(metric.timestamp);
                let bucketKey;

                switch (interval) {
                    case 'minute':
                        bucketKey = `${date.toISOString().slice(0, 16)}:00.000Z`;
                        break;
                    case 'hour':
                        bucketKey = `${date.toISOString().slice(0, 13)}:00:00.000Z`;
                        break;
                    case 'day':
                        bucketKey = `${date.toISOString().slice(0, 10)}T00:00:00.000Z`;
                        break;
                    default:
                        bucketKey = metric.timestamp;
                }

                if (!buckets.has(bucketKey)) {
                    buckets.set(bucketKey, { count: 0, sum: 0 });
                }

                const bucket = buckets.get(bucketKey);
                bucket.count++;
                bucket.sum += metric.value;
            }

            return Array.from(buckets.entries())
                .map(([timestamp, data]) => ({
                    timestamp,
                    avg: data.sum / data.count,
                    sum: data.sum,
                    count: data.count
                }))
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        },

        // Calculate percentile
        percentile: async (name, p, filters = {}) => {
            const data = queryInternal({ ...filters, name })
                .map(m => m.value)
                .sort((a, b) => a - b);

            if (data.length === 0) return null;

            const index = Math.ceil((p / 100) * data.length) - 1;
            return data[Math.max(0, index)];
        },

        // Delete old metrics
        deleteOlderThan: async (date) => {
            const cutoff = new Date(date);
            const initialLength = metrics.length;

            for (let i = metrics.length - 1; i >= 0; i--) {
                if (new Date(metrics[i].timestamp) < cutoff) {
                    metrics.splice(i, 1);
                }
            }

            return { deleted: initialLength - metrics.length };
        },

        // Get metric names
        getMetricNames: async () => {
            const names = new Set(metrics.map(m => m.name));
            return Array.from(names);
        },

        // Clear for testing
        clear: () => {
            metrics.length = 0;
            aggregations.clear();
        }
    };
};

describe('MetricsPersistenceService', () => {
    let metricsService;

    beforeEach(() => {
        metricsService = createMetricsPersistenceService();
    });

    describe('Storing Metrics', () => {
        it('should store a metric', async () => {
            const metric = await metricsService.store({
                name: 'api.requests',
                value: 1,
                tags: { endpoint: '/api/users' }
            });

            expect(metric.id).toBeDefined();
            expect(metric.name).toBe('api.requests');
            expect(metric.value).toBe(1);
        });

        it('should store batch of metrics', async () => {
            const stored = await metricsService.storeBatch([
                { name: 'cpu', value: 45 },
                { name: 'memory', value: 60 },
                { name: 'disk', value: 75 }
            ]);

            expect(stored).toHaveLength(3);
        });
    });

    describe('Querying', () => {
        beforeEach(async () => {
            await metricsService.store({ name: 'api.requests', value: 100, tags: { method: 'GET' } });
            await metricsService.store({ name: 'api.requests', value: 150, tags: { method: 'POST' } });
            await metricsService.store({ name: 'api.latency', value: 50, tags: { method: 'GET' } });
        });

        it('should query by name', async () => {
            const result = await metricsService.query({ name: 'api.requests' });
            expect(result).toHaveLength(2);
        });

        it('should query by tags', async () => {
            const result = await metricsService.query({ tags: { method: 'GET' } });
            expect(result).toHaveLength(2);
        });
    });

    describe('Aggregation', () => {
        beforeEach(async () => {
            await metricsService.store({ name: 'response_time', value: 100 });
            await metricsService.store({ name: 'response_time', value: 200 });
            await metricsService.store({ name: 'response_time', value: 150 });
            await metricsService.store({ name: 'response_time', value: 50 });
        });

        it('should calculate sum', async () => {
            const result = await metricsService.aggregate('response_time', 'sum');
            expect(result).toBe(500);
        });

        it('should calculate average', async () => {
            const result = await metricsService.aggregate('response_time', 'avg');
            expect(result).toBe(125);
        });

        it('should calculate min', async () => {
            const result = await metricsService.aggregate('response_time', 'min');
            expect(result).toBe(50);
        });

        it('should calculate max', async () => {
            const result = await metricsService.aggregate('response_time', 'max');
            expect(result).toBe(200);
        });

        it('should calculate count', async () => {
            const result = await metricsService.aggregate('response_time', 'count');
            expect(result).toBe(4);
        });
    });

    describe('Time Series', () => {
        it('should generate time series by day', async () => {
            await metricsService.store({ name: 'visits', value: 100, timestamp: '2026-01-07T10:00:00Z' });
            await metricsService.store({ name: 'visits', value: 150, timestamp: '2026-01-07T15:00:00Z' });
            await metricsService.store({ name: 'visits', value: 200, timestamp: '2026-01-08T10:00:00Z' });

            const series = await metricsService.getTimeSeries('visits', 'day');

            expect(series).toHaveLength(2);
            expect(series[0].sum).toBe(250);
            expect(series[1].sum).toBe(200);
        });
    });

    describe('Percentiles', () => {
        beforeEach(async () => {
            for (let i = 1; i <= 100; i++) {
                await metricsService.store({ name: 'latency', value: i });
            }
        });

        it('should calculate p50', async () => {
            const p50 = await metricsService.percentile('latency', 50);
            expect(p50).toBe(50);
        });

        it('should calculate p95', async () => {
            const p95 = await metricsService.percentile('latency', 95);
            expect(p95).toBe(95);
        });

        it('should calculate p99', async () => {
            const p99 = await metricsService.percentile('latency', 99);
            expect(p99).toBe(99);
        });
    });

    describe('Cleanup', () => {
        it('should delete old metrics', async () => {
            await metricsService.store({ name: 'old', value: 1, timestamp: '2025-01-01T00:00:00Z' });
            await metricsService.store({ name: 'new', value: 2, timestamp: '2026-01-08T00:00:00Z' });

            const result = await metricsService.deleteOlderThan('2026-01-01T00:00:00Z');

            expect(result.deleted).toBe(1);

            const remaining = await metricsService.query({});
            expect(remaining).toHaveLength(1);
            expect(remaining[0].name).toBe('new');
        });
    });

    describe('Metric Names', () => {
        it('should list unique metric names', async () => {
            await metricsService.store({ name: 'cpu', value: 50 });
            await metricsService.store({ name: 'memory', value: 60 });
            await metricsService.store({ name: 'cpu', value: 55 });

            const names = await metricsService.getMetricNames();

            expect(names).toContain('cpu');
            expect(names).toContain('memory');
            expect(names).toHaveLength(2);
        });
    });
});
