/**
 * User Preferences Routes
 * 
 * API endpoints for managing user preferences.
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const UserPreferencesService = require('../services/userPreferencesService');

/**
 * GET /api/preferences
 * Get current user's preferences
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const preferences = await UserPreferencesService.getPreferences(req.user.id);
        res.json({ preferences });
    } catch (error) {
        console.error('[Preferences] Get error:', error);
        res.status(500).json({ error: 'Failed to get preferences' });
    }
});

/**
 * PUT /api/preferences
 * Update user preferences
 */
router.put('/', authMiddleware, async (req, res) => {
    try {
        await UserPreferencesService.updatePreferences(req.user.id, req.body);
        const preferences = await UserPreferencesService.getPreferences(req.user.id);
        res.json({ success: true, preferences });
    } catch (error) {
        console.error('[Preferences] Update error:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

/**
 * GET /api/preferences/options
 * Get available options for preferences (timezones, locales, etc.)
 */
router.get('/options', authMiddleware, (req, res) => {
    res.json({
        timezones: UserPreferencesService.getTimezoneOptions(),
        locales: UserPreferencesService.getLocaleOptions(),
        dateFormats: [
            { value: 'YYYY-MM-DD', label: '2024-12-21', example: '2024-12-21' },
            { value: 'DD/MM/YYYY', label: '21/12/2024', example: '21/12/2024' },
            { value: 'MM/DD/YYYY', label: '12/21/2024', example: '12/21/2024' },
            { value: 'DD.MM.YYYY', label: '21.12.2024', example: '21.12.2024' },
        ],
        timeFormats: [
            { value: '24h', label: '24-hour (14:30)' },
            { value: '12h', label: '12-hour (2:30 PM)' },
        ],
        themes: [
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System default' },
        ],
        fontSizes: [
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium (default)' },
            { value: 'large', label: 'Large' },
        ],
    });
});

/**
 * PUT /api/preferences/accessibility
 * Update accessibility settings specifically
 */
router.put('/accessibility', authMiddleware, async (req, res) => {
    try {
        await UserPreferencesService.updatePreferences(req.user.id, {
            accessibility: req.body,
        });
        res.json({ success: true });
    } catch (error) {
        console.error('[Preferences] Accessibility update error:', error);
        res.status(500).json({ error: 'Failed to update accessibility settings' });
    }
});

/**
 * PUT /api/preferences/notifications
 * Update notification settings specifically
 */
router.put('/notifications', authMiddleware, async (req, res) => {
    try {
        await UserPreferencesService.updatePreferences(req.user.id, {
            notifications: req.body,
        });
        res.json({ success: true });
    } catch (error) {
        console.error('[Preferences] Notifications update error:', error);
        res.status(500).json({ error: 'Failed to update notification settings' });
    }
});

/**
 * PUT /api/preferences/ui
 * Update UI settings specifically
 */
router.put('/ui', authMiddleware, async (req, res) => {
    try {
        await UserPreferencesService.updatePreferences(req.user.id, {
            ui: req.body,
        });
        res.json({ success: true });
    } catch (error) {
        console.error('[Preferences] UI update error:', error);
        res.status(500).json({ error: 'Failed to update UI settings' });
    }
});

module.exports = router;
