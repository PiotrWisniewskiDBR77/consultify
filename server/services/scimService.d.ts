export default sCIMServiceInstance;
declare const sCIMServiceInstance: SCIMService;
declare class SCIMService {
    /**
     * Get or create SCIM service provider configuration for an organization
     */
    getServiceProvider(organizationId: any): Promise<any>;
    /**
     * Create or update SCIM service provider configuration
     */
    upsertServiceProvider(organizationId: any, config: any): Promise<any>;
    /**
     * Get SCIM service provider configuration response (RFC 7644)
     */
    getServiceProviderConfig(organizationId: any, baseUrl: any): {
        schemas: string[];
        documentationUri: string;
        patch: {
            supported: boolean;
        };
        bulk: {
            supported: boolean;
            maxOperations: number;
            maxPayloadSize: number;
        };
        filter: {
            supported: boolean;
            maxResults: number;
        };
        changePassword: {
            supported: boolean;
        };
        sort: {
            supported: boolean;
        };
        etag: {
            supported: boolean;
        };
        authenticationSchemes: {
            type: string;
            name: string;
            description: string;
            specUri: string;
            documentationUri: string;
            primary: boolean;
        }[];
        meta: {
            resourceType: string;
            location: string;
        };
    };
    /**
     * Generate a new SCIM bearer token
     */
    generateToken(organizationId: any, name: any, options?: {}): Promise<any>;
    /**
     * Validate a SCIM token and return the associated organization
     */
    validateToken(bearerToken: any): Promise<any>;
    /**
     * List all tokens for an organization
     */
    listTokens(organizationId: any): Promise<any>;
    /**
     * Revoke a SCIM token
     */
    revokeToken(tokenId: any, revokedBy: any): Promise<any>;
    /**
     * Create a SCIM user
     */
    createUser(organizationId: any, scimUser: any, tokenId: any): Promise<any>;
    /**
     * Get a SCIM user by SCIM ID
     */
    getUser(organizationId: any, scimId: any): Promise<any>;
    /**
     * List users with SCIM filtering
     */
    listUsers(organizationId: any, options?: {}): Promise<any>;
    /**
     * Update a SCIM user (PUT - full replace)
     */
    updateUser(organizationId: any, scimId: any, scimUser: any, tokenId: any): Promise<any>;
    /**
     * Patch a SCIM user (partial update)
     */
    patchUser(organizationId: any, scimId: any, operations: any, tokenId: any): Promise<any>;
    /**
     * Delete a SCIM user
     */
    deleteUser(organizationId: any, scimId: any, tokenId: any): Promise<any>;
    /**
     * Get group mappings for an organization
     */
    getGroupMappings(organizationId: any): Promise<any>;
    /**
     * Create or update a group mapping
     */
    upsertGroupMapping(organizationId: any, mapping: any): Promise<any>;
    /**
     * Delete a group mapping
     */
    deleteGroupMapping(organizationId: any, mappingId: any): Promise<any>;
    /**
     * Log a SCIM operation
     */
    logOperation(organizationId: any, tokenId: any, operation: any, resourceType: any, resourceId: any, externalId: any, requestBody: any, responseStatus: any, errorMessage: any): Promise<any>;
    /**
     * Get sync logs for an organization
     */
    getSyncLogs(organizationId: any, options?: {}): Promise<any>;
    /**
     * Format a user as a SCIM response
     */
    formatUserResponse(userId: any, scimId: any, user: any): {
        schemas: string[];
        id: any;
        externalId: any;
        userName: any;
        name: {
            formatted: string;
            familyName: any;
            givenName: any;
        };
        displayName: any;
        emails: {
            value: any;
            type: string;
            primary: boolean;
        }[];
        active: any;
        meta: {
            resourceType: string;
            location: string;
        };
    };
    /**
     * Create a SCIM error response
     */
    createErrorResponse(status: any, scimType: any, detail: any): {
        schemas: string[];
        status: any;
        scimType: any;
        detail: any;
    };
    /**
     * Get schema definitions
     */
    getSchemas(): {
        schemas: string[];
        totalResults: number;
        itemsPerPage: number;
        startIndex: number;
        Resources: {
            id: string;
            name: string;
            description: string;
            attributes: ({
                name: string;
                type: string;
                required: boolean;
                multiValued?: undefined;
            } | {
                name: string;
                type: string;
                required?: undefined;
                multiValued?: undefined;
            } | {
                name: string;
                type: string;
                multiValued: boolean;
                required?: undefined;
            })[];
            meta: {
                resourceType: string;
                location: string;
            };
        }[];
    };
    /**
     * Get resource types
     */
    getResourceTypes(): {
        schemas: string[];
        totalResults: number;
        Resources: {
            schemas: string[];
            id: string;
            name: string;
            endpoint: string;
            schema: string;
            meta: {
                resourceType: string;
                location: string;
            };
        }[];
    };
}
//# sourceMappingURL=scimService.d.ts.map