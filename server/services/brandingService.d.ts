export default BrandingService;
declare namespace BrandingService {
    /**
     * Get all organization brandings (SuperAdmin)
     */
    export function listAll(): Promise<{
        brandings: any;
        orgsWithoutBranding: any;
    }>;
    /**
     * Get branding for specific organization
     */
    export function getByOrganization(organizationId: any): Promise<{
        id: any;
        organizationId: any;
        organizationName: any;
        logoLightUrl: any;
        logoDarkUrl: any;
        logoIconUrl: any;
        faviconUrl: any;
        primaryColor: any;
        secondaryColor: any;
        accentColor: any;
        backgroundColor: any;
        textColor: any;
        darkPrimaryColor: any;
        darkSecondaryColor: any;
        darkBackgroundColor: any;
        darkTextColor: any;
        fontFamily: any;
        headingFontFamily: any;
        loginBackgroundUrl: any;
        loginTagline: any;
        loginWelcomeMessage: any;
        customDomain: any;
        customDomainVerified: boolean;
        customDomainSslStatus: any;
        hidePoweredBy: boolean;
        customSupportEmail: any;
        customTermsUrl: any;
        customPrivacyUrl: any;
        customCss: any;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Create branding for organization
     */
    export function create(organizationId: any, config: any, createdBy?: null): Promise<{
        id: string;
        success: boolean;
    }>;
    /**
     * Update branding for organization
     */
    export function update(organizationId: any, updates: any, updatedBy?: null): Promise<{
        success: boolean;
        message: string;
    } | {
        success: boolean;
        message?: undefined;
    }>;
    /**
     * Create or update branding
     */
    export function upsert(organizationId: any, config: any, createdBy?: null): Promise<{
        id: string;
        success: boolean;
    } | {
        success: boolean;
        message: string;
    } | {
        success: boolean;
        message?: undefined;
    }>;
    /**
     * Delete branding (reset to defaults)
     */
    function _delete(organizationId: any): Promise<{
        success: boolean;
    }>;
    export { _delete as delete };
    /**
     * Clone branding from one org to another
     */
    export function clone(sourceOrgId: any, targetOrgId: any, createdBy?: null): Promise<{
        id: string;
        success: boolean;
    } | {
        success: boolean;
        message: string;
    } | {
        success: boolean;
        message?: undefined;
    }>;
    export function _formatBranding(row: any): {
        id: any;
        organizationId: any;
        organizationName: any;
        logoLightUrl: any;
        logoDarkUrl: any;
        logoIconUrl: any;
        faviconUrl: any;
        primaryColor: any;
        secondaryColor: any;
        accentColor: any;
        backgroundColor: any;
        textColor: any;
        darkPrimaryColor: any;
        darkSecondaryColor: any;
        darkBackgroundColor: any;
        darkTextColor: any;
        fontFamily: any;
        headingFontFamily: any;
        loginBackgroundUrl: any;
        loginTagline: any;
        loginWelcomeMessage: any;
        customDomain: any;
        customDomainVerified: boolean;
        customDomainSslStatus: any;
        hidePoweredBy: boolean;
        customSupportEmail: any;
        customTermsUrl: any;
        customPrivacyUrl: any;
        customCss: any;
        createdAt: any;
        updatedAt: any;
    };
}
//# sourceMappingURL=brandingService.d.ts.map