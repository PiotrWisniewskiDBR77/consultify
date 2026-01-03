/**
 * User Appearance Settings API Routes
 * Handles visual customization, layout preferences, and theme settings
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/authMiddleware');
const db = require('../database');

router.use(requireAuth);

/**
 * GET /api/user/appearance
 * Get all appearance settings for current user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        const settings = await new Promise((resolve, reject) => {
            db.get(
                `SELECT theme, accent_color, font_family, font_size, display_density,
                        sidebar_collapsed, dashboard_layout, color_blind_mode, 
                        reduced_motion, high_contrast, custom_css
                 FROM user_appearance_settings
                 WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row || null);
                }
            );
        });

        res.json({
            success: true,
            data: {
                theme: settings?.theme || 'system',
                accentColor: settings?.accent_color || '#6366f1',
                fontFamily: settings?.font_family || 'Inter',
                fontSize: settings?.font_size || 'medium',
                displayDensity: settings?.display_density || 'comfortable',
                sidebarCollapsed: !!settings?.sidebar_collapsed,
                dashboardLayout: settings?.dashboard_layout || 'default',
                colorBlindMode: settings?.color_blind_mode || 'none',
                reducedMotion: !!settings?.reduced_motion,
                highContrast: !!settings?.high_contrast,
                customCss: settings?.custom_css || ''
            }
        });
    } catch (error) {
        console.error('Error fetching appearance settings:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch appearance settings' });
    }
});

/**
 * PUT /api/user/appearance
 * Update appearance settings
 */
router.put('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            theme, accentColor, fontFamily, fontSize, displayDensity,
            sidebarCollapsed, dashboardLayout, colorBlindMode, 
            reducedMotion, highContrast, customCss
        } = req.body;

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_appearance_settings (
                    user_id, theme, accent_color, font_family, font_size, display_density,
                    sidebar_collapsed, dashboard_layout, color_blind_mode,
                    reduced_motion, high_contrast, custom_css, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    theme = EXCLUDED.theme,
                    accent_color = EXCLUDED.accent_color,
                    font_family = EXCLUDED.font_family,
                    font_size = EXCLUDED.font_size,
                    display_density = EXCLUDED.display_density,
                    sidebar_collapsed = EXCLUDED.sidebar_collapsed,
                    dashboard_layout = EXCLUDED.dashboard_layout,
                    color_blind_mode = EXCLUDED.color_blind_mode,
                    reduced_motion = EXCLUDED.reduced_motion,
                    high_contrast = EXCLUDED.high_contrast,
                    custom_css = EXCLUDED.custom_css,
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    userId,
                    theme || 'system',
                    accentColor || '#6366f1',
                    fontFamily || 'Inter',
                    fontSize || 'medium',
                    displayDensity || 'comfortable',
                    sidebarCollapsed ? 1 : 0,
                    dashboardLayout || 'default',
                    colorBlindMode || 'none',
                    reducedMotion ? 1 : 0,
                    highContrast ? 1 : 0,
                    customCss || null
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, message: 'Appearance settings updated successfully' });
    } catch (error) {
        console.error('Error updating appearance settings:', error);
        res.status(500).json({ success: false, error: 'Failed to update appearance settings' });
    }
});

module.exports = router;




