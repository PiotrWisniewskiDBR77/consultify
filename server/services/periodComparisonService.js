/**
 * Period Comparison Service
 * 
 * Calculates changes between reporting periods for Management Reports.
 * Provides trend analysis and delta calculations.
 * 
 * PMO Standards:
 * - PMBOK 7: Measurement Performance Domain - Trend Analysis
 * - ISO 21500: Performance Measurement - Variance Analysis
 * - PRINCE2: Progress Theme - Trend Identification
 */

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();



// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Determine trend direction
const determineTrend = (current, previous, higherIsBetter = true) => {
    if (current === previous) return 'STABLE';
    
    const isUp = current > previous;
    if (higherIsBetter) {
        return isUp ? 'UP' : 'DOWN';
    } else {
        return isUp ? 'DOWN' : 'UP'; // For metrics where lower is better (e.g., blockers)
    }
};

// Calculate percentage change
const calculateChangePercent = (current, previous) => {
    if (previous === 0) {
        return current === 0 ? 0 : 100;
    }
    return Math.round(((current - previous) / previous) * 100);
};

const PeriodComparisonService = {
    /**
     * Get the previous report of the same type/scope
     * 
     * @param {string} reportId - Current report ID
     * @returns {Promise<Object|null>} Previous report or null
     */
    getPreviousReport: async (reportId) => {
        const currentReport = await dbGet(
            'SELECT * FROM management_reports WHERE id = ?',
            [reportId]
        );
        
        if (!currentReport) return null;

        // Find the most recent report before this one with same type/scope/project
        const previousReport = await dbGet(`
            SELECT * FROM management_reports
            WHERE organization_id = ?
              AND report_type = ?
              AND scope = ?
              AND (project_id = ? OR (project_id IS NULL AND ? IS NULL))
              AND created_at < ?
              AND status IN ('DRAFT', 'FINAL')
            ORDER BY created_at DESC
            LIMIT 1
        `, [
            currentReport.organization_id,
            currentReport.report_type,
            currentReport.scope,
            currentReport.project_id,
            currentReport.project_id,
            currentReport.created_at
        ]);

        return previousReport;
    },

    /**
     * Calculate changes between current and previous report
     * 
     * @param {Object} currentReport - Current report (with parsed content)
     * @param {Object} previousReport - Previous report (with parsed content)
     * @returns {Object} Changes object
     */
    calculateChanges: (currentReport, previousReport) => {
        const currentContent = typeof currentReport.content === 'string' 
            ? JSON.parse(currentReport.content) 
            : currentReport.content;
            
        const previousContent = typeof previousReport.content === 'string'
            ? JSON.parse(previousReport.content)
            : previousReport.content;

        const changes = {};

        // Tasks completed
        if (currentContent.statusSummary && previousContent.statusSummary) {
            const currentCompleted = currentContent.statusSummary.tasksCompletedPeriod || 
                                    currentContent.completedWork?.length || 0;
            const prevCompleted = previousContent.statusSummary.tasksCompletedPeriod ||
                                 previousContent.completedWork?.length || 0;
            
            changes.tasksCompleted = {
                current: currentCompleted,
                previous: prevCompleted,
                change: currentCompleted - prevCompleted,
                changePercent: calculateChangePercent(currentCompleted, prevCompleted),
                trend: determineTrend(currentCompleted, prevCompleted, true)
            };
        }

        // Overall progress
        if (currentContent.statusSummary?.progressPercent !== undefined &&
            previousContent.statusSummary?.progressPercent !== undefined) {
            changes.progressPercent = {
                current: currentContent.statusSummary.progressPercent,
                previous: previousContent.statusSummary.progressPercent,
                change: currentContent.statusSummary.progressPercent - previousContent.statusSummary.progressPercent,
                changePercent: calculateChangePercent(
                    currentContent.statusSummary.progressPercent,
                    previousContent.statusSummary.progressPercent
                ),
                trend: determineTrend(
                    currentContent.statusSummary.progressPercent,
                    previousContent.statusSummary.progressPercent,
                    true
                )
            };
        }

        // Blockers (fewer is better)
        const currentBlockers = currentContent.blockers?.length ||
                               currentContent.statusSummary?.tasksBlocked || 0;
        const prevBlockers = previousContent.blockers?.length ||
                            previousContent.statusSummary?.tasksBlocked || 0;
        
        changes.blockers = {
            current: currentBlockers,
            previous: prevBlockers,
            change: currentBlockers - prevBlockers,
            changePercent: calculateChangePercent(currentBlockers, prevBlockers),
            trend: determineTrend(currentBlockers, prevBlockers, false) // Lower is better
        };

        // Overdue tasks (fewer is better)
        if (currentContent.statusSummary?.tasksOverdue !== undefined &&
            previousContent.statusSummary?.tasksOverdue !== undefined) {
            changes.overdueTasks = {
                current: currentContent.statusSummary.tasksOverdue,
                previous: previousContent.statusSummary.tasksOverdue,
                change: currentContent.statusSummary.tasksOverdue - previousContent.statusSummary.tasksOverdue,
                changePercent: calculateChangePercent(
                    currentContent.statusSummary.tasksOverdue,
                    previousContent.statusSummary.tasksOverdue
                ),
                trend: determineTrend(
                    currentContent.statusSummary.tasksOverdue,
                    previousContent.statusSummary.tasksOverdue,
                    false // Lower is better
                )
            };
        }

        // Pending decisions (fewer is better)
        const currentDecisions = currentContent.pendingDecisions?.length ||
                                currentContent.statusSummary?.decisionsPending || 0;
        const prevDecisions = previousContent.pendingDecisions?.length ||
                             previousContent.statusSummary?.decisionsPending || 0;
        
        changes.pendingDecisions = {
            current: currentDecisions,
            previous: prevDecisions,
            change: currentDecisions - prevDecisions,
            changePercent: calculateChangePercent(currentDecisions, prevDecisions),
            trend: determineTrend(currentDecisions, prevDecisions, false)
        };

        // Critical risks (for Steering Committee reports)
        if (currentContent.risksAndIssues || currentContent.overallStatus) {
            const currentCritical = currentContent.risksAndIssues?.critical?.length ||
                                   currentContent.overallStatus?.find(s => s.category === 'RISK')?.summary?.match(/\d+/)?.[0] || 0;
            const prevCritical = previousContent.risksAndIssues?.critical?.length ||
                                previousContent.overallStatus?.find(s => s.category === 'RISK')?.summary?.match(/\d+/)?.[0] || 0;
            
            changes.criticalRisks = {
                current: parseInt(currentCritical) || 0,
                previous: parseInt(prevCritical) || 0,
                change: (parseInt(currentCritical) || 0) - (parseInt(prevCritical) || 0),
                changePercent: calculateChangePercent(parseInt(currentCritical) || 0, parseInt(prevCritical) || 0),
                trend: determineTrend(parseInt(currentCritical) || 0, parseInt(prevCritical) || 0, false)
            };
        }

        // Budget variance (for Steering Committee reports)
        if (currentContent.overallStatus && previousContent.overallStatus) {
            const currentBudget = currentContent.overallStatus.find(s => s.category === 'BUDGET');
            const prevBudget = previousContent.overallStatus.find(s => s.category === 'BUDGET');
            
            if (currentBudget?.spendPercent !== undefined && prevBudget?.spendPercent !== undefined) {
                changes.budgetVariance = {
                    current: currentBudget.variancePercent || (currentBudget.spendPercent - 100),
                    previous: prevBudget.variancePercent || (prevBudget.spendPercent - 100),
                    change: (currentBudget.variancePercent || 0) - (prevBudget.variancePercent || 0),
                    changePercent: calculateChangePercent(
                        Math.abs(currentBudget.variancePercent || 0),
                        Math.abs(prevBudget.variancePercent || 0)
                    ),
                    trend: determineTrend(
                        Math.abs(currentBudget.variancePercent || 0),
                        Math.abs(prevBudget.variancePercent || 0),
                        false // Lower variance is better
                    )
                };
            }
        }

        // KPI changes
        if (currentContent.kpis && previousContent.kpis) {
            changes.kpis = {};
            
            currentContent.kpis.forEach(currentKpi => {
                const prevKpi = previousContent.kpis.find(k => k.name === currentKpi.name || k.id === currentKpi.id);
                if (prevKpi && currentKpi.currentValue !== undefined && prevKpi.currentValue !== undefined) {
                    changes.kpis[currentKpi.name || currentKpi.id] = {
                        current: currentKpi.currentValue,
                        previous: prevKpi.currentValue,
                        change: currentKpi.currentValue - prevKpi.currentValue,
                        changePercent: calculateChangePercent(currentKpi.currentValue, prevKpi.currentValue),
                        trend: determineTrend(currentKpi.currentValue, prevKpi.currentValue, true),
                        unit: currentKpi.unit
                    };
                }
            });
        }

        return changes;
    },

    /**
     * Generate full comparison data for a report
     * 
     * @param {string} reportId - Current report ID
     * @returns {Promise<Object>} Full comparison data
     */
    generateComparisonData: async (reportId) => {
        const currentReport = await dbGet('SELECT * FROM management_reports WHERE id = ?', [reportId]);
        if (!currentReport) {
            throw new Error('Report not found');
        }

        const previousReport = await PeriodComparisonService.getPreviousReport(reportId);

        if (!previousReport) {
            return {
                previousReportId: null,
                previousPeriod: null,
                hasPreviousReport: false,
                changes: {}
            };
        }

        const changes = PeriodComparisonService.calculateChanges(currentReport, previousReport);

        return {
            previousReportId: previousReport.id,
            previousPeriod: {
                start: previousReport.period_start,
                end: previousReport.period_end
            },
            hasPreviousReport: true,
            changes
        };
    },

    /**
     * Get trend history for a specific metric across multiple reports
     * 
     * @param {string} organizationId - Organization ID
     * @param {string} projectId - Project ID (optional)
     * @param {string} reportType - Report type
     * @param {string} metricPath - Path to metric in content (e.g., 'statusSummary.progressPercent')
     * @param {number} limit - Number of historical points
     * @returns {Promise<Array>} Historical values
     */
    getTrendHistory: async (organizationId, projectId, reportType, metricPath, limit = 10) => {
        let query = `
            SELECT id, content, period_start, period_end, created_at
            FROM management_reports
            WHERE organization_id = ?
              AND report_type = ?
              AND status IN ('DRAFT', 'FINAL')
        `;
        const params = [organizationId, reportType];

        if (projectId) {
            query += ' AND project_id = ?';
            params.push(projectId);
        } else {
            query += ' AND project_id IS NULL';
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);

        const reports = await dbAll(query, params);

        return reports.reverse().map(report => {
            const content = typeof report.content === 'string'
                ? JSON.parse(report.content)
                : report.content;

            // Navigate to the metric using the path
            const pathParts = metricPath.split('.');
            let value = content;
            for (const part of pathParts) {
                value = value?.[part];
                if (value === undefined) break;
            }

            return {
                reportId: report.id,
                periodEnd: report.period_end,
                value: value ?? null,
                timestamp: report.created_at
            };
        });
    },

    /**
     * Calculate a summary of all trend directions
     * 
     * @param {Object} changes - Changes object from calculateChanges
     * @returns {Object} Trend summary
     */
    summarizeTrends: (changes) => {
        const summary = {
            improving: 0,
            declining: 0,
            stable: 0,
            total: 0
        };

        const checkTrend = (changeObj) => {
            if (!changeObj || changeObj.trend === undefined) return;
            summary.total++;
            
            if (changeObj.trend === 'UP') {
                // UP means improving for metrics where higher is better
                // Check if this is a "lower is better" metric by looking at the change
                summary.improving++;
            } else if (changeObj.trend === 'DOWN') {
                summary.declining++;
            } else {
                summary.stable++;
            }
        };

        // Check main metrics
        checkTrend(changes.tasksCompleted);
        checkTrend(changes.progressPercent);
        checkTrend(changes.blockers);
        checkTrend(changes.overdueTasks);
        checkTrend(changes.pendingDecisions);
        checkTrend(changes.criticalRisks);
        checkTrend(changes.budgetVariance);

        // Check KPIs
        if (changes.kpis) {
            Object.values(changes.kpis).forEach(checkTrend);
        }

        return summary;
    }
};

export default PeriodComparisonService;














