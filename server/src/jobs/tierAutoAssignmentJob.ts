// @ts-nocheck
/**
 * Tier Auto-Assignment Job
 *
 * Automatically promotes or demotes user tiers based on their monthly usage.
 * Runs on a schedule (typically monthly) or can be triggered manually.
 *
 * Tier Thresholds (configurable per org):
 * - BUDGET: 0-1000 tokens/month
 * - STANDARD: 1000-50000 tokens/month
 * - PREMIUM: 50000-200000 tokens/month
 * - REASONING: 200000+ tokens/month (manual only by default)
 */

import { getDatabase } from '../database/index.js';
import logger from '../utils/Logger.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';

// Default tier thresholds (can be overridden per org)
const DEFAULT_TIER_THRESHOLDS = {
  BUDGET: { minTokens: 0, maxTokens: 1000 },
  STANDARD: { minTokens: 1001, maxTokens: 50000 },
  PREMIUM: { minTokens: 50001, maxTokens: 200000 },
  REASONING: { minTokens: 200001, maxTokens: Infinity },
};

// Models available per tier
const TIER_MODELS = {
  BUDGET: ['gpt-4o-mini', 'claude-3-haiku', 'gemini-1.5-flash', 'deepseek-chat'],
  STANDARD: ['gpt-4o', 'claude-3.5-sonnet', 'gemini-1.5-pro'],
  PREMIUM: ['gpt-4-turbo', 'claude-3-opus'],
  REASONING: ['o1-mini', 'o1-preview'],
};

