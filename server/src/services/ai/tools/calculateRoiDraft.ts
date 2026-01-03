/**
 * Tool: calculate_roi_draft
 * Calculates ROI, NPV, and payback period for initiatives.
 */

type RoiParams = {
    initialInvestment: number;
    annualBenefit: number;
    years?: number;
    discountRate?: number;
};

type RoiBreakdown = {
    year: number;
    cashFlow: number;
    discountedCashFlow: number;
};

export async function calculateRoiDraft(params: RoiParams): Promise<Record<string, unknown>> {
    const {
        initialInvestment,
        annualBenefit,
        years = 5,
        discountRate = 0.1
    } = params;

    if (initialInvestment <= 0) {
        return { error: 'Initial investment must be positive' };
    }
    if (annualBenefit <= 0) {
        return { error: 'Annual benefit must be positive' };
    }

    const totalBenefit = annualBenefit * years;
    const roi = ((totalBenefit - initialInvestment) / initialInvestment) * 100;

    let npv = -initialInvestment;
    const breakdown: RoiBreakdown[] = [];

    for (let year = 1; year <= years; year++) {
        const discountFactor = Math.pow(1 + discountRate, year);
        const discountedCashFlow = annualBenefit / discountFactor;
        npv += discountedCashFlow;

        breakdown.push({
            year,
            cashFlow: annualBenefit,
            discountedCashFlow: Math.round(discountedCashFlow * 100) / 100
        });
    }

    const paybackYears = initialInvestment / annualBenefit;

    return {
        roi: Math.round(roi * 100) / 100,
        npv: Math.round(npv * 100) / 100,
        paybackYears: Math.round(paybackYears * 100) / 100,
        breakdown,
        summary: generateSummary(roi, npv, paybackYears)
    };
}

function generateSummary(roi: number, npv: number, paybackYears: number): string {
    if (roi > 100 && npv > 0 && paybackYears < 2) {
        return 'Excellent investment opportunity - strong returns with quick payback.';
    }
    if (roi > 50 && npv > 0 && paybackYears < 3) {
        return 'Good investment - solid returns with reasonable payback period.';
    }
    if (roi > 20 && npv > 0) {
        return 'Moderate investment - positive returns but consider alternatives.';
    }
    if (npv < 0) {
        return 'Caution - negative NPV suggests the investment may not be worthwhile.';
    }
    return 'Marginal investment - benefits are minimal relative to costs.';
}

export default { calculateRoiDraft };
