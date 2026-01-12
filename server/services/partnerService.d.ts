export default PartnerService;
declare namespace PartnerService {
    export { PARTNER_TYPES };
    /**
     * Create a new partner
     * @param {Object} params - Partner data
     * @param {string} params.name - Partner name
     * @param {string} params.partnerType - REFERRAL | RESELLER | SALES
     * @param {string} [params.email] - Contact email
     * @param {string} [params.contactName] - Contact person name
     * @param {number} [params.defaultRevenueSharePercent] - Default revenue share %
     * @param {Object} [params.metadata] - Additional metadata
     * @returns {Promise<Object>} Created partner
     */
    export function createPartner(params: {
        name: string;
        partnerType: string;
        email?: string | undefined;
        contactName?: string | undefined;
        defaultRevenueSharePercent?: number | undefined;
        metadata?: Object | undefined;
    }): Promise<Object>;
    /**
     * Get partner by ID
     * @param {string} id - Partner ID
     * @returns {Promise<Object|null>}
     */
    export function getPartner(id: string): Promise<Object | null>;
    /**
     * List all partners
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>}
     */
    export function listPartners(filters?: Object): Promise<any[]>;
    /**
     * Update partner
     * @param {string} id - Partner ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>}
     */
    export function updatePartner(id: string, updates: Object): Promise<Object>;
    /**
     * Create a partner agreement
     * @param {Object} params - Agreement data
     * @returns {Promise<Object>}
     */
    export function createAgreement(params: Object): Promise<Object>;
    /**
     * Get the active agreement for a partner at a specific date
     * @param {string} partnerId - Partner ID
     * @param {string} [atDate] - Date to check (ISO string, defaults to now)
     * @returns {Promise<Object|null>}
     */
    export function getActiveAgreement(partnerId: string, atDate?: string): Promise<Object | null>;
    /**
     * Get all agreements for a partner
     * @param {string} partnerId - Partner ID
     * @returns {Promise<Array>}
     */
    export function getAgreements(partnerId: string): Promise<any[]>;
    /**
     * Get partner by their partner code (for attribution lookups)
     * Partner codes link promo codes to partners
     * @param {string} partnerCode - Partner code from promo_codes table
     * @returns {Promise<Object|null>}
     */
    export function getByPartnerCode(partnerCode: string): Promise<Object | null>;
}
declare namespace PARTNER_TYPES {
    let REFERRAL: string;
    let RESELLER: string;
    let SALES: string;
}
//# sourceMappingURL=partnerService.d.ts.map