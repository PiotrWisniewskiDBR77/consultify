const express = require('express');
const router = express.Router();
const ReportService = require('../services/reportService');
const auth = require('../middleware/authMiddleware'); // Updated to correct filename

// Get Report by Project ID
router.get('/project/:projectId', auth, async (req, res) => {
    try {
        const report = await ReportService.getReport(req.params.projectId);

        if (!report) {
            // Auto-create draft if not exists? Or return 404? 
            // For MVP let's return 404 and let frontend trigger creation
            return res.status(404).json({ message: 'Report not found' });
        }

        res.json(report);
    } catch (err) {
        console.error('Error fetching report:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Create Draft Report
router.post('/draft', auth, async (req, res) => {
    try {
        const { projectId, title, sources } = req.body;
        const result = await ReportService.createDraft(projectId, req.user.organizationId, title || 'New Report', sources);
        res.status(201).json(result);
    } catch (err) {
        console.error('Error creating draft:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Add Block
router.post('/:reportId/blocks', auth, async (req, res) => {
    try {
        const result = await ReportService.addBlock(req.params.reportId, req.body);
        res.status(201).json(result);
    } catch (err) {
        console.error('Error adding block:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Update Block
router.put('/:reportId/blocks/:blockId', auth, async (req, res) => {
    try {
        await ReportService.updateBlock(req.params.reportId, req.params.blockId, req.body);
        res.json({ status: 'ok' });
    } catch (err) {
        console.error('Error updating block:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Reorder Blocks
router.post('/:reportId/reorder', auth, async (req, res) => {
    try {
        const { blockOrder } = req.body;
        await ReportService.reorderBlocks(req.params.reportId, blockOrder);
        res.json({ status: 'ok' });
    } catch (err) {
        console.error('Error reordering blocks:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Regenerate Block (AI)
router.post('/:reportId/blocks/:blockId/regenerate', auth, async (req, res) => {
    try {
        const { instructions } = req.body;
        const result = await ReportService.regenerateBlock(req.params.reportId, req.params.blockId, instructions);
        res.json(result);
    } catch (err) {
        console.error('Error regenerating block:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;