class TierAutoAssignmentJob {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.results = [];
  }

  /**
   * Get tier thresholds for an organization (with defaults)
   */
  async getOrgThresholds(organizationId) {
    return new Promise((resolve) => {
      db.get(
        `SELECT tier_thresholds FROM organization_ai_settings WHERE organization_id = ?`,
        [organizationId],
        (err, row) => {
          if (err || !row || !row.tier_thresholds) {
            resolve(DEFAULT_TIER_THRESHOLDS);
            return;
          }
          try {
            const custom = JSON.parse(row.tier_thresholds);
            resolve({ ...DEFAULT_TIER_THRESHOLDS, ...custom });
          } catch {
            resolve(DEFAULT_TIER_THRESHOLDS);
          }
        }
      );
    });
  }

  /**
   * Get organization's auto-assignment settings
   */
  async getOrgAutoAssignSettings(organizationId) {
    return new Promise((resolve) => {
      db.get(
        `SELECT 
                    COALESCE(auto_tier_enabled, 0) as enabled,
                    COALESCE(auto_tier_direction, 'both') as direction,
                    COALESCE(auto_tier_notify, 1) as notify,
                    COALESCE(auto_tier_max_tier, 'PREMIUM') as maxTier
                FROM organization_ai_settings 
                WHERE organization_id = ?`,
        [organizationId],
        (err, row) => {
          if (err || !row) {
            resolve({
              enabled: false,
              direction: 'both', // 'up', 'down', 'both'
              notify: true,
              maxTier: 'PREMIUM', // Never auto-assign to REASONING
            });
            return;
          }
          resolve({
            enabled: !!row.enabled,
            direction: row.direction || 'both',
            notify: !!row.notify,
            maxTier: row.maxTier || 'PREMIUM',
          });
        }
      );
    });
  }

  /**
   * Calculate recommended tier based on token usage
   */
  determineTier(tokenUsage, thresholds) {
    if (tokenUsage >= thresholds.REASONING.minTokens) return 'REASONING';
    if (tokenUsage >= thresholds.PREMIUM.minTokens) return 'PREMIUM';
    if (tokenUsage >= thresholds.STANDARD.minTokens) return 'STANDARD';
    return 'BUDGET';
  }

  /**
   * Get tier rank for comparison
   */
  getTierRank(tier) {
    const ranks = { BUDGET: 0, STANDARD: 1, PREMIUM: 2, REASONING: 3 };
    return ranks[tier] ?? 0;
  }

  /**
   * Process a single user for tier reassignment
   */
  async processUser(user, thresholds, settings) {
    const { userId, userName, organizationId, currentTier, tokensThisMonth } = user;

    const recommendedTier = this.determineTier(tokensThisMonth, thresholds);
    const currentRank = this.getTierRank(currentTier);
    const recommendedRank = this.getTierRank(recommendedTier);
    const maxAllowedRank = this.getTierRank(settings.maxTier);

    // Determine if we should change
    let newTier = currentTier;
    let changeType = null;

    if (recommendedRank > currentRank && settings.direction !== 'down') {
      // Promotion (but cap at maxTier)
      if (recommendedRank <= maxAllowedRank) {
        newTier = recommendedTier;
        changeType = 'promoted';
      } else {
        newTier = settings.maxTier;
        changeType = 'promoted';
      }
    } else if (recommendedRank < currentRank && settings.direction !== 'up') {
      // Demotion
      newTier = recommendedTier;
      changeType = 'demoted';
    }

    // Only process if there's a change
    if (newTier === currentTier) {
      return { userId, userName, currentTier, newTier: null, changeType: 'unchanged' };
    }

    // Update user tier
    await this.updateUserTier(userId, newTier);

    // Log the change
    await this.logTierChange({
      userId,
      organizationId,
      previousTier: currentTier,
      newTier,
      reason: changeType,
      tokensThisMonth,
      triggeredBy: 'auto_assignment',
    });

    // Send notification if enabled
    if (settings.notify) {
      await this.sendTierChangeNotification(user, currentTier, newTier, changeType);
    }

    return {
      userId,
      userName,
      currentTier,
      newTier,
      changeType,
      tokensThisMonth,
    };
  }

  /**
   * Update user's tier in database
   */
  async updateUserTier(userId, tier) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO user_ai_settings (user_id, selected_tier, updated_at)
                 VALUES (?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(user_id) DO UPDATE SET 
                    selected_tier = excluded.selected_tier,
                    updated_at = CURRENT_TIMESTAMP`,
        [userId, tier],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * Log tier change to audit/history
   */
  async logTierChange({
    userId,
    organizationId,
    previousTier,
    newTier,
    reason,
    tokensThisMonth,
    triggeredBy,
  }) {
    return new Promise((resolve) => {
      db.run(
        `INSERT INTO tier_change_log 
                 (id, user_id, organization_id, previous_tier, new_tier, reason, tokens_at_change, triggered_by, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          uuidv4(),
          userId,
          organizationId,
          previousTier,
          newTier,
          reason,
          tokensThisMonth,
          triggeredBy,
        ],
        (err) => {
          if (err) {
            logger.error('[TierAutoAssignment] Failed to log change:', err.message);
          }
          resolve();
        }
      );
    });
  }

  /**
   * Send notification about tier change
   */
  async sendTierChangeNotification(user, oldTier, newTier, changeType) {
    // This would integrate with your notification system
    // For now, just log it
    logger.info(
      `[TierAutoAssignment] ${changeType === 'promoted' ? '📈' : '📉'} User ${user.userName} (${user.userId}) ${changeType} from ${oldTier} to ${newTier}`
    );

    // TODO: Integrate with NotificationService
    // await NotificationService.send({
    //     userId: user.userId,
    //     type: 'tier_change',
    //     title: changeType === 'promoted' ? 'Tier Upgraded!' : 'Tier Adjusted',
    //     message: `Your AI tier has been ${changeType} from ${oldTier} to ${newTier} based on your usage.`
    // });
  }

  /**
   * Get all users with their token usage for an organization
   */
  async getOrgUsersWithUsage(organizationId) {
    return new Promise((resolve) => {
      db.all(
        `SELECT 
                    u.id as "userId",
                    u.name as "userName",
                    u.email,
                    u.organization_id as "organizationId",
                    COALESCE(uas.selected_tier, 'BUDGET') as currentTier,
                    COALESCE((
                        SELECT SUM(tokens_used) 
                        FROM ai_usage_log 
                        WHERE user_id = u.id 
                        AND timestamp >= datetime('now', '-30 days')
                    ), 0) as tokensThisMonth
                FROM users u
                LEFT JOIN user_ai_settings uas ON u.id = uas.user_id
                WHERE u.organization_id = ?`,
        [organizationId],
        (err, rows) => {
          if (err) {
            logger.error('[TierAutoAssignment] Failed to get users:', err.message);
            resolve([]);
            return;
          }
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get all organizations with auto-assignment enabled
   */
  async getEnabledOrganizations() {
    return new Promise((resolve) => {
      db.all(
        `SELECT DISTINCT o.id as "organizationId", o.name as "organizationName"
                 FROM organizations o
                 JOIN organization_ai_settings oas ON o.id = oas.organization_id
                 WHERE oas.auto_tier_enabled = 1`,
        [],
        (err, rows) => {
          if (err) {
            logger.error('[TierAutoAssignment] Failed to get organizations:', err.message);
            resolve([]);
            return;
          }
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * Run auto-assignment for a specific organization
   */
  async runForOrganization(organizationId) {
    const settings = await this.getOrgAutoAssignSettings(organizationId);

    if (!settings.enabled) {
      return { organizationId, skipped: true, reason: 'Auto-assignment disabled' };
    }

    const thresholds = await this.getOrgThresholds(organizationId);
    const users = await this.getOrgUsersWithUsage(organizationId);

    const results = [];
    for (const user of users) {
      const result = await this.processUser(user, thresholds, settings);
      results.push(result);
    }

    const changes = results.filter((r) => r.changeType !== 'unchanged');
    const promotions = results.filter((r) => r.changeType === 'promoted');
    const demotions = results.filter((r) => r.changeType === 'demoted');

    return {
      organizationId,
      processed: users.length,
      changes: changes.length,
      promotions: promotions.length,
      demotions: demotions.length,
      details: results,
    };
  }

  /**
   * Run auto-assignment for all enabled organizations
   */
  async runGlobal() {
    if (this.isRunning) {
      logger.info('[TierAutoAssignment] Job already running, skipping');
      return { skipped: true, reason: 'Already running' };
    }

    this.isRunning = true;
    const startTime = Date.now();
    logger.info('[TierAutoAssignment] Starting global tier assignment job');

    try {
      const organizations = await this.getEnabledOrganizations();
      const results = [];

      for (const org of organizations) {
        const result = await this.runForOrganization(org.organizationId);
        results.push({ ...result, organizationName: org.organizationName });
      }

      const duration = Date.now() - startTime;
      this.lastRun = new Date().toISOString();
      this.results = results;

      const summary = {
        completedAt: this.lastRun,
        duration: `${duration}ms`,
        organizationsProcessed: organizations.length,
        totalChanges: results.reduce((sum, r) => sum + (r.changes || 0), 0),
        totalPromotions: results.reduce((sum, r) => sum + (r.promotions || 0), 0),
        totalDemotions: results.reduce((sum, r) => sum + (r.demotions || 0), 0),
        results,
      };

      logger.info(
        `[TierAutoAssignment] Job completed in ${duration}ms. ${summary.totalChanges} tier changes.`
      );
      return summary;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      lastResults: this.results,
    };
  }

  /**
   * Preview what changes would be made (dry run)
   */
  async preview(organizationId) {
    const settings = await this.getOrgAutoAssignSettings(organizationId);
    const thresholds = await this.getOrgThresholds(organizationId);
    const users = await this.getOrgUsersWithUsage(organizationId);

    const preview = users.map((user) => {
      const recommendedTier = this.determineTier(user.tokensThisMonth, thresholds);
      const currentRank = this.getTierRank(user.currentTier);
      const recommendedRank = this.getTierRank(recommendedTier);

      let wouldChange = false;
      let changeType = 'unchanged';
      let newTier = user.currentTier;

      if (settings.enabled) {
        if (recommendedRank > currentRank && settings.direction !== 'down') {
          const maxRank = this.getTierRank(settings.maxTier);
          if (recommendedRank <= maxRank) {
            wouldChange = true;
            changeType = 'promote';
            newTier = recommendedTier;
          }
        } else if (recommendedRank < currentRank && settings.direction !== 'up') {
          wouldChange = true;
          changeType = 'demote';
          newTier = recommendedTier;
        }
      }

      return {
        userId: user.userId,
        userName: user.userName,
        currentTier: user.currentTier,
        tokensThisMonth: user.tokensThisMonth,
        recommendedTier,
        wouldChange,
        changeType,
        newTier: wouldChange ? newTier : null,
      };
    });

    return {
      organizationId,
      settings,
      thresholds,
      userCount: users.length,
      wouldChange: preview.filter((p) => p.wouldChange).length,
      preview,
    };
  }
}

// Singleton instance
const tierAutoAssignmentJob = new TierAutoAssignmentJob();

export default tierAutoAssignmentJob;
