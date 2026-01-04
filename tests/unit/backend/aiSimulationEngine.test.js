// AI Simulation Engine Unit Tests
// Tests the AI simulation engine for scenario planning and what-if analysis

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

describe('AISimulationEngine', () => {
    let engine;
    let AISimulationEngine;
    let mocks;

    beforeEach(async () => {
        vi.resetAllMocks();
        vi.resetModules();

        mocks = setupStandardTest();

        // Setup specific simulation service mocks
        mocks.simulationService = {
            runSimulation: vi.fn(),
            validateScenario: vi.fn(),
            calculateProbabilities: vi.fn()
        };

        // Module-level mock for simulation service
        vi.mock('../../../server/src/services/simulationService', () => ({
            default: mocks.simulationService
        }));

        AISimulationEngine = (await import('../../../server/ai/simulationEngine.js')).default;

        // Inject mocks via constructor using unified pattern
        engine = new AISimulationEngine({
            db: mocks.db,
            SimulationService: mocks.simulationService
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    describe('runScenarioSimulation', () => {
        it('should run basic project scenario simulation', async () => {
            const scenario = {
                type: 'project_outcome',
                baseline: {
                    budget: 100000,
                    timeline: 12, // months
                    teamSize: 8,
                    complexity: 'medium'
                },
                variables: {
                    budget_change: 0.1, // +10%
                    timeline_change: -0.2, // -20%
                    team_change: 0.25 // +25%
                }
            };

            const mockResult = {
                baselineOutcome: { success: 0.7, cost: 100000, duration: 12 },
                simulatedOutcome: { success: 0.85, cost: 110000, duration: 9.6 },
                confidence: 0.82,
                recommendations: ['Increase team size', 'Reduce scope']
            };

            mockSimulationService.runSimulation.mockResolvedValue(mockResult);

            const result = await engine.runScenarioSimulation(scenario);

            expect(result).toEqual(mockResult);
            expect(mockSimulationService.runSimulation).toHaveBeenCalledWith(scenario);
        });

        it('should handle risk scenario simulations', async () => {
            const riskScenario = {
                type: 'risk_impact',
                risks: [
                    { id: 'tech_debt', probability: 0.6, impact: 'high' },
                    { id: 'resource_shortage', probability: 0.3, impact: 'medium' },
                    { id: 'scope_creep', probability: 0.8, impact: 'low' }
                ],
                mitigation: {
                    tech_debt: ['refactoring_sprint', 'code_review'],
                    resource_shortage: ['cross_training'],
                    scope_creep: ['strict_change_control']
                }
            };

            const result = await engine.runScenarioSimulation(riskScenario);

            expect(result).toHaveProperty('riskAssessment');
            expect(result).toHaveProperty('mitigationEffectiveness');
            expect(result).toHaveProperty('recommendedActions');
        });

        it('should validate scenario parameters', async () => {
            const invalidScenarios = [
                null,
                undefined,
                {},
                { type: 'invalid_type' },
                { baseline: {} }
            ];

            for (const scenario of invalidScenarios) {
                await expect(engine.runScenarioSimulation(scenario)).rejects.toThrow('Invalid scenario');
            }
        });
    });

    describe('generateWhatIfScenarios', () => {
        it('should generate multiple what-if scenarios', async () => {
            const baseline = {
                project: {
                    budget: 100000,
                    timeline: 12,
                    teamSize: 8
                }
            };

            const variables = [
                { name: 'budget', range: [-0.2, 0.2], steps: 5 },
                { name: 'timeline', range: [-0.3, 0.1], steps: 3 }
            ];

            const scenarios = await engine.generateWhatIfScenarios(baseline, variables);

            expect(scenarios.length).toBe(15); // 5 budget × 3 timeline = 15 scenarios
            scenarios.forEach(scenario => {
                expect(scenario).toHaveProperty('id');
                expect(scenario).toHaveProperty('changes');
                expect(scenario).toHaveProperty('probability');
            });
        });

        it('should handle complex multi-variable scenarios', () => {
            const baseline = { value: 100 };
            const variables = [
                { name: 'factor1', range: [0.8, 1.2], steps: 3 },
                { name: 'factor2', range: [0.9, 1.1], steps: 2 },
                { name: 'factor3', range: [0.95, 1.05], steps: 2 }
            ];

            const scenarios = engine.generateVariableCombinations(variables);

            expect(scenarios.length).toBe(12); // 3 × 2 × 2 = 12 combinations
        });
    });

    describe('calculateProbabilities', () => {
        it('should calculate outcome probabilities', () => {
            const outcomes = [
                { scenario: 'best_case', factors: { budget: 1.1, timeline: 0.9, quality: 1.2 } },
                { scenario: 'worst_case', factors: { budget: 0.8, timeline: 1.3, quality: 0.8 } },
                { scenario: 'most_likely', factors: { budget: 1.0, timeline: 1.0, quality: 1.0 } }
            ];

            const probabilities = engine.calculateOutcomeProbabilities(outcomes);

            expect(probabilities.best_case).toBeGreaterThan(probabilities.worst_case);
            expect(probabilities.most_likely).toBeGreaterThan(probabilities.worst_case);
            expect(Object.values(probabilities).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 1);
        });

        it('should handle risk probability calculations', () => {
            const risks = [
                { id: 'risk1', probability: 0.3, impact: 0.8 },
                { id: 'risk2', probability: 0.5, impact: 0.6 },
                { id: 'risk3', probability: 0.2, impact: 0.9 }
            ];

            const riskMetrics = engine.calculateRiskProbabilities(risks);

            expect(riskMetrics).toHaveProperty('expectedImpact');
            expect(riskMetrics).toHaveProperty('riskExposure');
            expect(riskMetrics).toHaveProperty('topRisks');
            expect(riskMetrics.topRisks).toHaveLength(3);
        });
    });

    describe('monteCarloSimulation', () => {
        it('should run Monte Carlo simulations', async () => {
            const parameters = {
                iterations: 1000,
                variables: {
                    budget: { mean: 100000, std: 10000, distribution: 'normal' },
                    timeline: { mean: 12, std: 2, distribution: 'normal' },
                    success_rate: { min: 0.5, max: 0.9, distribution: 'uniform' }
                },
                correlations: [
                    { var1: 'budget', var2: 'timeline', coefficient: 0.3 }
                ]
            };

            const results = await engine.runMonteCarloSimulation(parameters);

            expect(results).toHaveProperty('iterations', 1000);
            expect(results).toHaveProperty('statistics');
            expect(results).toHaveProperty('distribution');
            expect(results.statistics).toHaveProperty('mean');
            expect(results.statistics).toHaveProperty('median');
            expect(results.statistics).toHaveProperty('stdDev');
            expect(results.statistics).toHaveProperty('confidenceInterval');
        });

        it('should handle different probability distributions', () => {
            const distributions = ['normal', 'uniform', 'triangular', 'beta'];

            distributions.forEach(dist => {
                const samples = engine.generateDistributionSamples(dist, {
                    mean: 100,
                    std: 10,
                    min: 80,
                    max: 120,
                    mode: 105,
                    alpha: 2,
                    beta: 2
                }, 100);

                expect(samples).toHaveLength(100);
                samples.forEach(sample => {
                    expect(typeof sample).toBe('number');
                    expect(sample).toBeGreaterThan(0);
                });
            });
        });
    });

    describe('sensitivityAnalysis', () => {
        it('should perform sensitivity analysis', () => {
            const model = {
                inputs: ['budget', 'timeline', 'team_size'],
                output: 'success_probability',
                relationships: {
                    budget: (x) => Math.max(0, 1 - (x - 100000) / 50000),
                    timeline: (x) => Math.max(0, 1 - (x - 12) / 6),
                    team_size: (x) => Math.min(1, x / 10)
                }
            };

            const baseline = { budget: 100000, timeline: 12, team_size: 8 };
            const ranges = {
                budget: [80000, 120000],
                timeline: [9, 18],
                team_size: [5, 12]
            };

            const analysis = engine.performSensitivityAnalysis(model, baseline, ranges);

            expect(analysis).toHaveProperty('tornadoDiagram');
            expect(analysis).toHaveProperty('correlationMatrix');
            expect(analysis).toHaveProperty('keyDrivers');

            expect(analysis.keyDrivers.length).toBe(3);
            analysis.keyDrivers.forEach(driver => {
                expect(driver).toHaveProperty('variable');
                expect(driver).toHaveProperty('impact');
                expect(driver).toHaveProperty('correlation');
            });
        });

        it('should identify most influential variables', () => {
            const variables = [
                { name: 'budget', impact: 0.3, correlation: 0.8 },
                { name: 'timeline', impact: 0.7, correlation: -0.6 },
                { name: 'quality', impact: 0.2, correlation: 0.4 },
                { name: 'resources', impact: 0.5, correlation: 0.7 }
            ];

            const keyDrivers = engine.identifyKeyDrivers(variables);

            expect(keyDrivers[0].name).toBe('timeline'); // Highest impact
            expect(keyDrivers[1].name).toBe('resources');
            expect(keyDrivers[2].name).toBe('budget');
            expect(keyDrivers[3].name).toBe('quality');
        });
    });

    describe('scenarioComparison', () => {
        it('should compare multiple scenarios', () => {
            const scenarios = [
                {
                    id: 'scenario1',
                    name: 'Aggressive Timeline',
                    outcomes: { duration: 8, cost: 120000, success: 0.6 }
                },
                {
                    id: 'scenario2',
                    name: 'Conservative Approach',
                    outcomes: { duration: 14, cost: 95000, success: 0.85 }
                },
                {
                    id: 'scenario3',
                    name: 'Balanced Strategy',
                    outcomes: { duration: 11, cost: 105000, success: 0.78 }
                }
            ];

            const comparison = engine.compareScenarios(scenarios);

            expect(comparison).toHaveProperty('rankings');
            expect(comparison).toHaveProperty('tradeoffs');
            expect(comparison).toHaveProperty('recommendations');

            expect(comparison.rankings.success[0]).toBe('scenario2'); // Highest success rate
            expect(comparison.rankings.cost[0]).toBe('scenario2'); // Lowest cost
            expect(comparison.rankings.speed[0]).toBe('scenario1'); // Fastest
        });

        it('should analyze scenario trade-offs', () => {
            const scenarios = [
                { id: 'fast', outcomes: { duration: 6, cost: 150000, quality: 0.7 } },
                { id: 'cheap', outcomes: { duration: 15, cost: 80000, quality: 0.8 } },
                { id: 'quality', outcomes: { duration: 12, cost: 120000, quality: 0.95 } }
            ];

            const tradeoffs = engine.analyzeTradeoffs(scenarios);

            expect(tradeoffs).toHaveProperty('paretoFront');
            expect(tradeoffs).toHaveProperty('efficientFrontier');
            expect(tradeoffs.paretoFront.length).toBeGreaterThan(0);
        });
    });

    describe('storeSimulationResults', () => {
        it('should store simulation results', async () => {
            const simulationResult = {
                scenarioId: 'sim-123',
                results: { outcome: 0.85, confidence: 0.92 },
                metadata: { duration: 1500, iterations: 1000 }
            };

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call(null, null);
            });

            const result = await engine.storeSimulationResults(simulationResult);

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should retrieve stored simulations', async () => {
            const mockResults = [
                { id: 1, scenarioId: 'sim-1', results: '{"outcome": 0.8}', timestamp: '2024-01-01' }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback.call(null, mockResults);
            });

            const results = await engine.getSimulationResults('scenario-123');

            expect(results).toHaveLength(1);
            expect(results[0]).toHaveProperty('scenarioId', 'sim-1');
            expect(results[0]).toHaveProperty('parsedResults');
            expect(results[0].parsedResults.outcome).toBe(0.8);
        });
    });

    describe('Error Handling', () => {
        it('should handle simulation service failures', async () => {
            mockSimulationService.runSimulation.mockRejectedValue(new Error('Simulation engine unavailable'));

            const scenario = { type: 'basic', parameters: {} };

            await expect(engine.runScenarioSimulation(scenario)).rejects.toThrow('Simulation engine unavailable');
        });

        it('should validate simulation parameters', () => {
            const invalidParams = [
                { iterations: -1 },
                { variables: null },
                { iterations: 'invalid' }
            ];

            invalidParams.forEach(params => {
                expect(() => engine.validateSimulationParameters(params)).toThrow();
            });
        });

        it('should handle database errors', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call(null, new Error('Database error'));
            });

            const simulationResult = { scenarioId: 'test', results: {} };

            await expect(engine.storeSimulationResults(simulationResult)).rejects.toThrow('Database error');
        });
    });

    describe('Performance', () => {
        it('should optimize simulation performance', async () => {
            const largeScenario = {
                type: 'complex',
                iterations: 10000,
                variables: Array(20).fill().map((_, i) => ({
                    name: `var${i}`,
                    distribution: 'normal',
                    mean: 100,
                    std: 10
                }))
            };

            const startTime = Date.now();

            // Mock fast completion
            mockSimulationService.runSimulation.mockResolvedValue({
                outcome: 0.75,
                confidence: 0.85
            });

            await engine.runScenarioSimulation(largeScenario);

            const duration = Date.now() - startTime;

            // Should complete within reasonable time
            expect(duration).toBeLessThan(5000);
        });

        it('should cache simulation results', async () => {
            const scenario = { type: 'test', parameters: { value: 100 } };

            mockSimulationService.runSimulation.mockResolvedValue({ result: 0.8 });

            // First run
            await engine.runScenarioSimulation(scenario);

            // Second run - should use cache
            await engine.runScenarioSimulation(scenario);

            // Service should only be called once
            expect(mockSimulationService.runSimulation).toHaveBeenCalledTimes(1);
        });
    });
});
