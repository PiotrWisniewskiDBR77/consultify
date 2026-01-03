/**
 * User Profile Completeness Routes
 * 
 * Provides profile completeness data with role-based suggestions
 */

import express from 'express';
const router = express.Router();
import requireAuth from '../middleware/authMiddleware.js';
import { getDatabase } from '../database/Database.js';
const db = getDatabase();

router.use(requireAuth);

/**
 * GET /api/user/profile-completeness
 * Get profile completeness with suggestions
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        // Get user data
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, first_name, last_name, email, phone, linkedin_id, avatar_url, 
                        job_title, timezone, mfa_enabled, organization_id, role
                 FROM users WHERE id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Get linked accounts
        const linkedAccounts = user.linked_accounts ? JSON.parse(user.linked_accounts) : {};
        
        // Calculate completion items
        const items = [
            {
                id: 'avatar',
                label: 'Profile Photo',
                weight: 15,
                isComplete: !!user.avatar_url,
                action: 'avatar',
                actionLabel: 'Upload photo'
            },
            {
                id: 'name',
                label: 'Full Name',
                weight: 20,
                isComplete: !!(user.first_name && user.last_name),
                action: 'personal',
                actionLabel: 'Add name'
            },
            {
                id: 'jobTitle',
                label: 'Job Title',
                weight: 15,
                isComplete: !!user.job_title,
                action: 'personal',
                actionLabel: 'Add job title'
            },
            {
                id: 'phone',
                label: 'Phone Number',
                weight: 10,
                isComplete: !!user.phone,
                action: 'contact',
                actionLabel: 'Add phone'
            },
            {
                id: 'timezone',
                label: 'Timezone',
                weight: 10,
                isComplete: !!user.timezone && user.timezone !== 'UTC',
                action: 'personal',
                actionLabel: 'Set timezone'
            },
            {
                id: 'linkedin',
                label: 'LinkedIn Profile',
                weight: 10,
                isComplete: !!(user.linkedin_id || linkedAccounts.linkedin),
                action: 'connected',
                actionLabel: 'Connect LinkedIn'
            },
            {
                id: 'mfa',
                label: 'Two-Factor Auth',
                weight: 15,
                isComplete: !!user.mfa_enabled,
                action: 'personal',
                actionLabel: 'Enable 2FA'
            },
            {
                id: 'bio',
                label: 'Professional Bio',
                weight: 5,
                isComplete: false, // Will check from professional profile
                action: 'professional',
                actionLabel: 'Add bio'
            }
        ];

        // Calculate percentage
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        const completedWeight = items.filter(item => item.isComplete).reduce((sum, item) => sum + item.weight, 0);
        const percentage = Math.round((completedWeight / totalWeight) * 100);

        // Get achievements
        const achievements = await new Promise((resolve, reject) => {
            db.all(
                `SELECT achievement_type, unlocked_at 
                 FROM user_achievements 
                 WHERE user_id = ? 
                 ORDER BY unlocked_at DESC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // Role-based suggestions
        const suggestions = [];
        const userRole = user.role || 'USER';
        
        if (userRole === 'PROJECT_MANAGER' || userRole === 'MANAGER') {
            if (!user.linkedin_id && !linkedAccounts.linkedin) {
                suggestions.push({
                    type: 'role_based',
                    priority: 'high',
                    message: 'As a Project Manager, adding your LinkedIn profile helps build professional connections',
                    action: 'connected',
                    actionLabel: 'Connect LinkedIn'
                });
            }
        }

        if (!user.mfa_enabled) {
            suggestions.push({
                type: 'security',
                priority: 'high',
                message: 'Enable two-factor authentication to secure your account',
                action: 'personal',
                actionLabel: 'Enable 2FA'
            });
        }

        if (percentage < 50) {
            suggestions.push({
                type: 'completion',
                priority: 'medium',
                message: 'Complete your profile to unlock all features',
                action: 'personal',
                actionLabel: 'Complete Profile'
            });
        }

        res.json({
            success: true,
            data: {
                percentage,
                items,
                achievements,
                suggestions,
                completedItems: items.filter(i => i.isComplete).length,
                totalItems: items.length
            }
        });
    } catch (error) {
        console.error('Error fetching profile completeness:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch profile completeness' });
    }
});

/**
 * GET /api/user/achievements
 * Get all achievements for user
 */
router.get('/achievements', async (req, res) => {
    try {
        const userId = req.user.id;

        const achievements = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, achievement_type, unlocked_at, metadata
                 FROM user_achievements 
                 WHERE user_id = ? 
                 ORDER BY unlocked_at DESC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        res.json({ success: true, data: achievements });
    } catch (error) {
        console.error('Error fetching achievements:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch achievements' });
    }
});

export default router;






