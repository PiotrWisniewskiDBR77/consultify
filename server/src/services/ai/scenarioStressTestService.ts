/**
 * Scenario Stress Testing Service (Enterprise)
 *
 * Monte Carlo-style what-if analysis for decision options.
 * Enables:
 * - Define variable scenarios (demand +30%, supply -20%, etc.)
 * - Run options through multiple scenarios
 * - Calculate sensitivity and robustness
 */

import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface ScenarioVariable {
  name: string;
  baseValue: number;
  unit?: string;
  variations: Array<{
    label: string;
    multiplier: number; // 1.3 = +30%, 0.8 = -20%
  }>;
}

export interface DecisionOption {
  id: string;
  name: string;
  baseOutcome: number; // Expected value at base scenario
  sensitivity: Record<string, number>; // How much each variable affects outcome (elasticity)
}

export interface ScenarioResult {
  scenarioLabel: string;
  variables: Record<string, number>; // Variable name -> actual value
  optionResults: Array<{
    optionId: string;
    optionName: string;
    adjustedOutcome: number;
    percentChange: number;
  }>;
  bestOption: string;
}

export interface StressTestSummary {
  options: DecisionOption[];
  scenarios: ScenarioResult[];
  robustnessRanking: Array<{
    optionId: string;
    optionName: string;
    winCount: number; // How many scenarios this option wins
    avgOutcome: number; // Average outcome across scenarios
    volatility: number; // Standard deviation of outcomes
    robustnessScore: number; // Composite score (higher = more robust)
  }>;
  sensitivityAnalysis: Array<{
    variableName: string;
    impactScore: number; // How much this variable swings the decision
    mostAffectedOption: string;
  }>;
  recommendation: {
    bestRobustChoice: string;
    bestOptimisticChoice: string;
    bestPessimisticChoice: string;
    rationale: string;
  };
}

// ==========================================
// DEFAULT SCENARIOS
// ==========================================

export const COMMON_SCENARIO_VARIABLES: ScenarioVariable[] = [
  {
    name: 'demand',
    baseValue: 100,
    unit: '%',
    variations: [
      { label: 'pessimistic', multiplier: 0.7 },
      { label: 'conservative', multiplier: 0.9 },
      { label: 'base', multiplier: 1.0 },
      { label: 'optimistic', multiplier: 1.2 },
      { label: 'high_growth', multiplier: 1.5 },
    ],
  },
  {
    name: 'cost',
    baseValue: 100,
    unit: '%',
    variations: [
      { label: 'cost_reduction', multiplier: 0.85 },
      { label: 'base', multiplier: 1.0 },
      { label: 'inflation', multiplier: 1.1 },
      { label: 'high_inflation', multiplier: 1.25 },
    ],
  },
  {
    name: 'timeline',
    baseValue: 100,
    unit: '% of planned',
    variations: [
      { label: 'ahead', multiplier: 0.8 },
      { label: 'on_time', multiplier: 1.0 },
      { label: 'delayed', multiplier: 1.3 },
      { label: 'severely_delayed', multiplier: 2.0 },
    ],
  },
  {
    name: 'competition',
    baseValue: 100,
    unit: 'intensity',
    variations: [
      { label: 'low', multiplier: 0.7 },
      { label: 'normal', multiplier: 1.0 },
      { label: 'high', multiplier: 1.5 },
      { label: 'intense', multiplier: 2.0 },
    ],
  },
];

// ==========================================
// SERVICE
// ==========================================

/**
 * Run stress test simulation
 */
export function runStressTest(args: {
  options: DecisionOption[];
  variables?: ScenarioVariable[];
  generateCombinations?: boolean;
}): StressTestSummary {
  const { options, variables = COMMON_SCENARIO_VARIABLES, generateCombinations = false } = args;

  // Generate scenarios
  const scenarios = generateCombinations
    ? generateAllCombinations(variables)
    : generateKeyScenarios(variables);

  // Run each option through each scenario
  const scenarioResults: ScenarioResult[] = scenarios.map((scenario) => {
    const optionResults = options.map((option) => {
      const adjustedOutcome = calculateAdjustedOutcome(option, scenario, variables);
      const percentChange = ((adjustedOutcome - option.baseOutcome) / option.baseOutcome) * 100;

      return {
        optionId: option.id,
        optionName: option.name,
        adjustedOutcome,
        percentChange,
      };
    });

    const best = optionResults.reduce((a, b) => (a.adjustedOutcome > b.adjustedOutcome ? a : b));

    return {
      scenarioLabel: scenario.label,
      variables: scenario.values,
      optionResults,
      bestOption: best.optionId,
    };
  });

  // Calculate robustness ranking
  const robustnessRanking = options
    .map((option) => {
      const outcomes = scenarioResults.map(
        (sr) => sr.optionResults.find((or) => or.optionId === option.id)!.adjustedOutcome
      );
      const winCount = scenarioResults.filter((sr) => sr.bestOption === option.id).length;
      const avgOutcome = outcomes.reduce((a, b) => a + b, 0) / outcomes.length;
      const variance =
        outcomes.reduce((a, b) => a + Math.pow(b - avgOutcome, 2), 0) / outcomes.length;
      const volatility = Math.sqrt(variance);

      // Robustness = wins + avg outcome (normalized) - volatility (normalized)
      const robustnessScore = winCount * 10 + avgOutcome / 100 - volatility / 50;

      return {
        optionId: option.id,
        optionName: option.name,
        winCount,
        avgOutcome,
        volatility,
        robustnessScore,
      };
    })
    .sort((a, b) => b.robustnessScore - a.robustnessScore);

  // Calculate sensitivity analysis
  const sensitivityAnalysis = variables
    .map((variable) => {
      let maxImpact = 0;
      let mostAffected = options[0].id;

      for (const option of options) {
        const elasticity = Math.abs(option.sensitivity[variable.name] || 0);
        if (elasticity > maxImpact) {
          maxImpact = elasticity;
          mostAffected = option.id;
        }
      }

      return {
        variableName: variable.name,
        impactScore: maxImpact,
        mostAffectedOption: mostAffected,
      };
    })
    .sort((a, b) => b.impactScore - a.impactScore);

  // Generate recommendation
  const bestRobust = robustnessRanking[0];
  const pessimisticScenario = scenarioResults.find((sr) =>
    sr.scenarioLabel.includes('pessimistic')
  );
  const optimisticScenario = scenarioResults.find((sr) => sr.scenarioLabel.includes('optimistic'));

  const recommendation = {
    bestRobustChoice: bestRobust.optionId,
    bestOptimisticChoice: optimisticScenario?.bestOption || bestRobust.optionId,
    bestPessimisticChoice: pessimisticScenario?.bestOption || bestRobust.optionId,
    rationale: generateRationale(robustnessRanking, sensitivityAnalysis),
  };

  return {
    options,
    scenarios: scenarioResults,
    robustnessRanking,
    sensitivityAnalysis,
    recommendation,
  };
}

