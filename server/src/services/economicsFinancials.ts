export type FinancialData = {
  initialInvestment: number;
  implementationCost: number;
  annualOperatingCost: number;
  trainingCost: number;
  contingencyPercent: number;
  annualCostSavings: number;
  annualRevenueIncrease: number;
  productivityGainsPercent: number;
  riskReductionValue: number;
  implementationMonths: number;
  benefitRealizationMonths: number;
  analysisHorizonYears: number;
  discountRate: number;
  currency: string;
  assumptions: string[];
};

export const defaultFinancialData: FinancialData = {
  initialInvestment: 0,
  implementationCost: 0,
  annualOperatingCost: 0,
  trainingCost: 0,
  contingencyPercent: 15,
  annualCostSavings: 0,
  annualRevenueIncrease: 0,
  productivityGainsPercent: 0,
  riskReductionValue: 0,
  implementationMonths: 12,
  benefitRealizationMonths: 6,
  analysisHorizonYears: 5,
  discountRate: 10,
  currency: 'PLN',
  assumptions: [],
};

export const normalizeFinancialData = (input: any): FinancialData => ({
  ...defaultFinancialData,
  ...(input || {}),
  assumptions: Array.isArray(input?.assumptions) ? input.assumptions : [],
});

export const calculateFinancialMetrics = (data: FinancialData) => {
  const horizon = Math.max(1, data.analysisHorizonYears || 1);
  const discountRate = (data.discountRate || 0) / 100;

  const totalInitialCost =
    (data.initialInvestment || 0) + (data.implementationCost || 0) + (data.trainingCost || 0);
  const contingency = totalInitialCost * ((data.contingencyPercent || 0) / 100);
  const totalUpfront = totalInitialCost + contingency;

  const baseAnnualBenefits =
    (data.annualCostSavings || 0) +
    (data.annualRevenueIncrease || 0) +
    (data.riskReductionValue || 0);
  const productivityMultiplier = 1 + (data.productivityGainsPercent || 0) / 100;
  const annualBenefits = baseAnnualBenefits * productivityMultiplier;

  const cashFlows: Array<{
    year: number;
    costs: number;
    benefits: number;
    netCashFlow: number;
    cumulativeCashFlow: number;
  }> = [];

  let cumulativeCashFlow = 0;
  cumulativeCashFlow -= totalUpfront;
  cashFlows.push({
    year: 0,
    costs: totalUpfront,
    benefits: 0,
    netCashFlow: -totalUpfront,
    cumulativeCashFlow,
  });

  for (let year = 1; year <= horizon; year++) {
    const yearBenefits = annualBenefits;
    const yearCosts = data.annualOperatingCost || 0;
    const netCashFlow = yearBenefits - yearCosts;
    cumulativeCashFlow += netCashFlow;
    cashFlows.push({
      year,
      costs: yearCosts,
      benefits: yearBenefits,
      netCashFlow,
      cumulativeCashFlow,
    });
  }

  let npv = -totalUpfront;
  for (let year = 1; year <= horizon; year++) {
    const netCashFlow = annualBenefits - (data.annualOperatingCost || 0);
    npv += netCashFlow / Math.pow(1 + discountRate, year);
  }

  let irr: number | null = null;
  const irrCashFlows = [
    -totalUpfront,
    ...Array(horizon).fill(annualBenefits - (data.annualOperatingCost || 0)),
  ];

  const calculateNPVForRate = (rate: number) => {
    let npvCalc = 0;
    for (let i = 0; i < irrCashFlows.length; i++) {
      npvCalc += irrCashFlows[i] / Math.pow(1 + rate, i);
    }
    return npvCalc;
  };

  let irrGuess = 0.1;
  for (let iteration = 0; iteration < 100; iteration++) {
    const npvAtGuess = calculateNPVForRate(irrGuess);
    const npvAtGuessPlus = calculateNPVForRate(irrGuess + 0.0001);
    const derivative = (npvAtGuessPlus - npvAtGuess) / 0.0001;

    if (Math.abs(npvAtGuess) < 0.01) {
      irr = irrGuess;
      break;
    }
    if (derivative === 0) break;
    irrGuess = irrGuess - npvAtGuess / derivative;
    if (irrGuess < -1 || irrGuess > 10) break;
  }

  let paybackPeriod: number | null = null;
  for (let i = 1; i < cashFlows.length; i++) {
    if (cashFlows[i].cumulativeCashFlow >= 0 && cashFlows[i - 1].cumulativeCashFlow < 0) {
      const previousCumulative = Math.abs(cashFlows[i - 1].cumulativeCashFlow);
      const currentNet = cashFlows[i].netCashFlow || 1;
      paybackPeriod = i - 1 + previousCumulative / currentNet;
      break;
    }
  }

  const totalCosts = totalUpfront + (data.annualOperatingCost || 0) * horizon;
  const totalBenefits = annualBenefits * horizon;
  const netBenefit = totalBenefits - totalCosts;
  const roi = totalCosts > 0 ? netBenefit / totalCosts : null;

  return {
    npv,
    irr,
    paybackPeriod,
    roi,
    totalCosts,
    totalBenefits,
    netBenefit,
    cashFlows,
  };
};

