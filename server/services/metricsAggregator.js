/**
 * Metrics Aggregator Service
 * 
 * STEP 7: Metrics & Conversion Intelligence (Enterprise+)
 * 
 * Analytics and aggregation engine for business intelligence.
 * Computes funnels, cohort analysis, conversion metrics, and early warnings.
 * 
 * Key capabilities:
 * - Funnel analysis (Demo→Trial→Paid, Help effectiveness, Attribution)
 * - Cohort analysis (Trial cohorts, conversion windows)
 * - Materialized snapshots for dashboard performance
 * - Early warning system for at-risk accounts
 * 
 * @module metricsAggregator
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const MetricsCollector = require('./metricsCollector');

/**
 * Metric key constants for snapshots
 */
const METRIC_KEYS = {
    // Funnel metrics
    FUNNEL_DEMO_TO_TRIAL: 'funnel_demo_to_trial',
    FUNNEL_TRIAL_TO_PAID: 'funnel_trial_to_paid',
    FUNNEL_HELP_COMPLETION: 'funnel_help_completion',
    FUNNEL_ATTRIBUTION_CONVERSION: 'funnel_attribution_conversion',

    // Timing metrics
    AVG_DAYS_TO_UPGRADE: 'avg_days_to_upgrade',

    // Rate metrics
    TRIAL_EXPIRY_RATE: 'trial_expiry_rate',
    INVITE_ACCEPTANCE_RATE: 'invite_acceptance_rate',

    // Partner metrics
    PARTNER_REVENUE: 'partner_revenue',
    PARTNER_CONVERSION: 'partner_conversion',

    // Help metrics
    HELP_EFFECTIVENESS: 'help_effectiveness',
    PLAYBOOK_COMPLETION: 'playbook_completion'
};

/**
 * Warning severity levels
 */
const WARNING_SEVERITY = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
};

