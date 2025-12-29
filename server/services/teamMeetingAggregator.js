/**
 * Team Meeting Report Aggregator
 * 
 * Aggregates data for Team Meeting reports.
 * Extracts and organizes task status, completed work, blockers, and decisions.
 * 
 * PMO Standards: ISO 21500, PMBOK 7, PRINCE2 (Checkpoint Report)
 */

const db = require('../database');

/**
 * Database helper for async queries
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

const TeamMeetingAggregator = {
    /**
     * Get status summary for a project
     * @param {string} projectId - Project ID
     * @param {Date} periodStart - Period start date
     * @param {Date} periodEnd - Period end date
     */
    getStatusSummary: async (projectId, periodStart, periodEnd) => {
        const [taskStats, initiativeStats, decisionStats] = await Promise.all([
            dbGet(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status IN ('done', 'DONE') THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status IN ('in_progress', 'IN_PROGRESS') THEN 1 ELSE 0 END) as inProgress,
                    SUM(CASE WHEN status IN ('blocked', 'BLOCKED') THEN 1 ELSE 0 END) as blocked,
                    SUM(CASE WHEN due_date < date('now') AND status NOT IN ('done', 'DONE') THEN 1 ELSE 0 END) as overdue
                FROM tasks WHERE project_id = ?
            `, [projectId]),
            dbGet(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status IN ('EXECUTING', 'APPROVED') THEN 1 ELSE 0 END) as onTrack,
                    SUM(CASE WHEN status IN ('BLOCKED', 'AT_RISK') THEN 1 ELSE 0 END) as atRisk
                FROM initiatives WHERE project_id = ?
            `, [projectId]),
            dbGet(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status IN ('APPROVED', 'ACCEPTED') THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status IN ('PENDING', 'DRAFT') THEN 1 ELSE 0 END) as pending
                FROM decisions WHERE project_id = ?
            `, [projectId])
        ]);

        const total = taskStats?.total || 0;
        const completed = taskStats?.completed || 0;

        return {
            progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
            healthStatus: TeamMeetingAggregator._calculateHealthStatus(taskStats, initiativeStats),
            tasksTotal: total,
            tasksCompleted: completed,
            tasksInProgress: taskStats?.inProgress || 0,
            tasksBlocked: taskStats?.blocked || 0,
            tasksOverdue: taskStats?.overdue || 0,
            initiativesTotal: initiativeStats?.total || 0,
            initiativesOnTrack: initiativeStats?.onTrack || 0,
            initiativesAtRisk: initiativeStats?.atRisk || 0,
            decisionsApproved: decisionStats?.approved || 0,
            decisionsPending: decisionStats?.pending || 0
        };
    },

    /**
     * Get completed work in the period
     * @param {string} projectId - Project ID
     * @param {Date} periodStart - Period start date
     * @param {Date} periodEnd - Period end date
     */
    getCompletedWork: async (projectId, periodStart, periodEnd) => {
        const tasks = await dbAll(`
            SELECT t.*, u.first_name || ' ' || u.last_name as assigneeName
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.id
            WHERE t.project_id = ? 
              AND t.status IN ('done', 'DONE')
              AND t.updated_at >= ? 
              AND t.updated_at <= ?
            ORDER BY t.updated_at DESC
            LIMIT 20
        `, [projectId, periodStart.toISOString(), periodEnd.toISOString()]);

        return tasks.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            assignee: t.assigneeName || 'Unassigned',
            completedAt: t.updated_at,
            initiative: t.initiative_id,
            priority: t.priority
        }));
    },

    /**
     * Get work in progress
     * @param {string} projectId - Project ID
     */
    getWorkInProgress: async (projectId) => {
        const tasks = await dbAll(`
            SELECT t.*, u.first_name || ' ' || u.last_name as assigneeName
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.id
            WHERE t.project_id = ? 
              AND t.status IN ('in_progress', 'IN_PROGRESS')
            ORDER BY t.priority DESC, t.due_date ASC
            LIMIT 20
        `, [projectId]);

        return tasks.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            assignee: t.assigneeName || 'Unassigned',
            progress: t.progress || 0,
            dueDate: t.due_date,
            priority: t.priority,
            isOverdue: t.due_date && new Date(t.due_date) < new Date()
        }));
    },

    /**
     * Get blockers and issues
     * @param {string} projectId - Project ID
     */
    getBlockers: async (projectId) => {
        const blockers = await dbAll(`
            SELECT t.*, u.first_name || ' ' || u.last_name as assigneeName
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.id
            WHERE t.project_id = ? 
              AND t.status IN ('blocked', 'BLOCKED')
            ORDER BY t.priority DESC, t.created_at ASC
        `, [projectId]);

        return blockers.map(b => ({
            id: b.id,
            title: b.title,
            description: b.description,
            assignee: b.assigneeName || 'Unassigned',
            blockedSince: b.updated_at,
            blockingReason: b.blocking_reason || 'No reason specified',
            priority: b.priority,
            impact: b.priority === 'HIGH' || b.priority === 'CRITICAL' ? 'HIGH' : 'MEDIUM'
        }));
    },

    /**
     * Get pending decisions
     * @param {string} projectId - Project ID
     */
    getPendingDecisions: async (projectId) => {
        const decisions = await dbAll(`
            SELECT d.*, u.first_name || ' ' || u.last_name as decisionMakerName
            FROM decisions d
            LEFT JOIN users u ON d.decision_maker_id = u.id
            WHERE d.project_id = ? 
              AND d.status IN ('PENDING', 'DRAFT')
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
            isOverdue: d.deadline && new Date(d.deadline) < new Date(),
            daysUntilDeadline: d.deadline 
                ? Math.ceil((new Date(d.deadline) - new Date()) / (1000 * 60 * 60 * 24))
                : null
        }));
    },

    /**
     * Get next period plan
     * @param {string} projectId - Project ID
     * @param {number} periodDays - Planning period in days
     */
    getNextPeriodPlan: async (projectId, periodDays = 7) => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + periodDays);

        const plannedTasks = await dbAll(`
            SELECT t.*, u.first_name || ' ' || u.last_name as assigneeName
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.id
            WHERE t.project_id = ? 
              AND t.status NOT IN ('done', 'DONE', 'blocked', 'BLOCKED', 'cancelled', 'CANCELLED')
              AND (t.start_date <= ? OR t.due_date <= ?)
            ORDER BY t.priority DESC, t.start_date ASC
            LIMIT 20
        `, [projectId, futureDate.toISOString(), futureDate.toISOString()]);

        return plannedTasks.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            assignee: t.assigneeName || 'Unassigned',
            startDate: t.start_date,
            dueDate: t.due_date,
            priority: t.priority,
            estimatedHours: t.estimated_hours
        }));
    },

    /**
     * Generate highlights from data
     * @param {Array} completedWork - Completed work items
     * @param {Object} statusSummary - Status summary
     */
    generateHighlights: (completedWork, statusSummary) => {
        const highlights = [];
        
        if (completedWork.length > 0) {
            highlights.push(`${completedWork.length} tasks completed this period`);
        }
        if (statusSummary.progressPercent >= 75) {
            highlights.push(`Strong progress: ${statusSummary.progressPercent}% complete`);
        }
        if (statusSummary.tasksBlocked === 0) {
            highlights.push('No blocked tasks - execution flowing smoothly');
        }
        if (statusSummary.initiativesOnTrack > 0 && statusSummary.initiativesAtRisk === 0) {
            highlights.push(`All ${statusSummary.initiativesOnTrack} active initiatives on track`);
        }

        return highlights;
    },

    /**
     * Generate concerns from data
     * @param {Array} blockers - Blocker items
     * @param {Object} statusSummary - Status summary
     */
    generateConcerns: (blockers, statusSummary) => {
        const concerns = [];

        if (blockers.length > 0) {
            concerns.push(`${blockers.length} blocked item(s) require attention`);
        }
        if (statusSummary.tasksOverdue > 0) {
            concerns.push(`${statusSummary.tasksOverdue} task(s) are overdue`);
        }
        if (statusSummary.decisionsPending > 3) {
            concerns.push(`${statusSummary.decisionsPending} decisions pending - may cause delays`);
        }
        if (statusSummary.initiativesAtRisk > 0) {
            concerns.push(`${statusSummary.initiativesAtRisk} initiative(s) at risk`);
        }

        return concerns;
    },

    /**
     * Calculate health status
     * @private
     */
    _calculateHealthStatus: (taskStats, initiativeStats) => {
        const overduePercent = taskStats?.total > 0 
            ? (taskStats.overdue / taskStats.total) * 100 
            : 0;
        const blockedPercent = taskStats?.total > 0 
            ? (taskStats.blocked / taskStats.total) * 100 
            : 0;

        if (overduePercent > 20 || blockedPercent > 15) return 'RED';
        if (overduePercent > 10 || blockedPercent > 8) return 'AMBER';
        return 'GREEN';
    }
};

module.exports = TeamMeetingAggregator;

