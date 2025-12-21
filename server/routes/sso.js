/**
 * SSO Routes
 * 
 * API endpoints for SSO configuration and authentication.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/authMiddleware');
const { requireOrgAccess } = require('../middleware/rbac');
const SSOService = require('../services/ssoService');
const AuditService = require('../services/auditService');

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
        const jwt = require('jsonwebtoken');
        const config = require('../config');

        const token = jwt.sign({
            id: result.user.id,
            email: result.user.email,
            role: result.user.role,
            organizationId: result.user.organizationId,
            ssoSessionId: result.sessionId,
        }, config.JWT_SECRET, { expiresIn: '8h' });

        // Redirect to frontend with token
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/sso/callback?token=${token}`);

    } catch (error) {
        console.error('[SSO] Callback error:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
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

module.exports = router;
