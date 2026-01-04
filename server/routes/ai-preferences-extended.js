/**
 * AI Preferences Extended Routes
 * 
 * Features:
 * - AI Model Selection
 * - AI Behavior Settings
 * - AI Context Configuration
 */

import express from 'express';
const router = express.Router();
import requireAuth from '../middleware/authMiddleware.js';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();

router.use(requireAuth);

// ==========================================
// AI MODEL SELECTION
// ==========================================

/**
 * GET /api/user/ai-preferences/models
 * Get AI model preferences
 */
router.get('/models', async (req, res) => {
    try {
        const userId = req.user.id;

        const prefs = await new Promise((resolve, reject) => {
            db.get(
                `SELECT model_preferences_json, cost_tracking_json FROM user_ai_preferences WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        let modelSettings = {
            defaultModel: 'gpt-4-turbo',
            chatModel: 'gpt-4-turbo',
            codeModel: 'claude-3-sonnet',
            analysisModel: 'claude-3-opus',
            documentModel: 'gpt-4o',
            temperature: 0.7,
            maxTokens: 4096,
            streamResponse: true
        };

        let costEstimate = { monthly: 0, daily: 0 };

        if (prefs?.model_preferences_json) {
            try {
                modelSettings = { ...modelSettings, ...JSON.parse(prefs.model_preferences_json) };
            } catch (e) {}
        }

        if (prefs?.cost_tracking_json) {
            try {
                costEstimate = JSON.parse(prefs.cost_tracking_json);
            } catch (e) {}
        }

        res.json({
            success: true,
            data: {
                ...modelSettings,
                costEstimate
            }
        });
    } catch (error) {
        console.error('Error fetching AI model preferences:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch AI model preferences' });
    }
});

/**
 * PUT /api/user/ai-preferences/models
 * Update AI model preferences
 */
router.put('/models', async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = req.body;

        const modelPreferencesJson = JSON.stringify(settings);

        // Check if record exists
        const existing = await new Promise((resolve, reject) => {
            db.get('SELECT user_id FROM user_ai_preferences WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (existing) {
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE user_ai_preferences SET model_preferences_json = ?, updated_at = datetime('now') WHERE user_id = ?`,
                    [modelPreferencesJson, userId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        } else {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO user_ai_preferences (user_id, model_preferences_json, created_at, updated_at)
                     VALUES (?, ?, datetime('now'), datetime('now'))`,
                    [userId, modelPreferencesJson],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        res.json({ success: true, message: 'AI model preferences updated' });
    } catch (error) {
        console.error('Error updating AI model preferences:', error);
        res.status(500).json({ success: false, error: 'Failed to update AI model preferences' });
    }
});

// ==========================================
// AI BEHAVIOR
// ==========================================

/**
 * GET /api/user/ai-preferences/behavior
 * Get AI behavior settings
 */
router.get('/behavior', async (req, res) => {
    try {
        const userId = req.user.id;

        const prefs = await new Promise((resolve, reject) => {
            db.get(
                `SELECT behavior_settings_json FROM user_ai_preferences WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        let behaviorSettings = {
            enableAutoSuggestions: true,
            enableInComments: true,
            enableInTasks: true,
            enableLearningFromWork: true,
            enableProactiveInsights: true,
            enableAutocomplete: true,
            personality: 'professional',
            responseLength: 'moderate',
            formality: 70,
            technicalLevel: 50,
            useProjectContext: true,
            useHistoricalData: true,
            useTeamPatterns: false
        };

        if (prefs?.behavior_settings_json) {
            try {
                behaviorSettings = { ...behaviorSettings, ...JSON.parse(prefs.behavior_settings_json) };
            } catch (e) {}
        }

        res.json({ success: true, data: behaviorSettings });
    } catch (error) {
        console.error('Error fetching AI behavior settings:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch AI behavior settings' });
    }
});

/**
 * PUT /api/user/ai-preferences/behavior
 * Update AI behavior settings
 */
router.put('/behavior', async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = req.body;

        const behaviorSettingsJson = JSON.stringify(settings);

        const existing = await new Promise((resolve, reject) => {
            db.get('SELECT user_id FROM user_ai_preferences WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (existing) {
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE user_ai_preferences SET behavior_settings_json = ?, updated_at = datetime('now') WHERE user_id = ?`,
                    [behaviorSettingsJson, userId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        } else {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO user_ai_preferences (user_id, behavior_settings_json, created_at, updated_at)
                     VALUES (?, ?, datetime('now'), datetime('now'))`,
                    [userId, behaviorSettingsJson],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        res.json({ success: true, message: 'AI behavior settings updated' });
    } catch (error) {
        console.error('Error updating AI behavior settings:', error);
        res.status(500).json({ success: false, error: 'Failed to update AI behavior settings' });
    }
});

// ==========================================
// AI CONTEXT
// ==========================================

/**
 * GET /api/user/ai-preferences/context
 * Get AI context settings
 */
router.get('/context', async (req, res) => {
    try {
        const userId = req.user.id;

        const prefs = await new Promise((resolve, reject) => {
            db.get(
                `SELECT context_settings_json FROM user_ai_preferences WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        let contextSettings = {
            contextWindowSize: 'medium',
            includedProjects: [],
            excludedProjects: [],
            projectContextMode: 'all',
            includeTeamData: true,
            includedTeamMembers: [],
            excludedTeamMembers: [],
            teamDataMode: 'all',
            knowledgeBases: {
                companyDocs: true,
                projectDocs: true,
                pastConversations: true,
                industryKnowledge: false,
                customSources: []
            }
        };

        if (prefs?.context_settings_json) {
            try {
                contextSettings = { ...contextSettings, ...JSON.parse(prefs.context_settings_json) };
            } catch (e) {}
        }

        res.json({ success: true, data: contextSettings });
    } catch (error) {
        console.error('Error fetching AI context settings:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch AI context settings' });
    }
});

/**
 * PUT /api/user/ai-preferences/context
 * Update AI context settings
 */
router.put('/context', async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = req.body;

        const contextSettingsJson = JSON.stringify(settings);

        const existing = await new Promise((resolve, reject) => {
            db.get('SELECT user_id FROM user_ai_preferences WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (existing) {
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE user_ai_preferences SET context_settings_json = ?, updated_at = datetime('now') WHERE user_id = ?`,
                    [contextSettingsJson, userId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        } else {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO user_ai_preferences (user_id, context_settings_json, created_at, updated_at)
                     VALUES (?, ?, datetime('now'), datetime('now'))`,
                    [userId, contextSettingsJson],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        res.json({ success: true, message: 'AI context settings updated' });
    } catch (error) {
        console.error('Error updating AI context settings:', error);
        res.status(500).json({ success: false, error: 'Failed to update AI context settings' });
    }
});

export default router;












