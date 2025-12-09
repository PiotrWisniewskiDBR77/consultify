const express = require('express');
const router = express.Router();
const AiService = require('../services/aiService');

// POST /api/ai/chat
// General Purpose Chat (keeps existing contract but adds role support)
router.post('/chat', async (req, res) => {
    try {
        const { message, history, role } = req.body; // Added role support
        const text = await AiService.chat(message, history, role);
        res.json({ text });
    } catch (error) {
        console.error('AI Chat Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ai/diagnose
// Layer 1: Diagnosis Engine
router.post('/diagnose', async (req, res) => {
    try {
        const { axis, input } = req.body;
        // e.g. axis="Digital Processes", input="We use Excel for everything"
        const result = await AiService.diagnose(axis, input);
        res.json(result);
    } catch (error) {
        console.error('AI Diagnose Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ai/recommend
// Layer 2: Consulting Engine
router.post('/recommend', async (req, res) => {
    try {
        const { diagnosisReport } = req.body;
        const initiatives = await AiService.generateInitiatives(diagnosisReport);
        res.json(initiatives);
    } catch (error) {
        console.error('AI Recommend Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ai/roadmap
// Layer 3: Strategic Advisor
router.post('/roadmap', async (req, res) => {
    try {
        const { initiatives } = req.body;
        const roadmap = await AiService.buildRoadmap(initiatives);
        res.json(roadmap);
    } catch (error) {
        console.error('AI Roadmap Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ai/simulate
// Layer 4: Simulation
router.post('/simulate', async (req, res) => {
    try {
        const { initiatives, revenue } = req.body;
        const economics = await AiService.simulateEconomics(initiatives, revenue);
        res.json(economics);
    } catch (error) {
        console.error('AI Simulate Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
