/**
 * Proactive Nudges Service
 * 
 * Provides context-aware AI suggestions based on user behavior and project state.
 * Features:
 * - Pattern detection
 * - Smart timing
 * - Contextual recommendations
 * - Learning from user actions
 */

import { getDatabase } from '../../src/database/Database.ts';
const db = getDatabase();
import { aiLogger } from './logger.js';

// Nudge triggers and conditions
const NUDGE_TRIGGERS = {
    ASSESSMENT_STARTED: {
        id: 'assessment_started',
        delay: 300000, // 5 minutes
        message: 'Widzę, że rozpocząłeś ocenę. Chcesz, żebym pomógł Ci zrozumieć poszczególne kryteria?',
        capability: 'assessment_help'
    },
    ASSESSMENT_STALLED: {
        id: 'assessment_stalled',
        delay: 600000, // 10 minutes
        message: 'Zauważyłem, że ocena nie jest jeszcze ukończona. Mogę zasugerować optymalne wartości na podstawie profilu firmy.',
        capability: 'assessment_suggestion'
    },
    REPORT_EMPTY: {
        id: 'report_empty',
        delay: 180000, // 3 minutes
        message: 'Raport jest pusty. Chcesz, żebym wygenerował kompleksowy raport audytu DRD?',
        capability: 'report_generation'
    },
    NO_INITIATIVES: {
        id: 'no_initiatives',
        delay: 300000, // 5 minutes
        message: 'Nie masz jeszcze inicjatyw zmian. Mogę zaproponować priorytetowe działania na podstawie oceny.',
        capability: 'initiative_suggestion'
    },
    TASK_OVERDUE: {
        id: 'task_overdue',
        delay: 0, // Immediate
        message: 'Masz zaległe zadania. Mogę pomóc w reorganizacji harmonogramu.',
        capability: 'task_advisor'
    },
    LOW_SCORE_DETECTED: {
        id: 'low_score_detected',
        delay: 60000, // 1 minute
        message: 'Wykryłem niskie oceny w niektórych osiach DRD. Chcesz zobaczyć rekomendacje poprawy?',
        capability: 'improvement_recommendations'
    },
    FIRST_LOGIN: {
        id: 'first_login',
        delay: 30000, // 30 seconds
        message: 'Witaj w Consultify! Jestem Twoim asystentem AI. Jak mogę Ci dziś pomóc?',
        capability: 'onboarding'
    }
};

class ProactiveNudgesService {
    constructor() {
        this.userStates = new Map(); // Track user activity states
        this.nudgeHistory = new Map(); // Track shown nudges per user
        this.cooldownPeriod = 3600000; // 1 hour between same nudge types
    }

    /**
     * Track user activity
     */
    async trackActivity(userId, activityType, metadata = {}) {
        const now = Date.now();
        
        if (!this.userStates.has(userId)) {
            this.userStates.set(userId, {
                activities: [],
                lastActivity: now,
                sessionStart: now
            });
        }

        const state = this.userStates.get(userId);
        state.activities.push({
            type: activityType,
            timestamp: now,
            metadata
        });
        state.lastActivity = now;

        // Keep only last 50 activities
        if (state.activities.length > 50) {
            state.activities = state.activities.slice(-50);
        }

        // Check for nudge triggers
        const nudges = await this.checkTriggers(userId, activityType, metadata);
        
        return nudges;
    }

