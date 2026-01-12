export type Complexity = 'High' | 'Medium' | 'Low';
export type Priority = 'High' | 'Medium' | 'Low';
export interface CostEstimate {
    cost: number;
    costRange: string;
}
export interface BenefitEstimate {
    benefit: number;
    benefitRange: string;
}
export interface Initiative {
    complexity: Complexity;
    priority: Priority;
    [key: string]: unknown;
}
export interface DetailedInitiative extends Initiative {
    estimatedCost: number;
    costRange: string;
    estimatedAnnualBenefit: number;
    benefitRange: string;
}
export interface PortfolioAnalysis {
    totalCapex: number;
    annualOpex: number;
    annualBenefit: number;
    efficiencyGains: number;
    roi: number;
    paybackPeriodMonths: number;
    initiatives: DetailedInitiative[];
}
declare const FinancialService: {
    /**
     * Calculates the estimated cost of an initiative based on its complexity.
     */
    estimateCost: (complexity: Complexity) => CostEstimate;
    /**
     * Calculates the estimated benefit of an initiative based on its priority and cost.
     */
    estimateBenefit: (priority: Priority, cost: number) => BenefitEstimate;
    /**
     * Simulates the full economic impact of a portfolio of initiatives.
     */
    simulatePortfolio: (initiatives: Initiative[], revenueBase?: number) => PortfolioAnalysis;
};
export default FinancialService;
//# sourceMappingURL=financialService.d.ts.map