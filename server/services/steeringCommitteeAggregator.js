/**
 * Steering Committee Report Aggregator
 * 
 * Aggregates executive-level data for Steering Committee reports.
 * Focuses on RAG status, KPIs, risks, decisions, and forecasts.
 * 
 * PMO Standards: ISO 21500, PMBOK 7, PRINCE2 (Highlight Report)
 */

const db = require('../database');

/**
 * Database helpers
 */
const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

const SteeringCommitteeAggregator = {
    /**
     * Get overall RAG status across all dimensions
     * @param {string} projectId - Project ID
     * @param {Object} healthSnapshot - Optional PMO health snapshot
     */
    getOverallRAGStatus: async (projectId, healthSnapshot = null) => {
        const [taskMetrics, riskMetrics, budgetMetrics] = await Promise.all([
            dbGet(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN due_date < date('now') AND status != 'DONE' THEN 1 ELSE 0 END) as overdue,
                    SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked
                FROM tasks WHERE project_id = ?
            `, [projectId]),
            dbGet(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN severity IN ('critical', 'CRITICAL') THEN 1 ELSE 0 END) as critical,
                    SUM(CASE WHEN severity IN ('high', 'HIGH') THEN 1 ELSE 0 END) as high
                FROM risk_register WHERE project_id = ? AND status NOT IN ('resolved', 'accepted')
            `, [projectId]),
            SteeringCommitteeAggregator._getBudgetMetrics(projectId)
        ]);

        const overduePercent = taskMetrics?.total > 0 ? (taskMetrics.overdue / taskMetrics.total) * 100 : 0;
        const scheduleStatus = overduePercent > 20 ? 'RED' : overduePercent > 10 ? 'AMBER' : 'GREEN';
        const riskStatus = riskMetrics?.critical > 0 ? 'RED' : riskMetrics?.high > 2 ? 'AMBER' : 'GREEN';

        const overall = SteeringCommitteeAggregator._worstStatus([
            scheduleStatus,
            budgetMetrics.status,
            riskStatus
        ]);

        return {
            overall,
            schedule: {
                category: 'SCHEDULE',
                status: scheduleStatus,
                trend: 'STABLE',
                summary: `${taskMetrics?.overdue || 0} tasks overdue of ${taskMetrics?.total || 0} total`
            },
            budget: budgetMetrics,
            scope: {
                category: 'SCOPE',
                status: (taskMetrics?.blocked || 0) > 5 ? 'AMBER' : 'GREEN',
                trend: 'STABLE',
                summary: `${taskMetrics?.blocked || 0} blocked items`
            },
            risk: {
                category: 'RISK',
                status: riskStatus,
                trend: 'STABLE',
                summary: `${riskMetrics?.critical || 0} critical, ${riskMetrics?.high || 0} high risks`
            },
            quality: {
                category: 'QUALITY',
                status: 'GREEN',
                trend: 'STABLE',
                summary: 'Quality metrics on track'
            }
        };
    },

    /**
     * Get KPIs for the project
     * @param {string} projectId - Project ID
     */
    getKPIs: async (projectId) => {
        // First try custom KPIs from project_kpis table
        const customKPIs = await dbAll(`
            SELECT pk.*, u.first_name || ' ' || u.last_name as owner_name
            FROM project_kpis pk
            LEFT JOIN users u ON pk.owner_id = u.id
            WHERE pk.project_id = ? AND pk.status = 'ACTIVE'
            ORDER BY pk.display_order, pk.category, pk.name
        `, [projectId]);

        if (customKPIs.length > 0) {
            return customKPIs.map(kpi => ({
                id: kpi.id,
                name: kpi.name,
                category: kpi.category,
                description: kpi.description,
                currentValue: kpi.current_value,
                targetValue: kpi.target_value,
                baselineValue: kpi.baseline_value,
                unit: kpi.unit,
                trend: kpi.trend || 'STABLE',
                status: SteeringCommitteeAggregator._calculateKPIStatus(kpi),
                sparklineData: SteeringCommitteeAggregator._parseJSON(kpi.historical_values, []),
                showSparkline: kpi.show_sparkline === 1,
                showTarget: kpi.show_target === 1,
                ownerName: kpi.owner_name,
                lastUpdated: kpi.last_updated_at
            }));
        }

        // Fallback: Calculate from task data
        const metrics = await dbGet(`
            SELECT 
                COUNT(*) as totalTasks,
                SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as completedTasks,
                AVG(progress) as avgProgress,
                SUM(CASE WHEN due_date < date('now') AND status != 'DONE' THEN 1 ELSE 0 END) as overdueTasks
            FROM tasks WHERE project_id = ?
        `, [projectId]);

        const completionRate = metrics?.totalTasks > 0
            ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100)
            : 0;

        return [
            {
                id: 'schedule_performance',
                name: 'Schedule Performance',
                category: 'SCHEDULE',
                currentValue: completionRate,
                targetValue: 100,
                unit: '%',
                trend: 'STABLE',
                status: completionRate >= 80 ? 'GREEN' : completionRate >= 60 ? 'AMBER' : 'RED'
            },
            {
                id: 'on_time_delivery',
                name: 'On-Time Delivery',
                category: 'SCHEDULE',
                currentValue: metrics?.totalTasks > 0
                    ? Math.round(((metrics.totalTasks - metrics.overdueTasks) / metrics.totalTasks) * 100)
                    : 100,
                targetValue: 95,
                unit: '%',
                trend: 'STABLE',
                status: metrics?.overdueTasks === 0 ? 'GREEN' : metrics?.overdueTasks <= 3 ? 'AMBER' : 'RED'
            }
        ];
    },

    /**
     * Get risks and issues requiring board attention
     * @param {string} projectId - Project ID
     */
    getRisksAndIssues: async (projectId) => {
        const risks = await dbAll(`
            SELECT r.*, u.first_name || ' ' || u.last_name as ownerName
            FROM risk_register r
            LEFT JOIN users u ON r.owner_id = u.id
            WHERE r.project_id = ? AND r.status NOT IN ('resolved', 'accepted')
            ORDER BY 
                CASE r.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                r.created_at DESC
        `, [projectId]);

        return risks.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            severity: (row.severity || 'MEDIUM').toUpperCase(),
            probability: row.probability,
            impact: row.impact,
            owner: row.ownerName || 'Unassigned',
            mitigation: row.mitigation_plan,
            status: row.status,
            category: row.category || 'GENERAL',
            createdAt: row.created_at,
            dueDate: row.due_date
        }));
    },

    /**
     * Get decisions requiring board approval
     * @param {string} projectId - Project ID
     */
    getDecisionsForBoard: async (projectId) => {
        const decisions = await dbAll(`
            SELECT d.*, u.first_name || ' ' || u.last_name as decisionMakerName
            FROM decisions d
            LEFT JOIN users u ON d.decision_maker_id = u.id
            WHERE d.project_id = ? 
              AND (d.status IN ('PENDING', 'DRAFT') OR d.escalated = 1)
              AND (d.requires_board_approval = 1 OR d.escalated = 1 OR d.priority IN ('HIGH', 'CRITICAL'))
            ORDER BY d.priority DESC, d.deadline ASC
        `, [projectId]);

        return decisions.map(d => ({
            id: d.id,
            title: d.title,
            description: d.description,
            decisionMaker: d.decisionMakerName || 'Unassigned',
            deadline: d.deadline,
            priority: d.priority,
            impact: d.impact,
            options: SteeringCommitteeAggregator._parseJSON(d.options, []),
            recommendation: d.recommendation,
            isEscalated: d.escalated === 1,
            requiresBoardApproval: d.requires_board_approval === 1,
            daysUntilDeadline: d.deadline
                ? Math.ceil((new Date(d.deadline) - new Date()) / (1000 * 60 * 60 * 24))
                : null
        }));
    },

    /**
     * Get forecast and milestone data
     * @param {string} projectId - Project ID
     */
    getForecast: async (projectId) => {
        const [milestones, gates, project] = await Promise.all([
            dbAll(`
                SELECT m.*, u.first_name || ' ' || u.last_name as ownerName
                FROM milestones m
                LEFT JOIN users u ON m.owner_id = u.id
                WHERE m.project_id = ?
                ORDER BY m.due_date ASC
            `, [projectId]),
            dbAll(`
                SELECT * FROM stage_gates
                WHERE project_id = ?
                ORDER BY sequence_order ASC
            `, [projectId]),
            dbGet(`SELECT * FROM projects WHERE id = ?`, [projectId])
        ]);

        const upcomingMilestones = milestones.filter(m =>
            m.status !== 'DONE' && new Date(m.due_date) >= new Date()
        ).slice(0, 5);

        const upcomingGates = gates.filter(g =>
            g.status !== 'PASSED' && g.status !== 'COMPLETED'
        ).slice(0, 3);

        // Calculate completion forecast
        const completionForecast = SteeringCommitteeAggregator._calculateCompletionForecast(
            project,
            milestones,
            gates
        );

        return {
            nextMilestones: upcomingMilestones.map(m => ({
                id: m.id,
                name: m.name,
                dueDate: m.due_date,
                status: m.status,
                owner: m.ownerName,
                isAtRisk: m.status === 'AT_RISK',
                daysUntil: Math.ceil((new Date(m.due_date) - new Date()) / (1000 * 60 * 60 * 24))
            })),
            nextGates: upcomingGates.map(g => ({
                id: g.id,
                name: g.name,
                phase: g.phase,
                plannedDate: g.planned_date,
                status: g.status,
                criteria: SteeringCommitteeAggregator._parseJSON(g.criteria, [])
            })),
            completionForecast,
            forecastNarrative: SteeringCommitteeAggregator._generateForecastNarrative(
                completionForecast,
                upcomingMilestones,
                upcomingGates
            )
        };
    },

    /**
     * Calculate confidence level
     * @param {Array} milestones - Milestones
     * @param {Array} gates - Stage gates
     * @param {Object} healthSnapshot - Health snapshot
     * @param {Array} blockers - Blockers
     */
    calculateConfidence: (milestones, gates, healthSnapshot, blockers) => {
        let confidence = 'HIGH';
        let reasons = [];
        let score = 85;

        // Check blockers
        if (blockers && blockers.length > 3) {
            confidence = 'MEDIUM';
            score -= 15;
            reasons.push(`${blockers.length} active blockers`);
        }
        if (blockers && blockers.length > 6) {
            confidence = 'LOW';
            score -= 20;
        }

        // Check critical risks
        if (healthSnapshot?.risks?.critical > 0) {
            confidence = 'LOW';
            score -= 25;
            reasons.push(`${healthSnapshot.risks.critical} critical risk(s)`);
        } else if (healthSnapshot?.risks?.high > 3) {
            if (confidence !== 'LOW') confidence = 'MEDIUM';
            score -= 10;
            reasons.push(`${healthSnapshot.risks.high} high risks`);
        }

        // Check gates
        if (gates && gates.some(g => g.status === 'BLOCKED' || g.decision === 'STOP')) {
            confidence = 'LOW';
            score -= 20;
            reasons.push('Stage gate blocked');
        } else if (gates && gates.some(g => g.status === 'AT_RISK')) {
            if (confidence !== 'LOW') confidence = 'MEDIUM';
            score -= 10;
            reasons.push('Stage gate at risk');
        }

        // Check overdue milestones
        const overdueMilestones = milestones?.filter(m =>
            new Date(m.dueDate || m.due_date) < new Date() &&
            m.status !== 'DONE'
        ) || [];

        if (overdueMilestones.length > 2) {
            confidence = 'LOW';
            score -= 20;
            reasons.push(`${overdueMilestones.length} overdue milestones`);
        } else if (overdueMilestones.length > 0) {
            if (confidence !== 'LOW') confidence = 'MEDIUM';
            score -= 10;
            reasons.push(`${overdueMilestones.length} overdue milestone(s)`);
        }

        return {
            level: confidence,
            reasons,
            score: Math.max(0, Math.min(100, score))
        };
    },

    // ==========================================
    // PRIVATE HELPERS
    // ==========================================

    _getBudgetMetrics: async (projectId) => {
        const budget = await dbGet(`
            SELECT 
                planned_budget,
                actual_spend,
                forecast_at_completion,
                variance_percent
            FROM project_budgets 
            WHERE project_id = ?
        `, [projectId]);

        if (!budget || !budget.planned_budget) {
            return {
                category: 'BUDGET',
                status: 'GREY',
                trend: 'UNKNOWN',
                summary: 'Budget not tracked'
            };
        }

        const spendPercent = (budget.actual_spend / budget.planned_budget) * 100;
        const variance = budget.variance_percent || (spendPercent - 100);

        let status = 'GREEN';
        if (variance > 15 || spendPercent > 110) status = 'RED';
        else if (variance > 5 || spendPercent > 95) status = 'AMBER';

        return {
            category: 'BUDGET',
            status,
            trend: variance > 10 ? 'DECLINING' : variance < -5 ? 'IMPROVING' : 'STABLE',
            summary: `${Math.round(spendPercent)}% of budget used`,
            plannedBudget: budget.planned_budget,
            actualSpend: budget.actual_spend,
            spendPercent: Math.round(spendPercent),
            variancePercent: Math.round(variance)
        };
    },

    _calculateKPIStatus: (kpi) => {
        if (kpi.current_value === null || kpi.target_value === null) return 'GREY';

        const isHigherBetter = kpi.threshold_direction !== 'LOWER_IS_BETTER';
        const value = kpi.current_value;
        const green = kpi.green_threshold ?? (isHigherBetter ? kpi.target_value * 0.9 : kpi.target_value * 1.1);
        const amber = kpi.amber_threshold ?? (isHigherBetter ? kpi.target_value * 0.7 : kpi.target_value * 1.3);

        if (isHigherBetter) {
            return value >= green ? 'GREEN' : value >= amber ? 'AMBER' : 'RED';
        } else {
            return value <= green ? 'GREEN' : value <= amber ? 'AMBER' : 'RED';
        }
    },

    _calculateCompletionForecast: (project, milestones, gates) => {
        const now = new Date();
        const plannedEnd = project?.end_date ? new Date(project.end_date) : null;

        if (!plannedEnd) {
            return {
                plannedDate: null,
                forecastDate: null,
                varianceDays: 0,
                confidence: 'UNKNOWN'
            };
        }

        // Simple forecast: adjust based on milestone completion rate
        const completedMilestones = milestones.filter(m => m.status === 'DONE').length;
        const totalMilestones = milestones.length;
        const completionRate = totalMilestones > 0 ? completedMilestones / totalMilestones : 0;

        // Calculate days remaining based on rate
        const elapsedDays = project.start_date
            ? Math.ceil((now - new Date(project.start_date)) / (1000 * 60 * 60 * 24))
            : 0;
        const estimatedTotalDays = completionRate > 0 ? elapsedDays / completionRate : null;

        let forecastDate = plannedEnd;
        if (estimatedTotalDays && project.start_date) {
            forecastDate = new Date(project.start_date);
            forecastDate.setDate(forecastDate.getDate() + estimatedTotalDays);
        }

        const varianceDays = Math.ceil((forecastDate - plannedEnd) / (1000 * 60 * 60 * 24));

        return {
            plannedDate: plannedEnd.toISOString().split('T')[0],
            forecastDate: forecastDate.toISOString().split('T')[0],
            varianceDays,
            confidence: varianceDays <= 0 ? 'HIGH' : varianceDays <= 14 ? 'MEDIUM' : 'LOW'
        };
    },

    _generateForecastNarrative: (forecast, milestones, gates) => {
        const parts = [];

        if (forecast.varianceDays <= 0) {
            parts.push('Project is on track for planned completion.');
        } else if (forecast.varianceDays <= 14) {
            parts.push(`Project is ${forecast.varianceDays} days behind schedule.`);
        } else {
            parts.push(`Project is significantly delayed (${forecast.varianceDays} days).`);
        }

        if (milestones.length > 0) {
            const nextMilestone = milestones[0];
            parts.push(`Next milestone: ${nextMilestone.name} due in ${nextMilestone.daysUntil} days.`);
        }

        if (gates.length > 0) {
            parts.push(`${gates.length} stage gate(s) pending.`);
        }

        return parts.join(' ');
    },

    _worstStatus: (statuses) => {
        if (statuses.includes('RED')) return 'RED';
        if (statuses.includes('AMBER')) return 'AMBER';
        if (statuses.includes('GREY')) return 'GREY';
        return 'GREEN';
    },

    _parseJSON: (str, defaultValue) => {
        try {
            return str ? JSON.parse(str) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }
};

module.exports = SteeringCommitteeAggregator;



