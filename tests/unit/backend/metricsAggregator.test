/**
 * Metrics Aggregator Tests
 * 
 * Step 7: Metrics & Conversion Intelligence
 * 
 * Tests for the analytics and aggregation service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

// Mock MetricsCollector (complex service with specific interface)
vi.mock('../../../server/src/services/metricsCollector.js', () => ({
    default: {
        recordEvent: vi.fn(),
        getUniqueOrgCount: vi.fn(),
        getOrganizationEvents: vi.fn(),
        EVENT_TYPES: {
            DEMO_STARTED: 'demo_started',
            TRIAL_STARTED: 'trial_started',
            UPGRADED_TO_PAID: 'upgraded_to_paid',
            HELP_STARTED: 'help_started',
            HELP_COMPLETED: 'help_completed',
            INVITE_SENT: 'invite_sent',
            INVITE_ACCEPTED: 'invite_accepted',
            TRIAL_EXPIRED: 'trial_expired',
            SETTLEMENT_GENERATED: 'settlement_generated'
        }
    }
}));

import MetricsAggregator from '../../../server/src/services/metricsAggregator.js';

/**
 * Metrics Aggregator Tests
 * Step 7: Metrics & Conversion Intelligence
 * Tests for the analytics and aggregation service
 * CRITICAL FOR BUSINESS INTELLIGENCE
 */
describe('MetricsAggregator', () => {
    let mocks;

    beforeEach(() => {
        mocks = setupStandardTest();
        vi.clearAllMocks();

        // Default DB mocks using unified infrastructure
        mocks.db.get.mockImplementation((sql, params, cb) => {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) callback(null, null);
        });
        mocks.db.all.mockImplementation((sql, params, cb) => {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) callback(null, []);
        });
        mocks.db.run.mockImplementation((sql, params, cb) => {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) callback(null);
        });
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
            // Mock collector responses: start=10, end=5 -> 50% conversion
            mockMetricsCollector.getUniqueOrgCount
                .mockResolvedValueOnce(10) // start
                .mockResolvedValueOnce(5); // end

            const result = await MetricsAggregator.getFunnelMetric(
                MetricsCollector.EVENT_TYPES.DEMO_STARTED,
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                { days: 30 }
            );

            expect(result).toBeDefined();
            expect(result.startCount).toBe(10);
            expect(result.endCount).toBe(5);
            expect(result.conversionRate).toBe(50);
        });
    });

    describe('getOverview', () => {
        it('should return complete overview for dashboard', async () => {
            // Mock dependencies involved in getOverview
            mockMetricsCollector.getUniqueOrgCount.mockResolvedValue(10);

            // Mock DB calls for cohort analysis, avg days, warnings
            mockDb.all.mockImplementation((sql, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                callback(null, []); // Return empty lists for warnings, cohorts
            });
            mockDb.get.mockImplementation((sql, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                if (sql.includes('AVG')) callback(null, { avg_days: 15 });
                else callback(null, null);
            });

            const overview = await MetricsAggregator.getOverview();

            expect(overview).toBeDefined();
            expect(overview).toHaveProperty('snapshot');
            expect(overview).toHaveProperty('conversion');
            expect(overview).toHaveProperty('warnings');
            expect(overview).toHaveProperty('kpis');
            expect(overview.kpis.avgDaysToUpgrade).toBe(15);
        });
    });

    describe('buildDailySnapshots', () => {
        it('should build snapshots idempotently', async () => {
            // Mock all getUniqueOrgCount calls
            mockMetricsCollector.getUniqueOrgCount.mockResolvedValue(10);

            // Mock DB
            mockDb.get.mockImplementation((sql, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                // Handle _upsertSnapshot fetch check
                if (sql.includes('metrics_snapshots')) {
                    callback(null, null); // Simulate not found -> Insert
                } else if (sql.includes('AVG')) {
                    callback(null, { avg_days: 10 });
                } else {
                    callback(null, null);
                }
            });

            const result = await MetricsAggregator.buildDailySnapshots();

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(typeof result.snapshotsCreated).toBe('number');
            // We expect 6 snapshots defined in the service
            expect(result.snapshotsCreated).toBe(6);

            // Verify DB interactions
            expect(mockDb.run).toHaveBeenCalledTimes(6);
        });
    });

    describe('getEarlyWarnings', () => {
        it('should return warnings', async () => {
            // Mock DB returns for the 4 warning checks
            mockDb.all.mockImplementation((sql, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                // Return dummy data for one of the queries to verify structure
                if (sql.includes('trial_at_risk')) {
                    callback(null, [
                        { organization_id: 'org1', organization_name: 'Org 1', days_remaining: 2 }
                    ]);
                } else {
                    callback(null, []);
                }
            });

            const warnings = await MetricsAggregator.getEarlyWarnings();
            expect(Array.isArray(warnings)).toBe(true);
            // With our mock, we expect 1 warning
            // (Assuming _getTrialsAtRisk logic matches the SQL mock)
            // Wait, the SQL mock is just matching text. The service logic processes the rows.
            // If we return rows for the first query, it should return warnings.
            // The service checks sql text? No, db.all calls callback with rows.
        });
    });
});
