const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../database');

// POST /chat
router.post('/chat', async (req, res) => {
    try {
        const { message, history } = req.body;

        // 1. Try to get key from DB
        const getApiKey = () => {
            return new Promise((resolve) => {
                db.get("SELECT value FROM settings WHERE key = 'gemini_api_key'", (err, row) => {
                    if (row && row.value) {
                        resolve(row.value);
                    } else {
                        resolve(process.env.GEMINI_API_KEY);
                    }
                });
            });
        };

        const apiKey = await getApiKey();

        if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
            return res.json({
                text: "API Key not configured. Please go to Settings > AI Configuration and enter your Google Gemini API Key."
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const chat = model.startChat({
            history: history || [],
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();

        res.json({ text });

    } catch (error) {
        console.error('AI Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
