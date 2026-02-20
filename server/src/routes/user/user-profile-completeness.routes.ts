/**
 * User Profile Completeness Routes
 * Bundle 30.5 (T112) — Real implementation replacing stub
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

interface CompletionItem {
  id: string;
  label: string;
  weight: number;
  isComplete: boolean;
  action?: string;
  actionLabel?: string;
}

interface Suggestion {
  type: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  action?: string;
  actionLabel?: string;
}

/**
 * GET /api/user/profile-completeness
 */
router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
      const user = await dbGet<{
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        avatar_url: string | null;
        timezone: string | null;
        mfa_enabled: boolean | null;
      }>(`SELECT id, email, first_name, last_name, phone, avatar_url, timezone, mfa_enabled FROM users WHERE id = ?`, [userId]);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check connected accounts
      let hasConnectedAccount = false;
      let hasLinkedIn = false;
      try {
        const links = await dbAll<{ provider: string }>(
          `SELECT provider FROM oauth_links WHERE user_id = ? AND revoked_at IS NULL`,
          [userId]
        );
        hasConnectedAccount = links.length > 0;
        hasLinkedIn = links.some((l) => l.provider === 'linkedin');
      } catch {
        // table may not exist yet
      }

      // Check job title from profile
      let hasJobTitle = false;
      try {
        const profile = await dbGet<{ job_title: string | null }>(
          `SELECT job_title FROM user_profiles WHERE user_id = ?`,
          [userId]
        );
        hasJobTitle = !!(profile?.job_title);
      } catch {
        // table may not exist
      }

      const items: CompletionItem[] = [
        {
          id: 'avatar',
          label: 'Profile Photo',
          weight: 15,
          isComplete: !!user.avatar_url,
          action: 'avatar',
          actionLabel: 'Upload photo',
        },
        {
          id: 'name',
          label: 'Full Name',
          weight: 20,
          isComplete: !!(user.first_name && user.last_name),
          action: 'personal',
          actionLabel: 'Add name',
        },
        {
          id: 'jobTitle',
          label: 'Job Title',
          weight: 15,
          isComplete: hasJobTitle,
          action: 'personal',
          actionLabel: 'Add job title',
        },
        {
          id: 'phone',
          label: 'Phone Number',
          weight: 10,
          isComplete: !!user.phone,
          action: 'personal',
          actionLabel: 'Add phone',
        },
        {
          id: 'timezone',
          label: 'Timezone',
          weight: 10,
          isComplete: !!user.timezone && user.timezone !== 'UTC',
          action: 'personal',
          actionLabel: 'Set timezone',
        },
        {
          id: 'connectedAccounts',
          label: 'Connected Account',
          weight: 15,
          isComplete: hasConnectedAccount,
          action: 'connected',
          actionLabel: 'Connect account',
        },
        {
          id: 'mfa',
          label: 'Two-Factor Auth',
          weight: 15,
          isComplete: !!user.mfa_enabled,
          action: 'personal',
          actionLabel: 'Enable 2FA',
        },
      ];

      const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
      const completedWeight = items.filter((i) => i.isComplete).reduce((sum, i) => sum + i.weight, 0);
      const percentage = Math.round((completedWeight / totalWeight) * 100);

      // Build suggestions
      const suggestions: Suggestion[] = [];

      if (!hasLinkedIn) {
        suggestions.push({
          type: 'connect_linkedin',
          priority: 'high',
          message: 'Connect your LinkedIn account for faster login and professional credibility.',
          action: 'connected',
          actionLabel: 'Connect LinkedIn',
        });
      }

      if (!user.avatar_url) {
        suggestions.push({
          type: 'add_avatar',
          priority: 'medium',
          message: 'Add a profile photo to personalize your account.',
          action: 'avatar',
          actionLabel: 'Upload photo',
        });
      }

      if (!user.mfa_enabled) {
        suggestions.push({
          type: 'enable_mfa',
          priority: 'medium',
          message: 'Enable two-factor authentication for better security.',
          action: 'personal',
          actionLabel: 'Enable 2FA',
        });
      }

      // Check achievements
      const achievements: Array<{ achievement_type: string; unlocked_at: string }> = [];
      if (percentage >= 25) achievements.push({ achievement_type: 'PROFILE_COMPLETE_25', unlocked_at: new Date().toISOString() });
      if (percentage >= 50) achievements.push({ achievement_type: 'PROFILE_COMPLETE_50', unlocked_at: new Date().toISOString() });
      if (percentage >= 75) achievements.push({ achievement_type: 'PROFILE_COMPLETE_75', unlocked_at: new Date().toISOString() });
      if (percentage >= 100) achievements.push({ achievement_type: 'PROFILE_COMPLETE_100', unlocked_at: new Date().toISOString() });

      return res.json({
        success: true,
        data: {
          percentage,
          items,
          suggestions,
          achievements,
        },
      });
    } catch (err: any) {
      logger.error(`[profile-completeness] Error: ${err.message}`);
      return res.status(500).json({ error: 'Failed to compute profile completeness' });
    }
  })
);

export default router;
