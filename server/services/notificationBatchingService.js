/**
 * Notification Batching Service - Digest and batching for notifications
 * Part of My Work Module PMO Upgrade
 * 
 * Features:
 * - Notification batching
 * - Daily/Weekly digest generation
 * - Quiet hours respect
 * - Critical notification bypass
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const BaseService = require('./BaseService');
const NotificationService = require('./notificationService');

const NotificationBatchingService = Object.assign({}, BaseService, {
    
    /**
     * Get user notification preferences
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User preferences
     */
    getPreferences: async function(userId) {
        const sql = `SELECT * FROM notification_preferences WHERE user_id = ?`;
        const prefs = await this.queryOne(sql, [userId]);
        
        if (!prefs) {
            // Return defaults
            return {
                userId,
                categories: {
                    task_assigned: { inapp: true, push: true, email: false },
                    task_due_soon: { inapp: true, push: true, email: false },
                    task_overdue: { inapp: true, push: true, email: true },
                    decision_required: { inapp: true, push: true, email: true },
                    mention: { inapp: true, push: true, email: false },
                    comment: { inapp: true, push: false, email: false },
                    status_change: { inapp: true, push: false, email: false },
                    ai_insight: { inapp: true, push: false, email: false },
                    phase_transition: { inapp: true, push: true, email: true },
                    blocking_alert: { inapp: true, push: true, email: true }
                },
                quietHours: {
                    enabled: false,
                    start: '20:00',
                    end: '08:00',
                    timezone: 'Europe/Warsaw'
                },
                weekendSettings: {
                    criticalOnly: true,
                    digestOnly: false
                },
                dailyDigest: {
                    enabled: true,
                    time: '09:00'
                },
                weeklyDigest: {
                    enabled: true,
                    day: 'monday',
                    time: '09:00'
                }
            };
        }
        
        // Parse JSON fields
        let categories = {};
        try {
            categories = JSON.parse(prefs.category_settings || '{}');
        } catch (e) {
            categories = {};
        }
        
        return {
            userId,
            categories,
            quietHours: {
                enabled: !!prefs.quiet_hours_enabled,
                start: prefs.quiet_hours_start || '20:00',
                end: prefs.quiet_hours_end || '08:00',
                timezone: prefs.quiet_hours_timezone || 'Europe/Warsaw'
            },
            weekendSettings: {
                criticalOnly: !!prefs.weekend_critical_only,
                digestOnly: !!prefs.weekend_digest_only
            },
            dailyDigest: {
                enabled: !!prefs.daily_digest_enabled,
                time: prefs.daily_digest_time || '09:00'
            },
            weeklyDigest: {
                enabled: !!prefs.weekly_digest_enabled,
                day: prefs.weekly_digest_day || 'monday',
                time: prefs.weekly_digest_time || '09:00'
            }
        };
    },

    /**
     * Save user notification preferences
     * @param {string} userId - User ID
     * @param {Object} prefs - Preferences to save
     * @returns {Promise<Object>} Updated preferences
     */
    setPreferences: async function(userId, prefs) {
        const current = await this.getPreferences(userId);
        const merged = { ...current, ...prefs };
        
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO notification_preferences 
                (user_id, category_settings, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, 
                 quiet_hours_timezone, weekend_critical_only, weekend_digest_only, 
                 daily_digest_enabled, daily_digest_time, weekly_digest_enabled, weekly_digest_day, weekly_digest_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    category_settings = excluded.category_settings,
                    quiet_hours_enabled = excluded.quiet_hours_enabled,
                    quiet_hours_start = excluded.quiet_hours_start,
                    quiet_hours_end = excluded.quiet_hours_end,
                    quiet_hours_timezone = excluded.quiet_hours_timezone,
                    weekend_critical_only = excluded.weekend_critical_only,
                    weekend_digest_only = excluded.weekend_digest_only,
                    daily_digest_enabled = excluded.daily_digest_enabled,
                    daily_digest_time = excluded.daily_digest_time,
                    weekly_digest_enabled = excluded.weekly_digest_enabled,
                    weekly_digest_day = excluded.weekly_digest_day,
                    weekly_digest_time = excluded.weekly_digest_time,
                    updated_at = datetime('now')`,
                [
                    userId,
                    JSON.stringify(merged.categories || {}),
                    merged.quietHours?.enabled ? 1 : 0,
                    merged.quietHours?.start || '20:00',
                    merged.quietHours?.end || '08:00',
                    merged.quietHours?.timezone || 'Europe/Warsaw',
                    merged.weekendSettings?.criticalOnly ? 1 : 0,
                    merged.weekendSettings?.digestOnly ? 1 : 0,
                    merged.dailyDigest?.enabled ? 1 : 0,
                    merged.dailyDigest?.time || '09:00',
                    merged.weeklyDigest?.enabled ? 1 : 0,
                    merged.weeklyDigest?.day || 'monday',
                    merged.weeklyDigest?.time || '09:00'
                ],
                (err) => {
                    if (err) return reject(err);
                    resolve(merged);
                }
            );
        });
    },

    /**
     * Check if notification should be sent based on preferences
     * @param {string} userId - User ID
     * @param {string} category - Notification category
     * @param {string} severity - Notification severity
     * @returns {Promise<Object>} Delivery channels
     */
    checkDeliveryChannels: async function(userId, category, severity) {
        const prefs = await this.getPreferences(userId);
        const categoryPrefs = prefs.categories[category] || { inapp: true, push: false, email: false };
        
        // Check quiet hours
        if (prefs.quietHours?.enabled && severity !== 'CRITICAL') {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const currentTime = hours * 60 + minutes;
            
            const [startH, startM] = (prefs.quietHours.start || '20:00').split(':').map(Number);
            const [endH, endM] = (prefs.quietHours.end || '08:00').split(':').map(Number);
            const startTime = startH * 60 + startM;
            const endTime = endH * 60 + endM;
            
            // Check if current time is in quiet hours
            let inQuietHours = false;
            if (startTime > endTime) {
                // Overnight quiet hours (e.g., 20:00 - 08:00)
                inQuietHours = currentTime >= startTime || currentTime <= endTime;
            } else {
                inQuietHours = currentTime >= startTime && currentTime <= endTime;
            }
            
            if (inQuietHours) {
                // Only allow in-app during quiet hours
                return { inapp: categoryPrefs.inapp, push: false, email: false };
            }
        }
        
        // Check weekend settings
        const day = new Date().getDay();
        const isWeekend = day === 0 || day === 6;
        if (isWeekend && prefs.weekendSettings?.criticalOnly && severity !== 'CRITICAL') {
            return { inapp: categoryPrefs.inapp, push: false, email: false };
        }
        
        return categoryPrefs;
    },

    /**
     * Queue notification for batching
     * @param {Object} notification - Notification to queue
     * @returns {Promise<Object>} Queued notification
     */
    queueNotification: async function(notification) {
        const channels = await this.checkDeliveryChannels(
            notification.userId, 
            notification.type, 
            notification.severity
        );
        
        // Always create in-app notification immediately
        if (channels.inapp) {
            await NotificationService.create(notification);
        }
        
        // Queue push/email for batching (if enabled)
        if (channels.push || channels.email) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO notification_batches 
                    (id, user_id, batch_type, status, scheduled_at, content)
                    VALUES (?, ?, 'immediate', 'pending', datetime('now'), ?)`,
                    [uuidv4(), notification.userId, JSON.stringify({ notification, channels })],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
        
        return { queued: true, channels };
    },

    /**
     * Generate daily digest for a user
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Digest content
     */
    generateDailyDigest: async function(userId) {
        const FocusService = require('./focusService');
        const InboxService = require('./inboxService');
        
        // Get yesterday's and today's data
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        // Get execution history
        const history = await FocusService.getExecutionHistory(userId, 2);
        const todayScore = history[0]?.score || 0;
        const yesterdayScore = history[1]?.score || 0;
        
        // Get inbox counts
        const inboxCounts = await InboxService.getInboxCounts(userId);
        
        // Get overdue tasks
        const overdueSql = `
            SELECT t.id, t.title, t.due_date
            FROM tasks t
            WHERE t.assignee_id = ? 
            AND t.due_date < ? 
            AND t.status NOT IN ('done', 'completed', 'DONE', 'COMPLETED')
            ORDER BY t.due_date
            LIMIT 5
        `;
        const overdueTasks = await this.queryAll(overdueSql, [userId, today]);
        
        // Get upcoming deadlines (next 3 days)
        const upcomingSql = `
            SELECT t.id, t.title, t.due_date
            FROM tasks t
            WHERE t.assignee_id = ? 
            AND t.due_date >= ? 
            AND t.due_date <= date(?, '+3 days')
            AND t.status NOT IN ('done', 'completed', 'DONE', 'COMPLETED')
            ORDER BY t.due_date
            LIMIT 5
        `;
        const upcomingTasks = await this.queryAll(upcomingSql, [userId, today, today]);
        
        // Get pending decisions
        const decisionsSql = `
            SELECT id, title FROM decisions 
            WHERE decision_owner_id = ? AND status = 'PENDING'
            LIMIT 5
        `;
        const decisions = await this.queryAll(decisionsSql, [userId]);
        
        // Build highlights
        const highlights = [];
        
        // Execution streak check
        const recentHistory = await FocusService.getExecutionHistory(userId, 7);
        const streakDays = recentHistory.filter(h => h.score >= 80).length;
        if (streakDays >= 3) {
            highlights.push({
                type: 'achievement',
                title: `${streakDays}-Day Streak!`,
                description: `You've completed all focus tasks for ${streakDays} days in a row`
            });
        }
        
        // Score improvement
        if (todayScore > yesterdayScore + 10) {
            highlights.push({
                type: 'improvement',
                title: 'Great Progress!',
                description: `Your execution score improved by ${todayScore - yesterdayScore} points`
            });
        }
        
        // Warning for overdue
        if (overdueTasks.length > 0) {
            highlights.push({
                type: 'warning',
                title: 'Overdue Tasks',
                description: `You have ${overdueTasks.length} overdue task(s) that need attention`
            });
        }
        
        const digest = {
            period: 'daily',
            generatedAt: new Date().toISOString(),
            summary: {
                tasksCompleted: history[0]?.completedCount || 0,
                tasksCreated: history[0]?.totalCount || 0,
                overdueCount: overdueTasks.length,
                decisionsRequired: decisions.length,
                executionScore: todayScore,
                scoreChange: todayScore - yesterdayScore
            },
            highlights,
            upcomingDeadlines: upcomingTasks.map(t => ({
                taskId: t.id,
                title: t.title,
                dueDate: t.due_date
            })),
            inboxCounts,
            aiInsights: [] // Would be populated by AI service
        };
        
        return digest;
    },

    /**
     * Generate weekly digest for a user
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Weekly digest content
     */
    generateWeeklyDigest: async function(userId) {
        const FocusService = require('./focusService');
        
        // Get week's history
        const history = await FocusService.getExecutionHistory(userId, 7);
        
        // Calculate week stats
        const totalCompleted = history.reduce((sum, h) => sum + h.completedCount, 0);
        const totalTasks = history.reduce((sum, h) => sum + h.totalCount, 0);
        const avgScore = history.length > 0 
            ? Math.round(history.reduce((sum, h) => sum + h.score, 0) / history.length)
            : 0;
        
        // Best and worst days
        const sortedByScore = [...history].sort((a, b) => b.score - a.score);
        const bestDay = sortedByScore[0];
        const worstDay = sortedByScore[sortedByScore.length - 1];
        
        // Trend comparison with previous week
        const prevWeekHistory = await FocusService.getExecutionHistory(userId, 14);
        const prevWeek = prevWeekHistory.slice(7, 14);
        const prevAvgScore = prevWeek.length > 0
            ? Math.round(prevWeek.reduce((sum, h) => sum + h.score, 0) / prevWeek.length)
            : 0;
        
        const digest = {
            period: 'weekly',
            generatedAt: new Date().toISOString(),
            summary: {
                tasksCompleted: totalCompleted,
                tasksCreated: totalTasks,
                averageScore: avgScore,
                bestDayScore: bestDay?.score || 0,
                bestDayDate: bestDay?.date || '',
                scoreVsLastWeek: avgScore - prevAvgScore,
                trend: avgScore > prevAvgScore ? 'up' : avgScore < prevAvgScore ? 'down' : 'stable'
            },
            dailyBreakdown: history.map(h => ({
                date: h.date,
                score: h.score,
                completed: h.completedCount,
                total: h.totalCount
            })),
            recommendations: this._generateWeeklyRecommendations(history, avgScore)
        };
        
        return digest;
    },

    /**
     * Generate personalized recommendations based on week's performance
     */
    _generateWeeklyRecommendations: function(history, avgScore) {
        const recommendations = [];
        
        if (avgScore < 50) {
            recommendations.push('Consider focusing on fewer, higher-priority tasks each day');
            recommendations.push('Review your task estimation - are tasks taking longer than expected?');
        } else if (avgScore < 75) {
            recommendations.push('You\'re on track! Try adding buffer time between tasks');
        } else {
            recommendations.push('Excellent week! Consider taking on a strategic initiative');
        }
        
        // Check for patterns
        const lowDays = history.filter(h => h.score < 50);
        if (lowDays.length >= 2) {
            recommendations.push(`Consider reviewing your workload on ${lowDays.map(d => d.date).join(', ')}`);
        }
        
        return recommendations;
    },

    /**
     * Process pending notification batches
     * This should be called by a cron job
     */
    processBatches: async function() {
        const pendingBatches = await this.queryAll(
            `SELECT * FROM notification_batches 
             WHERE status = 'pending' AND scheduled_at <= datetime('now')
             LIMIT 100`
        );
        
        for (const batch of pendingBatches) {
            try {
                // Mark as processing
                await new Promise((resolve, reject) => {
                    db.run(
                        `UPDATE notification_batches SET status = 'processing' WHERE id = ?`,
                        [batch.id],
                        (err) => err ? reject(err) : resolve()
                    );
                });
                
                // Process based on batch type
                const content = JSON.parse(batch.content || '{}');
                
                // TODO: Implement actual push/email sending
                // await PushService.send(content.notification, content.channels);
                // await EmailService.send(content.notification, content.channels);
                
                // Mark as sent
                await new Promise((resolve, reject) => {
                    db.run(
                        `UPDATE notification_batches SET status = 'sent', sent_at = datetime('now') WHERE id = ?`,
                        [batch.id],
                        (err) => err ? reject(err) : resolve()
                    );
                });
            } catch (error) {
                console.error(`Failed to process batch ${batch.id}:`, error);
                await new Promise((resolve) => {
                    db.run(
                        `UPDATE notification_batches SET status = 'failed' WHERE id = ?`,
                        [batch.id],
                        () => resolve()
                    );
                });
            }
        }
        
        return { processed: pendingBatches.length };
    }
});

module.exports = NotificationBatchingService;



