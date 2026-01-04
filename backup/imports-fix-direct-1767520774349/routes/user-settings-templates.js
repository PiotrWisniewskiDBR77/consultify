/**
 * User Settings Templates API Routes
 * Handles saving and applying settings templates
 */

import express from 'express';
const router = express.Router();
import requireAuth from '../middleware/authMiddleware.js';
import db from '../database.js';

import { v4 as uuidv4 } from 'uuid';

router.use(requireAuth);

/**
 * GET /api/user/settings-templates
 * Get all custom templates for current user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        const templates = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, name, description, icon, settings_json, created_at, updated_at
                 FROM user_settings_templates
                 WHERE user_id = ?
                 ORDER BY created_at DESC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        res.json({
            success: true,
            data: {
                templates: templates.map(t => ({
                    id: t.id,
                    name: t.name,
                    description: t.description,
                    icon: t.icon,
                    settings: JSON.parse(t.settings_json),
                    createdAt: t.created_at,
                    updatedAt: t.updated_at
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching settings templates:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch settings templates' });
    }
});

/**
 * POST /api/user/settings-templates
 * Create a new template from current settings
 */
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, description, icon } = req.body;

        // Gather current settings from all tables
        const currentSettings = await gatherCurrentSettings(userId);
        const templateId = uuidv4();

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_settings_templates (
                    id, user_id, name, description, icon, settings_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                    templateId,
                    userId,
                    name,
                    description || '',
                    icon || '📋',
                    JSON.stringify(currentSettings)
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ 
            success: true, 
            message: 'Template created successfully',
            data: { id: templateId }
        });
    } catch (error) {
        console.error('Error creating settings template:', error);
        res.status(500).json({ success: false, error: 'Failed to create settings template' });
    }
});

/**
 * POST /api/user/settings-templates/:id/apply
 * Apply a template to current settings
 */
router.post('/:id/apply', async (req, res) => {
    try {
        const userId = req.user.id;
        const templateId = req.params.id;

        // Get template
        const template = await new Promise((resolve, reject) => {
            db.get(
                `SELECT settings_json FROM user_settings_templates WHERE id = ? AND user_id = ?`,
                [templateId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!template) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }

        const settings = JSON.parse(template.settings_json);
        await applySettings(userId, settings);

        res.json({ success: true, message: 'Template applied successfully' });
    } catch (error) {
        console.error('Error applying settings template:', error);
        res.status(500).json({ success: false, error: 'Failed to apply settings template' });
    }
});

/**
 * DELETE /api/user/settings-templates/:id
 * Delete a template
 */
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const templateId = req.params.id;

        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM user_settings_templates WHERE id = ? AND user_id = ?`,
                [templateId, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
        console.error('Error deleting settings template:', error);
        res.status(500).json({ success: false, error: 'Failed to delete settings template' });
    }
});

// Helper function to gather all current settings
async function gatherCurrentSettings(userId) {
    // This would gather from multiple tables
    // Simplified version - in production gather from all settings tables
    return {
        profile: {},
        security: {},
        privacy: {},
        aiPreferences: {},
        notifications: {},
        appearance: {},
        keyboard: {}
    };
}

// Helper function to apply settings from template
async function applySettings(userId, settings) {
    // This would update multiple tables
    // Simplified version - in production apply to all settings tables
    console.log(`Applying settings for user ${userId}`);
}

export default router;







