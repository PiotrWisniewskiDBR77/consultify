/**
 * Execution Monitor Service - AI-powered execution oversight
 * Step 5: Execution Control, My Work & Notifications
 */

/**
 * Dependency injection container
 */
const deps = {
    _db: null,
    _notificationService: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get notificationService() { return this._notificationService; },
    set notificationService(val) { this._notificationService = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: dbInstance } = await import('../src/database/Database.ts');
        deps._db = dbInstance;
    }
    if (!deps._notificationService) {
        const { default: notificationService } = await import('./notificationService.js');
        deps._notificationService = notificationService;
    }
}

class ExecutionMonitorService {
    constructor() {
        this._db = null;
    }

    get db() {
        if (!this._db) {
            throw new Error('ExecutionMonitorService: Database not initialized. Call init() first.');
        }
        return this._db;
    }

    /**
     * Initialize service dependencies
     */
    async init() {
        await initDeps();
        this._db = deps.db;
        return this;
    }

    /**
     * Set dependencies for testing
     */
    setDependencies(mockDeps) {
        Object.assign(deps, mockDeps);
        this._db = deps.db;
    }

    /**
     * Run daily execution monitoring for a project
     */
    async runDailyMonitor(projectId) {
        await this.init();
        const issues = [];
        const notifications = [];

        // 1. Detect stalled tasks (no update in 7+ days, still active)
        const stalledTasks = await this._detectStalledTasks(projectId);
        if (stalledTasks.length > 0) {
            issues.push({
                type: 'STALLED_TASKS',
                severity: 'WARNING',
                count: stalledTasks.length,
                items: stalledTasks
            });
        }

        // 2. Detect overdue tasks
        const overdueTasks = await this._detectOverdueTasks(projectId);
        if (overdueTasks.length > 0) {
            issues.push({
                type: 'OVERDUE_TASKS',
                severity: 'WARNING',
                count: overdueTasks.length,
                items: overdueTasks
            });

            // Notify assignees
            for (const task of overdueTasks) {
                if (task.assignee_id) {
                    notifications.push({
                        userId: task.assignee_id,
                        type: 'TASK_OVERDUE',
                        severity: 'WARNING',
                        title: 'Task Overdue',
                        message: `"${task.title}" is overdue`,
                        relatedObjectType: 'TASK',
                        relatedObjectId: task.id
                    });
                }
            }
        }

        // 3. Detect decision inertia (pending for 7+ days)
        const overdueDecisions = await this._detectOverdueDecisions(projectId);
        if (overdueDecisions.length > 0) {
            issues.push({
                type: 'DECISION_INERTIA',
                severity: 'CRITICAL',
                count: overdueDecisions.length,
                items: overdueDecisions
            });

            // Notify decision owners
            for (const decision of overdueDecisions) {
                notifications.push({
                    userId: decision.decision_owner_id,
                    type: 'DECISION_OVERDUE',
                    severity: 'CRITICAL',
                    title: 'Decision Overdue',
                    message: `"${decision.title}" requires your immediate attention`,
                    relatedObjectType: 'DECISION',
                    relatedObjectId: decision.id
                });
            }
        }

        // 4. Detect stalled initiatives
        const stalledInitiatives = await this._detectStalledInitiatives(projectId);
        if (stalledInitiatives.length > 0) {
            issues.push({
                type: 'STALLED_INITIATIVES',
                severity: 'WARNING',
                count: stalledInitiatives.length,
                items: stalledInitiatives
            });
        }

        // 5. Detect silent blockers (blocked without reason)
        const silentBlockers = await this._detectSilentBlockers(projectId);
        if (silentBlockers.length > 0) {
            issues.push({
                type: 'SILENT_BLOCKERS',
                severity: 'WARNING',
                count: silentBlockers.length,
                items: silentBlockers
            });
        }

        return {
            projectId,
            monitoredAt: new Date().toISOString(),
            issueCount: issues.length,
            issues,
            notificationsGenerated: notifications.length,
            notifications
        };
    }

    /**
     * Detect stalled tasks (no progress in 7+ days)
     */
    async _detectStalledTasks(projectId) {
        await this.init();
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT t.*, u.first_name, u.last_name
                    FROM tasks t
                    LEFT JOIN users u ON t.assignee_id = u.id
                    WHERE t.project_id = ? 
                    AND t.status = 'IN_PROGRESS'
                    AND t.updated_at < datetime('now', '-7 days')`,
                [projectId], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
        });
    }

    /**
     * Detect overdue tasks
     */
    async _detectOverdueTasks(projectId) {
        await this.init();
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT t.*, u.first_name, u.last_name
                    FROM tasks t
                    LEFT JOIN users u ON t.assignee_id = u.id
                    WHERE t.project_id = ? 
                    AND t.status != 'DONE'
                    AND t.due_date < date('now')`,
                [projectId], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
        });
    }

    /**
     * Detect overdue decisions (pending for 7+ days)
     */
    async _detectOverdueDecisions(projectId) {
        await this.init();
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM decisions 
                    WHERE project_id = ? 
                    AND status = 'PENDING'
                    AND created_at < datetime('now', '-7 days')`,
                [projectId], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
        });
    }

    /**
     * Detect stalled initiatives
     */
    async _detectStalledInitiatives(projectId) {
        await this.init();
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM initiatives
                    WHERE project_id = ? 
                    AND status IN ('EXECUTING', 'APPROVED')
                    AND updated_at < datetime('now', '-7 days')`,
                [projectId], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
        });
    }

    /**
     * Detect silent blockers
     */
    async _detectSilentBlockers(projectId) {
        await this.init();
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT t.id, t.title, 'TASK' as type FROM tasks t
                    WHERE t.project_id = ? AND t.status = 'BLOCKED' AND (t.blocked_reason IS NULL OR t.blocked_reason = '')
                    UNION ALL
                    SELECT i.id, i.title, 'INITIATIVE' as type FROM initiatives i
                    WHERE i.project_id = ? AND i.status = 'BLOCKED' AND (i.blocked_reason IS NULL OR i.blocked_reason = '')`,
                [projectId, projectId], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
        });
    }

    /**
     * Generate AI execution summary
     */
    async generateExecutionSummary(projectId) {
        const monitorResult = await this.runDailyMonitor(projectId);

        const summary = [];

        if (monitorResult.issueCount === 0) {
            summary.push('✅ Execution is healthy. No issues detected.');
        } else {
            summary.push(`⚠️ ${monitorResult.issueCount} execution issue(s) detected:`);

            for (const issue of monitorResult.issues) {
                switch (issue.type) {
                    case 'STALLED_TASKS':
                        summary.push(`• ${issue.count} task(s) have not been updated in 7+ days`);
                        break;
                    case 'OVERDUE_TASKS':
                        summary.push(`• ${issue.count} task(s) are overdue`);
                        break;
                    case 'DECISION_INERTIA':
                        summary.push(`• ${issue.count} decision(s) have been pending for 7+ days - this may be blocking progress`);
                        break;
                    case 'STALLED_INITIATIVES':
                        summary.push(`• ${issue.count} initiative(s) are stalled`);
                        break;
                    case 'SILENT_BLOCKERS':
                        summary.push(`• ${issue.count} item(s) are blocked without explanation`);
                        break;
                }
            }
        }

        return {
            projectId,
            summaryText: summary.join('\n'),
            issues: monitorResult.issues,
            generatedAt: new Date().toISOString()
        };
    }
}

const executionMonitorServiceInstance = new ExecutionMonitorService();
export default executionMonitorServiceInstance;
