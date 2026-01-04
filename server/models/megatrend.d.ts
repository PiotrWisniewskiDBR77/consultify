declare namespace _default {
    export { getBaselineTrends };
    export { getRadarData };
    export { getTrendDetail };
    export { createCustomTrend };
    export { updateCustomTrend };
}
export default _default;
/**
 * Get default megatrends for a given industry.
 * If no industry is provided, returns all baseline trends.
 * Falls back to static data if database is empty.
 */
declare function getBaselineTrends(industry: any): Promise<any>;
/**
 * Get data for the radar chart.
 * Returns an array of { label, type, ring, impact } for the selected industry.
 */
declare function getRadarData(industry: any): Promise<any>;
/**
 * Get full detail for a specific megatrend (including AI insights).
 */
declare function getTrendDetail(id: any): Promise<any>;
/**
 * Create a custom/company‑specific trend.
 * payload: { industry, type, label, description, ring }
 */
declare function createCustomTrend(payload: any, companyId: any): Promise<any>;
/**
 * Update an existing custom trend.
 */
declare function updateCustomTrend(id: any, payload: any, companyId: any): Promise<any>;
//# sourceMappingURL=megatrend.d.ts.map