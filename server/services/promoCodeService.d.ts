export default PromoCodeService;
declare namespace PromoCodeService {
    export { PROMO_TYPES };
    export { DISCOUNT_TYPES };
    export function setDependencies(newDeps: object): void;
    export function validatePromoCode(code: string): Promise<{
        valid: boolean;
        code?: object;
        reason?: string;
    }>;
    export function hasBeenUsedByOrg(code: string, organizationId: string): Promise<boolean>;
    export function markPromoCodeUsed(code: string, organizationId: string, userId?: string): Promise<{
        success: boolean;
        reason?: string;
    }>;
    export function createPromoCode(params: {
        code: string;
        type: string;
        discountType: string;
        discountValue: number;
        validFrom: string;
        validUntil: string;
        maxUses: number;
        createdByUserId: string;
        metadata: object;
    }): Promise<object>;
    export function listPromoCodes(options?: {
        includeInactive: boolean;
        type: string;
        limit: number;
        offset: number;
    }): Promise<object[]>;
    export function deactivatePromoCode(codeId: string): Promise<{
        success: boolean;
    }>;
    export function getUsageHistory(codeId: string): Promise<object[]>;
}
declare namespace PROMO_TYPES {
    let DISCOUNT: string;
    let PARTNER: string;
    let CAMPAIGN: string;
}
declare namespace DISCOUNT_TYPES {
    let PERCENT: string;
    let FIXED: string;
    let NONE: string;
}
//# sourceMappingURL=promoCodeService.d.ts.map