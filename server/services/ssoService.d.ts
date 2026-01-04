export default SSOService;
declare namespace SSOService {
    /**
     * List all SSO configurations across all organizations (SuperAdmin)
     */
    function listAllConfigurations(): Promise<any>;
    /**
     * Toggle SSO configuration active status
     */
    function toggleConfiguration(configId: any, isActive: any): Promise<{
        success: boolean;
    }>;
    /**
     * Delete SSO configuration
     */
    function deleteConfiguration(configId: any): Promise<{
        success: boolean;
    }>;
    /**
     * Create Google OIDC configuration
     */
    function createGoogleConfig(organizationId: any, { clientId, clientSecret, allowedDomains }: {
        clientId: any;
        clientSecret: any;
        allowedDomains?: never[] | undefined;
    }, createdBy?: null): Promise<{
        id: any;
        redirectUri: string;
    }>;
    /**
     * Update Google OIDC configuration
     */
    function updateGoogleConfig(organizationId: any, updates: any, updatedBy?: null): Promise<{
        success: boolean;
    }>;
    /**
     * Process Google OIDC callback
     */
    function processGoogleCallback(organizationId: any, code: any, requestInfo?: {}): Promise<{
        user: {
            id: any;
            email: any;
            firstName: any;
            lastName: any;
            role: any;
            organizationId: any;
        };
        sessionId: any;
        expiresAt: string;
    }>;
    /**
     * Generate Google OAuth URL
     */
    function getGoogleAuthUrl(organizationId: any): Promise<string>;
    /**
     * Create SSO configuration for organization
     * @param {string} organizationId
     * @param {Object} config
     */
    function createConfiguration(organizationId: string, config: Object, createdBy?: null): Promise<{
        id: any;
        spEntityId: string;
        spAcsUrl: string;
        spSloUrl: string;
    }>;
    /**
     * Get SSO configuration for organization
     * @param {string} organizationId
     * @param {boolean} includeSecrets
     */
    function getConfiguration(organizationId: string, includeSecrets?: boolean): Promise<{
        id: any;
        organizationId: any;
        providerType: any;
        providerName: any;
        isActive: boolean;
        isVerified: boolean;
        idpEntityId: any;
        idpSsoUrl: any;
        idpSloUrl: any;
        idpCertificate: any;
        spEntityId: any;
        spAcsUrl: any;
        spSloUrl: any;
        enforceSso: boolean;
        allowPasswordLogin: boolean;
        autoProvisionUsers: boolean;
        defaultRole: any;
        attributeMapping: any;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Update SSO configuration
     * @param {string} organizationId
     * @param {Object} updates
     */
    function updateConfiguration(organizationId: string, updates: Object, updatedBy?: null): Promise<{
        success: boolean;
    }>;
    /**
     * Activate SSO for organization
     * @param {string} organizationId
     */
    function activate(organizationId: string): Promise<{
        success: boolean;
    }>;
    /**
     * Deactivate SSO
     * @param {string} organizationId
     */
    function deactivate(organizationId: string): Promise<{
        success: boolean;
    }>;
    /**
     * Generate SP metadata XML for SAML
     * @param {string} organizationId
     */
    function generateMetadata(organizationId: string): Promise<string>;
    /**
     * Process SAML assertion
     * @param {string} organizationId
     * @param {Object} assertion - Parsed SAML assertion
     */
    function processSAMLAssertion(organizationId: string, assertion: Object, requestInfo?: {}): Promise<{
        user: {
            id: any;
            email: any;
            firstName: any;
            lastName: any;
            role: any;
            organizationId: any;
        };
        sessionId: any;
        expiresAt: string;
    }>;
    /**
     * Terminate SSO session (logout)
     * @param {string} sessionId
     * @param {string} reason
     */
    function terminateSession(sessionId: string, reason?: string): Promise<void>;
    /**
     * Get login attempts for troubleshooting
     * @param {string} organizationId
     * @param {Object} options
     */
    function getLoginAttempts(organizationId: string, options?: Object): Promise<any>;
    /**
     * Create Azure AD configuration
     */
    function createAzureADConfig(organizationId: any, { tenantId, clientId, clientSecret, allowedDomains }: {
        tenantId: any;
        clientId: any;
        clientSecret: any;
        allowedDomains?: never[] | undefined;
    }, createdBy?: null): Promise<{
        id: any;
        redirectUri: string;
    }>;
    /**
     * Update Azure AD configuration
     */
    function updateAzureADConfig(organizationId: any, updates: any, updatedBy?: null): Promise<{
        success: boolean;
    }>;
    /**
     * Get Azure AD configuration
     */
    function getAzureADConfiguration(organizationId: any, includeSecrets?: boolean): Promise<{
        id: any;
        organizationId: any;
        providerType: any;
        providerName: any;
        tenantId: any;
        isActive: boolean;
        isVerified: boolean;
        enforceSso: boolean;
        allowPasswordLogin: boolean;
        autoProvisionUsers: boolean;
        defaultRole: any;
        scimEnabled: boolean;
        attributeMapping: any;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Generate Azure AD OAuth URL
     */
    function getAzureADAuthUrl(organizationId: any): Promise<string>;
    /**
     * Process Azure AD callback
     */
    function processAzureADCallback(organizationId: any, code: any, requestInfo?: {}): Promise<{
        user: {
            id: any;
            email: any;
            firstName: any;
            lastName: any;
            displayName: any;
            role: any;
            organizationId: any;
        };
        sessionId: any;
        expiresAt: string;
    }>;
    function _logAttempt(attempt: any): Promise<void>;
}
//# sourceMappingURL=ssoService.d.ts.map