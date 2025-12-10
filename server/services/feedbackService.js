const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const FeedbackService = {
    /**
     * Saves user feedback for an AI response (The "Learning" Step).
     */
    saveFeedback: async (userId, context, prompt, response, rating, correction = '') => {
        const stmt = db.prepare(`INSERT INTO ai_feedback (id, user_id, context, prompt, response, rating, correction) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        stmt.run(uuidv4(), userId, context, prompt, response, rating, correction);
        stmt.finalize();
    },

    /**
     * Retrieves "Good Examples" (Rating >= 4) to inject into prompt context.
     * "Few-Shot Learning" from own memory.
     * @param {string} contextType - e.g. 'diagnose', 'roadmap'
     */
    getLearningExamples: async (contextType) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT prompt, response, correction
                FROM ai_feedback
                WHERE context = ? AND rating >= 4
                ORDER BY created_at DESC
                LIMIT 3
            `;
            db.all(sql, [contextType], (err, rows) => {
                if (err) resolve([]); // Don't fail if DB error, just return empty learning
                else {
                    // Format as string for prompt injection
                    const examples = rows.map(r => `
Example Input: ${r.prompt.substring(0, 100)}...
Good Response: ${r.response.substring(0, 200)}...
${r.correction ? `Correction to apply: ${r.correction}` : ''}
---`).join('\n');
                    resolve(examples);
                }
            });
        });
    }
};

module.exports = FeedbackService;
