/**
 * Tool: calculate_roi_draft
 * Calculates ROI, NPV, and payback period for initiatives
 */

async function calculateRoiDraft(params, context) {
    const {
        initialInvestment,
        annualBenefit,
        years = 5,
        discountRate = 0.1
    } = params;

    // Validate inputs
    if (initialInvestment <= 0) {
        return { error: 'Initial investment must be positive' };
    }
    if (annualBenefit <= 0) {
        return { error: 'Annual benefit must be positive' };
    }

    // Calculate basic ROI
    const totalBenefit = annualBenefit * years;
    const roi = ((totalBenefit - initialInvestment) / initialInvestment) * 100;

    // Calculate NPV
    let npv = -initialInvestment;
    const breakdown = [];

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

    // Calculate payback period
    const paybackYears = initialInvestment / annualBenefit;

    return {
        roi: Math.round(roi * 100) / 100,
        npv: Math.round(npv * 100) / 100,
        paybackYears: Math.round(paybackYears * 100) / 100,
        breakdown,
        summary: generateSummary(roi, npv, paybackYears)
    };
}

function generateSummary(roi, npv, paybackYears) {
    let assessment = '';

    if (roi > 100 && npv > 0 && paybackYears < 2) {
        assessment = 'Excellent investment opportunity - strong returns with quick payback.';
    } else if (roi > 50 && npv > 0 && paybackYears < 3) {
        assessment = 'Good investment - solid returns with reasonable payback period.';
    } else if (roi > 20 && npv > 0) {
        assessment = 'Moderate investment - positive returns but consider alternatives.';
    } else if (npv < 0) {
        assessment = 'Caution - negative NPV suggests the investment may not be worthwhile.';
    } else {
        assessment = 'Marginal investment - benefits are minimal relative to costs.';
    }

    return assessment;
}

module.exports = { calculateRoiDraft };