    /**
     * Check if any nudges should be triggered
     */
    async checkTriggers(userId, activityType, metadata) {
        const nudges = [];
        const state = this.userStates.get(userId);

        switch (activityType) {
            case 'assessment_view':
                if (await this.shouldShowNudge(userId, 'assessment_started')) {
                    nudges.push(this.createNudge(NUDGE_TRIGGERS.ASSESSMENT_STARTED, userId, metadata));
                }
                break;

            case 'assessment_idle':
                const lastAssessmentActivity = state.activities
                    .filter(a => a.type.startsWith('assessment_'))
                    .pop();
                if (lastAssessmentActivity && 
                    Date.now() - lastAssessmentActivity.timestamp > NUDGE_TRIGGERS.ASSESSMENT_STALLED.delay) {
                    if (await this.shouldShowNudge(userId, 'assessment_stalled')) {
                        nudges.push(this.createNudge(NUDGE_TRIGGERS.ASSESSMENT_STALLED, userId, metadata));
                    }
                }
                break;

            case 'report_view':
                if (metadata.isEmpty && await this.shouldShowNudge(userId, 'report_empty')) {
                    nudges.push(this.createNudge(NUDGE_TRIGGERS.REPORT_EMPTY, userId, metadata));
                }
                break;

            case 'project_view':
                if (metadata.initiativeCount === 0 && await this.shouldShowNudge(userId, 'no_initiatives')) {
                    nudges.push(this.createNudge(NUDGE_TRIGGERS.NO_INITIATIVES, userId, metadata));
                }
                break;

            case 'assessment_score':
                if (metadata.score < 3 && await this.shouldShowNudge(userId, 'low_score_detected')) {
                    nudges.push(this.createNudge(NUDGE_TRIGGERS.LOW_SCORE_DETECTED, userId, metadata));
                }
                break;

            case 'login':
                if (metadata.isFirstLogin && await this.shouldShowNudge(userId, 'first_login')) {
                    nudges.push(this.createNudge(NUDGE_TRIGGERS.FIRST_LOGIN, userId, metadata));
                }
                break;
        }

        return nudges;
    }

    /**
     * Check if nudge should be shown (respects cooldown)
     */
    async shouldShowNudge(userId, nudgeId) {
        const historyKey = `${userId}:${nudgeId}`;
        const lastShown = this.nudgeHistory.get(historyKey);

        if (lastShown && Date.now() - lastShown < this.cooldownPeriod) {
            return false;
        }

        // Check database for dismissed nudges
        try {
            const dismissed = await db.get(`
                SELECT dismissed_at FROM ai_nudge_dismissals
                WHERE user_id = ? AND nudge_id = ?
                AND dismissed_at > datetime('now', '-7 days')
            `, [userId, nudgeId]);

            if (dismissed) {
                return false;
            }
        } catch (error) {
            // Table might not exist yet
            aiLogger.debug('ProactiveNudges', `Dismissal check failed: ${error.message}`);
        }

        return true;
    }

    /**
     * Create nudge object
     */
    createNudge(trigger, userId, metadata) {
        return {
            id: require('crypto').randomUUID(),
            nudgeId: trigger.id,
            userId,
            message: trigger.message,
            capability: trigger.capability,
            metadata,
            priority: this.calculatePriority(trigger, metadata),
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000 // 1 hour
        };
    }

    /**
     * Calculate nudge priority
     */
    calculatePriority(trigger, metadata) {
        let priority = 50; // Base priority

        // Adjust based on trigger type
        if (trigger.id === 'first_login') priority = 100;
        if (trigger.id === 'task_overdue') priority = 90;
        if (trigger.id === 'low_score_detected') priority = 75;

        // Adjust based on metadata
        if (metadata?.critical) priority += 20;
        if (metadata?.urgent) priority += 15;

        return Math.min(100, priority);
    }

    /**
     * Mark nudge as shown
     */
    async markNudgeShown(userId, nudgeId) {
        this.nudgeHistory.set(`${userId}:${nudgeId}`, Date.now());
        
        try {
            await db.run(`
                INSERT INTO ai_nudge_log (id, user_id, nudge_id, shown_at)
                VALUES (?, ?, ?, datetime('now'))
            `, [require('crypto').randomUUID(), userId, nudgeId]);
        } catch (error) {
            aiLogger.debug('ProactiveNudges', `Log failed: ${error.message}`);
        }
    }

    /**
     * Mark nudge as dismissed
     */
    async dismissNudge(userId, nudgeId) {
        try {
            await db.run(`
                INSERT INTO ai_nudge_dismissals (id, user_id, nudge_id, dismissed_at)
                VALUES (?, ?, ?, datetime('now'))
            `, [require('crypto').randomUUID(), userId, nudgeId]);
        } catch (error) {
            aiLogger.debug('ProactiveNudges', `Dismiss failed: ${error.message}`);
        }
    }

    /**
     * Mark nudge as acted upon
     */
    async nudgeActedUpon(userId, nudgeId, action) {
        try {
            await db.run(`
                UPDATE ai_nudge_log 
                SET acted_upon = 1, action = ?, acted_at = datetime('now')
                WHERE user_id = ? AND nudge_id = ? AND acted_upon IS NULL
                ORDER BY shown_at DESC LIMIT 1
            `, [action, userId, nudgeId]);
        } catch (error) {
            aiLogger.debug('ProactiveNudges', `Action log failed: ${error.message}`);
        }
    }

