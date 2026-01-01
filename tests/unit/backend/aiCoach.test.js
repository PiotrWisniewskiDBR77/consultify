// AI Coach Unit Tests
// Tests the AI Coach service for advisory reports and health scoring
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const AICoach = require('../../../server/ai/aiCoach');
const AIContextBuilder = require('../../../server/ai/aiContextBuilder');
const SignalEngine = require('../../../server/ai/signalEngine');
const RecommendationEngine = require('../../../server/ai/recommendationEngine');
const SimulationEngine = require('../../../server/ai/simulationEngine');

describe('AICoach', () => {
    beforeEach(() => {
        // Spy on real dependencies
        vi.spyOn(AIContextBuilder, 'buildContext');
        vi.spyOn(SignalEngine, 'detectSignals');
        vi.spyOn(RecommendationEngine, 'generateRecommendations');
        vi.spyOn(SimulationEngine, 'simulateImpacts');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getAdvisoryReport', () => {
        it('should generate comprehensive advisory report', async () => {
            const mockContext = {
                orgId: 'org-123',
                orgName: 'Test Organization',
                timestamp: '2024-01-01T00:00:00Z',
                data: {
                    task_distribution: { total: 50 },
                    initiative_status: [
                        { id: 'init-1', is_blocked: false },
                        { id: 'init-2', is_blocked: true }
                    ]
                }
            };

            const mockSignals = [
                { type: 'risk', severity: 'HIGH', message: 'High risk detected' },
                { type: 'opportunity', severity: 'MEDIUM', message: 'Opportunity available' }
            ];

            const mockRecommendations = [
                { id: 'rec-1', type: 'action', title: 'Optimize resources', impact: 'high' }
            ];

            const mockSimulations = [
                { recommendationId: 'rec-1', expectedImpact: 0.15, confidence: 0.85 }
            ];

            AIContextBuilder.buildContext.mockResolvedValue(mockContext);
            SignalEngine.detectSignals.mockReturnValue(mockSignals);
            RecommendationEngine.generateRecommendations.mockReturnValue(mockRecommendations);
            SimulationEngine.simulateImpacts.mockReturnValue(mockSimulations);

            const result = await AICoach.getAdvisoryReport('org-123');

            expect(result).toBeDefined();
            expect(result.orgId).toBe('org-123');
            expect(result.orgName).toBe('Test Organization');
            expect(result.signals).toEqual(mockSignals);
            expect(result.recommendations).toEqual(mockRecommendations);
            expect(result.simulations).toEqual(mockSimulations);
            expect(result.summary).toBeDefined();
            expect(result.summary.task_count).toBe(50);
            expect(result.summary.active_initiatives).toBe(2);
            expect(result.summary.health_score).toBeGreaterThanOrEqual(0);
            expect(result.summary.health_score).toBeLessThanOrEqual(100);
        });

        it('should calculate health score correctly', async () => {
            const mockContext = {
                orgId: 'org-123',
                orgName: 'Test Org',
                timestamp: '2024-01-01T00:00:00Z',
                data: {
                    task_distribution: { total: 10 },
                    initiative_status: [
                        { id: 'init-1', is_blocked: false },
                        { id: 'init-2', is_blocked: true }
                    ]
                }
            };

            const mockSignals = [
                { type: 'risk', severity: 'CRITICAL' },
                { type: 'risk', severity: 'HIGH' }
            ];

            AIContextBuilder.buildContext.mockResolvedValue(mockContext);
            SignalEngine.detectSignals.mockReturnValue(mockSignals);
            RecommendationEngine.generateRecommendations.mockReturnValue([]);
            SimulationEngine.simulateImpacts.mockReturnValue([]);

            const result = await AICoach.getAdvisoryReport('org-123');

            // CRITICAL: -15, HIGH: -10, blocked initiative: -5 = -30 from 100 = 70
            expect(result.summary.health_score).toBe(70);
        });

        it('should handle empty context gracefully', async () => {
            const mockContext = {
                orgId: 'org-123',
                orgName: 'Test Org',
                timestamp: '2024-01-01T00:00:00Z',
                data: {
                    task_distribution: { total: 0 },
                    initiative_status: []
                }
            };

            AIContextBuilder.buildContext.mockResolvedValue(mockContext);
            SignalEngine.detectSignals.mockReturnValue([]);
            RecommendationEngine.generateRecommendations.mockReturnValue([]);
            SimulationEngine.simulateImpacts.mockReturnValue([]);

            const result = await AICoach.getAdvisoryReport('org-123');

            expect(result).toBeDefined();
            expect(result.summary.task_count).toBe(0);
            expect(result.summary.active_initiatives).toBe(0);
            expect(result.summary.health_score).toBe(100); // Perfect score with no issues
        });

        it('should include audit trail', async () => {
            const mockContext = {
                orgId: 'org-123',
                orgName: 'Test Org',
                timestamp: '2024-01-01T00:00:00Z',
                data: { task_distribution: { total: 10 }, initiative_status: [] }
            };

            AIContextBuilder.buildContext.mockResolvedValue(mockContext);
            SignalEngine.detectSignals.mockReturnValue([]);
            RecommendationEngine.generateRecommendations.mockReturnValue([]);
            SimulationEngine.simulateImpacts.mockReturnValue([]);

            const result = await AICoach.getAdvisoryReport('org-123');

            expect(result.audit).toBeDefined();
            expect(result.audit.context_id).toBe('2024-01-01T00:00:00Z');
            expect(result.audit.data_sources).toBeInstanceOf(Array);
            expect(result.audit.version).toBe('1.0.0-governed');
        });

        it('should handle errors gracefully', async () => {
            AIContextBuilder.buildContext.mockRejectedValue(new Error('Context build failed'));

            await expect(AICoach.getAdvisoryReport('org-123')).rejects.toThrow('Context build failed');
        });
    });

    describe('_calculateHealthScore', () => {
        it('should return 100 for perfect health', () => {
            const context = {
                data: {
                    initiative_status: []
                }
            };
            const signals = [];

            const score = AICoach._calculateHealthScore(context, signals);

            expect(score).toBe(100);
        });

        it('should penalize critical signals', () => {
            const context = {
                data: {
                    initiative_status: []
                }
            };
            const signals = [
                { severity: 'CRITICAL' },
                { severity: 'CRITICAL' }
            ];

            const score = AICoach._calculateHealthScore(context, signals);

            // 100 - (15 * 2) = 70
            expect(score).toBe(70);
        });

        it('should penalize blocked initiatives', () => {
            const context = {
                data: {
                    initiative_status: [
                        { is_blocked: true },
                        { is_blocked: true },
                        { is_blocked: false }
                    ]
                }
            };
            const signals = [];

            const score = AICoach._calculateHealthScore(context, signals);

            // 100 - (5 * 2) = 90
            expect(score).toBe(90);
        });

        it('should not go below 0', () => {
            const context = {
                data: {
                    initiative_status: Array(30).fill({ is_blocked: true })
                }
            };
            const signals = Array(10).fill({ severity: 'CRITICAL' });

            const score = AICoach._calculateHealthScore(context, signals);

            // Should be capped at 0
            expect(score).toBe(0);
        });

        it('should handle mixed severity signals', () => {
            const context = {
                data: {
                    initiative_status: [{ is_blocked: true }]
                }
            };
            const signals = [
                { severity: 'CRITICAL' },
                { severity: 'HIGH' },
                { severity: 'MEDIUM' },
                { severity: 'LOW' }
            ];

            const score = AICoach._calculateHealthScore(context, signals);

            // 100 - 15 (CRITICAL) - 10 (HIGH) - 5 (MEDIUM) - 0 (LOW) - 5 (blocked) = 65
            expect(score).toBe(65);
        });
    });
});

