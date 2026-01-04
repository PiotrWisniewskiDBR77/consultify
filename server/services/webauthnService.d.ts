export default webAuthnServiceInstance;
declare const webAuthnServiceInstance: WebAuthnService;
declare class WebAuthnService {
    /**
     * Generate registration options for WebAuthn credential creation
     */
    generateRegistrationOptions(userId: any, userName: any, userDisplayName: any): Promise<{
        challengeId: string;
        options: {
            challenge: any;
            rp: {
                name: string;
                id: string;
            };
            user: {
                id: any;
                name: any;
                displayName: any;
            };
            pubKeyCredParams: {
                alg: number;
                type: string;
            }[];
            authenticatorSelection: {
                authenticatorAttachment: string;
                requireResidentKey: boolean;
                residentKey: string;
                userVerification: string;
            };
            timeout: number;
            attestation: string;
            excludeCredentials: any;
        };
    }>;
    /**
     * Verify registration response and store credential
     */
    verifyRegistration(challengeId: any, userId: any, response: any, deviceName?: null): Promise<{
        credentialId: string;
        deviceType: any;
        created: boolean;
    }>;
    /**
     * Generate authentication options
     */
    generateAuthenticationOptions(userId?: null): Promise<{
        challengeId: string;
        options: {
            challenge: any;
            timeout: number;
            rpId: string;
            userVerification: string;
            allowCredentials: any;
        };
    }>;
    /**
     * Verify authentication response
     */
    verifyAuthentication(challengeId: any, response: any): Promise<{
        verified: boolean;
        userId: any;
        credentialId: any;
    }>;
    /**
     * Get all credentials for a user
     */
    getUserCredentials(userId: any): Promise<any>;
    /**
     * Get credential by WebAuthn credential ID
     */
    getCredentialById(credentialId: any): Promise<any>;
    /**
     * Store a new credential
     */
    storeCredential(credential: any): Promise<any>;
    /**
     * Update credential usage (sign count and last used)
     */
    updateCredentialUsage(id: any, signCount: any): Promise<any>;
    /**
     * Rename a credential
     */
    renameCredential(credentialId: any, userId: any, newName: any): Promise<any>;
    /**
     * Revoke a credential
     */
    revokeCredential(credentialId: any, userId: any, reason?: null): Promise<any>;
    /**
     * Check if user has WebAuthn enabled
     */
    isWebAuthnEnabled(userId: any): Promise<any>;
    /**
     * Generate a random challenge
     */
    generateChallenge(): NonSharedBuffer;
    /**
     * Store a challenge
     */
    storeChallenge(id: any, userId: any, challenge: any, type: any, expiresAt: any, options: any): Promise<any>;
    /**
     * Get a challenge
     */
    getChallenge(id: any): Promise<any>;
    /**
     * Invalidate a challenge (mark as used)
     */
    invalidateChallenge(id: any): Promise<any>;
    /**
     * Base64URL encode
     */
    base64URLEncode(buffer: any): any;
    /**
     * Base64URL decode
     */
    base64URLDecode(str: any): Buffer<ArrayBuffer>;
    /**
     * Decode CBOR attestation object (simplified)
     */
    decodeAttestationObject(buffer: any): {
        fmt: string;
        authData: null;
        attStmt: {};
        flags: {};
        aaguid: null;
        signCount: number;
    };
    /**
     * Extract public key from authenticator data
     */
    extractPublicKey(authData: any): any;
    /**
     * Parse authenticator data for authentication
     */
    parseAuthenticatorData(authData: any): {
        rpIdHash: any;
        flags: {
            up: boolean;
            uv: boolean;
            be: boolean;
            bs: boolean;
        };
        signCount: any;
    };
}
//# sourceMappingURL=webauthnService.d.ts.map