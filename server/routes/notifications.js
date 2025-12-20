// Notifications Routes
// Step 5: Execution Control, My Work & Notifications

const express = require('express');
const router = express.Router();
const NotificationService = require('../services/notificationService');
const EscalationService = require('../services/escalationService');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/notifications
router.get('/', verifyToken, async (req, res) => {
    const { unreadOnly, limit, projectId } = req.query;
    try {
        const notifications = await NotificationService.getForUser(req.userId, {
            unreadOnly: unreadOnly === 'true',
            limit: limit ? parseInt(limit) : 50,
            projectId
        });
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/notifications/counts
router.get('/counts', verifyToken, async (req, res) => {
    try {
        const counts = await NotificationService.getCounts(req.userId);
        res.json(counts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', verifyToken, async (req, res) => {
    try {
        const result = await NotificationService.markRead(req.params.id, req.userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', verifyToken, async (req, res) => {
    try {
        const result = await NotificationService.markAllRead(req.userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== ESCALATIONS ====================

// GET /api/notifications/escalations/:projectId
router.get('/escalations/:projectId', verifyToken, async (req, res) => {
    const { status } = req.query;
    try {
        const escalations = await EscalationService.getEscalations(req.params.projectId, status);
        res.json(escalations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/notifications/escalations/:projectId/run
router.post('/escalations/:projectId/run', verifyToken, async (req, res) => {
    if (!req.can('edit_project_settings')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const result = await EscalationService.runAutoEscalation(req.params.projectId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/notifications/escalations/:id/acknowledge
router.patch('/escalations/:id/acknowledge', verifyToken, async (req, res) => {
    try {
        const result = await EscalationService.acknowledgeEscalation(req.params.id, req.userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/notifications/escalations/:id/resolve
router.patch('/escalations/:id/resolve', verifyToken, async (req, res) => {
    try {
        const result = await EscalationService.resolveEscalation(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
