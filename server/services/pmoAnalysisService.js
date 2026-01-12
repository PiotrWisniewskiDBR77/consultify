/**
 * PMO Analysis Service - AI-driven PMO health analysis
 * Step 3: PMO Objects, Statuses & Stage Gates
 */

/**
 * Dependency injection container
 */
const deps = {
    _db: null,
    _baseService: null,
    _progressService: null,
    _dependencyService: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get baseService() { return this._baseService; },
    set baseService(val) { this._baseService = val; },

    get progressService() { return this._progressService; },
    set progressService(val) { this._progressService = val; },

    get dependencyService() { return this._dependencyService; },
    set dependencyService(val) { this._dependencyService = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: dbInstance } = await import('../src/database/index.js');
        deps._db = dbInstance;
    }
    if (!deps._baseService) {
        const { default: baseService } = await import('./BaseService.js');
        deps._baseService = baseService;
    }
    if (!deps._progressService) {
        const { default: progressService } = await import('./progressService.js');
        deps._progressService = progressService;
    }
    if (!deps._dependencyService) {
        const { default: dependencyService } = await import('./dependencyService.js');
        deps._dependencyService = dependencyService;
    }
}

class PMOAnalysisService {
    constructor() {
        this._db = null;
    }

    get db() {
        if (!this._db) {
            throw new Error('PMOAnalysisService: Database not initialized. Call init() first.');
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
     * Run full PMO analysis for a project
     */
    async analyzeProject(projectId) {
        await this.init();
        try {
            const issues = [];
            const warnings = [];
            const recommendations = [];

            // OPTIMIZED: Execute detection queries in parallel
            const [
                orphans,
                noTasks,
                overloaded,
                deadlocks,
                stalled
            ] = await Promise.all([
                this.detectOrphanInitiatives(projectId),
                this.detectInitiativesWithoutTasks(projectId),
                this.detectOverloadedUsers(projectId),
                deps.dependencyService.detectDeadlocks(projectId),
                this.detectStalledInitiatives(projectId)
            ]);

            // 1. Detect orphan initiatives (no owner)
            if (orphans.length > 0) {
                issues.push({
                    type: 'ORPHAN_INITIATIVES',
                    severity: 'HIGH',
                    message: `${orphans.length} initiative(s) have no owner assigned`,
                    items: orphans
                });
            }

            // 2. Detect initiatives without tasks
            if (noTasks.length > 0) {
                warnings.push({
                    type: 'NO_TASKS',
                    severity: 'MEDIUM',
                    message: `${noTasks.length} initiative(s) have no tasks defined`,
                    items: noTasks
                });
            }

            // 3. Detect overloaded users
            if (overloaded.length > 0) {
                warnings.push({
                    type: 'OVERLOADED_USERS',
                    severity: 'MEDIUM',
                    message: `${overloaded.length} user(s) have excessive task load`,
                    items: overloaded
                });
            }

            // 4. Detect dependency conflicts
            if (deadlocks.hasDeadlocks) {
                issues.push({
                    type: 'DEPENDENCY_DEADLOCK',
                    severity: 'CRITICAL',
                    message: `Circular dependencies detected`,
                    items: deadlocks.cycles
                });
            }

            // 5. Detect stalled initiatives
            if (stalled.length > 0) {
                warnings.push({
                    type: 'STALLED_INITIATIVES',
                    severity: 'MEDIUM',
                    message: `${stalled.length} initiative(s) have had no progress in 7+ days`,
                    items: stalled
                });
            }

            // 6. Generate recommendations
            if (orphans.length > 0) {
                recommendations.push('Assign owners to all initiatives before proceeding');
            }
            if (noTasks.length > 0) {
                recommendations.push('Break down initiatives into executable tasks');
            }
            if (deadlocks.hasDeadlocks) {
                recommendations.push('Review and resolve circular dependencies');
            }

            // Calculate overall health
            const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
            const highCount = issues.filter(i => i.severity === 'HIGH').length;
            const healthScore = Math.max(0, 100 - (criticalCount * 30) - (highCount * 15) - (warnings.length * 5));

            return {
                projectId,
                healthScore,
                status: criticalCount > 0 ? 'CRITICAL' : (highCount > 0 ? 'AT_RISK' : 'HEALTHY'),
                issues,
                warnings,
                recommendations,
                analyzedAt: new Date().toISOString()
            };
        } catch (error) {
            deps.baseService.logError('Error analyzing project', error);
            throw error;
        }
    }

    /**
     * Detect initiatives without owners
     */
    async detectOrphanInitiatives(projectId) {
        await this.init();
        const sql = `SELECT id, title as name FROM initiatives 
                    WHERE project_id = ? AND (owner_business_id IS NULL OR owner_business_id = '')`;
        return await deps.baseService.queryAll(sql, [projectId]);
    }

    /**
     * Detect initiatives without tasks
     */
    async detectInitiativesWithoutTasks(projectId) {
        await this.init();
        const sql = `
            SELECT i.id, i.title as name 
            FROM initiatives i
            LEFT JOIN tasks t ON t.initiative_id = i.id
            WHERE i.project_id = ?
            GROUP BY i.id
            HAVING COUNT(t.id) = 0
        `;
        return await deps.baseService.queryAll(sql, [projectId]);
    }

    /**
     * Detect overloaded users (>10 active tasks)
     */
    async detectOverloadedUsers(projectId) {
        await this.init();
        const sql = `
            SELECT t.assignee_id, u.first_name, u.last_name, COUNT(*) as task_count
            FROM tasks t
            JOIN users u ON t.assignee_id = u.id
            WHERE t.project_id = ? AND t.status != 'DONE'
            GROUP BY t.assignee_id
            HAVING COUNT(*) > 10
        `;
        const rows = await deps.baseService.queryAll(sql, [projectId]);
        return rows.map(r => ({
            userId: r.assignee_id,
            name: `${r.first_name} ${r.last_name}`,
            taskCount: r.task_count
        }));
    }

    /**
     * Detect stalled initiatives (no updates in 7+ days)
     */
    async detectStalledInitiatives(projectId) {
        await this.init();
        const sql = `
            SELECT id, title as name, status, updated_at
            FROM initiatives
            WHERE project_id = ? 
              AND status IN ('EXECUTING', 'APPROVED')
              AND updated_at < datetime('now', '-7 days')
        `;
        return await deps.baseService.queryAll(sql, [projectId]);
    }

    /**
     * Explain why something is blocked
     */
    async explainBlocker(objectType, objectId) {
        await this.init();
        try {
            const reasons = [];

            if (objectType === 'INITIATIVE') {
                // OPTIMIZED: Execute queries in parallel
                const [decisions, depsResult, init] = await Promise.all([
                    // Check for blocking decisions
                    deps.baseService.queryAll(`SELECT title, status FROM decisions 
                            WHERE related_object_id = ? AND status = 'PENDING' AND required = 1`, [objectId]),
                    // Check for blocking dependencies
                    deps.dependencyService.canStart(objectId),
                    // Check blockedReason field
                    deps.baseService.queryOne(`SELECT blocked_reason FROM initiatives WHERE id = ?`, [objectId])
                ]);

                if (decisions.length > 0) {
                    reasons.push({
                        type: 'PENDING_DECISION',
                        message: `Waiting for decision: ${decisions.map(d => d.title).join(', ')}`
                    });
                }

                if (!depsResult.canStart) {
                    reasons.push({
                        type: 'BLOCKED_DEPENDENCY',
                        message: `Waiting for: ${depsResult.blockedBy.map(d => d.name).join(', ')}`
                    });
                }

                if (init && init.blocked_reason) {
                    reasons.push({
                        type: 'EXPLICIT_BLOCK',
                        message: init.blocked_reason
                    });
                }
            }

            if (objectType === 'TASK') {
                const task = await deps.baseService.queryOne(`SELECT blocked_reason, blocker_type FROM tasks WHERE id = ?`, [objectId]);

                if (task) {
                    reasons.push({
                        type: task.blocker_type || 'UNKNOWN',
                        message: task.blocked_reason || 'No reason specified'
                    });
                }
            }

            return {
                objectType,
                objectId,
                isBlocked: reasons.length > 0,
                reasons
            };
        } catch (error) {
            deps.baseService.logError('Error explaining blocker', error);
            throw error;
        }
    }
}

const pmoAnalysisServiceInstance = new PMOAnalysisService();
export default pmoAnalysisServiceInstance;
