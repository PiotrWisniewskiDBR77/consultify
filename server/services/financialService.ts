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

const FinancialService = {
    /**
     * Calculates the estimated cost of an initiative based on its complexity.
     */
    estimateCost: (complexity: Complexity): CostEstimate => {
        let cost = 5000;
        let costRange = 'Low (<$10k)';

        if (complexity === 'High') {
            cost = 75000;
            costRange = 'High (>$50k)';
        } else if (complexity === 'Medium') {
            cost = 25000;
            costRange = 'Medium ($10k-$50k)';
        }

        return { cost, costRange };
    },

    /**
     * Calculates the estimated benefit of an initiative based on its priority and cost.
     */
    estimateBenefit: (priority: Priority, cost: number): BenefitEstimate => {
        let benefit = cost * 1.2;
        let benefitRange = 'Low (<$20k/yr)';

        if (priority === 'High') {
            benefit = cost * 2.5;
        } else if (priority === 'Medium') {
            benefit = cost * 1.5;
        }

        // Determine range label
        if (benefit < 20000) benefitRange = 'Low (<$20k/yr)';
        else if (benefit < 100000) benefitRange = 'Medium ($20k-$100k/yr)';
        else benefitRange = 'High (>$100k/yr)';

        return { benefit, benefitRange };
    },

    /**
     * Simulates the full economic impact of a portfolio of initiatives.
     */
    simulatePortfolio: (initiatives: Initiative[], revenueBase = 10000000): PortfolioAnalysis => {
        let totalCost = 0;
        let totalBenefit = 0;

        const detailedInitiatives: DetailedInitiative[] = initiatives.map(i => {
            const { cost, costRange } = FinancialService.estimateCost(i.complexity);
            const { benefit, benefitRange } = FinancialService.estimateBenefit(i.priority, cost);

            totalCost += cost;
            totalBenefit += benefit;

            return {
                ...i,
                estimatedCost: cost,
                costRange,
                estimatedAnnualBenefit: benefit,
                benefitRange
            };
        });

        const roi = totalCost > 0 ? (totalBenefit / totalCost) * 100 : 0;
        const paybackMonths = totalBenefit > 0 ? (totalCost / totalBenefit) * 12 : 0;

        // Efficiency gains = Benefit / Revenue
        const efficiencyGains = (totalBenefit / revenueBase) * 100;

        return {
            totalCapex: totalCost,
            annualOpex: totalCost * 0.15, // Assumption: 15% maintenance
            annualBenefit: totalBenefit,
            efficiencyGains: parseFloat(efficiencyGains.toFixed(2)),
            roi: parseFloat(roi.toFixed(1)),
            paybackPeriodMonths: parseFloat(paybackMonths.toFixed(1)),
            initiatives: detailedInitiatives
        };
    }
};

export default FinancialService;

