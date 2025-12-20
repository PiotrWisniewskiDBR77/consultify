/**
 * Demo API Routes
 * 
 * Endpoints for demo mode entry and management
 * 
 * Step 2 Finalization: Abuse Protection
 * - Rate limiting: 3 demos per 10 min per IP
 * - Max 1 active demo per user/email
 * 
 * Step 4: Attribution Integration
 * - Records attribution events for partner tracking
 * - Supports UTM parameters for campaign attribution
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const DemoService = require('../services/demoService');
const OrganizationEventService = require('../services/organizationEventService');
const AttributionService = require('../services/attributionService');

// Demo abuse protection: 3 demos per 10 minutes per IP
const demoRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 3,
    message: {
        error: 'Too many demo sessions created. Please try again later.',
        errorCode: 'DEMO_RATE_LIMITED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * POST /api/demo/start
 * Start a demo session (no registration required)
 * 
 * Abuse Protection:
 * - Rate limited: 3 per 10 min per IP
 * - Max 1 active demo per email
 * 
 * Step 4 Attribution:
 * - Accepts utm_campaign, utm_medium, partner_code
 * - Records attribution event for partner settlements
 * 
 * Body: { email?: string, templateId?: string, utm_campaign?: string, utm_medium?: string, partner_code?: string }
 * Returns: { token, organizationId, userId, expiresAt }
 */
router.post('/start', demoRateLimiter, async (req, res) => {
    try {
        const { email, templateId, utm_campaign, utm_medium, partner_code } = req.body;
        const clientIp = req.ip || req.connection.remoteAddress;

        // Check for existing active demo for this email
        if (email) {
            const hasActiveDemo = await DemoService.hasActiveDemoForEmail(email);
            if (hasActiveDemo) {
                return res.status(409).json({
                    error: 'You already have an active demo session. Please use your existing session or wait for it to expire.',
                    errorCode: 'DEMO_ALREADY_EXISTS'
                });
            }
        }

        // Create demo organization
        const demo = await DemoService.createDemoOrganization(templateId, email);

        // Log audit event (organization lifecycle)
        await OrganizationEventService.logEvent(
            demo.organizationId,
            OrganizationEventService.EVENT_TYPES.DEMO_STARTED,
            null,
            { email: email || 'anonymous', clientIp, templateId }
        );

        // Step 4: Record attribution event for partner tracking
        await AttributionService.recordAttribution({
            organizationId: demo.organizationId,
            userId: demo.userId,
            sourceType: AttributionService.SOURCE_TYPES.DEMO,
            campaign: utm_campaign,
            partnerCode: partner_code,
            medium: utm_medium,
            metadata: {
                email: email || 'anonymous',
                templateId,
                clientIp,
                entryPoint: 'demo_start'
            }
        });

        // Generate JWT token for demo user
        const token = jwt.sign(
            {
                id: demo.userId,
                email: email || `demo@demo.consultify.app`,
                organizationId: demo.organizationId,
                role: 'ADMIN',
                isDemo: true
            },
            config.jwtSecret,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            organizationId: demo.organizationId,
            userId: demo.userId,
            expiresAt: demo.expiresAt,
            message: 'Demo session started. This session will expire in 24 hours.'
        });

    } catch (error) {
        console.error('[Demo] Error starting demo:', error);
        res.status(500).json({ error: 'Failed to start demo session' });
    }
});

/**
 * GET /api/demo/templates
 * Get available demo templates
 */
router.get('/templates', async (req, res) => {
    try {
        const templates = await DemoService.getTemplates();
        res.json(templates);
    } catch (error) {
        console.error('[Demo] Error fetching templates:', error);
        res.status(500).json({ error: 'Failed to fetch demo templates' });
    }
});

module.exports = router;

