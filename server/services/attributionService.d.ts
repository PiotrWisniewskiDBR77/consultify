export default AttributionService;
declare namespace AttributionService {
    export { SOURCE_TYPES };
    export function setDependencies(newDeps: object): void;
    export function recordAttribution(params: {
        organizationId: string;
        userId: string;
        sourceType: string;
        sourceId: string;
        campaign: string;
        partnerCode: string;
        medium: string;
        metadata: object;
    }): Promise<{
        eventId: string;
    }>;
    export function getOrganizationAttribution(organizationId: string): Promise<object[]>;
    export function getFirstAttribution(organizationId: string): Promise<object | null>;
    export function hasAttribution(organizationId: string): Promise<boolean>;
    export function exportAttribution(filters?: {
        startDate: string;
        endDate: string;
        partnerCode: string;
        sourceType: string;
    }): Promise<object[]>;
    export function getPartnerSummary(startDate?: string, endDate?: string): Promise<object[]>;
}
declare namespace SOURCE_TYPES {
    let PROMO_CODE: string;
    let INVITATION: string;
    let DEMO: string;
    let SALES: string;
    let SELF_SERVE: string;
}
//# sourceMappingURL=attributionService.d.ts.map