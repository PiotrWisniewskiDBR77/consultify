
// AI Coach Unit Tests
// Tests the AI Coach service for advisory reports and health scoring
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AICoach from '../../../server/ai/aiCoach.js';

describe('AICoach', () => {
    let mockDeps;

    beforeEach(() => {
        // Create fresh mocks for each test
        mockDeps = {
            AIContextBuilder: { buildContext: vi.fn() },
            SignalEngine: { detectSignals: vi.fn() },
            RecommendationEngine: { generateRecommendations: vi.fn() },
            SimulationEngine: { simulateImpacts: vi.fn() }
        };

        // Inject mocks into the service
        AICoach.setDependencies(mockDeps);
    });

    afterEach(() => {
        vi.clearAllMocks();
        // Ideally we would restore original dependencies here if we had access to them,
        // but for unit tests running in isolation/parallel, setting them fresh in beforeEach is sufficient.
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

            mockDeps.AIContextBuilder.buildContext.mockResolvedValue(mockContext);
            mockDeps.SignalEngine.detectSignals.mockReturnValue(mockSignals);
            mockDeps.RecommendationEngine.generateRecommendations.mockResolvedValue(mockRecommendations);
            mockDeps.SimulationEngine.simulateImpacts.mockReturnValue(mockSimulations);

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

            // Verify dependency calls
            expect(mockDeps.AIContextBuilder.buildContext).toHaveBeenCalledWith('org-123');
            expect(mockDeps.SignalEngine.detectSignals).toHaveBeenCalledWith(mockContext);
            expect(mockDeps.RecommendationEngine.generateRecommendations).toHaveBeenCalledWith(mockSignals);
            expect(mockDeps.SimulationEngine.simulateImpacts).toHaveBeenCalledWith(mockRecommendations);
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

            mockDeps.AIContextBuilder.buildContext.mockResolvedValue(mockContext);
            mockDeps.SignalEngine.detectSignals.mockReturnValue(mockSignals);
            mockDeps.RecommendationEngine.generateRecommendations.mockResolvedValue([]);
            mockDeps.SimulationEngine.simulateImpacts.mockReturnValue([]);

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

            mockDeps.AIContextBuilder.buildContext.mockResolvedValue(mockContext);
            mockDeps.SignalEngine.detectSignals.mockReturnValue([]);
            mockDeps.RecommendationEngine.generateRecommendations.mockResolvedValue([]);
            mockDeps.SimulationEngine.simulateImpacts.mockReturnValue([]);

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

            mockDeps.AIContextBuilder.buildContext.mockResolvedValue(mockContext);
            mockDeps.SignalEngine.detectSignals.mockReturnValue([]);
            mockDeps.RecommendationEngine.generateRecommendations.mockResolvedValue([]);
            mockDeps.SimulationEngine.simulateImpacts.mockReturnValue([]);

            const result = await AICoach.getAdvisoryReport('org-123');

            expect(result.audit).toBeDefined();
            expect(result.audit.context_id).toBe('2024-01-01T00:00:00Z');
        });

        it('should handle errors gracefully', async () => {
            mockDeps.AIContextBuilder.buildContext.mockRejectedValue(new Error('Context build failed'));

            await expect(AICoach.getAdvisoryReport('org-123')).rejects.toThrow('Context build failed');
        });
    });

    describe('_calculateHealthScore', () => {
        it('should return 100 for perfect health', () => {
            const context = { data: { initiative_status: [] } };
            const signals = [];
            const score = AICoach._calculateHealthScore(context, signals);
            expect(score).toBe(100);
        });

        it('should penalize critical signals', () => {
            const context = { data: { initiative_status: [] } };
            const signals = [{ severity: 'CRITICAL' }, { severity: 'CRITICAL' }];
            const score = AICoach._calculateHealthScore(context, signals);
            expect(score).toBe(70);
        });

        it('should penalize blocked initiatives', () => {
            const context = {
                data: {
                    initiative_status: [{ is_blocked: true }, { is_blocked: true }]
                }
            };
            const signals = [];
            const score = AICoach._calculateHealthScore(context, signals);
            expect(score).toBe(90);
        });
    });
});
