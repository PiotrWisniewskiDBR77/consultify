const express = require('express');
const router = express.Router();
const ConsultantService = require('../services/consultantService');
const authMiddleware = require('../middleware/auth'); // Standard auth checks valid token

// Middleware to ensure user is a consultant
const requireConsultant = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const consultant = await ConsultantService.getConsultantProfile(req.user.id);
        if (!consultant || consultant.status !== 'ACTIVE') {
            return res.status(403).json({ error: 'Access denied: Active consultant profile required' });
        }
        req.consultant = consultant;
        next();
    } catch (err) {
        console.error('Consultant check error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

router.use(authMiddleware);
router.use(requireConsultant);

// GET /api/consultants/me
router.get('/me', async (req, res) => {
    try {
        res.json({
            ...req.consultant,
            user: {
                id: req.user.id,
                email: req.user.email,
                firstName: req.user.firstName,
                lastName: req.user.lastName
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/consultants/orgs - Get linked organizations
router.get('/orgs', async (req, res) => {
    try {
        const orgs = await ConsultantService.getLinkedOrganizations(req.user.id);
        res.json(orgs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/consultants/invites - Create invite code
router.post('/invites', async (req, res) => {
    try {
        const { type, targetEmail, targetCompanyName, maxUses, expiresInDays } = req.body;

        if (!type || !ConsultantService.INVITE_TYPES[type]) {
            return res.status(400).json({ error: 'Invalid invite type' });
        }

        const invite = await ConsultantService.createInvite({
            consultantId: req.user.id,
            type,
            targetEmail,
            targetCompanyName,
            maxUses: maxUses || 1,
            expiresInDays: expiresInDays || 30
        });

        res.status(201).json(invite);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/consultants/invites - List invites
router.get('/invites', async (req, res) => {
    try {
        const invites = await ConsultantService.getConsultantInvites(req.user.id);
        res.json(invites);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