const MetricsAggregator = {
    METRIC_KEYS,
    WARNING_SEVERITY,

    /**
     * Build daily snapshots for all metrics (designed for cron job)
     * IDEMPOTENT: Can be run multiple times for the same date
     * 
     * @param {string} [date] - Date to build snapshots for (default: today)
     * @returns {Promise<{success: boolean, snapshotsCreated: number}>}
     */
    buildDailySnapshots: async (date = null) => {
        const snapshotDate = date || new Date().toISOString().split('T')[0];
        let snapshotsCreated = 0;

        console.log(`[MetricsAggregator] Building daily snapshots for ${snapshotDate}`);

        try {
            // Calculate all metrics
            const metrics = await Promise.all([
                MetricsAggregator.getFunnelMetric(
                    MetricsCollector.EVENT_TYPES.DEMO_STARTED,
                    MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                    { days: 30 }
                ),
                MetricsAggregator.getFunnelMetric(
                    MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                    MetricsCollector.EVENT_TYPES.UPGRADED_TO_PAID,
                    { days: 30 }
                ),
                MetricsAggregator.getFunnelMetric(
                    MetricsCollector.EVENT_TYPES.HELP_STARTED,
                    MetricsCollector.EVENT_TYPES.HELP_COMPLETED,
                    { days: 30 }
                ),
                MetricsAggregator.getFunnelMetric(
                    MetricsCollector.EVENT_TYPES.INVITE_SENT,
                    MetricsCollector.EVENT_TYPES.INVITE_ACCEPTED,
                    { days: 30 }
                ),
                MetricsAggregator.getAverageDaysToUpgrade({ days: 90 }),
                MetricsAggregator.getTrialExpiryRate({ days: 30 })
            ]);

            const snapshotData = [
                { key: METRIC_KEYS.FUNNEL_DEMO_TO_TRIAL, value: metrics[0].conversionRate },
                { key: METRIC_KEYS.FUNNEL_TRIAL_TO_PAID, value: metrics[1].conversionRate },
                { key: METRIC_KEYS.FUNNEL_HELP_COMPLETION, value: metrics[2].conversionRate },
                { key: METRIC_KEYS.INVITE_ACCEPTANCE_RATE, value: metrics[3].conversionRate },
                { key: METRIC_KEYS.AVG_DAYS_TO_UPGRADE, value: metrics[4] },
                { key: METRIC_KEYS.TRIAL_EXPIRY_RATE, value: metrics[5] }
            ];

            // Upsert snapshots (INSERT OR REPLACE)
            for (const snapshot of snapshotData) {
                await MetricsAggregator._upsertSnapshot(snapshotDate, snapshot.key, snapshot.value, {});
                snapshotsCreated++;
            }

            console.log(`[MetricsAggregator] Created ${snapshotsCreated} snapshots for ${snapshotDate}`);
            return { success: true, snapshotsCreated };

        } catch (err) {
            console.error('[MetricsAggregator] Failed to build snapshots:', err.message);
            throw err;
        }
    },

    /**
     * Upsert a snapshot (idempotent)
     * @private
     */
    _upsertSnapshot: async (snapshotDate, metricKey, metricValue, dimensions = {}) => {
        const dimensionsJson = JSON.stringify(dimensions);

        return new Promise((resolve, reject) => {
            // First try to find existing
            db.get(
                `SELECT id FROM metrics_snapshots WHERE snapshot_date = ? AND metric_key = ? AND dimensions = ?`,
                [snapshotDate, metricKey, dimensionsJson],
                (err, existing) => {
                    if (err) return reject(err);

                    if (existing) {
                        // Update existing
                        db.run(
                            `UPDATE metrics_snapshots SET metric_value = ?, created_at = datetime('now') WHERE id = ?`,
                            [metricValue, existing.id],
                            (err) => err ? reject(err) : resolve({ updated: true })
                        );
                    } else {
                        // Insert new
                        db.run(
                            `INSERT INTO metrics_snapshots (id, snapshot_date, metric_key, metric_value, dimensions) VALUES (?, ?, ?, ?, ?)`,
                            [uuidv4(), snapshotDate, metricKey, metricValue, dimensionsJson],
                            (err) => err ? reject(err) : resolve({ created: true })
                        );
                    }
                }
            );
        });
    },

    /**
     * Get funnel conversion between two event types
     * 
     * @param {string} startEvent - Start event type
     * @param {string} endEvent - End event type
     * @param {Object} filters - Query filters
     * @returns {Promise<{startCount: number, endCount: number, conversionRate: number}>}
     */
    getFunnel: async (startEvent, endEvent, filters = {}) => {
        return MetricsAggregator.getFunnelMetric(startEvent, endEvent, filters);
    },

    /**
     * Calculate funnel metric between two events
     * 
     * @param {string} startEvent - Start event type
     * @param {string} endEvent - End event type  
     * @param {Object} options - Query options
     * @param {number} [options.days] - Days to look back
     * @returns {Promise<Object>}
     */
    getFunnelMetric: async (startEvent, endEvent, options = {}) => {
        const { days = 30, source } = options;

        const [startCount, endCount] = await Promise.all([
            MetricsCollector.getUniqueOrgCount(startEvent, {
                startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                source
            }),
            MetricsCollector.getUniqueOrgCount(endEvent, {
                startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                source
            })
        ]);

        const conversionRate = startCount > 0 ? (endCount / startCount) * 100 : 0;

        return {
            startEvent,
            endEvent,
            startCount,
            endCount,
            conversionRate: Math.round(conversionRate * 100) / 100,
            period: `${days} days`
        };
    },

    /**
     * Get cohort analysis for trial conversions
     * 
     * @param {string} cohortType - 'weekly' | 'monthly'
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    getCohortAnalysis: async (cohortType = 'weekly', options = {}) => {
        const { weeks = 12 } = options;
        const groupFormat = cohortType === 'weekly'
            ? "strftime('%Y-W%W', created_at)"
            : "strftime('%Y-%m', created_at)";

        const sql = `
            SELECT 
                ${groupFormat} as cohort,
                COUNT(DISTINCT CASE WHEN event_type = ? THEN organization_id END) as trials_started,
                COUNT(DISTINCT CASE WHEN event_type = ? THEN organization_id END) as upgraded,
                COUNT(DISTINCT CASE WHEN event_type = ? THEN organization_id END) as expired
            FROM metrics_events
            WHERE created_at >= datetime('now', ?)
              AND event_type IN (?, ?, ?)
            GROUP BY cohort
            ORDER BY cohort DESC
        `;

        return new Promise((resolve, reject) => {
            db.all(sql, [
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                MetricsCollector.EVENT_TYPES.UPGRADED_TO_PAID,
                MetricsCollector.EVENT_TYPES.TRIAL_EXPIRED,
                `-${weeks} weeks`,
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                MetricsCollector.EVENT_TYPES.UPGRADED_TO_PAID,
                MetricsCollector.EVENT_TYPES.TRIAL_EXPIRED
            ], (err, rows) => {
                if (err) reject(err);
                else {
                    resolve(rows.map(row => ({
                        ...row,
                        conversionRate: row.trials_started > 0
                            ? Math.round((row.upgraded / row.trials_started) * 100 * 100) / 100
                            : 0,
                        expiryRate: row.trials_started > 0
                            ? Math.round((row.expired / row.trials_started) * 100 * 100) / 100
                            : 0
                    })));
                }
            });
        });
    },

    /**
     * Get conversion metrics overview
     * 
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    getConversionMetrics: async (options = {}) => {
        const { days = 30 } = options;

        const [
            demoToTrial,
            trialToPaid,
            helpCompletion,
            inviteAcceptance
        ] = await Promise.all([
            MetricsAggregator.getFunnelMetric(
                MetricsCollector.EVENT_TYPES.DEMO_STARTED,
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                { days }
            ),
            MetricsAggregator.getFunnelMetric(
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                MetricsCollector.EVENT_TYPES.UPGRADED_TO_PAID,
                { days }
            ),
            MetricsAggregator.getFunnelMetric(
                MetricsCollector.EVENT_TYPES.HELP_STARTED,
                MetricsCollector.EVENT_TYPES.HELP_COMPLETED,
                { days }
            ),
            MetricsAggregator.getFunnelMetric(
                MetricsCollector.EVENT_TYPES.INVITE_SENT,
                MetricsCollector.EVENT_TYPES.INVITE_ACCEPTED,
                { days }
            )
        ]);

        return {
            period: `${days} days`,
            funnels: {
                demoToTrial,
                trialToPaid,
                helpCompletion,
                inviteAcceptance
            },
            summary: {
                totalTrialsStarted: trialToPaid.startCount,
                totalConversions: trialToPaid.endCount,
                overallConversionRate: trialToPaid.conversionRate
            }
        };
    },

    /**
     * Get average days from trial start to upgrade
     * 
     * @param {Object} options - Query options
     * @returns {Promise<number>}
     */
    getAverageDaysToUpgrade: async (options = {}) => {
        const { days = 90 } = options;

        const sql = `
            SELECT AVG(julianday(u.created_at) - julianday(t.created_at)) as avg_days
            FROM metrics_events t
            JOIN metrics_events u ON t.organization_id = u.organization_id
            WHERE t.event_type = ?
              AND u.event_type = ?
              AND t.created_at >= datetime('now', ?)
              AND u.created_at > t.created_at
        `;

        return new Promise((resolve, reject) => {
            db.get(sql, [
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                MetricsCollector.EVENT_TYPES.UPGRADED_TO_PAID,
                `-${days} days`
            ], (err, row) => {
                if (err) reject(err);
                else resolve(Math.round((row?.avg_days || 0) * 10) / 10);
            });
        });
    },

    /**
     * Get trial expiry rate (trials that expired without upgrading)
     * 
     * @param {Object} options - Query options
     * @returns {Promise<number>}
     */
    getTrialExpiryRate: async (options = {}) => {
        const { days = 30 } = options;

        const [expired, total] = await Promise.all([
            MetricsCollector.getUniqueOrgCount(MetricsCollector.EVENT_TYPES.TRIAL_EXPIRED, {
                startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
            }),
            MetricsCollector.getUniqueOrgCount(MetricsCollector.EVENT_TYPES.TRIAL_STARTED, {
                startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
            })
        ]);

        return total > 0 ? Math.round((expired / total) * 100 * 100) / 100 : 0;
    },

    /**
     * Get early warnings for at-risk accounts
     * 
     * @returns {Promise<Array>}
     */
    getEarlyWarnings: async () => {
        const warnings = [];

        // 1. Trial at risk: Days ≤ 3 and no help completed
        const trialsAtRisk = await MetricsAggregator._getTrialsAtRisk();
        warnings.push(...trialsAtRisk);

        // 2. Trial expired without upgrade attempt
        const expiredNoAction = await MetricsAggregator._getExpiredNoAction();
        warnings.push(...expiredNoAction);

        // 3. Help started 3+ times but no action taken
        const helpStuck = await MetricsAggregator._getHelpStuck();
        warnings.push(...helpStuck);

        // 4. Partner low conversion (< 10%)
        const partnerLowConversion = await MetricsAggregator._getPartnerLowConversion();
        warnings.push(...partnerLowConversion);

        return warnings;
    },

    /**
     * Get trials at risk (expiring soon with no engagement)
     * @private
     */
    _getTrialsAtRisk: async () => {
        const sql = `
            SELECT DISTINCT 
                o.id as organization_id,
                o.name as organization_name,
                o.valid_until,
                julianday(o.valid_until) - julianday('now') as days_remaining
            FROM organizations o
            WHERE o.status = 'active'
              AND (o.plan = 'free' OR o.plan = 'trial')
              AND o.valid_until IS NOT NULL
              AND julianday(o.valid_until) - julianday('now') BETWEEN 0 AND 3
              AND o.id NOT IN (
                  SELECT DISTINCT organization_id 
                  FROM metrics_events 
                  WHERE event_type = 'help_completed'
              )
        `;

        return new Promise((resolve, reject) => {
            db.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else {
                    resolve(rows.map(row => ({
                        type: 'trial_at_risk',
                        severity: WARNING_SEVERITY.HIGH,
                        organizationId: row.organization_id,
                        organizationName: row.organization_name,
                        daysRemaining: Math.round(row.days_remaining),
                        message: `Trial expires in ${Math.round(row.days_remaining)} days with no help engagement`
                    })));
                }
            });
        });
    },

    /**
     * Get expired trials with no upgrade attempt
     * @private
     */
    _getExpiredNoAction: async () => {
        const sql = `
            SELECT DISTINCT 
                me.organization_id,
                o.name as organization_name,
                me.created_at as expired_at
            FROM metrics_events me
            JOIN organizations o ON me.organization_id = o.id
            WHERE me.event_type = ?
              AND me.created_at >= datetime('now', '-7 days')
              AND me.organization_id NOT IN (
                  SELECT organization_id 
                  FROM metrics_events 
                  WHERE event_type = ?
              )
        `;

        return new Promise((resolve, reject) => {
            db.all(sql, [
                MetricsCollector.EVENT_TYPES.TRIAL_EXPIRED,
                MetricsCollector.EVENT_TYPES.UPGRADED_TO_PAID
            ], (err, rows) => {
                if (err) reject(err);
                else {
                    resolve(rows.map(row => ({
                        type: 'trial_expired_no_action',
                        severity: WARNING_SEVERITY.CRITICAL,
                        organizationId: row.organization_id,
                        organizationName: row.organization_name,
                        expiredAt: row.expired_at,
                        message: 'Trial expired without upgrade attempt'
                    })));
                }
            });
        });
    },

    /**
     * Get orgs with 3+ help starts but no completed action
     * @private
     */
    _getHelpStuck: async () => {
        const sql = `
            SELECT 
                started.organization_id,
                o.name as organization_name,
                started.start_count
            FROM (
                SELECT organization_id, COUNT(*) as start_count
                FROM metrics_events
                WHERE event_type = ?
                  AND created_at >= datetime('now', '-30 days')
                GROUP BY organization_id
                HAVING COUNT(*) >= 3
            ) started
            JOIN organizations o ON started.organization_id = o.id
            WHERE started.organization_id NOT IN (
                SELECT organization_id 
                FROM metrics_events 
                WHERE event_type = ?
                  AND created_at >= datetime('now', '-30 days')
            )
        `;

        return new Promise((resolve, reject) => {
            db.all(sql, [
                MetricsCollector.EVENT_TYPES.HELP_STARTED,
                MetricsCollector.EVENT_TYPES.HELP_COMPLETED
            ], (err, rows) => {
                if (err) reject(err);
                else {
                    resolve(rows.map(row => ({
                        type: 'help_stuck',
                        severity: WARNING_SEVERITY.MEDIUM,
                        organizationId: row.organization_id,
                        organizationName: row.organization_name,
                        startCount: row.start_count,
                        message: `Started help ${row.start_count} times but never completed`
                    })));
                }
            });
        });
    },

    /**
     * Get partners with low conversion rate
     * @private
     */
    _getPartnerLowConversion: async () => {
        const sql = `
            SELECT 
                JSON_EXTRACT(context, '$.partnerCode') as partner_code,
                COUNT(DISTINCT CASE WHEN event_type = ? THEN organization_id END) as trials,
                COUNT(DISTINCT CASE WHEN event_type = ? THEN organization_id END) as conversions
            FROM metrics_events
            WHERE source = 'PARTNER'
              AND created_at >= datetime('now', '-90 days')
            GROUP BY partner_code
            HAVING trials >= 5
               AND (CAST(conversions AS FLOAT) / trials) < 0.1
        `;

        return new Promise((resolve, reject) => {
            db.all(sql, [
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                MetricsCollector.EVENT_TYPES.UPGRADED_TO_PAID
            ], (err, rows) => {
                if (err) reject(err);
                else {
                    resolve(rows.map(row => ({
                        type: 'partner_low_conversion',
                        severity: WARNING_SEVERITY.HIGH,
                        partnerCode: row.partner_code,
                        trials: row.trials,
                        conversions: row.conversions,
                        conversionRate: Math.round((row.conversions / row.trials) * 100 * 100) / 100,
                        message: `Partner ${row.partner_code} has < 10% conversion rate`
                    })));
                }
            });
        });
    },

    /**
     * Get partner performance metrics
     * 
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    getPartnerPerformance: async (options = {}) => {
        const { days = 90, limit = 20 } = options;

        const sql = `
            SELECT 
                JSON_EXTRACT(context, '$.partnerCode') as partner_code,
                COUNT(DISTINCT CASE WHEN event_type = ? THEN organization_id END) as total_referrals,
                COUNT(DISTINCT CASE WHEN event_type = ? THEN organization_id END) as conversions,
                COUNT(CASE WHEN event_type = ? THEN 1 END) as settlements_count
            FROM metrics_events
            WHERE source = 'PARTNER'
              AND created_at >= datetime('now', ?)
            GROUP BY partner_code
            ORDER BY conversions DESC
            LIMIT ?
        `;

        return new Promise((resolve, reject) => {
            db.all(sql, [
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                MetricsCollector.EVENT_TYPES.UPGRADED_TO_PAID,
                MetricsCollector.EVENT_TYPES.SETTLEMENT_GENERATED,
                `-${days} days`,
                limit
            ], (err, rows) => {
                if (err) reject(err);
                else {
                    resolve(rows.map(row => ({
                        partnerCode: row.partner_code,
                        totalReferrals: row.total_referrals,
                        conversions: row.conversions,
                        settlementsCount: row.settlements_count,
                        conversionRate: row.total_referrals > 0
                            ? Math.round((row.conversions / row.total_referrals) * 100 * 100) / 100
                            : 0
                    })));
                }
            });
        });
    },

    /**
     * Get help/playbook effectiveness metrics
     * 
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    getHelpEffectiveness: async (options = {}) => {
        const { days = 30 } = options;

        // Get completion rate by playbook
        const sql = `
            SELECT 
                JSON_EXTRACT(context, '$.playbookKey') as playbook_key,
                COUNT(CASE WHEN event_type = ? THEN 1 END) as started,
                COUNT(CASE WHEN event_type = ? THEN 1 END) as completed
            FROM metrics_events
            WHERE event_type IN (?, ?)
              AND created_at >= datetime('now', ?)
            GROUP BY playbook_key
            ORDER BY started DESC
        `;

        const playbookStats = await new Promise((resolve, reject) => {
            db.all(sql, [
                MetricsCollector.EVENT_TYPES.HELP_STARTED,
                MetricsCollector.EVENT_TYPES.HELP_COMPLETED,
                MetricsCollector.EVENT_TYPES.HELP_STARTED,
                MetricsCollector.EVENT_TYPES.HELP_COMPLETED,
                `-${days} days`
            ], (err, rows) => {
                if (err) reject(err);
                else {
                    resolve(rows.map(row => ({
                        playbookKey: row.playbook_key,
                        started: row.started,
                        completed: row.completed,
                        completionRate: row.started > 0
                            ? Math.round((row.completed / row.started) * 100 * 100) / 100
                            : 0
                    })));
                }
            });
        });

        // Calculate overall
        const totalStarted = playbookStats.reduce((sum, p) => sum + p.started, 0);
        const totalCompleted = playbookStats.reduce((sum, p) => sum + p.completed, 0);

        return {
            period: `${days} days`,
            overall: {
                totalStarted,
                totalCompleted,
                completionRate: totalStarted > 0
                    ? Math.round((totalCompleted / totalStarted) * 100 * 100) / 100
                    : 0
            },
            byPlaybook: playbookStats
        };
    },

    /**
     * Get snapshots for a date range
     * 
     * @param {string} metricKey - Metric key
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    getSnapshots: async (metricKey, options = {}) => {
        const { startDate, endDate, limit = 30 } = options;

        let sql = `SELECT * FROM metrics_snapshots WHERE metric_key = ?`;
        const params = [metricKey];

        if (startDate) {
            sql += ` AND snapshot_date >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            sql += ` AND snapshot_date <= ?`;
            params.push(endDate);
        }

        sql += ` ORDER BY snapshot_date DESC LIMIT ?`;
        params.push(limit);

        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else {
                    resolve(rows.map(row => ({
                        ...row,
                        dimensions: row.dimensions ? JSON.parse(row.dimensions) : {}
                    })));
                }
            });
        });
    },

    /**
     * Get overview metrics for SuperAdmin dashboard
     * 
     * @returns {Promise<Object>}
     */
    getOverview: async () => {
        const [
            conversionMetrics,
            cohortAnalysis,
            earlyWarnings,
            avgDaysToUpgrade,
            trialExpiryRate
        ] = await Promise.all([
            MetricsAggregator.getConversionMetrics({ days: 30 }),
            MetricsAggregator.getCohortAnalysis('weekly', { weeks: 8 }),
            MetricsAggregator.getEarlyWarnings(),
            MetricsAggregator.getAverageDaysToUpgrade({ days: 90 }),
            MetricsAggregator.getTrialExpiryRate({ days: 30 })
        ]);

        return {
            snapshot: {
                generatedAt: new Date().toISOString(),
                period: '30 days'
            },
            conversion: conversionMetrics,
            cohorts: cohortAnalysis.slice(0, 8),
            warnings: earlyWarnings,
            kpis: {
                avgDaysToUpgrade,
                trialExpiryRate,
                activeWarningsCount: earlyWarnings.length
            }
        };
    },

    /**
     * Get organization-specific metrics (for Admin dashboard)
     * 
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object>}
     */
    getOrganizationMetrics: async (organizationId) => {
        const events = await MetricsCollector.getOrganizationEvents(organizationId, { limit: 50 });

        // Count events by type
        const eventCounts = events.reduce((acc, event) => {
            acc[event.event_type] = (acc[event.event_type] || 0) + 1;
            return acc;
        }, {});

        // Get org trial status
        const orgInfo = await new Promise((resolve, reject) => {
            db.get(
                `SELECT plan, status, valid_until, created_at FROM organizations WHERE id = ?`,
                [organizationId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        // Calculate days remaining if trial
        let daysRemaining = null;
        if (orgInfo?.valid_until) {
            const remaining = (new Date(orgInfo.valid_until) - new Date()) / (1000 * 60 * 60 * 24);
            daysRemaining = Math.max(0, Math.round(remaining));
        }

        // Get invite stats
        const inviteStats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COUNT(CASE WHEN event_type = ? THEN 1 END) as sent,
                    COUNT(CASE WHEN event_type = ? THEN 1 END) as accepted
                FROM metrics_events
                WHERE organization_id = ?
            `, [
                MetricsCollector.EVENT_TYPES.INVITE_SENT,
                MetricsCollector.EVENT_TYPES.INVITE_ACCEPTED,
                organizationId
            ], (err, row) => err ? reject(err) : resolve(row || { sent: 0, accepted: 0 }));
        });

        // Get help stats
        const helpStats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COUNT(CASE WHEN event_type = ? THEN 1 END) as started,
                    COUNT(CASE WHEN event_type = ? THEN 1 END) as completed
                FROM metrics_events
                WHERE organization_id = ?
            `, [
                MetricsCollector.EVENT_TYPES.HELP_STARTED,
                MetricsCollector.EVENT_TYPES.HELP_COMPLETED,
                organizationId
            ], (err, row) => err ? reject(err) : resolve(row || { started: 0, completed: 0 }));
        });

        return {
            organization: {
                id: organizationId,
                plan: orgInfo?.plan,
                status: orgInfo?.status,
                createdAt: orgInfo?.created_at
            },
            trial: {
                validUntil: orgInfo?.valid_until,
                daysRemaining,
                isActive: orgInfo?.plan === 'free' && daysRemaining > 0
            },
            activity: {
                totalEvents: events.length,
                eventCounts,
                recentEvents: events.slice(0, 10)
            },
            teamAdoption: {
                invitesSent: inviteStats.sent,
                invitesAccepted: inviteStats.accepted,
                acceptanceRate: inviteStats.sent > 0
                    ? Math.round((inviteStats.accepted / inviteStats.sent) * 100)
                    : 0
            },
            helpUsage: {
                playbooksStarted: helpStats.started,
                playbooksCompleted: helpStats.completed,
                completionRate: helpStats.started > 0
                    ? Math.round((helpStats.completed / helpStats.started) * 100)
                    : 0
            }
        };
    },

    /**
     * Get warnings for a specific organization
     * 
     * @param {string} organizationId 
     * @returns {Promise<Array>}
     */
    checkOrganizationWarnings: async (organizationId) => {
        const allWarnings = await MetricsAggregator.getEarlyWarnings();
        return allWarnings.filter(w => w.organizationId === organizationId);
    }
};

module.exports = MetricsAggregator;
