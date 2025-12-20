/**
 * Metrics Aggregator Tests
 * 
 * Step 7: Metrics & Conversion Intelligence
 * 
 * Tests for the analytics and aggregation service
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

// Use real database and collector
const db = require('../../../server/database');
const MetricsCollector = require('../../../server/services/metricsCollector');
const MetricsAggregator = require('../../../server/services/metricsAggregator');

describe('MetricsAggregator', () => {
    beforeAll(async () => {
        // Wait for database schema to be initialized
        await db.initPromise;
    });

    describe('METRIC_KEYS', () => {
        it('should define all required metric keys', () => {
            expect(MetricsAggregator.METRIC_KEYS).toBeDefined();
            expect(MetricsAggregator.METRIC_KEYS.FUNNEL_DEMO_TO_TRIAL).toBe('funnel_demo_to_trial');
            expect(MetricsAggregator.METRIC_KEYS.FUNNEL_TRIAL_TO_PAID).toBe('funnel_trial_to_paid');
            expect(MetricsAggregator.METRIC_KEYS.FUNNEL_HELP_COMPLETION).toBe('funnel_help_completion');
            expect(MetricsAggregator.METRIC_KEYS.AVG_DAYS_TO_UPGRADE).toBe('avg_days_to_upgrade');
            expect(MetricsAggregator.METRIC_KEYS.TRIAL_EXPIRY_RATE).toBe('trial_expiry_rate');
        });
    });

    describe('WARNING_SEVERITY', () => {
        it('should define severity levels', () => {
            expect(MetricsAggregator.WARNING_SEVERITY).toBeDefined();
            expect(MetricsAggregator.WARNING_SEVERITY.LOW).toBe('LOW');
            expect(MetricsAggregator.WARNING_SEVERITY.MEDIUM).toBe('MEDIUM');
            expect(MetricsAggregator.WARNING_SEVERITY.HIGH).toBe('HIGH');
            expect(MetricsAggregator.WARNING_SEVERITY.CRITICAL).toBe('CRITICAL');
        });
    });

    describe('getFunnelMetric', () => {
        it('should calculate funnel between two events', async () => {
            // Seed data
            const org1 = 'org-1';
            const org2 = 'org-2';
            await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.DEMO_STARTED, { organizationId: org1 });
            await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.DEMO_STARTED, { organizationId: org2 });
            await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.TRIAL_STARTED, { organizationId: org1 });

            const result = await MetricsAggregator.getFunnelMetric(
                MetricsCollector.EVENT_TYPES.DEMO_STARTED,
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                { days: 30 }
            );

            expect(result).toBeDefined();
            expect(result.startCount).toBeGreaterThanOrEqual(2);
            expect(result.endCount).toBeGreaterThanOrEqual(1);
            expect(result.conversionRate).toBeGreaterThan(0);
        });
    });

    describe('getOverview', () => {
        it('should return complete overview for dashboard', async () => {
            const overview = await MetricsAggregator.getOverview();

            expect(overview).toBeDefined();
            expect(overview).toHaveProperty('snapshot');
            expect(overview).toHaveProperty('conversion');
            expect(overview).toHaveProperty('warnings');
            expect(overview).toHaveProperty('kpis');
        });
    });

    describe('buildDailySnapshots', () => {
        it('should build snapshots idempotently', async () => {
            const result = await MetricsAggregator.buildDailySnapshots();

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(typeof result.snapshotsCreated).toBe('number');

            // Try again for same date
            const result2 = await MetricsAggregator.buildDailySnapshots();
            expect(result2.success).toBe(true);
        });
    });

    describe('getEarlyWarnings', () => {
        it('should return warnings (seed data needed for specific warnings)', async () => {
            const warnings = await MetricsAggregator.getEarlyWarnings();
            expect(Array.isArray(warnings)).toBe(true);
        });
    });
});
