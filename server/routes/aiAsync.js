const express = require('express');
const router = express.Router();
const AiService = require('../services/aiService');

// Submit a job
router.post('/jobs', async (req, res) => {
    try {
        const { taskType, payload } = req.body;
        const userId = req.user ? req.user.id : null;

        if (!taskType || !payload) {
            return res.status(400).json({ error: 'Missing taskType or payload' });
        }

        const result = await AiService.queueTask(taskType, payload, userId);
        res.status(202).json(result);
    } catch (error) {
        console.error('Queue Error', error);
        res.status(500).json({ error: error.message });
    }
});

// Get job status
router.get('/jobs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const status = await AiService.getJobStatus(id);

        if (!status) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json(status);
    } catch (error) {
        console.error('Job Status Error', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
