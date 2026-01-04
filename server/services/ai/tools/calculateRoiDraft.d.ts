/**
 * Tool: calculate_roi_draft
 * Calculates ROI, NPV, and payback period for initiatives
 */
export interface CalculateRoiParams {
    initialInvestment: number;
    annualBenefit: number;
    years?: number;
    discountRate?: number;
}
export interface RoiBreakdown {
    year: number;
    cashFlow: number;
    discountedCashFlow: number;
}
export interface RoiResult {
    roi: number;
    npv: number;
    paybackYears: number;
    breakdown: RoiBreakdown[];
    summary: string;
}
export interface RoiError {
    error: string;
}
export interface Context {
    [key: string]: unknown;
}
declare function calculateRoiDraft(params: CalculateRoiParams, context: Context): Promise<RoiResult | RoiError>;
export { calculateRoiDraft };
//# sourceMappingURL=calculateRoiDraft.d.ts.map