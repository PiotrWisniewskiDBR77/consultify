export default FinancialCalculatorService;
declare namespace FinancialCalculatorService {
    function setDependencies(newDeps?: {}): void;
    /**
     * Calculate Net Present Value (NPV)
     * NPV = Σ [Cash Flow_t / (1 + r)^t] - Initial Investment
     */
    function calculateNPV(cashFlows: any, discountRate: any, initialInvestment?: number): number;
    /**
     * Calculate Internal Rate of Return (IRR)
     * Uses Newton-Raphson iteration method
     */
    function calculateIRR(cashFlows: any, initialInvestment: any, maxIterations?: number, precision?: number): number | null;
    /**
     * Calculate Payback Period (in months)
     * Time to recover the initial investment from net cash flows
     */
    function calculatePaybackPeriod(initialInvestment: any, annualCashFlows: any): number | null;
    /**
     * Calculate Simple ROI
     * ROI = (Total Benefits - Total Costs) / Total Costs * 100
     */
    function calculateROI(totalBenefits: any, totalCosts: any): number | null;
    /**
     * Calculate Total Cost of Ownership (TCO)
     * Sum of all costs over the analysis period
     */
    function calculateTCO(costs: any, years: any): number;
    /**
     * Generate annual cash flow projections
     */
    function generateCashFlowProjections(financialData: any): {
        initialInvestment: any;
        cashFlows: {
            year: number;
            costs: number;
            benefits: number;
            netCashFlow: number;
            discountFactor: number;
            discountedCashFlow: number;
            cumulativeCashFlow: number;
        }[];
        totalCosts: number;
        totalBenefits: number;
        totalNetCashFlow: number;
    };
    /**
     * Run sensitivity analysis on key variables
     */
    function runSensitivityAnalysis(baseCase: any, variables: any, ranges: any): {
        baseCase: {
            npv: number;
        };
        sensitivity: {};
        tornado: {
            baseCaseNpv: number;
            impacts: any;
        };
    };
    /**
     * Generate tornado diagram data showing impact of each variable
     */
    function generateTornadoData(baseCase: any, variables: any, ranges: any): {
        baseCaseNpv: number;
        impacts: any;
    };
    /**
     * Generate scenario comparisons (best, worst, expected)
     */
    function generateScenarioAnalysis(baseCase: any): {};
    /**
     * Get financial analysis for an initiative
     */
    function getFinancials(initiativeId: any, organizationId: any): Promise<{
        id: any;
        initiativeId: any;
        analysisId: any;
        organizationId: any;
        initialInvestment: any;
        implementationCost: any;
        annualOperatingCost: any;
        trainingCost: any;
        contingencyPercent: any;
        annualCostSavings: any;
        annualRevenueIncrease: any;
        productivityGainsPercent: any;
        riskReductionValue: any;
        implementationMonths: any;
        benefitRealizationMonths: any;
        analysisHorizonYears: any;
        discountRate: any;
        npv: any;
        irr: any;
        paybackMonths: any;
        roiPercent: any;
        tco5Year: any;
        currency: any;
        assumptions: any;
        cashFlowProjections: any;
        sensitivityResults: any;
        createdBy: any;
        createdAt: any;
        updatedAt: any;
        lastCalculatedAt: any;
    } | null>;
    /**
     * Create or update financial analysis
     */
    function createOrUpdateFinancials(initiativeId: any, data: any, organizationId: any, userId: any): Promise<{
        id: any;
        initiativeId: any;
        analysisId: any;
        organizationId: any;
        initialInvestment: any;
        implementationCost: any;
        annualOperatingCost: any;
        trainingCost: any;
        contingencyPercent: any;
        annualCostSavings: any;
        annualRevenueIncrease: any;
        productivityGainsPercent: any;
        riskReductionValue: any;
        implementationMonths: any;
        benefitRealizationMonths: any;
        analysisHorizonYears: any;
        discountRate: any;
        npv: any;
        irr: any;
        paybackMonths: any;
        roiPercent: any;
        tco5Year: any;
        currency: any;
        assumptions: any;
        cashFlowProjections: any;
        sensitivityResults: any;
        createdBy: any;
        createdAt: any;
        updatedAt: any;
        lastCalculatedAt: any;
    } | null>;
    /**
     * Update existing financial analysis
     */
    function updateFinancials(initiativeId: any, data: any, organizationId: any, userId: any): Promise<{
        id: any;
        initiativeId: any;
        analysisId: any;
        organizationId: any;
        initialInvestment: any;
        implementationCost: any;
        annualOperatingCost: any;
        trainingCost: any;
        contingencyPercent: any;
        annualCostSavings: any;
        annualRevenueIncrease: any;
        productivityGainsPercent: any;
        riskReductionValue: any;
        implementationMonths: any;
        benefitRealizationMonths: any;
        analysisHorizonYears: any;
        discountRate: any;
        npv: any;
        irr: any;
        paybackMonths: any;
        roiPercent: any;
        tco5Year: any;
        currency: any;
        assumptions: any;
        cashFlowProjections: any;
        sensitivityResults: any;
        createdBy: any;
        createdAt: any;
        updatedAt: any;
        lastCalculatedAt: any;
    } | null>;
    /**
     * Recalculate all metrics for an initiative
     */
    function recalculateMetrics(initiativeId: any, organizationId: any): Promise<{
        npv: number;
        irr: number | null;
        paybackMonths: number | null;
        roi: number | null;
        tco: number;
        projections: {
            initialInvestment: any;
            cashFlows: {
                year: number;
                costs: number;
                benefits: number;
                netCashFlow: number;
                discountFactor: number;
                discountedCashFlow: number;
                cumulativeCashFlow: number;
            }[];
            totalCosts: number;
            totalBenefits: number;
            totalNetCashFlow: number;
        };
    }>;
    /**
     * Get cash flow projections for an initiative
     */
    function getCashFlowProjections(initiativeId: any, organizationId: any): Promise<{
        initialInvestment: any;
        cashFlows: {
            year: number;
            costs: number;
            benefits: number;
            netCashFlow: number;
            discountFactor: number;
            discountedCashFlow: number;
            cumulativeCashFlow: number;
        }[];
        totalCosts: number;
        totalBenefits: number;
        totalNetCashFlow: number;
    } | null>;
    /**
     * Record assumptions history for audit trail
     */
    function recordAssumptionsHistory(financialId: any, data: any, changeType: any, userId: any): Promise<void>;
    /**
     * Get benefit tracking records for an initiative
     */
    function getBenefitTracking(initiativeId: any, filters: {} | undefined, organizationId: any): Promise<any>;
    /**
     * Record a benefit measurement
     */
    function recordBenefitMeasurement(initiativeId: any, data: any, organizationId: any, userId: any): Promise<{
        id: any;
        financialId: any;
        initiativeId: any;
        organizationId: any;
        periodStart: any;
        periodEnd: any;
        periodType: any;
        plannedCostSavings: any;
        plannedRevenueIncrease: any;
        plannedProductivityGains: any;
        actualCostSavings: any;
        actualRevenueIncrease: any;
        actualProductivityGains: any;
        varianceCostSavingsPercent: any;
        varianceRevenuePercent: any;
        varianceProductivityPercent: any;
        overallVariancePercent: any;
        varianceNotes: any;
        achievements: any;
        challenges: any;
        evidenceLinks: any;
        verificationStatus: any;
        verifiedBy: any;
        verifiedAt: any;
        createdBy: any;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Get a single benefit measurement
     */
    function getBenefitMeasurement(id: any): Promise<{
        id: any;
        financialId: any;
        initiativeId: any;
        organizationId: any;
        periodStart: any;
        periodEnd: any;
        periodType: any;
        plannedCostSavings: any;
        plannedRevenueIncrease: any;
        plannedProductivityGains: any;
        actualCostSavings: any;
        actualRevenueIncrease: any;
        actualProductivityGains: any;
        varianceCostSavingsPercent: any;
        varianceRevenuePercent: any;
        varianceProductivityPercent: any;
        overallVariancePercent: any;
        varianceNotes: any;
        achievements: any;
        challenges: any;
        evidenceLinks: any;
        verificationStatus: any;
        verifiedBy: any;
        verifiedAt: any;
        createdBy: any;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Update benefit measurement
     */
    function updateBenefitMeasurement(id: any, data: any, organizationId: any, userId: any): Promise<{
        id: any;
        financialId: any;
        initiativeId: any;
        organizationId: any;
        periodStart: any;
        periodEnd: any;
        periodType: any;
        plannedCostSavings: any;
        plannedRevenueIncrease: any;
        plannedProductivityGains: any;
        actualCostSavings: any;
        actualRevenueIncrease: any;
        actualProductivityGains: any;
        varianceCostSavingsPercent: any;
        varianceRevenuePercent: any;
        varianceProductivityPercent: any;
        overallVariancePercent: any;
        varianceNotes: any;
        achievements: any;
        challenges: any;
        evidenceLinks: any;
        verificationStatus: any;
        verifiedBy: any;
        verifiedAt: any;
        createdBy: any;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Verify a benefit measurement
     */
    function verifyBenefitMeasurement(id: any, userId: any): Promise<{
        id: any;
        financialId: any;
        initiativeId: any;
        organizationId: any;
        periodStart: any;
        periodEnd: any;
        periodType: any;
        plannedCostSavings: any;
        plannedRevenueIncrease: any;
        plannedProductivityGains: any;
        actualCostSavings: any;
        actualRevenueIncrease: any;
        actualProductivityGains: any;
        varianceCostSavingsPercent: any;
        varianceRevenuePercent: any;
        varianceProductivityPercent: any;
        overallVariancePercent: any;
        varianceNotes: any;
        achievements: any;
        challenges: any;
        evidenceLinks: any;
        verificationStatus: any;
        verifiedBy: any;
        verifiedAt: any;
        createdBy: any;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Get benefit tracking summary
     */
    function getBenefitSummary(initiativeId: any, organizationId: any): Promise<{
        totalMeasurements: number;
        message: string;
        verifiedMeasurements?: undefined;
        pendingMeasurements?: undefined;
        periodsCovered?: undefined;
        totals?: undefined;
        averageVariance?: undefined;
    } | {
        totalMeasurements: any;
        verifiedMeasurements: any;
        pendingMeasurements: any;
        periodsCovered: {
            first: any;
            last: any;
        };
        totals: {
            plannedCostSavings: any;
            actualCostSavings: any;
            costSavingsVariance: number | null;
            plannedRevenueIncrease: any;
            actualRevenueIncrease: any;
            revenueVariance: number | null;
            totalPlanned: any;
            totalActual: any;
        };
        averageVariance: number;
        message?: undefined;
    }>;
    /**
     * Get variance analysis details
     */
    function getVarianceAnalysis(initiativeId: any, organizationId: any): Promise<{
        message: string;
        hasFinancials: boolean;
        measurementCount: any;
        originalProjection?: undefined;
        actualPerformance?: undefined;
        varianceByPeriodType?: undefined;
        trend?: undefined;
        recommendations?: undefined;
    } | {
        originalProjection: any;
        actualPerformance: {
            totalSavings: any;
            totalRevenue: any;
        };
        varianceByPeriodType: {};
        trend: {
            period: string;
            variance: any;
            cumulative: number;
        }[];
        recommendations: {
            type: string;
            message: string;
            priority: string;
        }[];
        message?: undefined;
        hasFinancials?: undefined;
        measurementCount?: undefined;
    }>;
    /**
     * Generate recommendations based on variance patterns
     */
    function generateVarianceRecommendations(measurements: any): {
        type: string;
        message: string;
        priority: string;
    }[];
    /**
     * Generate business case document data
     */
    function generateBusinessCase(initiativeId: any, options: any, organizationId: any): Promise<{
        generated: string;
        template: any;
        language: any;
        summary: {
            npv: any;
            irr: any;
            paybackMonths: any;
            roi: any;
            tco: any;
            recommendation: {
                verdict: string;
                summary: string;
                confidence: string;
            };
        };
        financials: {
            id: any;
            initiativeId: any;
            analysisId: any;
            organizationId: any;
            initialInvestment: any;
            implementationCost: any;
            annualOperatingCost: any;
            trainingCost: any;
            contingencyPercent: any;
            annualCostSavings: any;
            annualRevenueIncrease: any;
            productivityGainsPercent: any;
            riskReductionValue: any;
            implementationMonths: any;
            benefitRealizationMonths: any;
            analysisHorizonYears: any;
            discountRate: any;
            npv: any;
            irr: any;
            paybackMonths: any;
            roiPercent: any;
            tco5Year: any;
            currency: any;
            assumptions: any;
            cashFlowProjections: any;
            sensitivityResults: any;
            createdBy: any;
            createdAt: any;
            updatedAt: any;
            lastCalculatedAt: any;
        };
        cashFlowProjections: {
            initialInvestment: any;
            cashFlows: {
                year: number;
                costs: number;
                benefits: number;
                netCashFlow: number;
                discountFactor: number;
                discountedCashFlow: number;
                cumulativeCashFlow: number;
            }[];
            totalCosts: number;
            totalBenefits: number;
            totalNetCashFlow: number;
        };
        scenarios: {};
        sensitivity: {
            baseCase: {
                npv: number;
            };
            sensitivity: {};
            tornado: {
                baseCaseNpv: number;
                impacts: any;
            };
        } | null;
        assumptions: any;
        risks: {
            category: string;
            level: string;
            description: string;
        }[];
    }>;
    /**
     * Generate investment recommendation based on metrics
     */
    function generateInvestmentRecommendation(financials: any): {
        verdict: string;
        summary: string;
        confidence: string;
    };
    /**
     * Identify financial risks from analysis
     */
    function identifyFinancialRisks(financials: any, scenarios: any): {
        category: string;
        level: string;
        description: string;
    }[];
    function transformFinancialRow(row: any): {
        id: any;
        initiativeId: any;
        analysisId: any;
        organizationId: any;
        initialInvestment: any;
        implementationCost: any;
        annualOperatingCost: any;
        trainingCost: any;
        contingencyPercent: any;
        annualCostSavings: any;
        annualRevenueIncrease: any;
        productivityGainsPercent: any;
        riskReductionValue: any;
        implementationMonths: any;
        benefitRealizationMonths: any;
        analysisHorizonYears: any;
        discountRate: any;
        npv: any;
        irr: any;
        paybackMonths: any;
        roiPercent: any;
        tco5Year: any;
        currency: any;
        assumptions: any;
        cashFlowProjections: any;
        sensitivityResults: any;
        createdBy: any;
        createdAt: any;
        updatedAt: any;
        lastCalculatedAt: any;
    } | null;
    function transformBenefitRow(row: any): {
        id: any;
        financialId: any;
        initiativeId: any;
        organizationId: any;
        periodStart: any;
        periodEnd: any;
        periodType: any;
        plannedCostSavings: any;
        plannedRevenueIncrease: any;
        plannedProductivityGains: any;
        actualCostSavings: any;
        actualRevenueIncrease: any;
        actualProductivityGains: any;
        varianceCostSavingsPercent: any;
        varianceRevenuePercent: any;
        varianceProductivityPercent: any;
        overallVariancePercent: any;
        varianceNotes: any;
        achievements: any;
        challenges: any;
        evidenceLinks: any;
        verificationStatus: any;
        verifiedBy: any;
        verifiedAt: any;
        createdBy: any;
        createdAt: any;
        updatedAt: any;
    } | null;
}
//# sourceMappingURL=financialCalculatorService.d.ts.map