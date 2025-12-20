// PMO Analysis Service - AI-driven PMO health analysis
// Step 3: PMO Objects, Statuses & Stage Gates

const db = require('../database');
const ProgressService = require('./progressService');
const DependencyService = require('./dependencyService');

const PMOAnalysisService = {
    /**
     * Run full PMO analysis for a project
     */
    analyzeProject: async (projectId) => {
        const issues = [];
        const warnings = [];
        const recommendations = [];

        // 1. Detect orphan initiatives (no owner)
        const orphans = await PMOAnalysisService.detectOrphanInitiatives(projectId);
        if (orphans.length > 0) {
            issues.push({
                type: 'ORPHAN_INITIATIVES',
                severity: 'HIGH',
                message: `${orphans.length} initiative(s) have no owner assigned`,
                items: orphans
            });
        }

        // 2. Detect initiatives without tasks
        const noTasks = await PMOAnalysisService.detectInitiativesWithoutTasks(projectId);
        if (noTasks.length > 0) {
            warnings.push({
                type: 'NO_TASKS',
                severity: 'MEDIUM',
                message: `${noTasks.length} initiative(s) have no tasks defined`,
                items: noTasks
            });
        }

        // 3. Detect overloaded users
        const overloaded = await PMOAnalysisService.detectOverloadedUsers(projectId);
        if (overloaded.length > 0) {
            warnings.push({
                type: 'OVERLOADED_USERS',
                severity: 'MEDIUM',
                message: `${overloaded.length} user(s) have excessive task load`,
                items: overloaded
            });
        }

        // 4. Detect dependency conflicts
        const deadlocks = await DependencyService.detectDeadlocks(projectId);
        if (deadlocks.hasDeadlocks) {
            issues.push({
                type: 'DEPENDENCY_DEADLOCK',
                severity: 'CRITICAL',
                message: `Circular dependencies detected`,
                items: deadlocks.cycles
            });
        }

        // 5. Detect stalled initiatives
        const stalled = await PMOAnalysisService.detectStalledInitiatives(projectId);
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
    },

    /**
     * Detect initiatives without owners
     */
    detectOrphanInitiatives: async (projectId) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT id, name FROM initiatives 
                    WHERE project_id = ? AND (owner_business_id IS NULL OR owner_business_id = '')`,
                [projectId], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
        });
    },

    /**
     * Detect initiatives without tasks
     */
    detectInitiativesWithoutTasks: async (projectId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT i.id, i.name 
                FROM initiatives i
                LEFT JOIN tasks t ON t.initiative_id = i.id
                WHERE i.project_id = ?
                GROUP BY i.id
                HAVING COUNT(t.id) = 0
            `;

            db.all(sql, [projectId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Detect overloaded users (>10 active tasks)
     */
    detectOverloadedUsers: async (projectId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT t.assignee_id, u.first_name, u.last_name, COUNT(*) as task_count
                FROM tasks t
                JOIN users u ON t.assignee_id = u.id
                WHERE t.project_id = ? AND t.status NOT IN ('done', 'DONE')
                GROUP BY t.assignee_id
                HAVING COUNT(*) > 10
            `;

            db.all(sql, [projectId], (err, rows) => {
                if (err) return reject(err);
                resolve((rows || []).map(r => ({
                    userId: r.assignee_id,
                    name: `${r.first_name} ${r.last_name}`,
                    taskCount: r.task_count
                })));
            });
        });
    },

    /**
     * Detect stalled initiatives (no updates in 7+ days)
     */
    detectStalledInitiatives: async (projectId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, name, status, updated_at
                FROM initiatives
                WHERE project_id = ? 
                  AND status IN ('IN_EXECUTION', 'APPROVED')
                  AND updated_at < datetime('now', '-7 days')
            `;

            db.all(sql, [projectId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Explain why something is blocked
     */
    explainBlocker: async (objectType, objectId) => {
        const reasons = [];

        if (objectType === 'INITIATIVE') {
            // Check for blocking decisions
            const decisions = await new Promise((resolve, reject) => {
                db.all(`SELECT title, status FROM decisions 
                        WHERE related_object_id = ? AND status = 'PENDING' AND required = 1`,
                    [objectId], (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    });
            });

            if (decisions.length > 0) {
                reasons.push({
                    type: 'PENDING_DECISION',
                    message: `Waiting for decision: ${decisions.map(d => d.title).join(', ')}`
                });
            }

            // Check for blocking dependencies
            const deps = await DependencyService.canStart(objectId);
            if (!deps.canStart) {
                reasons.push({
                    type: 'BLOCKED_DEPENDENCY',
                    message: `Waiting for: ${deps.blockedBy.map(d => d.name).join(', ')}`
                });
            }

            // Check blockedReason field
            const init = await new Promise((resolve, reject) => {
                db.get(`SELECT blocked_reason FROM initiatives WHERE id = ?`, [objectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (init && init.blocked_reason) {
                reasons.push({
                    type: 'EXPLICIT_BLOCK',
                    message: init.blocked_reason
                });
            }
        }

        if (objectType === 'TASK') {
            const task = await new Promise((resolve, reject) => {
                db.get(`SELECT blocked_reason, blocker_type FROM tasks WHERE id = ?`, [objectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

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
    }
};

module.exports = PMOAnalysisService;
