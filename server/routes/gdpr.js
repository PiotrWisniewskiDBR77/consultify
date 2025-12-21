const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const GdprService = require('../services/gdprService');

router.use(authMiddleware);

/**
 * POST /api/gdpr/export
 * Request data export
 */
router.post('/export', async (req, res) => {
    try {
        const requestId = await GdprService.requestExport(req.user.id, req.user.organizationId);
        res.json({
            message: 'Export requested successfully. You will be notified when ready.',
            requestId
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to request export' });
    }
});

/**
 * POST /api/gdpr/forget-me
 * Request account deletion/anonymization
 */
router.post('/forget-me', async (req, res) => {
    try {
        const { confirmation } = req.body;
        if (confirmation !== 'DELETE MY ACCOUNT PERMANENTLY') {
            return res.status(400).json({ error: 'Invalid confirmation string' });
        }

        await GdprService.anonymizeUser(req.user.id);
        res.json({ message: 'Account anonymized. You have been logged out.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to process deletion request' });
    }
});

module.exports = router;
