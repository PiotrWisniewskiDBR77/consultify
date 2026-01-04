/**
 * User Keyboard Shortcuts API Routes
 * Handles custom keyboard shortcut configurations
 */

import express from 'express';
const router = express.Router();
import requireAuth from '../middleware/authMiddleware.js';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();


router.use(requireAuth);

/**
 * GET /api/user/keyboard-shortcuts
 * Get all keyboard shortcuts for current user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        const shortcuts = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, action, keys_json, category, description, is_custom, enabled
                 FROM user_keyboard_shortcuts
                 WHERE user_id = ?
                 ORDER BY category, action`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // If no custom shortcuts, return defaults
        if (shortcuts.length === 0) {
            const defaultShortcuts = getDefaultShortcuts();
            return res.json({
                success: true,
                data: { shortcuts: defaultShortcuts }
            });
        }

        res.json({
            success: true,
            data: {
                shortcuts: shortcuts.map(s => ({
                    id: s.id,
                    action: s.action,
                    keys: JSON.parse(s.keys_json),
                    category: s.category,
                    description: s.description,
                    isCustom: !!s.is_custom,
                    enabled: !!s.enabled
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching keyboard shortcuts:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch keyboard shortcuts' });
    }
});

/**
 * PUT /api/user/keyboard-shortcuts
 * Update keyboard shortcuts
 */
router.put('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { shortcuts } = req.body;

        // Delete existing custom shortcuts
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM user_keyboard_shortcuts WHERE user_id = ?', [userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Insert new shortcuts
        for (const shortcut of shortcuts) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO user_keyboard_shortcuts (
                        id, user_id, action, keys_json, category, description, is_custom, enabled, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [
                        shortcut.id,
                        userId,
                        shortcut.action,
                        JSON.stringify(shortcut.keys),
                        shortcut.category,
                        shortcut.description,
                        shortcut.isCustom ? 1 : 0,
                        shortcut.enabled !== false ? 1 : 0
                    ],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        res.json({ success: true, message: 'Keyboard shortcuts updated successfully' });
    } catch (error) {
        console.error('Error updating keyboard shortcuts:', error);
        res.status(500).json({ success: false, error: 'Failed to update keyboard shortcuts' });
    }
});

/**
 * POST /api/user/keyboard-shortcuts/reset
 * Reset shortcuts to defaults
 */
router.post('/reset', async (req, res) => {
    try {
        const userId = req.user.id;

        await new Promise((resolve, reject) => {
            db.run('DELETE FROM user_keyboard_shortcuts WHERE user_id = ?', [userId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ 
            success: true, 
            message: 'Keyboard shortcuts reset to defaults',
            data: { shortcuts: getDefaultShortcuts() }
        });
    } catch (error) {
        console.error('Error resetting keyboard shortcuts:', error);
        res.status(500).json({ success: false, error: 'Failed to reset keyboard shortcuts' });
    }
});

function getDefaultShortcuts() {
    return [
        { id: '1', action: 'go_home', keys: ['Cmd', 'H'], category: 'Navigation', description: 'Go to Dashboard', isCustom: false, enabled: true },
        { id: '2', action: 'go_inbox', keys: ['G', 'I'], category: 'Navigation', description: 'Go to Inbox', isCustom: false, enabled: true },
        { id: '3', action: 'go_projects', keys: ['G', 'P'], category: 'Navigation', description: 'Go to Projects', isCustom: false, enabled: true },
        { id: '4', action: 'new_task', keys: ['N', 'T'], category: 'Actions', description: 'Create New Task', isCustom: false, enabled: true },
        { id: '5', action: 'new_project', keys: ['N', 'P'], category: 'Actions', description: 'Create New Project', isCustom: false, enabled: true },
        { id: '6', action: 'search', keys: ['Cmd', 'K'], category: 'System', description: 'Open Search', isCustom: false, enabled: true },
        { id: '7', action: 'command_palette', keys: ['Cmd', 'Shift', 'P'], category: 'System', description: 'Command Palette', isCustom: false, enabled: true },
        { id: '8', action: 'ai_assist', keys: ['Cmd', 'J'], category: 'AI', description: 'Open AI Assistant', isCustom: false, enabled: true },
        { id: '9', action: 'save', keys: ['Cmd', 'S'], category: 'Editing', description: 'Save Current', isCustom: false, enabled: true },
        { id: '10', action: 'toggle_sidebar', keys: ['Cmd', 'B'], category: 'Views', description: 'Toggle Sidebar', isCustom: false, enabled: true }
    ];
}

export default router;









