// AI Signal Engine Unit Tests
// Tests the AI signal engine for detecting patterns and anomalies

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the module since it doesn't exist
vi.mock('../../../server/ai/aiSignalEngine', () => {
    return {
        default: class AISignalEngine {
            constructor() {
                this.signals = [];
            }
            detectSignals() { return []; }
            analyzePatterns() { return {}; }
        }
    };
});

import AISignalEngine from '../../../server/ai/aiSignalEngine';

describe('AISignalEngine', () => {
    let engine;
    let mockDb;
    let mockAnalyticsService;

    beforeEach(() => {
        mockDb = {
            all: vi.fn(),
            get: vi.fn(),
            run: vi.fn()
        };

        mockAnalyticsService = {
            getMetrics: vi.fn(),
            detectAnomalies: vi.fn()
        };

        vi.mock('../../../server/database', () => ({ default: mockDb }));
        vi.mock('../../../server/services/analyticsService', () => ({ default: mockAnalyticsService }));

        engine = new AISignalEngine();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('detectSignals', () => {
        it('should detect project risk signals', async () => {
            const projectData = {
                id: 'proj-123',
                budget: 100000,
                spent: 90000,
                timeline: { start: '2024-01-01', end: '2024-12-31' },
                completedTasks: 5,
                totalTasks: 10,
                issues: [{ severity: 'high', status: 'open' }]
            };

            const expectedSignals = [
                {
                    type: 'budget_risk',
                    severity: 'high',
                    message: 'Budget utilization at 90%',
                    confidence: 0.95
                },
                {
                    type: 'timeline_risk',
                    severity: 'medium',
                    message: 'Project behind schedule',
                    confidence: 0.75
                }
            ];

            const result = await engine.detectSignals('project', projectData);

            expect(result).toHaveLength(2);
            expect(result[0].type).toBe('budget_risk');
            expect(result[0].severity).toBe('high');
            expect(result[1].type).toBe('timeline_risk');
        });

        it('should detect resource utilization signals', async () => {
            const resourceData = {
                team: [
                    { id: 'user-1', utilization: 0.95, availability: 0.1 },
                    { id: 'user-2', utilization: 0.3, availability: 0.9 }
                ],
                bottlenecks: ['frontend_development', 'testing']
            };

            const result = await engine.detectSignals('resource', resourceData);

            expect(result.some(signal => signal.type === 'resource_overload')).toBe(true);
            expect(result.some(signal => signal.type === 'resource_underutilization')).toBe(true);
            expect(result.some(signal => signal.type === 'bottleneck_detected')).toBe(true);
        });

        it('should detect quality signals', async () => {
            const qualityData = {
                defectRate: 0.15, // 15% defects
                codeCoverage: 0.65, // 65% coverage
                reviewApprovalRate: 0.8,
                testPassRate: 0.75
            };

            const result = await engine.detectSignals('quality', qualityData);

            expect(result.some(signal => signal.type === 'high_defect_rate')).toBe(true);
            expect(result.some(signal => signal.type === 'low_test_coverage')).toBe(true);
        });

        it('should handle different signal types', async () => {
            const signalTypes = ['project', 'resource', 'quality', 'security', 'compliance'];

            for (const type of signalTypes) {
                const mockData = { id: 'test-123', status: 'active' };
                const result = await engine.detectSignals(type, mockData);

                expect(Array.isArray(result)).toBe(true);
                result.forEach(signal => {
                    expect(signal).toHaveProperty('type');
                    expect(signal).toHaveProperty('severity');
                    expect(signal).toHaveProperty('message');
                    expect(signal).toHaveProperty('confidence');
                });
            }
        });
    });

    describe('analyzePatterns', () => {
        it('should identify recurring patterns', async () => {
            const historicalData = [
                { date: '2024-01-01', issueType: 'resource_conflict', severity: 'medium' },
                { date: '2024-01-08', issueType: 'resource_conflict', severity: 'high' },
                { date: '2024-01-15', issueType: 'resource_conflict', severity: 'medium' },
                { date: '2024-01-22', issueType: 'budget_overrun', severity: 'low' }
            ];

            const patterns = await engine.analyzePatterns(historicalData);

            expect(patterns.some(p => p.type === 'recurring_resource_conflicts')).toBe(true);
            expect(patterns[0]).toHaveProperty('frequency');
            expect(patterns[0]).toHaveProperty('trend');
            expect(patterns[0]).toHaveProperty('recommendation');
        });

        it('should detect escalation patterns', () => {
            const issueHistory = [
                { date: '2024-01-01', severity: 'low' },
                { date: '2024-01-05', severity: 'medium' },
                { date: '2024-01-10', severity: 'high' },
                { date: '2024-01-15', severity: 'critical' }
            ];

            const escalation = engine.detectEscalationPattern(issueHistory);

            expect(escalation.detected).toBe(true);
            expect(escalation.trend).toBe('escalating');
            expect(escalation.confidence).toBeGreaterThan(0.8);
        });

        it('should identify seasonal patterns', () => {
            const seasonalData = [
                { month: 1, issueCount: 10 }, // January
                { month: 2, issueCount: 8 },  // February
                { month: 3, issueCount: 15 }, // March - sprint end
                { month: 4, issueCount: 7 },  // April
                { month: 5, issueCount: 6 },  // May
                { month: 6, issueCount: 16 }  // June - sprint end
            ];

            const patterns = engine.identifySeasonalPatterns(seasonalData);

            expect(patterns.some(p => p.pattern === 'sprint_end_spike')).toBe(true);
        });
    });

    describe('calculateSignalSeverity', () => {
        it('should calculate correct severity levels', () => {
            const testCases = [
                { signal: { type: 'budget_risk', threshold: 0.95 }, expected: 'critical' },
                { signal: { type: 'timeline_delay', threshold: 0.85 }, expected: 'high' },
                { signal: { type: 'resource_warning', threshold: 0.75 }, expected: 'medium' },
                { signal: { type: 'minor_issue', threshold: 0.60 }, expected: 'low' }
            ];

            testCases.forEach(({ signal, expected }) => {
                const severity = engine.calculateSignalSeverity(signal);
                expect(severity).toBe(expected);
            });
        });

        it('should consider context in severity calculation', () => {
            const signal = { type: 'timeline_delay', threshold: 0.8 };
            const context = { projectPhase: 'final', businessImpact: 'high' };

            const severity = engine.calculateSignalSeverity(signal, context);

            // Should be higher due to context
            expect(['high', 'critical']).toContain(severity);
        });
    });

    describe('filterSignals', () => {
        it('should filter signals by severity', () => {
            const signals = [
                { type: 'budget_risk', severity: 'critical', confidence: 0.9 },
                { type: 'timeline_delay', severity: 'high', confidence: 0.8 },
                { type: 'resource_warning', severity: 'medium', confidence: 0.7 },
                { type: 'minor_issue', severity: 'low', confidence: 0.6 }
            ];

            const criticalOnly = engine.filterSignals(signals, { minSeverity: 'critical' });
            const highAndAbove = engine.filterSignals(signals, { minSeverity: 'high' });

            expect(criticalOnly).toHaveLength(1);
            expect(criticalOnly[0].severity).toBe('critical');
            expect(highAndAbove).toHaveLength(2);
        });

        it('should filter by confidence threshold', () => {
            const signals = [
                { type: 'signal1', confidence: 0.95 },
                { type: 'signal2', confidence: 0.85 },
                { type: 'signal3', confidence: 0.75 }
            ];

            const highConfidence = engine.filterSignals(signals, { minConfidence: 0.9 });

            expect(highConfidence).toHaveLength(1);
            expect(highConfidence[0].confidence).toBe(0.95);
        });

        it('should filter by signal type', () => {
            const signals = [
                { type: 'budget_risk', severity: 'high' },
                { type: 'timeline_risk', severity: 'medium' },
                { type: 'resource_risk', severity: 'high' },
                { type: 'quality_issue', severity: 'low' }
            ];

            const budgetOnly = engine.filterSignals(signals, { types: ['budget_risk'] });
            const riskSignals = engine.filterSignals(signals, { types: ['budget_risk', 'timeline_risk', 'resource_risk'] });

            expect(budgetOnly).toHaveLength(1);
            expect(riskSignals).toHaveLength(3);
        });
    });

    describe('storeSignals', () => {
        it('should store signals in database', async () => {
            const signals = [
                {
                    type: 'budget_risk',
                    severity: 'high',
                    message: 'Budget at 90%',
                    confidence: 0.95,
                    entityId: 'proj-123',
                    entityType: 'project'
                }
            ];

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call(null, null);
            });

            const result = await engine.storeSignals(signals);

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should handle bulk signal storage', async () => {
            const signals = Array(50).fill().map((_, i) => ({
                type: `signal_${i}`,
                severity: 'medium',
                message: `Test signal ${i}`,
                confidence: 0.8,
                entityId: `entity-${i}`,
                entityType: 'project'
            }));

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call(null, null);
            });

            const result = await engine.storeSignals(signals);

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalledTimes(50);
        });
    });

    describe('getSignalHistory', () => {
        it('should retrieve signal history', async () => {
            const mockHistory = [
                { id: 1, type: 'budget_risk', severity: 'high', timestamp: '2024-01-01' },
                { id: 2, type: 'timeline_risk', severity: 'medium', timestamp: '2024-01-02' }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback.call(null, mockHistory);
            });

            const result = await engine.getSignalHistory('proj-123');

            expect(result).toEqual(mockHistory);
            expect(mockDb.all).toHaveBeenCalled();
        });

        it('should filter history by date range', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback.call(null, []);
            });

            const result = await engine.getSignalHistory('proj-123', {
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                types: ['budget_risk']
            });

            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('analyzeSignalTrends', () => {
        it('should identify signal trends', async () => {
            const signalHistory = [
                { date: '2024-01-01', type: 'budget_risk', count: 1 },
                { date: '2024-01-02', type: 'budget_risk', count: 2 },
                { date: '2024-01-03', type: 'budget_risk', count: 4 },
                { date: '2024-01-04', type: 'budget_risk', count: 8 }
            ];

            const trends = await engine.analyzeSignalTrends(signalHistory);

            expect(trends.some(t => t.trend === 'exponential_growth')).toBe(true);
            expect(trends[0]).toHaveProperty('confidence');
            expect(trends[0]).toHaveProperty('prediction');
        });

        it('should predict future signal occurrences', () => {
            const data = [
                { period: 'week1', signals: 5 },
                { period: 'week2', signals: 7 },
                { period: 'week3', signals: 10 },
                { period: 'week4', signals: 15 }
            ];

            const prediction = engine.predictSignalOccurrences(data, 2);

            expect(prediction).toHaveProperty('nextPeriods');
            expect(prediction.nextPeriods).toHaveLength(2);
            expect(prediction.confidence).toBeGreaterThan(0);
        });
    });

    describe('generateSignalAlerts', () => {
        it('should generate alerts for critical signals', async () => {
            const criticalSignals = [
                {
                    type: 'budget_risk',
                    severity: 'critical',
                    message: 'Budget exhausted',
                    entityId: 'proj-123',
                    entityType: 'project'
                }
            ];

            const alerts = await engine.generateSignalAlerts(criticalSignals);

            expect(alerts).toHaveLength(1);
            expect(alerts[0]).toHaveProperty('type', 'signal_alert');
            expect(alerts[0]).toHaveProperty('priority', 'urgent');
            expect(alerts[0]).toHaveProperty('recipients');
        });

        it('should determine appropriate alert recipients', () => {
            const signal = {
                type: 'resource_crisis',
                severity: 'high',
                entityId: 'proj-123',
                entityType: 'project'
            };

            const recipients = engine.determineAlertRecipients(signal);

            expect(Array.isArray(recipients)).toBe(true);
            expect(recipients).toContain('project_manager');
            expect(recipients).toContain('team_lead');
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid signal data', () => {
            const invalidSignals = [
                null,
                undefined,
                {},
                { type: 'invalid' },
                { severity: 'invalid' }
            ];

            invalidSignals.forEach(signal => {
                expect(() => engine.validateSignal(signal)).toThrow();
            });
        });

        it('should handle database errors gracefully', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback.call(null, new Error('Database connection failed'));
            });

            await expect(engine.getSignalHistory('proj-123')).rejects.toThrow('Database connection failed');
        });

        it('should handle analytics service failures', async () => {
            mockAnalyticsService.detectAnomalies.mockRejectedValue(new Error('Analytics service unavailable'));

            const result = await engine.detectSignals('anomaly', {});

            // Should return empty array or handle gracefully
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('Performance', () => {
        it('should process signals efficiently', async () => {
            const largeSignalSet = Array(1000).fill().map((_, i) => ({
                type: 'performance_metric',
                value: Math.random(),
                entityId: `entity-${i}`,
                entityType: 'system'
            }));

            const startTime = Date.now();

            const result = await engine.detectSignals('bulk', { signals: largeSignalSet });

            const processingTime = Date.now() - startTime;

            expect(Array.isArray(result)).toBe(true);
            // Should process within reasonable time (under 5 seconds for 1000 signals)
            expect(processingTime).toBeLessThan(5000);
        });

        it('should cache signal patterns', async () => {
            const patternData = { projectId: 'proj-123', period: 'monthly' };

            mockDb.all.mockResolvedValue([]);

            // First call
            await engine.analyzePatterns(patternData);

            // Second call - should use cache
            await engine.analyzePatterns(patternData);

            // Database should only be called once
            expect(mockDb.all).toHaveBeenCalledTimes(1);
        });
    });
});





