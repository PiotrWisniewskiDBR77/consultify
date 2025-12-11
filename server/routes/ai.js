const express = require('express');
const router = express.Router();
const AiService = require('../services/aiService');
const FeedbackService = require('../services/feedbackService');
const AnalyticsService = require('../services/analyticsService');
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const { enforceTokenQuota, recordTokenUsageAfterResponse } = require('../middleware/quotaMiddleware');
const verifyToken = require('../middleware/authMiddleware');

// Authenticate all AI routes
router.use(verifyToken);

// Apply token quota enforcement to all AI POST endpoints
const quotaProtectedRoutes = ['/chat', '/chat/stream', '/diagnose', '/recommend', '/roadmap', '/simulate', '/validate', '/suggest-tasks', '/verify', '/extract-insight'];
quotaProtectedRoutes.forEach(route => {
    router.use(route, enforceTokenQuota);
});

// --- TEST CONNECTION ---
router.post('/test-connection', async (req, res) => {
    try {
        const config = req.body;
        // Basic validation
        if (!config.provider || !config.api_key) {
            return res.status(400).json({ error: 'Missing provider or API Key' });
        }

        const result = await AiService.testProviderConnection(config);
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (error) {
        console.error('Test Connection Error:', error);
        res.status(500).json({ error: 'Connection test failed' });
    }
});

// --- CHAT ---
router.post('/chat', async (req, res) => {
    try {
        const { message, history, systemInstruction, roleName } = req.body;
        const userId = req.body.userId || req.user?.id;
        // userId might come from req.user if auth middleware is on, but simplified here
        const response = await AiService.chat(message, history, roleName, userId);
        res.json({ text: response });
    } catch (error) {
        console.error('AI Chat Error:', error);
        res.status(500).json({ error: 'AI processing failed' });
    }
});

router.post('/chat/stream', async (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const { message, history, roleName } = req.body;
        const userId = req.body.userId || req.user?.id;

        const stream = AiService.chatStream(message, history, roleName, userId);

        for await (const chunk of stream) {
            if (chunk) {
                // Send SSE data
                res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            }
        }
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error('AI Chat Stream Error:', error);
        res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
        res.end();
    }
});

// --- DIAGNOSE ---
router.post('/diagnose', async (req, res) => {
    try {
        const { axis, input, userId } = req.body;
        const result = await AiService.diagnose(axis, input, userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- RECOMMEND ---
router.post('/recommend', async (req, res) => {
    try {
        const { diagnosisReport, userId } = req.body;
        const initiatives = await AiService.generateInitiatives(diagnosisReport, userId);
        res.json(initiatives);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ROADMAP ---
router.post('/roadmap', async (req, res) => {
    try {
        const { initiatives, userId } = req.body;
        const roadmap = await AiService.buildRoadmap(initiatives, userId);
        res.json(roadmap);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SIMULATE ---
router.post('/simulate', async (req, res) => {
    try {
        const { initiatives, revenue, userId } = req.body;
        const result = await AiService.simulateEconomics(initiatives, revenue, userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- VALIDATE ---
router.post('/validate', async (req, res) => {
    try {
        const { initiative, userId } = req.body;
        const result = await AiService.validateInitiative(initiative, userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SUGGEST TASKS ---
router.post('/suggest-tasks', async (req, res) => {
    try {
        const { initiative, userId } = req.body;
        const result = await AiService.suggestTasks(initiative, userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- VERIFY (WEB) ---
router.post('/verify', async (req, res) => {
    try {
        const { query, userId } = req.body;
        const result = await AiService.verifyWithWeb(query, userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- EXTRACT INSIGHTS (LEARNING) ---
router.post('/extract-insight', async (req, res) => {
    try {
        const { text, source, userId } = req.body;
        const result = await AiService.extractInsights(text, source, userId);
        res.json(result || { found: false });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- FEEDBACK ---
router.post('/feedback', async (req, res) => {
    try {
        const { userId, context, prompt, response, rating, correction } = req.body;
        await FeedbackService.saveFeedback(userId, context, prompt, response, rating, correction);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ANALYTICS (Admin) ---
router.get('/stats', async (req, res) => {
    try {
        const stats = await AnalyticsService.getStats();
        const topTopics = await AnalyticsService.getTopTopics();
        res.json({ usage: stats, topics: topTopics });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/benchmarks', async (req, res) => {
    try {
        const { industry } = req.query;
        const benchmarks = await AnalyticsService.getIndustryBenchmarks(industry);
        res.json(benchmarks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SYSTEM PROMPTS (Admin) ---
router.get('/prompts', (req, res) => {
    db.all("SELECT * FROM system_prompts ORDER BY key", [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

router.put('/prompts/:key', (req, res) => {
    const { content, description, updatedBy } = req.body;
    const key = req.params.key;
    const stmt = db.prepare("UPDATE system_prompts SET content = ?, description = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?");
    stmt.run(content, description, updatedBy, key, function (err) {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ success: true, changes: this.changes });
    });
    stmt.finalize();
});

module.exports = router;
