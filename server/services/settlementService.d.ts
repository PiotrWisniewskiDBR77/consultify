export default SettlementService;
declare namespace SettlementService {
    export { PERIOD_STATUS };
    export { ENTRY_TYPES };
    export function setDependencies(newDeps?: {}): void;
    /**
     * Create a new settlement period
     * @param {Object} params - Period parameters
     * @param {string} params.periodStart - Period start date (ISO string)
     * @param {string} params.periodEnd - Period end date (ISO string)
     * @returns {Promise<Object>} Created period
     */
    export function createPeriod(params: {
        periodStart: string;
        periodEnd: string;
    }): Promise<Object>;
    /**
     * Check for overlapping periods
     * @param {string} start - Start date
     * @param {string} end - End date
     * @returns {Promise<Object|null>}
     */
    export function checkOverlappingPeriod(start: string, end: string): Promise<Object | null>;
    /**
     * Get the current open period
     * @returns {Promise<Object|null>}
     */
    export function getOpenPeriod(): Promise<Object | null>;
    /**
     * Get period by ID
     * @param {string} periodId - Period ID
     * @returns {Promise<Object|null>}
     */
    export function getPeriod(periodId: string): Promise<Object | null>;
    /**
     * List settlement periods
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    export function listPeriods(options?: Object): Promise<any[]>;
    /**
     * Calculate settlements for a period (CORE LOGIC)
     *
     * Rules:
     * 1. Only OPEN periods can be calculated
     * 2. Finds all attribution events with partner_code in the period
     * 3. For each attribution, finds the valid agreement at that time
     * 4. Calculates settlement_amount = revenue_amount × revenue_share_percent / 100
     * 5. Inserts immutable settlement rows
     * 6. Updates period status to CALCULATED
     *
     * @param {string} periodId - Period ID
     * @param {string} calculatedByUserId - User performing calculation
     * @returns {Promise<Object>} Calculation result
     */
    export function calculateSettlements(periodId: string, calculatedByUserId: string): Promise<Object>;
    /**
     * Get revenue amount for an attribution event
     * In production, this would query billing/payments data
     * @param {Object} attribution - Attribution event
     * @returns {Promise<number>}
     */
    export function getRevenueForAttribution(attribution: Object): Promise<number>;
    /**
     * Insert a settlement row (immutable)
     * @param {Object} settlement - Settlement data
     * @returns {Promise<void>}
     */
    export function insertSettlement(settlement: Object): Promise<void>;
    /**
     * Create an adjustment entry (for corrections without modifying history)
     *
     * CRITICAL: Adjustments must be in a NEW period, not the original period.
     * The original settlement remains immutable.
     *
     * @param {Object} params - Adjustment parameters
     * @param {string} params.originalSettlementId - ID of settlement being corrected
     * @param {string} params.periodId - Period ID for the adjustment (must be OPEN or CALCULATED)
     * @param {number} params.adjustmentAmount - Positive or negative adjustment
     * @param {string} params.reason - Required reason for adjustment
     * @param {string} params.createdByUserId - User creating the adjustment
     * @returns {Promise<Object>} Created adjustment entry
     */
    export function createAdjustment(params: {
        originalSettlementId: string;
        periodId: string;
        adjustmentAmount: number;
        reason: string;
        createdByUserId: string;
    }): Promise<Object>;
    /**
     * Clear settlements for a period (only for recalculation of OPEN/CALCULATED periods)
     * @param {string} periodId - Period ID
     * @returns {Promise<void>}
     */
    export function clearPeriodSettlements(periodId: string): Promise<void>;
    /**
     * Update period status and totals
     * @param {string} periodId - Period ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<void>}
     */
    export function updatePeriodStatus(periodId: string, updates: Object): Promise<void>;
    /**
     * Lock a settlement period (makes it immutable)
     *
     * Rules:
     * 1. Only CALCULATED periods can be locked
     * 2. After locking, no recalculation or modification is allowed
     *
     * @param {string} periodId - Period ID
     * @param {string} lockedByUserId - User locking the period
     * @returns {Promise<Object>}
     */
    export function lockPeriod(periodId: string, lockedByUserId: string): Promise<Object>;
    /**
     * Get settlements for a period
     * @param {string} periodId - Period ID
     * @returns {Promise<Array>}
     */
    export function getPeriodSettlements(periodId: string): Promise<any[]>;
    /**
     * Get partner report for a specific period
     * @param {string} partnerId - Partner ID
     * @param {string} periodId - Period ID
     * @returns {Promise<Object>}
     */
    export function getPartnerReport(partnerId: string, periodId: string): Promise<Object>;
    /**
     * Get all settlements for a partner across all periods
     * @param {string} partnerId - Partner ID
     * @returns {Promise<Array>}
     */
    export function getPartnerSettlements(partnerId: string): Promise<any[]>;
    /**
     * Export settlements for a period
     * @param {string} periodId - Period ID
     * @param {string} format - 'json' or 'csv'
     * @returns {Promise<Object>}
     */
    export function exportSettlements(periodId: string, format?: string): Promise<Object>;
}
declare namespace PERIOD_STATUS {
    let OPEN: string;
    let CALCULATED: string;
    let LOCKED: string;
}
declare namespace ENTRY_TYPES {
    let NORMAL: string;
    let ADJUSTMENT: string;
}
//# sourceMappingURL=settlementService.d.ts.map