    /**
     * Alias for nudgeActedUpon for API compatibility
     */
    async markNudgeActed(userId, nudgeId, action) {
        return this.nudgeActedUpon(userId, nudgeId, action);
    }

    /**
     * Check and generate nudges based on context
     */
    async checkAndGenerateNudges(userId, organizationId, context = {}) {
        const nudges = [];
        
        // Check based on trigger type
        if (context.trigger) {
            const triggerNudges = await this.checkTriggers(userId, context.trigger, context.context || {});
            nudges.push(...triggerNudges);
        }

        // Mark all generated nudges as shown
        for (const nudge of nudges) {
            await this.markNudgeShown(userId, nudge.nudgeId);
        }

        return nudges;
    }

    /**
     * Suppress a type of nudge for a user
     */
    async suppressNudgeType(userId, nudgeType, duration = 'permanent') {
        try {
            const expiresAt = duration === 'permanent' 
                ? "datetime('now', '+10 years')"
                : "datetime('now', '+7 days')";

            await db.run(`
                INSERT INTO ai_nudge_suppressions (id, user_id, nudge_type, suppressed_at, expires_at)
                VALUES (?, ?, ?, datetime('now'), ${expiresAt})
                ON CONFLICT (user_id, nudge_type) 
                DO UPDATE SET suppressed_at = datetime('now'), expires_at = excluded.expires_at
            `, [require('crypto').randomUUID(), userId, nudgeType]);

            aiLogger.info('ProactiveNudges', `Suppressed ${nudgeType} for user ${userId}`);
        } catch (error) {
            aiLogger.debug('ProactiveNudges', `Suppression failed: ${error.message}`);
        }
    }

    /**
     * Get pending nudges for user
     */
    async getPendingNudges(userId, context = {}) {
        const nudges = [];
        const state = this.userStates.get(userId);

        if (!state) {
            return nudges;
        }

        // Check various conditions based on current context
        if (context.screenName === 'assessment' && context.isEmpty) {
            if (await this.shouldShowNudge(userId, 'assessment_started')) {
                nudges.push(this.createNudge(NUDGE_TRIGGERS.ASSESSMENT_STARTED, userId, context));
            }
        }

        if (context.screenName === 'report' && context.isEmpty) {
            if (await this.shouldShowNudge(userId, 'report_empty')) {
                nudges.push(this.createNudge(NUDGE_TRIGGERS.REPORT_EMPTY, userId, context));
            }
        }

        if (context.hasOverdueTasks) {
            if (await this.shouldShowNudge(userId, 'task_overdue')) {
                nudges.push(this.createNudge(NUDGE_TRIGGERS.TASK_OVERDUE, userId, context));
            }
        }

        // Sort by priority
        return nudges.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Get nudge analytics
     */
    async getNudgeAnalytics(organizationId = null) {
        try {
            let query = `
                SELECT 
                    nudge_id,
                    COUNT(*) as shown_count,
                    SUM(CASE WHEN acted_upon = 1 THEN 1 ELSE 0 END) as acted_count
                FROM ai_nudge_log
            `;
            const params = [];

            if (organizationId) {
                query += ` WHERE organization_id = ?`;
                params.push(organizationId);
            }

            query += ` GROUP BY nudge_id`;

            const stats = await db.all(query, params);

            return stats.map(s => ({
                nudgeId: s.nudge_id,
                shownCount: s.shown_count,
                actedCount: s.acted_count,
                actionRate: s.shown_count > 0 
                    ? Math.round((s.acted_count / s.shown_count) * 100) 
                    : 0
            }));
        } catch (error) {
            aiLogger.debug('ProactiveNudges', `Analytics failed: ${error.message}`);
            return [];
        }
    }
}

// Singleton instance
const proactiveNudgesService = new ProactiveNudgesService();

export {
    ProactiveNudgesService,
    proactiveNudgesService,
    proactiveNudgesService as proactiveNudges, // Alias for API routes
    NUDGE_TRIGGERS
};

export default {
    ProactiveNudgesService,
    proactiveNudgesService,
    proactiveNudges: proactiveNudgesService, // Alias for API routes
    NUDGE_TRIGGERS
};

