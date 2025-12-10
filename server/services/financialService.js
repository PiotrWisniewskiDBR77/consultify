const FinancialService = {
    /**
     * Calculates the estimated cost of an initiative based on its complexity.
     * @param {string} complexity - 'High', 'Medium', or 'Low'
     * @returns {Object} - { cost: number, costRange: string }
     */
    estimateCost: (complexity) => {
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
     * @param {string} priority - 'High', 'Medium', or 'Low'
     * @param {number} cost - The estimated cost
     * @returns {Object} - { benefit: number, benefitRange: string }
     */
    estimateBenefit: (priority, cost) => {
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
     * @param {Array} initiatives - List of initiatives with complexity and priority
     * @param {number} revenueBase - Base revenue for context (default 10M)
     * @returns {Object} - Full economic analysis
     */
    simulatePortfolio: (initiatives, revenueBase = 10000000) => {
        let totalCost = 0;
        let totalBenefit = 0;

        const detailedInitiatives = initiatives.map(i => {
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

module.exports = FinancialService;
