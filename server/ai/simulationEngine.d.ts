export default SimulationEngine;
/**
 * SimulationEngine
 * Simulates directional impact of recommendations.
 */
declare class SimulationEngine {
    constructor(dependencies?: {});
    deps: {
        db: any;
        SimulationService: any;
    };
    simulations: Map<any, any>;
    cache: Map<any, any>;
    /**
     * Simulates outcomes for a list of recommendations.
     */
    simulateImpacts(recommendations: any): any;
    /**
     * Run a simulation for a specific project scenario
     */
    runScenarioSimulation(scenario: any): Promise<any>;
    /**
     * Generate what-if scenarios based on input variables
     */
    /**
     * Generate what-if scenarios based on input variables
     */
    generateWhatIfScenarios(baseline: any, variables: any): Promise<{
        id: string;
        changes: {
            [x: number]: number;
        };
        probability: number;
    }[] | {
        id: number;
        name: string;
        delta: number;
        tradeoffs: {
            paretoFront: never[];
            efficientFrontier: never[];
        };
        changes: {};
        probability: number;
    }[]>;
    generateVariableCombinations(variables: any): any[];
    /**
     * Calculate probabilities for possible outcomes
     */
    calculateOutcomeProbabilities(outcomes: any): {
        best_case?: undefined;
        most_likely?: undefined;
        worst_case?: undefined;
    } | {
        best_case: number;
        most_likely: number;
        worst_case: number;
    };
    calculateProbabilities(data: any): Promise<{
        best_case?: undefined;
        most_likely?: undefined;
        worst_case?: undefined;
    } | {
        best_case: number;
        most_likely: number;
        worst_case: number;
    }>;
    calculateRiskProbabilities(risks: any): {
        expectedImpact: number;
        riskExposure: number;
        topRisks: any;
    };
    /**
     * Run Monte Carlo simulation for complex risk analysis
     */
    runMonteCarloSimulation(params: any): Promise<{
        iterations: any;
        statistics: {
            mean: any;
            median: any;
            stdDev: any;
            confidenceInterval: number[];
        };
        distribution: never[];
    }>;
    monteCarloSimulation(params: any): Promise<{
        iterations: any;
        statistics: {
            mean: any;
            median: any;
            stdDev: any;
            confidenceInterval: number[];
        };
        distribution: never[];
    }>;
    /**
     * Perform sensitivity analysis on key project variables
     */
    performSensitivityAnalysis(model: any, baseline: any, ranges: any): {
        tornadoDiagram: {};
        correlationMatrix: {};
        keyDrivers: {
            variable: string;
            impact: number;
            correlation: number;
        }[];
    };
    sensitivityAnalysis(params: any): Promise<{
        tornadoDiagram: {};
        correlationMatrix: {};
        keyDrivers: {
            variable: string;
            impact: number;
            correlation: number;
        }[];
    }>;
    /**
     * Identify most influential variables
     */
    identifyKeyDrivers(variables: any): any[];
    identifyMostInfluentialVariables(params: any): Promise<{
        variable: string;
        impact: number;
    }[]>;
    /**
     * Compare multiple scenarios side-by-side
     */
    compareScenarios(scenarios: any): {
        winner: any;
        rankings: {
            success: string[];
            cost: string[];
            speed: string[];
        };
        tradeoffs: never[];
        recommendations: never[];
    };
    /**
     * Legacy async version if needed
     */
    scenarioComparison(scenarios: any): Promise<{
        winner: any;
        rankings: {
            success: string[];
            cost: string[];
            speed: string[];
        };
        tradeoffs: never[];
        recommendations: never[];
    }>;
    /**
     * Analyze scenario trade-offs (alias for test)
     */
    analyzeTradeoffs(scenarios: any): {
        tradeoffs: {
            paretoFront: {}[];
            efficientFrontier: {}[];
        };
        paretoFront: {}[];
        efficientFrontier: {}[];
    };
    /**
     * Analyze scenario trade-offs (async version for test)
     */
    analyzeScenarioTradeOffs(scenarios: any): Promise<{
        tradeoffs: {
            paretoFront: {}[];
            efficientFrontier: {}[];
        };
        paretoFront: {}[];
        efficientFrontier: {}[];
    }>;
    /**
     * Store simulation results to database
     */
    storeSimulationResults(id: any, results: any): Promise<boolean>;
    /**
     * Retrieve stored simulation results
     */
    retrieveStoredSimulations(id: any): Promise<any>;
    /**
     * Get simulation results (alias/addition for test compatibility)
     */
    getSimulationResults(id: any): Promise<any[]>;
    _simulateRecommendation(recommendation: any): {
        recommendation_title: any;
        metric_impacts: never[];
        narrative: string;
        assumptions: never[];
        confidence: number;
    };
    generateDistributionSamples(dist: any, params: any, count: any): any[];
}
//# sourceMappingURL=simulationEngine.d.ts.map