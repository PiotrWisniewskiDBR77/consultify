/**
 * AI Health Alert Service
 * 
 * Responsible for triggering alerts when AI health tests fail.
 * Notifies SuperAdmins via:
 * - In-app notifications
 * - Slack webhook (if configured)
 * 
 * @version 1.0.0
 */

import { getDatabase } from '../../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';
import NotificationService from '../notificationService.js';
import SlackService from '../slackService.js';
import { aiLogger } from './logger.js';

// Alert severities based on failure count
const ALERT_SEVERITY = {
    DEGRADED: 'DEGRADED',   // 1-2 tests failed
    CRITICAL: 'CRITICAL',   // 3+ tests failed or connection failed
    UNAVAILABLE: 'UNAVAILABLE' // All tests failed
};

// Cooldown period to prevent alert spam (in milliseconds)
const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

// In-memory cooldown tracker
const alertCooldowns = new Map();

const AIHealthAlertService = {
    ALERT_SEVERITY,

    /**
     * Trigger health alerts when tests fail
     * @param {Object} testResults - Results from AIHealthService.runAllTests()
     * @param {string} triggeredBy - User who triggered the test (optional)
     */
    async triggerHealthAlert(testResults, triggeredBy = 'system') {
        const failedTests = [];
        const passedTests = [];
        
        // Categorize results
        for (const [capability, result] of Object.entries(testResults.results || testResults)) {
            if (result.status === 'FAILED') {
                failedTests.push({ capability, error: result.error, latency: result.latency });
            } else {
                passedTests.push({ capability, latency: result.latency, skipped: result.details?.skipped });
            }
        }

        // No failures, no alert needed
        if (failedTests.length === 0) {
            aiLogger.info('AIHealthAlert', 'All tests passed, no alert needed');
            return { alertSent: false, reason: 'All tests passed' };
        }

        // Determine severity
        let severity = ALERT_SEVERITY.DEGRADED;
        const connectionFailed = failedTests.some(t => t.capability === 'connection');
        const chatReadyFailed = failedTests.some(t => t.capability === 'chat_ready');
        
        if (connectionFailed || chatReadyFailed) {
            severity = ALERT_SEVERITY.CRITICAL;
        } else if (failedTests.length >= 3) {
            severity = ALERT_SEVERITY.CRITICAL;
        }
        
        if (failedTests.length === Object.keys(testResults.results || testResults).length) {
            severity = ALERT_SEVERITY.UNAVAILABLE;
        }

        // Check cooldown
        const cooldownKey = `health_alert_${severity}`;
        const lastAlert = alertCooldowns.get(cooldownKey);
        const now = Date.now();

        if (lastAlert && (now - lastAlert) < ALERT_COOLDOWN_MS) {
            const remainingMs = ALERT_COOLDOWN_MS - (now - lastAlert);
            aiLogger.warn('AIHealthAlert', `Alert cooldown active, ${Math.round(remainingMs / 1000)}s remaining`);
            return { 
                alertSent: false, 
                reason: 'Cooldown active', 
                cooldownRemaining: remainingMs,
                severity
            };
        }

        // Set cooldown
        alertCooldowns.set(cooldownKey, now);

        // Build alert message
        const alertMessage = this._buildAlertMessage(failedTests, passedTests, severity);

        // Log to database
        await this._logAlert(severity, failedTests, triggeredBy);

        // Send notifications
        const notificationResults = await Promise.allSettled([
            this.notifySuperAdmins(alertMessage, severity, failedTests),
            this.sendSlackAlert(alertMessage, severity, failedTests)
        ]);

        const [inAppResult, slackResult] = notificationResults;

        aiLogger.info('AIHealthAlert', `Alert triggered: ${severity}`, {
            failedTests: failedTests.map(t => t.capability),
            inAppSent: inAppResult.status === 'fulfilled',
            slackSent: slackResult.status === 'fulfilled'
        });

        return {
            alertSent: true,
            severity,
            failedTests: failedTests.map(t => t.capability),
            notifications: {
                inApp: inAppResult.status === 'fulfilled' ? inAppResult.value : { error: inAppResult.reason?.message },
                slack: slackResult.status === 'fulfilled' ? slackResult.value : { error: slackResult.reason?.message }
            }
        };
    },

    /**
     * Notify all SuperAdmins via in-app notifications
     */
    async notifySuperAdmins(message, severity, failedTests) {
        // Get all SuperAdmins
        const superAdmins = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, organization_id FROM users WHERE role = 'SUPERADMIN'`,
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        if (superAdmins.length === 0) {
            aiLogger.warn('AIHealthAlert', 'No SuperAdmins found to notify');
            return { notified: 0 };
        }

        const notificationType = severity === ALERT_SEVERITY.UNAVAILABLE 
            ? 'AI_CHAT_UNAVAILABLE'
            : severity === ALERT_SEVERITY.CRITICAL 
                ? 'AI_HEALTH_CRITICAL' 
                : 'AI_HEALTH_DEGRADED';

        const title = severity === ALERT_SEVERITY.UNAVAILABLE
            ? '🚨 AI System Unavailable'
            : severity === ALERT_SEVERITY.CRITICAL
                ? '⚠️ AI Health Critical'
                : '⚠️ AI Health Degraded';

        const notifications = [];

        for (const admin of superAdmins) {
            try {
                await NotificationService.create({
                    userId: admin.id,
                    organizationId: admin.organization_id || 'system',
                    type: notificationType,
                    severity: severity === ALERT_SEVERITY.CRITICAL || severity === ALERT_SEVERITY.UNAVAILABLE 
                        ? 'CRITICAL' 
                        : 'WARNING',
                    title,
                    message: message.short,
                    isActionable: true,
                    actionUrl: '/superadmin/ai-platform?tab=health'
                });
                notifications.push(admin.id);
            } catch (err) {
                aiLogger.error('AIHealthAlert', `Failed to notify admin ${admin.id}`, err);
            }
        }

        return { 
            notified: notifications.length, 
            total: superAdmins.length,
            adminIds: notifications 
        };
    },

    /**
     * Send alert to Slack
     */
    async sendSlackAlert(message, severity, failedTests) {
        // Check if Slack webhook is configured
        if (!process.env.SLACK_WEBHOOK_URL) {
            return { sent: false, reason: 'No Slack webhook configured' };
        }

        const emoji = severity === ALERT_SEVERITY.UNAVAILABLE 
            ? ':rotating_light:'
            : severity === ALERT_SEVERITY.CRITICAL 
                ? ':warning:' 
                : ':yellow_heart:';

        const color = severity === ALERT_SEVERITY.UNAVAILABLE 
            ? '#dc2626'  // red
            : severity === ALERT_SEVERITY.CRITICAL 
                ? '#f97316' // orange
                : '#eab308'; // yellow

        try {
            await SlackService.sendAIHealthAlert({
                title: `${emoji} AI Health Alert: ${severity}`,
                message: message.detailed,
                severity,
                failedTests,
                color
            });

            return { sent: true, severity };
        } catch (err) {
            aiLogger.error('AIHealthAlert', 'Failed to send Slack alert', err);
            return { sent: false, error: err.message };
        }
    },

    /**
     * Build alert message
     */
    _buildAlertMessage(failedTests, passedTests, severity) {
        const failedNames = failedTests.map(t => t.capability).join(', ');
        const passedCount = passedTests.length;
        const totalCount = failedTests.length + passedCount;

        const short = severity === ALERT_SEVERITY.UNAVAILABLE
            ? `AI System is completely unavailable. All ${totalCount} tests failed.`
            : `AI Health ${severity}: ${failedTests.length} of ${totalCount} tests failed (${failedNames})`;

        const detailed = [
            `*AI Health Status: ${severity}*`,
            '',
            `*Failed Tests (${failedTests.length}):*`,
            ...failedTests.map(t => `  • ${t.capability}: ${t.error || 'Unknown error'}`),
            '',
            `*Passed Tests (${passedCount}):*`,
            ...passedTests.map(t => `  • ${t.capability}${t.skipped ? ' (skipped)' : ''}: ${t.latency}ms`),
            '',
            `_Timestamp: ${new Date().toISOString()}_`
        ].join('\n');

        return { short, detailed };
    },

    /**
     * Log alert to database for history
     */
    async _logAlert(severity, failedTests, triggeredBy) {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            
            db.run(
                `INSERT INTO ai_health_alerts 
                 (id, severity, failed_tests, triggered_by, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [id, severity, JSON.stringify(failedTests), triggeredBy],
                (err) => {
                    if (err) {
                        // Table might not exist, create it
                        if (err.message.includes('no such table')) {
                            this._createAlertsTable()
                                .then(() => this._logAlert(severity, failedTests, triggeredBy))
                                .then(resolve)
                                .catch(reject);
                        } else {
                            aiLogger.error('AIHealthAlert', 'Failed to log alert', err);
                            resolve(); // Don't fail the alert process
                        }
                    } else {
                        resolve({ id });
                    }
                }
            );
        });
    },

    /**
     * Create alerts table if it doesn't exist
     */
    async _createAlertsTable() {
        return new Promise((resolve, reject) => {
            db.run(`
                CREATE TABLE IF NOT EXISTS ai_health_alerts (
                    id TEXT PRIMARY KEY,
                    severity TEXT NOT NULL,
                    failed_tests TEXT,
                    triggered_by TEXT,
                    resolved_at DATETIME,
                    resolved_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) reject(err);
                else {
                    db.run(`CREATE INDEX IF NOT EXISTS idx_ai_health_alerts_severity ON ai_health_alerts(severity, created_at)`, resolve);
                }
            });
        });
    },

    /**
     * Get alert history
     * @param {number} limit - Max number of alerts to return
     */
    async getAlertHistory(limit = 50) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM ai_health_alerts 
                 ORDER BY created_at DESC 
                 LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) {
                        if (err.message.includes('no such table')) {
                            resolve([]);
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    },

    /**
     * Clear cooldown (for testing)
     */
    clearCooldown(severity) {
        const key = `health_alert_${severity}`;
        alertCooldowns.delete(key);
    },

    /**
     * Clear all cooldowns
     */
    clearAllCooldowns() {
        alertCooldowns.clear();
    }
};

export default AIHealthAlertService;














