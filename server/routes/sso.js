/**
 * SSO Routes
 * 
 * API endpoints for SSO configuration and authentication.
 * Includes SuperAdmin routes for managing all organization SSO configs.
 */

import express from 'express';
const router = express.Router();
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import authMiddleware from '../middleware/authMiddleware.js';
import verifySuperAdmin from '../middleware/superAdminMiddleware.js';
import rbacMiddleware from '../middleware/rbac.js';
const { requireOrgAccess } = rbacMiddleware;
import * as SSOServiceModule from '../services/ssoService.js';
const SSOService = SSOServiceModule.default || SSOServiceModule;
import AuditService from '../services/auditService.js';

// ==========================================
// SUPERADMIN ROUTES
// ==========================================

/**
 * GET /api/sso/superadmin/configs
 * List all SSO configurations (SuperAdmin only)
 */
router.get('/superadmin/configs', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const configs = await SSOService.listAllConfigurations();
        res.json({ configs });
    } catch (error) {
        console.error('[SSO] List all configs error:', error);
        res.status(500).json({ error: 'Failed to list SSO configurations' });
    }
});

/**
 * POST /api/sso/superadmin/google/config
 * Create Google SSO config for any organization (SuperAdmin only)
 */
router.post('/superadmin/google/config', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { organizationId, clientId, clientSecret, allowedDomains } = req.body;
        
        if (!organizationId || !clientId) {
            return res.status(400).json({ error: 'organizationId and clientId are required' });
        }
        
        const result = await SSOService.createGoogleConfig(
            organizationId, 
            { clientId, clientSecret, allowedDomains },
            req.user.id
        );
        
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[SSO] Create Google config error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * PUT /api/sso/superadmin/google/config/:orgId
 * Update Google SSO config for any organization (SuperAdmin only)
 */
router.put('/superadmin/google/config/:orgId', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { orgId } = req.params;
        await SSOService.updateGoogleConfig(orgId, req.body, req.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[SSO] Update Google config error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * PUT /api/sso/superadmin/config/:configId/toggle
 * Toggle SSO config active status (SuperAdmin only)
 */
router.put('/superadmin/config/:configId/toggle', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { configId } = req.params;
        const { isActive } = req.body;
        
        await SSOService.toggleConfiguration(configId, isActive);
        res.json({ success: true });
    } catch (error) {
        console.error('[SSO] Toggle config error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * DELETE /api/sso/superadmin/config/:configId
 * Delete SSO configuration (SuperAdmin only)
 */
router.delete('/superadmin/config/:configId', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { configId } = req.params;
        await SSOService.deleteConfiguration(configId);
        res.json({ success: true });
    } catch (error) {
        console.error('[SSO] Delete config error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/sso/superadmin/config/:orgId
 * Get SSO config for specific org (SuperAdmin only)
 */
router.get('/superadmin/config/:orgId', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { orgId } = req.params;
        const ssoConfig = await SSOService.getConfiguration(orgId);
        
        if (!ssoConfig) {
            return res.json({ configured: false });
        }
        
        res.json({ configured: true, config: ssoConfig });
    } catch (error) {
        console.error('[SSO] Get config error:', error);
        res.status(500).json({ error: 'Failed to get SSO configuration' });
    }
});

// ==========================================
// GOOGLE OIDC ROUTES
// ==========================================

/**
 * GET /api/sso/google/login/:organizationId
 * Initiate Google SSO login
 */
router.get('/google/login/:organizationId', async (req, res) => {
    try {
        const { organizationId } = req.params;
        const authUrl = await SSOService.getGoogleAuthUrl(organizationId);
        res.redirect(authUrl);
    } catch (error) {
        console.error('[SSO] Google login error:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/sso/error?message=${encodeURIComponent(error.message)}`);
    }
});

/**
 * GET /api/sso/google/callback
 * Google OAuth callback handler
 */
router.get('/google/callback', async (req, res) => {
    try {
        const { code, state, error: oauthError } = req.query;
        
        if (oauthError) {
            throw new Error(oauthError);
        }
        
        if (!code || !state) {
            throw new Error('Missing authorization code or state');
        }
        
        // Decode state to get organizationId
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        const { organizationId } = stateData;
        
        const result = await SSOService.processGoogleCallback(organizationId, code, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
        });
        
        // Generate JWT token
        const token = jwt.sign({
            id: result.user.id,
            email: result.user.email,
            role: result.user.role,
            organizationId: result.user.organizationId,
            ssoSessionId: result.sessionId,
        }, config.JWT_SECRET, { expiresIn: '8h' });
        
        // Redirect to frontend with token
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/sso/callback?token=${token}`);
        
    } catch (error) {
        console.error('[SSO] Google callback error:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/sso/error?message=${encodeURIComponent(error.message)}`);
    }
});

// ==========================================
// AZURE AD (Microsoft Entra ID) ROUTES
// ==========================================

/**
 * POST /api/sso/superadmin/azure-ad/config
 * Create Azure AD SSO config for any organization (SuperAdmin only)
 */
router.post('/superadmin/azure-ad/config', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { organizationId, tenantId, clientId, clientSecret, allowedDomains } = req.body;
        
        if (!organizationId || !tenantId || !clientId) {
            return res.status(400).json({ error: 'organizationId, tenantId, and clientId are required' });
        }
        
        const result = await SSOService.createAzureADConfig(
            organizationId, 
            { tenantId, clientId, clientSecret, allowedDomains },
            req.user.id
        );
        
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[SSO] Create Azure AD config error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * PUT /api/sso/superadmin/azure-ad/config/:orgId
 * Update Azure AD SSO config for any organization (SuperAdmin only)
 */
router.put('/superadmin/azure-ad/config/:orgId', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { orgId } = req.params;
        await SSOService.updateAzureADConfig(orgId, req.body, req.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[SSO] Update Azure AD config error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/sso/superadmin/azure-ad/config/:orgId
 * Get Azure AD config for specific org (SuperAdmin only)
 */
router.get('/superadmin/azure-ad/config/:orgId', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { orgId } = req.params;
        const azureConfig = await SSOService.getAzureADConfiguration(orgId);
        
        if (!azureConfig) {
            return res.json({ configured: false });
        }
        
        res.json({ configured: true, config: azureConfig });
    } catch (error) {
        console.error('[SSO] Get Azure AD config error:', error);
        res.status(500).json({ error: 'Failed to get Azure AD configuration' });
    }
});

/**
 * GET /api/sso/azure-ad/login/:organizationId
 * Initiate Azure AD SSO login
 */
router.get('/azure-ad/login/:organizationId', async (req, res) => {
    try {
        const { organizationId } = req.params;
        const authUrl = await SSOService.getAzureADAuthUrl(organizationId);
        res.redirect(authUrl);
    } catch (error) {
        console.error('[SSO] Azure AD login error:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/sso/error?message=${encodeURIComponent(error.message)}`);
    }
});

/**
 * GET /api/sso/azure-ad/callback
 * Azure AD OAuth callback handler
 */
router.get('/azure-ad/callback', async (req, res) => {
    try {
        const { code, state, error: oauthError, error_description } = req.query;
        
        if (oauthError) {
            throw new Error(error_description || oauthError);
        }
        
        if (!code || !state) {
            throw new Error('Missing authorization code or state');
        }
        
        // Decode state to get organizationId (using base64url for Azure)
        let stateData;
        try {
            stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
        } catch {
            // Try regular base64 as fallback
            stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        }
        const { organizationId } = stateData;
        
        const result = await SSOService.processAzureADCallback(organizationId, code, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
        });
        
        // Generate JWT token
        const token = jwt.sign({
            id: result.user.id,
            email: result.user.email,
            role: result.user.role,
            organizationId: result.user.organizationId,
            ssoSessionId: result.sessionId,
        }, config.JWT_SECRET, { expiresIn: '8h' });
        
        // Redirect to frontend with token
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/sso/callback?token=${token}&provider=azure-ad`);
        
    } catch (error) {
        console.error('[SSO] Azure AD callback error:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/sso/error?message=${encodeURIComponent(error.message)}&provider=azure-ad`);
    }
});

/**
 * GET /api/sso/azure-ad/config
 * Get Azure AD config for current organization
 */
router.get('/azure-ad/config', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const azureConfig = await SSOService.getAzureADConfiguration(orgId);
        
        if (!azureConfig) {
            return res.json({ configured: false });
        }
        
        res.json({ configured: true, config: azureConfig });
    } catch (error) {
        console.error('[SSO] Get Azure AD config error:', error);
        res.status(500).json({ error: 'Failed to get Azure AD configuration' });
    }
});

/**
 * POST /api/sso/azure-ad/config
 * Create Azure AD config for current organization
 */
router.post('/azure-ad/config', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { tenantId, clientId, clientSecret, allowedDomains } = req.body;
        
        if (!tenantId || !clientId) {
            return res.status(400).json({ error: 'tenantId and clientId are required' });
        }
        
        const result = await SSOService.createAzureADConfig(
            orgId, 
            { tenantId, clientId, clientSecret, allowedDomains },
            req.user.id
        );
        
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[SSO] Create Azure AD config error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * PUT /api/sso/azure-ad/config
 * Update Azure AD config for current organization
 */
router.put('/azure-ad/config', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        await SSOService.updateAzureADConfig(orgId, req.body, req.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[SSO] Update Azure AD config error:', error);
        res.status(400).json({ error: error.message });
    }
});

// ==========================================
// GENERAL CONFIG ROUTES
// ==========================================

/**
 * GET /api/sso/config
 * Get SSO configuration for current organization
 */
router.get('/config', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const config = await SSOService.getConfiguration(orgId);

        if (!config) {
            return res.json({ configured: false });
        }

        res.json({ configured: true, config });
    } catch (error) {
        console.error('[SSO] Get config error:', error);
        res.status(500).json({ error: 'Failed to get SSO configuration' });
    }
});

