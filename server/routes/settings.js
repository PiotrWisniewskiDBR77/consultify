const express = require('express');
const router = express.Router();
const db = require('../database');

// GET Settings
router.get('/', (req, res) => {
    db.all('SELECT key, value FROM settings', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const settings = {};
        rows.forEach(row => {
            // Mask API Key for security when sending to client
            if (row.key === 'gemini_api_key' && row.value) {
                settings[row.key] = '********************' + row.value.slice(-4);
            } else {
                settings[row.key] = row.value;
            }
        });
        res.json(settings);
    });
});

// SAVE Settings
router.post('/', (req, res) => {
    const { key, value } = req.body;

    if (!key) return res.status(400).json({ error: 'Key is required' });

    db.run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) 
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
        [key, value, value],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

module.exports = router;