/**
 * Quick sensitivity check for a single variable
 */
export function quickSensitivityCheck(args: {
  option: DecisionOption;
  variableName: string;
  range: [number, number]; // e.g., [0.5, 1.5] for -50% to +50%
  steps?: number;
}): Array<{ multiplier: number; outcome: number; percentChange: number }> {
  const { option, variableName, range, steps = 5 } = args;
  const results: Array<{ multiplier: number; outcome: number; percentChange: number }> = [];

  const step = (range[1] - range[0]) / (steps - 1);
  for (let i = 0; i < steps; i++) {
    const multiplier = range[0] + step * i;
    const elasticity = option.sensitivity[variableName] || 0;
    const outcome = option.baseOutcome * (1 + elasticity * (multiplier - 1));
    const percentChange = ((outcome - option.baseOutcome) / option.baseOutcome) * 100;

    results.push({ multiplier, outcome, percentChange });
  }

  return results;
}

// ==========================================
// HELPERS
// ==========================================

function generateKeyScenarios(variables: ScenarioVariable[]): Array<{
  label: string;
  values: Record<string, number>;
}> {
  // Generate key named scenarios
  const scenarios: Array<{ label: string; values: Record<string, number> }> = [
    { label: 'base_case', values: {} },
    { label: 'pessimistic', values: {} },
    { label: 'optimistic', values: {} },
    { label: 'high_cost_pressure', values: {} },
    { label: 'demand_surge', values: {} },
  ];

  for (const v of variables) {
    const varValues = Object.fromEntries(
      v.variations.map((vr) => [vr.label, v.baseValue * vr.multiplier])
    );

    scenarios[0].values[v.name] = v.baseValue; // base
    scenarios[1].values[v.name] =
      varValues['pessimistic'] || varValues['high_inflation'] || v.baseValue * 0.7;
    scenarios[2].values[v.name] =
      varValues['optimistic'] || varValues['high_growth'] || v.baseValue * 1.3;
    scenarios[3].values[v.name] = v.name === 'cost' ? v.baseValue * 1.25 : v.baseValue;
    scenarios[4].values[v.name] = v.name === 'demand' ? v.baseValue * 1.5 : v.baseValue;
  }

  return scenarios;
}

function generateAllCombinations(variables: ScenarioVariable[]): Array<{
  label: string;
  values: Record<string, number>;
}> {
  // Limit to avoid explosion
  const MAX_SCENARIOS = 50;

  const combinations: Array<{ label: string; values: Record<string, number> }> = [];
  const indices = new Array(variables.length).fill(0);

  while (combinations.length < MAX_SCENARIOS) {
    const values: Record<string, number> = {};
    const labels: string[] = [];

    for (let i = 0; i < variables.length; i++) {
      const v = variables[i];
      const variation = v.variations[indices[i]];
      values[v.name] = v.baseValue * variation.multiplier;
      labels.push(`${v.name}:${variation.label}`);
    }

    combinations.push({ label: labels.join('_'), values });

    // Increment indices
    let carry = true;
    for (let i = variables.length - 1; i >= 0 && carry; i--) {
      indices[i]++;
      if (indices[i] >= variables[i].variations.length) {
        indices[i] = 0;
      } else {
        carry = false;
      }
    }
    if (carry) break; // All done
  }

  return combinations;
}

function calculateAdjustedOutcome(
  option: DecisionOption,
  scenario: { label: string; values: Record<string, number> },
  variables: ScenarioVariable[]
): number {
  let adjustment = 1.0;

  for (const v of variables) {
    const scenarioValue = scenario.values[v.name] || v.baseValue;
    const multiplier = scenarioValue / v.baseValue;
    const elasticity = option.sensitivity[v.name] || 0;

    // Apply elasticity: if demand +10% and elasticity is 0.5, outcome increases 5%
    adjustment *= 1 + elasticity * (multiplier - 1);
  }

  return option.baseOutcome * adjustment;
}

function generateRationale(
  robustnessRanking: StressTestSummary['robustnessRanking'],
  sensitivityAnalysis: StressTestSummary['sensitivityAnalysis']
): string {
  const best = robustnessRanking[0];
  const topVariable = sensitivityAnalysis[0];

  return `${best.optionName} shows the highest robustness across scenarios (wins ${best.winCount} scenarios, avg outcome ${best.avgOutcome.toFixed(1)}). Key sensitivity driver is ${topVariable.variableName}. Consider monitoring ${topVariable.variableName} closely post-decision.`;
}