/**
 * POST /api/sso/config
 * Create SSO configuration
 */
router.post('/config', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const result = await SSOService.createConfiguration(orgId, req.body, req.user.id);

        AuditService.logFromRequest(req, 'SSO_CONFIG_CREATED', 'organization', orgId);

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[SSO] Create config error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * PUT /api/sso/config
 * Update SSO configuration
 */
router.put('/config', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        await SSOService.updateConfiguration(orgId, req.body, req.user.id);

        res.json({ success: true });
    } catch (error) {
        console.error('[SSO] Update config error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/sso/activate
 * Activate SSO for organization
 */
router.post('/activate', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        await SSOService.activate(orgId);

        res.json({ success: true, message: 'SSO activated' });
    } catch (error) {
        console.error('[SSO] Activate error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/sso/deactivate
 * Deactivate SSO for organization
 */
router.post('/deactivate', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        await SSOService.deactivate(orgId);

        res.json({ success: true, message: 'SSO deactivated' });
    } catch (error) {
        console.error('[SSO] Deactivate error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/sso/metadata/:organizationId
 * Get SP metadata XML (public endpoint for IdP configuration)
 */
router.get('/metadata/:organizationId', async (req, res) => {
    try {
        const { organizationId } = req.params;
        const metadata = await SSOService.generateMetadata(organizationId);

        res.set('Content-Type', 'application/xml');
        res.send(metadata);
    } catch (error) {
        console.error('[SSO] Metadata error:', error);
        res.status(404).json({ error: 'SSO not configured' });
    }
});

/**
 * POST /api/sso/callback/:organizationId
 * SAML Assertion Consumer Service (ACS) endpoint
 */
router.post('/callback/:organizationId', async (req, res) => {
    try {
        const { organizationId } = req.params;
        const { SAMLResponse } = req.body;

        if (!SAMLResponse) {
            return res.status(400).json({ error: 'No SAML response' });
        }

        // In production, use a proper SAML library like passport-saml or saml2-js
        const assertion = parseSAMLResponse(SAMLResponse);

        const result = await SSOService.processSAMLAssertion(organizationId, assertion, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
        });

        // Generate JWT token
        const token = jwt.sign({
            id: result.user.id,
            email: result.user.email,
            role: result.user.role,
            organizationId: result.user.organizationId,
            ssoSessionId: result.sessionId,
        }, config.JWT_SECRET, { expiresIn: '8h' });

        // Redirect to frontend with token
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/sso/callback?token=${token}`);

    } catch (error) {
        console.error('[SSO] Callback error:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/sso/error?message=${encodeURIComponent(error.message)}`);
    }
});

/**
 * GET /api/sso/login/:organizationId
 * Initiate SSO login (redirect to IdP)
 */
router.get('/login/:organizationId', async (req, res) => {
    try {
        const { organizationId } = req.params;
        const config = await SSOService.getConfiguration(organizationId);

        if (!config || !config.isActive) {
            return res.status(400).json({ error: 'SSO not configured or not active' });
        }

        if (config.providerType === 'saml') {
            // Generate SAML AuthnRequest
            const requestId = `_${uuidv4()}`;
            const issueInstant = new Date().toISOString();

            const authnRequest = Buffer.from(`
                <samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                    ID="${requestId}"
                    Version="2.0"
                    IssueInstant="${issueInstant}"
                    Destination="${config.idpSsoUrl}"
                    AssertionConsumerServiceURL="${config.spAcsUrl}"
                    ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
                    <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${config.spEntityId}</saml:Issuer>
                </samlp:AuthnRequest>
            `).toString('base64');

            res.redirect(`${config.idpSsoUrl}?SAMLRequest=${encodeURIComponent(authnRequest)}`);
        } else {
            return res.status(400).json({ error: 'Only SAML SSO supported currently' });
        }
    } catch (error) {
        console.error('[SSO] Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sso/attempts
 * Get SSO login attempts for troubleshooting
 */
router.get('/attempts', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { status, limit } = req.query;

        const attempts = await SSOService.getLoginAttempts(orgId, {
            status,
            limit: parseInt(limit) || 50,
        });

        res.json({ attempts });
    } catch (error) {
        console.error('[SSO] Get attempts error:', error);
        res.status(500).json({ error: 'Failed to get login attempts' });
    }
});

// Helper function (placeholder - use proper SAML library in production)
function parseSAMLResponse(samlResponse) {
    // In production, use passport-saml or saml2-js to properly parse and validate
    const decoded = Buffer.from(samlResponse, 'base64').toString('utf8');

    // This is a simplified placeholder
    return {
        nameId: 'user@example.com',
        sessionIndex: 'session-123',
        attributes: {
            email: 'user@example.com',
            given_name: 'John',
            family_name: 'Doe',
        },
    };
}

export default router;
