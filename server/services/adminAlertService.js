/**
 * Admin Alert Service
 * Handles advanced alerting for billing anomalies, cost spikes, and budget issues
 */

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';


const deps = {
    db,
    uuidv4,
};

/**
 * Set dependencies (for testing)
 */
function setDependencies(newDeps = {}) {
    Object.assign(deps, newDeps);
}

/**
 * Create admin alert configuration
 */
function createAdminAlert(orgId, alertConfig) {
    return new Promise((resolve, reject) => {
        const id = `alert-${deps.uuidv4()}`;

        deps.db.run(
            `INSERT INTO admin_billing_alerts(
                id, organization_id, alert_type, severity, cost_threshold_usd,
                usage_threshold_percent, seat_threshold_percent, notify_admins,
                notify_billing_contact, notify_superadmin, email_enabled,
                slack_webhook_url, webhook_url, alert_frequency, cooldown_hours, is_active
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, orgId,
                alertConfig.alertType,
                alertConfig.severity || 'medium',
                alertConfig.costThresholdUsd || null,
                alertConfig.usageThresholdPercent || null,
                alertConfig.seatThresholdPercent || null,
                alertConfig.notifyAdmins !== false ? 1 : 0,
                alertConfig.notifyBillingContact !== false ? 1 : 0,
                alertConfig.notifySuperadmin ? 1 : 0,
                alertConfig.emailEnabled !== false ? 1 : 0,
                alertConfig.slackWebhookUrl || null,
                alertConfig.webhookUrl || null,
                alertConfig.alertFrequency || 'once',
                alertConfig.cooldownHours || 24,
                alertConfig.isActive !== false ? 1 : 0
            ],
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id, ...alertConfig });
                }
            }
        );
    });
}

/**
 * Check and trigger alerts
 */
function checkAndTriggerAlerts(orgId) {
    return new Promise((resolve, reject) => {
        // Get all active alerts for organization
        deps.db.all(
            `SELECT * FROM admin_billing_alerts WHERE organization_id = ? AND is_active = 1`,
            [orgId],
            (err, alerts) => {
                if (err) {
                    reject(err);
                    return;
                }

                const triggeredAlerts = [];

                Promise.all(
                    alerts.map(alert => {
                        return checkAlert(alert)
                            .then(shouldTrigger => {
                                if (shouldTrigger) {
                                    return triggerAlert(alert.id)
                                        .then(() => {
                                            triggeredAlerts.push(alert);
                                            return alert;
                                        });
                                }
                                return null;
                            });
                    })
                )
                    .then(() => {
                        resolve({ triggeredCount: triggeredAlerts.length, alerts: triggeredAlerts });
                    })
                    .catch(reject);
            }
        );
    });
}

/**
 * Check if an alert should be triggered
 */
function checkAlert(alert) {
    return new Promise((resolve, reject) => {
        const now = new Date();
        const lastTriggered = alert.last_triggered_at ? new Date(alert.last_triggered_at) : null;
        const cooldownMs = (alert.cooldown_hours || 24) * 60 * 60 * 1000;

        // Check cooldown
        if (lastTriggered && (now - lastTriggered) < cooldownMs) {
            resolve(false);
            return;
        }

        // Check alert type and conditions
        switch (alert.alert_type) {
            case 'cost_spike':
                checkCostSpike(alert)
                    .then(resolve)
                    .catch(reject);
                break;
            case 'usage_anomaly':
                checkUsageAnomaly(alert)
                    .then(resolve)
                    .catch(reject);
                break;
            case 'budget_exceeded':
                checkBudgetExceeded(alert)
                    .then(resolve)
                    .catch(reject);
                break;
            case 'seat_limit_reached':
                checkSeatLimit(alert)
                    .then(resolve)
                    .catch(reject);
                break;
            default:
                resolve(false);
        }
    });
}

/**
 * Check for cost spike
 */
function checkCostSpike(alert) {
    return new Promise((resolve, reject) => {
        if (!alert.cost_threshold_usd) {
            resolve(false);
            return;
        }

        // Get current period cost
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

        deps.db.get(
            `SELECT SUM(total_cost) as total_cost
             FROM pay_as_you_go_usage
             WHERE organization_id = ?
               AND billing_period_start >= ?
               AND invoiced = 0`,
            [alert.organization_id, periodStart.toISOString()],
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                const currentCost = row?.total_cost || 0;
                resolve(currentCost >= alert.cost_threshold_usd);
            }
        );
    });
}

/**
 * Check for usage anomaly
 */
function checkUsageAnomaly(alert) {
    return new Promise((resolve, reject) => {
        if (!alert.usage_threshold_percent) {
            resolve(false);
            return;
        }

        // Get current usage vs previous period
        const now = new Date();
        const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        Promise.all([
            new Promise((res, rej) => {
                deps.db.get(
                    `SELECT SUM(total_cost) as total_cost
                     FROM pay_as_you_go_usage
                     WHERE organization_id = ?
                       AND billing_period_start >= ?`,
                    [alert.organization_id, currentPeriodStart.toISOString()],
                    (err, row) => {
                        if (err) rej(err);
                        else res(row?.total_cost || 0);
                    }
                );
            }),
            new Promise((res, rej) => {
                deps.db.get(
                    `SELECT SUM(total_cost) as total_cost
                     FROM pay_as_you_go_usage
                     WHERE organization_id = ?
                       AND billing_period_start >= ?
                       AND billing_period_end <= ?`,
                    [alert.organization_id, previousPeriodStart.toISOString(), previousPeriodEnd.toISOString()],
                    (err, row) => {
                        if (err) rej(err);
                        else res(row?.total_cost || 0);
                    }
                );
            })
        ])
            .then(([currentCost, previousCost]) => {
                if (previousCost === 0) {
                    resolve(false);
                    return;
                }

                const increasePercent = ((currentCost - previousCost) / previousCost) * 100;
                resolve(increasePercent >= alert.usage_threshold_percent);
            })
            .catch(reject);
    });
}

/**
 * Check if budget exceeded
 */
function checkBudgetExceeded(alert) {
    return new Promise((resolve, reject) => {
        // Check org budget
        deps.db.get(
            `SELECT cost_cap_monthly FROM billing_alerts WHERE organization_id = ?`,
            [alert.organization_id],
            (err, budget) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!budget || !budget.cost_cap_monthly) {
                    resolve(false);
                    return;
                }

                const now = new Date();
                const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

                deps.db.get(
                    `SELECT SUM(total_cost) as total_cost
                     FROM pay_as_you_go_usage
                     WHERE organization_id = ?
                       AND billing_period_start >= ?
                       AND invoiced = 0`,
                    [alert.organization_id, periodStart.toISOString()],
                    (err, row) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        const currentCost = row?.total_cost || 0;
                        resolve(currentCost >= budget.cost_cap_monthly);
                    }
                );
            }
        );
    });
}

/**
 * Check if seat limit reached
 */
function checkSeatLimit(alert) {
    return new Promise((resolve, reject) => {
        if (!alert.seat_threshold_percent) {
            resolve(false);
            return;
        }

        deps.db.get(
            `SELECT seats_used, total_seats_available FROM organization_seats WHERE organization_id = ?`,
            [alert.organization_id],
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row || !row.total_seats_available || row.total_seats_available === 0) {
                    resolve(false);
                    return;
                }

                const utilizationPercent = (row.seats_used / row.total_seats_available) * 100;
                resolve(utilizationPercent >= alert.seat_threshold_percent);
            }
        );
    });
}

/**
 * Trigger an alert
 */
function triggerAlert(alertId) {
    return new Promise((resolve, reject) => {
        // Get alert details
        deps.db.get(
            `SELECT * FROM admin_billing_alerts WHERE id = ?`,
            [alertId],
            (err, alert) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Update trigger count and last triggered
                deps.db.run(
                    `UPDATE admin_billing_alerts SET
                        trigger_count = trigger_count + 1,
                        last_triggered_at = datetime('now'),
                        updated_at = datetime('now')
                    WHERE id = ?`,
                    [alertId],
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        // Send alert via configured channels
                        sendAlert(alert)
                            .then(() => resolve({ triggered: true, alertId }))
                            .catch(reject);
                    }
                );
            }
        );
    });
}

/**
 * Send alert via configured channels
 */
function sendAlert(alert) {
    return new Promise((resolve, reject) => {
        // In a full implementation, this would:
        // 1. Send email if email_enabled
        // 2. Send Slack webhook if slack_webhook_url set
        // 3. Send custom webhook if webhook_url set
        // 4. Create notifications for admins if notify_admins

        // For now, just log
        console.log(`[Admin Alert] ${alert.alert_type} triggered for org ${alert.organization_id}`);
        resolve({ sent: true });
    });
}

/**
 * Get alert history
 */
function getAlertHistory(orgId, limit = 50) {
    return new Promise((resolve, reject) => {
        deps.db.all(
            `SELECT * FROM admin_billing_alerts
             WHERE organization_id = ?
             ORDER BY last_triggered_at DESC, created_at DESC
             LIMIT ?`,
            [orgId, limit],
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            }
        );
    });
}

/**
 * Update alert cooldown
 */
function updateAlertCooldown(alertId, cooldownHours) {
    return new Promise((resolve, reject) => {
        deps.db.run(
            `UPDATE admin_billing_alerts SET
                cooldown_hours = ?,
                updated_at = datetime('now')
            WHERE id = ?`,
            [cooldownHours, alertId],
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ success: true });
                }
            }
        );
    });
}

export {
setDependencies,
    createAdminAlert,
    checkAndTriggerAlerts,
    sendAlert,
    getAlertHistory,
    updateAlertCooldown
};

export default {
    setDependencies,
    createAdminAlert,
    checkAndTriggerAlerts,
    sendAlert,
    getAlertHistory,
    updateAlertCooldown
};














