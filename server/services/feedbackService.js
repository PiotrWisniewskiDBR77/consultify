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
    },

    /**
     * PERIODIC: Analyzes feedback to generate Global Strategies.
     * This closes the loop: User Feedback -> AI Analysis -> Global Strategy -> Better Future Prompts.
     */
    consolidateLearning: async () => {
        const AiService = require('./aiService'); // Lazy load to avoid circular dep

        console.log("[GlobalLearning] Starting consolidation...");

        // 1. Get contexts with enough feedback
        const getContexts = () => new Promise(resolve => {
            db.all("SELECT context, COUNT(*) as count FROM ai_feedback GROUP BY context HAVING count >= 3", (err, rows) => resolve(rows || []));
        });

        const contexts = await getContexts();

        for (const ctx of contexts) {
            const contextType = ctx.context;
            console.log(`[GlobalLearning] Analyzing context: ${contextType}`);

            // 2. Fetch feedback rows
            const getFeedback = () => new Promise(resolve => {
                db.all("SELECT prompt, response, rating, comment, correction FROM ai_feedback WHERE context = ? ORDER BY created_at DESC LIMIT 20", [contextType], (err, rows) => resolve(rows || []));
            });
            const feedback = await getFeedback();

            // 3. Ask AI to synthesize a strategy
            const feedbackText = feedback.map(f => `[Rating: ${f.rating}/5] User Comment: "${f.comment || ''}"`).join('\n');
            const systemPrompt = `
                You are a Process Optimization Expert. 
                Analyze the following feedback logs for the task "${contextType}".
                Identify ONE key strategic rule or best practice that would improve future performance.
                Focus on user pain points (low ratings) or what they praised (high ratings).
                
                Return JSON: { "title": "Short Rule Name", "description": "One sentence instruction for the AI." }
            `;

            try {
                const jsonStr = await AiService.deps.callLLM(
                    `Feedback Logs:\n${feedbackText}`,
                    systemPrompt,
                    [],
                    null,
                    'system', // userId
                    'analysis'
                );

                const strategy = JSON.parse(jsonStr.replace(/```json/g, '').replace(/```/g, ''));

                if (strategy && strategy.title) {
                    // 4. Save to Global Strategies
                    const stmt = db.prepare(`INSERT INTO global_strategies (id, title, description, is_active, created_by) VALUES (?, ?, ?, ?, ?)`);
                    stmt.run(uuidv4(), `${contextType.toUpperCase()}: ${strategy.title}`, strategy.description, 1, 'AI_LEARNING');
                    stmt.finalize();
                    console.log(`[GlobalLearning] Learned new strategy: ${strategy.title}`);
                }
            } catch (e) {
                console.error("[GlobalLearning] Error processing context:", contextType, e);
            }
        }
        return { status: 'completed', contextsAnalyzed: contexts.length };
    }
};

module.exports = FeedbackService;
