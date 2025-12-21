/**
 * AI Analytics Service
 * Step 18: Outcomes, ROI & Continuous Learning Loop
 * 
 * Aggregates analytics for AI actions, playbooks, and policies:
 * - Action success/failure rates
 * - Approval type breakdown (manual vs auto)
 * - Playbook completion rates
 * - Dead-letter job statistics
 * - Time-to-resolution metrics
 */

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database'),
    ROIService: require('./roiService')
};

const AIAnalyticsService = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },
    /**
     * Get action execution statistics.
     * @param {string} orgId - Organization ID
     * @param {Object} dateRange - { from, to }
     * @returns {Promise<Object>} Action stats
     */
    getActionStats: async (orgId, dateRange = {}) => {
        const { from, to } = dateRange;

        return new Promise((resolve, reject) => {
            let whereClause = `WHERE organization_id = ?`;
            const params = [orgId];

            if (from) {
                whereClause += ` AND created_at >= ?`;
                params.push(from);
            }
            if (to) {
                whereClause += ` AND created_at <= ?`;
                params.push(to);
            }

            const sql = `
                SELECT 
                    action_type,
                    status,
                    COUNT(*) as count
                FROM action_executions
                ${whereClause}
                GROUP BY action_type, status
            `;

            deps.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);

                // Aggregate by action type
                const byActionType = {};
                let totalSuccess = 0;
                let totalFailed = 0;

                (rows || []).forEach(row => {
                    if (!byActionType[row.action_type]) {
                        byActionType[row.action_type] = { success: 0, failed: 0, total: 0 };
                    }
                    if (row.status === 'SUCCESS') {
                        byActionType[row.action_type].success += row.count;
                        totalSuccess += row.count;
                    } else {
                        byActionType[row.action_type].failed += row.count;
                        totalFailed += row.count;
                    }
                    byActionType[row.action_type].total += row.count;
                });

                const total = totalSuccess + totalFailed;
                resolve({
                    total_executions: total,
                    success_count: totalSuccess,
                    failed_count: totalFailed,
                    success_rate: total > 0 ? Math.round((totalSuccess / total) * 10000) / 100 : 0,
                    by_action_type: byActionType
                });
            });
        });
    },

    /**
     * Get approval statistics (manual vs auto-approved).
     * @param {string} orgId - Organization ID
     * @param {Object} dateRange - { from, to }
     * @returns {Promise<Object>} Approval stats
     */
    getApprovalStats: async (orgId, dateRange = {}) => {
        const { from, to } = dateRange;

        return new Promise((resolve, reject) => {
            let whereClause = `WHERE organization_id = ?`;
            const params = [orgId];

            if (from) {
                whereClause += ` AND created_at >= ?`;
                params.push(from);
            }
            if (to) {
                whereClause += ` AND created_at <= ?`;
                params.push(to);
            }

            const sql = `
                SELECT 
                    decision,
                    CASE 
                        WHEN policy_rule_id IS NOT NULL THEN 'auto'
                        ELSE 'manual'
                    END as approval_type,
                    COUNT(*) as count
                FROM action_decisions
                ${whereClause}
                GROUP BY decision, approval_type
            `;

            deps.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);

                let approved = 0, rejected = 0, modified = 0;
                let autoApproved = 0, manualApproved = 0;

                (rows || []).forEach(row => {
                    if (row.decision === 'APPROVED') {
                        approved += row.count;
                        if (row.approval_type === 'auto') {
                            autoApproved += row.count;
                        } else {
                            manualApproved += row.count;
                        }
                    } else if (row.decision === 'REJECTED') {
                        rejected += row.count;
                    } else if (row.decision === 'MODIFIED') {
                        modified += row.count;
                    }
                });

                const total = approved + rejected + modified;
                resolve({
                    total_decisions: total,
                    approved: approved,
                    rejected: rejected,
                    modified: modified,
                    auto_approved: autoApproved,
                    manual_approved: manualApproved,
                    auto_approval_rate: approved > 0 ? Math.round((autoApproved / approved) * 10000) / 100 : 0,
                    approval_rate: total > 0 ? Math.round((approved / total) * 10000) / 100 : 0
                });
            });
        });
    },

    /**
     * Get playbook completion statistics.
     * @param {string} orgId - Organization ID
     * @param {Object} dateRange - { from, to }
     * @returns {Promise<Object>} Playbook stats
     */
    getPlaybookStats: async (orgId, dateRange = {}) => {
        const { from, to } = dateRange;

        return new Promise((resolve, reject) => {
            let whereClause = `WHERE r.organization_id = ?`;
            const params = [orgId];

            if (from) {
                whereClause += ` AND r.created_at >= ?`;
                params.push(from);
            }
            if (to) {
                whereClause += ` AND r.created_at <= ?`;
                params.push(to);
            }

            const sql = `
                SELECT 
                    t.title as playbook_name,
                    t.key as playbook_key,
                    r.status,
                    COUNT(*) as count,
                    AVG(
                        CASE 
                            WHEN r.completed_at IS NOT NULL AND r.started_at IS NOT NULL 
                            THEN (julianday(r.completed_at) - julianday(r.started_at)) * 24 * 60
                            ELSE NULL 
                        END
                    ) as avg_duration_mins
                FROM ai_playbook_runs r
                JOIN ai_playbook_templates t ON r.template_id = t.id
                ${whereClause}
                GROUP BY t.id, r.status
            `;

            deps.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);

                const byPlaybook = {};
                let totalRuns = 0, completedRuns = 0, failedRuns = 0;

                (rows || []).forEach(row => {
                    if (!byPlaybook[row.playbook_key]) {
                        byPlaybook[row.playbook_key] = {
                            name: row.playbook_name,
                            total: 0,
                            completed: 0,
                            failed: 0,
                            in_progress: 0,
                            avg_duration_mins: null
                        };
                    }

                    byPlaybook[row.playbook_key].total += row.count;
                    totalRuns += row.count;

                    if (row.status === 'COMPLETED') {
                        byPlaybook[row.playbook_key].completed += row.count;
                        byPlaybook[row.playbook_key].avg_duration_mins = row.avg_duration_mins
                            ? Math.round(row.avg_duration_mins * 10) / 10
                            : null;
                        completedRuns += row.count;
                    } else if (row.status === 'FAILED' || row.status === 'CANCELLED') {
                        byPlaybook[row.playbook_key].failed += row.count;
                        failedRuns += row.count;
                    } else {
                        byPlaybook[row.playbook_key].in_progress += row.count;
                    }
                });

                // Calculate completion rates
                for (const key of Object.keys(byPlaybook)) {
                    const pb = byPlaybook[key];
                    pb.completion_rate = pb.total > 0
                        ? Math.round((pb.completed / pb.total) * 10000) / 100
                        : 0;
                }

                resolve({
                    total_runs: totalRuns,
                    completed: completedRuns,
                    failed: failedRuns,
                    completion_rate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 10000) / 100 : 0,
                    by_playbook: byPlaybook
                });
            });
        });
    },

    /**
     * Get dead-letter job statistics.
     * @param {string} orgId - Organization ID
     * @param {Object} dateRange - { from, to }
     * @returns {Promise<Object>} Dead-letter stats
     */
    getDeadLetterStats: async (orgId, dateRange = {}) => {
        const { from, to } = dateRange;

        return new Promise((resolve, reject) => {
            let whereClause = `WHERE organization_id = ?`;
            const params = [orgId];

            if (from) {
                whereClause += ` AND created_at >= ?`;
                params.push(from);
            }
            if (to) {
                whereClause += ` AND created_at <= ?`;
                params.push(to);
            }

            const sql = `
                SELECT 
                    type,
                    status,
                    last_error_code,
                    COUNT(*) as count
                FROM async_jobs
                ${whereClause}
                GROUP BY type, status, last_error_code
            `;

            deps.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);

                let totalJobs = 0, deadLetterCount = 0, failedCount = 0;
                const byErrorCode = {};

                (rows || []).forEach(row => {
                    totalJobs += row.count;

                    if (row.status === 'DEAD_LETTER') {
                        deadLetterCount += row.count;
                        const code = row.last_error_code || 'UNKNOWN';
                        byErrorCode[code] = (byErrorCode[code] || 0) + row.count;
                    } else if (row.status === 'FAILED') {
                        failedCount += row.count;
                    }
                });

                resolve({
                    total_jobs: totalJobs,
                    dead_letter_count: deadLetterCount,
                    failed_count: failedCount,
                    dead_letter_rate: totalJobs > 0 ? Math.round((deadLetterCount / totalJobs) * 10000) / 100 : 0,
                    by_error_code: byErrorCode
                });
            });
        });
    },

    /**
     * Get time-to-resolution metrics.
     * @param {string} orgId - Organization ID
     * @param {Object} dateRange - { from, to }
     * @returns {Promise<Object>} Time-to-resolution stats
     */
    getTimeToResolution: async (orgId, dateRange = {}) => {
        const { from, to } = dateRange;

        return new Promise((resolve, reject) => {
            let whereClause = `WHERE organization_id = ? AND completed_at IS NOT NULL`;
            const params = [orgId];

            if (from) {
                whereClause += ` AND created_at >= ?`;
                params.push(from);
            }
            if (to) {
                whereClause += ` AND created_at <= ?`;
                params.push(to);
            }

            const sql = `
                SELECT 
                    AVG((julianday(completed_at) - julianday(started_at)) * 24 * 60) as avg_resolution_mins,
                    MIN((julianday(completed_at) - julianday(started_at)) * 24 * 60) as min_resolution_mins,
                    MAX((julianday(completed_at) - julianday(started_at)) * 24 * 60) as max_resolution_mins,
                    COUNT(*) as count
                FROM ai_playbook_runs
                ${whereClause}
            `;

            deps.db.get(sql, params, (err, row) => {
                if (err) return reject(err);

                resolve({
                    avg_resolution_mins: row?.avg_resolution_mins ? Math.round(row.avg_resolution_mins * 10) / 10 : null,
                    min_resolution_mins: row?.min_resolution_mins ? Math.round(row.min_resolution_mins * 10) / 10 : null,
                    max_resolution_mins: row?.max_resolution_mins ? Math.round(row.max_resolution_mins * 10) / 10 : null,
                    sample_count: row?.count || 0
                });
            });
        });
    },

    /**
     * Get ROI summary combining all metrics.
     * @param {string} orgId - Organization ID
     * @param {Object} dateRange - { from, to }
     * @returns {Promise<Object>} ROI summary
     */
    getROISummary: async (orgId, dateRange = {}) => {
        const [hoursSaved, costReduction, actionStats, playbookStats] = await Promise.all([
            deps.ROIService.estimateHoursSaved(orgId, dateRange),
            deps.ROIService.estimateCostReduction(orgId, dateRange),
            AIAnalyticsService.getActionStats(orgId, dateRange),
            AIAnalyticsService.getPlaybookStats(orgId, dateRange)
        ]);

        return {
            hours_saved: hoursSaved.hours_saved,
            cost_saved: costReduction.cost_saved,
            currency: 'USD',
            actions_executed: actionStats.total_executions,
            action_success_rate: actionStats.success_rate,
            playbooks_completed: playbookStats.completed,
            playbook_completion_rate: playbookStats.completion_rate,
            calculated_at: new Date().toISOString()
        };
    },

    /**
     * Export analytics data in specified format.
     * @param {string} orgId - Organization ID
     * @param {string} format - 'csv' | 'json'
     * @param {Object} dateRange - { from, to }
     * @returns {Promise<Object>} Export data
     */
    exportData: async (orgId, format = 'json', dateRange = {}) => {
        const [actionStats, approvalStats, playbookStats, deadLetterStats, roiSummary] = await Promise.all([
            AIAnalyticsService.getActionStats(orgId, dateRange),
            AIAnalyticsService.getApprovalStats(orgId, dateRange),
            AIAnalyticsService.getPlaybookStats(orgId, dateRange),
            AIAnalyticsService.getDeadLetterStats(orgId, dateRange),
            AIAnalyticsService.getROISummary(orgId, dateRange)
        ]);

        const data = {
            exported_at: new Date().toISOString(),
            organization_id: orgId,
            date_range: dateRange,
            actions: actionStats,
            approvals: approvalStats,
            playbooks: playbookStats,
            dead_letter: deadLetterStats,
            roi: roiSummary
        };

        if (format === 'csv') {
            return AIAnalyticsService._convertToCSV(data);
        }

        return data;
    },

    /**
     * Get dashboard summary for UI.
     */
    getDashboardSummary: async (orgId, dateRange = {}) => {
        const [actionStats, approvalStats, playbookStats, deadLetterStats, timeToResolution, roiSummary] = await Promise.all([
            AIAnalyticsService.getActionStats(orgId, dateRange),
            AIAnalyticsService.getApprovalStats(orgId, dateRange),
            AIAnalyticsService.getPlaybookStats(orgId, dateRange),
            AIAnalyticsService.getDeadLetterStats(orgId, dateRange),
            AIAnalyticsService.getTimeToResolution(orgId, dateRange),
            AIAnalyticsService.getROISummary(orgId, dateRange)
        ]);

        return {
            actions: actionStats,
            approvals: approvalStats,
            playbooks: playbookStats,
            deadLetter: deadLetterStats,
            timeToResolution,
            roi: roiSummary
        };
    },

    // ==========================================
    // INTERNAL HELPERS
    // ==========================================

    _convertToCSV: (data) => {
        const lines = [];

        // Header
        lines.push('Metric,Value');

        // Actions
        lines.push(`Total Executions,${data.actions.total_executions}`);
        lines.push(`Success Rate,${data.actions.success_rate}%`);

        // Approvals
        lines.push(`Total Decisions,${data.approvals.total_decisions}`);
        lines.push(`Auto Approval Rate,${data.approvals.auto_approval_rate}%`);

        // Playbooks
        lines.push(`Playbook Completion Rate,${data.playbooks.completion_rate}%`);

        // Dead Letter
        lines.push(`Dead Letter Rate,${data.dead_letter.dead_letter_rate}%`);

        // ROI
        lines.push(`Hours Saved,${data.roi.hours_saved}`);
        lines.push(`Cost Saved,${data.roi.cost_saved}`);

        return {
            content: lines.join('\n'),
            filename: `ai_analytics_${new Date().toISOString().split('T')[0]}.csv`,
            content_type: 'text/csv'
        };
    }
};

module.exports = AIAnalyticsService;
