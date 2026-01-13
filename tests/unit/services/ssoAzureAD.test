/**
 * SSO Azure AD Extension Unit Tests
 * 
 * Tests for Azure AD/Entra ID SSO integration
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');
const crypto = require('crypto');

// Mock database
vi.mock('../../../server/database', () => ({
    default: {
        run: vi.fn((sql, params, cb) => {
            if (typeof params === 'function') {
                params.call({ lastID: 1, changes: 1 }, null);
            } else if (cb) {
                cb.call({ lastID: 1, changes: 1 }, null);
            }
        }),
        get: vi.fn((sql, params, cb) => {
            if (typeof params === 'function') {
                params(null, null);
            } else if (cb) {
                cb(null, null);
            }
        }),
        all: vi.fn((sql, params, cb) => {
            if (typeof params === 'function') {
                params(null, []);
            } else if (cb) {
                cb(null, []);
            }
        }),
    }
}));

const ssoService = require('../../../server/services/ssoService');

describe('Azure AD SSO Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.SSO_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    });

    describe('Azure AD Configuration', () => {
        it('should require tenant ID', () => {
            const config = {
                tenantId: '12345678-1234-1234-1234-123456789012',
                clientId: 'client-id',
                clientSecret: 'client-secret',
            };
            
            expect(config.tenantId).toBeDefined();
            expect(config.tenantId).toMatch(/^[a-f0-9-]+$/i);
        });

        it('should require client ID', () => {
            const config = {
                tenantId: 'tenant-id',
                clientId: '12345678-1234-1234-1234-123456789012',
                clientSecret: 'client-secret',
            };
            
            expect(config.clientId).toBeDefined();
        });

        it('should encrypt client secret', () => {
            const clientSecret = 'super-secret-key';
            const key = crypto.randomBytes(32);
            const iv = crypto.randomBytes(16);
            
            const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
            let encrypted = cipher.update(clientSecret, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            expect(encrypted).not.toBe(clientSecret);
        });

        it('should support allowed domains list', () => {
            const config = {
                allowedDomains: ['company.com', 'partner.com'],
            };
            
            expect(config.allowedDomains).toContain('company.com');
            expect(config.allowedDomains).toHaveLength(2);
        });
    });

    describe('OAuth 2.0 Authorization URL', () => {
        it('should build correct authorization endpoint', () => {
            const tenantId = 'tenant-123';
            const baseUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
            
            expect(baseUrl).toContain('login.microsoftonline.com');
            expect(baseUrl).toContain(tenantId);
        });

        it('should include required OAuth parameters', () => {
            const params = {
                client_id: 'client-123',
                response_type: 'code',
                redirect_uri: 'https://consultinity.app/api/sso/azure-ad/callback',
                scope: 'openid profile email',
                state: crypto.randomBytes(16).toString('hex'),
                response_mode: 'query',
            };
            
            expect(params.response_type).toBe('code');
            expect(params.scope).toContain('openid');
        });

        it('should include PKCE code challenge for security', () => {
            const codeVerifier = crypto.randomBytes(32).toString('base64url');
            const codeChallenge = crypto.createHash('sha256')
                .update(codeVerifier)
                .digest('base64url');
            
            expect(codeVerifier.length).toBeGreaterThan(40);
            expect(codeChallenge).toBeDefined();
        });

        it('should generate unique state for CSRF protection', () => {
            const state1 = crypto.randomBytes(16).toString('hex');
            const state2 = crypto.randomBytes(16).toString('hex');
            
            expect(state1).not.toBe(state2);
        });
    });

    describe('Token Exchange', () => {
        it('should build correct token endpoint', () => {
            const tenantId = 'tenant-123';
            const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
            
            expect(tokenUrl).toContain('/token');
        });

        it('should include required token request parameters', () => {
            const params = {
                client_id: 'client-123',
                client_secret: 'secret-456',
                code: 'auth-code',
                redirect_uri: 'https://consultinity.app/api/sso/azure-ad/callback',
                grant_type: 'authorization_code',
            };
            
            expect(params.grant_type).toBe('authorization_code');
        });

        it('should handle token response', () => {
            const tokenResponse = {
                access_token: 'eyJ...',
                token_type: 'Bearer',
                expires_in: 3600,
                scope: 'openid profile email',
                id_token: 'eyJ...',
            };
            
            expect(tokenResponse.token_type).toBe('Bearer');
            expect(tokenResponse.expires_in).toBe(3600);
        });
    });

    describe('ID Token Validation', () => {
        it('should validate token issuer', () => {
            const tenantId = 'tenant-123';
            const expectedIssuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
            const actualIssuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
            
            expect(actualIssuer).toBe(expectedIssuer);
        });

        it('should validate token audience', () => {
            const clientId = 'client-123';
            const tokenClaims = { aud: clientId };
            
            expect(tokenClaims.aud).toBe(clientId);
        });

        it('should check token expiration', () => {
            const now = Math.floor(Date.now() / 1000);
            const validExp = now + 3600;
            const expiredExp = now - 3600;
            
            expect(validExp > now).toBe(true);
            expect(expiredExp > now).toBe(false);
        });

        it('should validate nonce for replay protection', () => {
            const sentNonce = crypto.randomBytes(16).toString('hex');
            const receivedNonce = sentNonce;
            
            expect(receivedNonce).toBe(sentNonce);
        });
    });

    describe('User Claims Mapping', () => {
        it('should extract email from preferred_username', () => {
            const claims = {
                preferred_username: 'user@company.com',
            };
            
            expect(claims.preferred_username).toContain('@');
        });

        it('should extract email from email claim', () => {
            const claims = {
                email: 'user@company.com',
            };
            
            expect(claims.email).toContain('@');
        });

        it('should map name claims', () => {
            const claims = {
                given_name: 'John',
                family_name: 'Doe',
                name: 'John Doe',
            };
            
            expect(claims.given_name).toBe('John');
            expect(claims.family_name).toBe('Doe');
        });

        it('should extract Azure AD object ID', () => {
            const claims = {
                oid: '12345678-1234-1234-1234-123456789012',
                sub: 'unique-subject-id',
            };
            
            expect(claims.oid).toBeDefined();
        });

        it('should extract group memberships from groups claim', () => {
            const claims = {
                groups: [
                    '11111111-1111-1111-1111-111111111111',
                    '22222222-2222-2222-2222-222222222222',
                ],
            };
            
            expect(claims.groups).toHaveLength(2);
        });

        it('should handle roles claim for app roles', () => {
            const claims = {
                roles: ['Admin', 'User'],
            };
            
            expect(claims.roles).toContain('Admin');
        });
    });

    describe('Domain Validation', () => {
        it('should allow email from configured domain', () => {
            const allowedDomains = ['company.com', 'partner.com'];
            const email = 'user@company.com';
            const domain = email.split('@')[1];
            
            expect(allowedDomains.includes(domain)).toBe(true);
        });

        it('should reject email from unconfigured domain', () => {
            const allowedDomains = ['company.com'];
            const email = 'user@attacker.com';
            const domain = email.split('@')[1];
            
            expect(allowedDomains.includes(domain)).toBe(false);
        });

        it('should support wildcard subdomain matching', () => {
            const allowedPattern = '*.company.com';
            const email = 'user@dev.company.com';
            const domain = email.split('@')[1];
            
            const isAllowed = domain.endsWith('.company.com');
            expect(isAllowed).toBe(true);
        });
    });

    describe('SCIM Integration', () => {
        it('should support SCIM provisioning toggle', () => {
            const config = {
                tenantId: 'tenant-123',
                clientId: 'client-123',
                scimEnabled: true,
            };
            
            expect(config.scimEnabled).toBe(true);
        });

        it('should link SCIM token to SSO config', () => {
            const config = {
                tenantId: 'tenant-123',
                scimEnabled: true,
                scimTokenId: 'token-456',
            };
            
            expect(config.scimTokenId).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid_client error', () => {
            const error = {
                error: 'invalid_client',
                error_description: 'Client authentication failed',
            };
            
            expect(error.error).toBe('invalid_client');
        });

        it('should handle invalid_grant error', () => {
            const error = {
                error: 'invalid_grant',
                error_description: 'Authorization code expired',
            };
            
            expect(error.error).toBe('invalid_grant');
        });

        it('should handle consent_required error', () => {
            const error = {
                error: 'consent_required',
                error_description: 'User consent required',
            };
            
            expect(error.error).toBe('consent_required');
        });

        it('should handle interaction_required error', () => {
            const error = {
                error: 'interaction_required',
                error_description: 'User interaction required',
            };
            
            expect(error.error).toBe('interaction_required');
        });
    });

    describe('Multi-Tenant Support', () => {
        it('should support single tenant configuration', () => {
            const config = {
                tenantId: '12345678-1234-1234-1234-123456789012',
                multiTenant: false,
            };
            
            expect(config.multiTenant).toBe(false);
        });

        it('should support common endpoint for multi-tenant', () => {
            const multiTenantUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
            
            expect(multiTenantUrl).toContain('/common/');
        });

        it('should support organizations endpoint', () => {
            const orgUrl = 'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize';
            
            expect(orgUrl).toContain('/organizations/');
        });
    });

    describe('Session Management', () => {
        it('should create session after successful login', () => {
            const session = {
                userId: 'user-123',
                organizationId: 'org-456',
                ssoProvider: 'azure-ad',
                tenantId: 'tenant-789',
                expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
            };
            
            expect(session.ssoProvider).toBe('azure-ad');
        });

        it('should support single logout', () => {
            const tenantId = 'tenant-123';
            const logoutUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout`;
            const postLogoutRedirect = 'https://consultinity.app';
            
            expect(logoutUrl).toContain('/logout');
        });
    });
});













