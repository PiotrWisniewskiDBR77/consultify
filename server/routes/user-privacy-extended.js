/**
 * User Privacy Extended Routes
 * 
 * Features:
 * - Profile visibility settings (public/org/team/private)
 * - Email/Phone visibility
 * - Activity feed controls
 * - Directory & search visibility
 * - Profile sections visibility
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/authMiddleware');
const db = require('../database');

router.use(requireAuth);

/**
 * GET /api/user/privacy-settings
 * Get privacy settings for current user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        const settings = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM user_profile_extended WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!settings) {
            // Return defaults
            return res.json({
                success: true,
                data: {
                    profileVisibility: 'organization',
                    avatarVisibility: 'organization',
                    emailVisibility: 'organization',
                    phoneVisibility: 'team',
                    showActivityStatus: true,
                    showLastSeen: true,
                    activityFeedVisibility: 'team',
                    showTaskActivity: true,
                    showProjectActivity: true,
                    showCommentActivity: true,
                    showInDirectory: true,
                    showInSearch: true,
                    allowMentionsFrom: 'all',
                    allowDirectMessagesFrom: 'all',
                    showBio: true,
                    showSkills: true,
                    showCertifications: true,
                    showEducation: true,
                    showWorkHistory: true,
                    showSocialLinks: true
                }
            });
        }

        // Parse JSON fields
        let activitySettings = {};
        let profileSectionSettings = {};
        try {
            if (settings.activity_visibility_json) {
                activitySettings = JSON.parse(settings.activity_visibility_json);
            }
            if (settings.profile_section_visibility_json) {
                profileSectionSettings = JSON.parse(settings.profile_section_visibility_json);
            }
        } catch (e) {
            console.error('Error parsing JSON settings:', e);
        }

        res.json({
            success: true,
            data: {
                profileVisibility: settings.profile_visibility || 'organization',
                avatarVisibility: activitySettings.avatarVisibility || 'organization',
                emailVisibility: activitySettings.emailVisibility || 'organization',
                phoneVisibility: activitySettings.phoneVisibility || 'team',
                showActivityStatus: settings.show_activity_status !== 0,
                showLastSeen: settings.show_last_seen !== 0,
                activityFeedVisibility: activitySettings.activityFeedVisibility || 'team',
                showTaskActivity: activitySettings.showTaskActivity !== false,
                showProjectActivity: activitySettings.showProjectActivity !== false,
                showCommentActivity: activitySettings.showCommentActivity !== false,
                showInDirectory: settings.show_in_directory !== 0,
                showInSearch: activitySettings.showInSearch !== false,
                allowMentionsFrom: settings.allow_mentions_from || 'all',
                allowDirectMessagesFrom: settings.allow_direct_messages_from || 'all',
                showBio: profileSectionSettings.showBio !== false,
                showSkills: profileSectionSettings.showSkills !== false,
                showCertifications: profileSectionSettings.showCertifications !== false,
                showEducation: profileSectionSettings.showEducation !== false,
                showWorkHistory: profileSectionSettings.showWorkHistory !== false,
                showSocialLinks: profileSectionSettings.showSocialLinks !== false
            }
        });
    } catch (error) {
        console.error('Error fetching privacy settings:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch privacy settings' });
    }
});

/**
 * PUT /api/user/privacy-settings
 * Update privacy settings
 */
router.put('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            profileVisibility,
            avatarVisibility,
            emailVisibility,
            phoneVisibility,
            showActivityStatus,
            showLastSeen,
            activityFeedVisibility,
            showTaskActivity,
            showProjectActivity,
            showCommentActivity,
            showInDirectory,
            showInSearch,
            allowMentionsFrom,
            allowDirectMessagesFrom,
            showBio,
            showSkills,
            showCertifications,
            showEducation,
            showWorkHistory,
            showSocialLinks
        } = req.body;

        // Prepare JSON fields
        const activityVisibilityJson = JSON.stringify({
            avatarVisibility,
            emailVisibility,
            phoneVisibility,
            activityFeedVisibility,
            showTaskActivity,
            showProjectActivity,
            showCommentActivity,
            showInSearch
        });

        const profileSectionVisibilityJson = JSON.stringify({
            showBio,
            showSkills,
            showCertifications,
            showEducation,
            showWorkHistory,
            showSocialLinks
        });

        // Check if record exists
        const existing = await new Promise((resolve, reject) => {
            db.get('SELECT user_id FROM user_profile_extended WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (existing) {
            // Update
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE user_profile_extended SET
                        profile_visibility = ?,
                        show_activity_status = ?,
                        show_last_seen = ?,
                        show_in_directory = ?,
                        allow_mentions_from = ?,
                        allow_direct_messages_from = ?,
                        activity_visibility_json = ?,
                        profile_section_visibility_json = ?,
                        updated_at = datetime('now')
                     WHERE user_id = ?`,
                    [
                        profileVisibility || 'organization',
                        showActivityStatus ? 1 : 0,
                        showLastSeen ? 1 : 0,
                        showInDirectory ? 1 : 0,
                        allowMentionsFrom || 'all',
                        allowDirectMessagesFrom || 'all',
                        activityVisibilityJson,
                        profileSectionVisibilityJson,
                        userId
                    ],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        } else {
            // Insert
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO user_profile_extended 
                     (user_id, profile_visibility, show_activity_status, show_last_seen, show_in_directory,
                      allow_mentions_from, allow_direct_messages_from, activity_visibility_json, 
                      profile_section_visibility_json, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                    [
                        userId,
                        profileVisibility || 'organization',
                        showActivityStatus ? 1 : 0,
                        showLastSeen ? 1 : 0,
                        showInDirectory ? 1 : 0,
                        allowMentionsFrom || 'all',
                        allowDirectMessagesFrom || 'all',
                        activityVisibilityJson,
                        profileSectionVisibilityJson
                    ],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        res.json({ success: true, message: 'Privacy settings updated' });
    } catch (error) {
        console.error('Error updating privacy settings:', error);
        res.status(500).json({ success: false, error: 'Failed to update privacy settings' });
    }
});

module.exports = router;