export const applyScenarioAdjustments = (
  data: FinancialData,
  scenarioType: string
): FinancialData => {
  if (scenarioType === 'optimistic') {
    return {
      ...data,
      annualCostSavings: data.annualCostSavings * 1.15,
      annualRevenueIncrease: data.annualRevenueIncrease * 1.2,
      annualOperatingCost: data.annualOperatingCost * 0.9,
      discountRate: Math.max(0, data.discountRate - 1),
    };
  }
  if (scenarioType === 'conservative') {
    return {
      ...data,
      annualCostSavings: data.annualCostSavings * 0.85,
      annualRevenueIncrease: data.annualRevenueIncrease * 0.85,
      annualOperatingCost: data.annualOperatingCost * 1.1,
      discountRate: data.discountRate + 1,
    };
  }
  return { ...data };
};

type FinancialInsights = {
  errors: string[];
  warnings: string[];
  recommendations: string[];
};

const pushIf = (list: string[], condition: boolean, message: string) => {
  if (condition) list.push(message);
};

export const validateFinancialData = (data: FinancialData): FinancialInsights => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  const safeNumber = (value: number) => (Number.isFinite(value) ? value : 0);

  const initialInvestment = safeNumber(data.initialInvestment);
  const implementationCost = safeNumber(data.implementationCost);
  const trainingCost = safeNumber(data.trainingCost);
  const annualOperatingCost = safeNumber(data.annualOperatingCost);
  const annualCostSavings = safeNumber(data.annualCostSavings);
  const annualRevenueIncrease = safeNumber(data.annualRevenueIncrease);
  const riskReductionValue = safeNumber(data.riskReductionValue);
  const analysisHorizonYears = safeNumber(data.analysisHorizonYears);
  const discountRate = safeNumber(data.discountRate);

  pushIf(errors, analysisHorizonYears <= 0, 'analysis_horizon_years must be greater than 0');
  pushIf(errors, discountRate < 0 || discountRate > 100, 'discount_rate must be between 0 and 100');

  const nonNegativeFields = [
    ['initial_investment', initialInvestment],
    ['implementation_cost', implementationCost],
    ['training_cost', trainingCost],
    ['annual_operating_cost', annualOperatingCost],
    ['annual_cost_savings', annualCostSavings],
    ['annual_revenue_increase', annualRevenueIncrease],
    ['risk_reduction_value', riskReductionValue],
  ] as const;

  for (const [field, value] of nonNegativeFields) {
    if (value < 0) {
      errors.push(`${field} must be greater than or equal to 0`);
    }
  }

  const totalBenefits = annualCostSavings + annualRevenueIncrease + riskReductionValue;
  pushIf(
    warnings,
    totalBenefits === 0,
    'No annual benefits defined; ROI and payback may be negative.'
  );
  pushIf(
    warnings,
    totalBenefits > 0 && totalBenefits <= annualOperatingCost,
    'Annual benefits are not higher than operating costs; cashflow may stay negative.'
  );
  pushIf(
    warnings,
    data.implementationMonths > analysisHorizonYears * 12,
    'Implementation time exceeds the analysis horizon.'
  );

  pushIf(
    recommendations,
    totalBenefits > 0 && initialInvestment > 0 && discountRate <= 15,
    'Consider approving after scenario review.'
  );
  pushIf(
    recommendations,
    totalBenefits === 0 || initialInvestment === 0,
    'Provide complete cost and benefit inputs for more reliable metrics.'
  );

  return { errors, warnings, recommendations };
};
