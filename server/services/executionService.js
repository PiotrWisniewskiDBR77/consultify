const db = require('../database');

const ExecutionService = {
    /**
     * Get execution summary for a project (task and blocker status)
     */
    getExecutionSummary: (projectId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total_tasks,
                    SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                    AVG(progress) as avg_progress
                FROM tasks 
                WHERE project_id = ?
            `;

            db.get(sql, [projectId], (err, row) => {
                if (err) return reject(err);
                resolve({
                    totalTasks: row?.total_tasks || 0,
                    completed: row?.completed || 0,
                    blocked: row?.blocked || 0,
                    inProgress: row?.in_progress || 0,
                    avgProgress: Math.round(row?.avg_progress || 0),
                    completionRate: row?.total_tasks > 0
                        ? Math.round((row?.completed / row?.total_tasks) * 100)
                        : 0
                });
            });
        });
    },

    /**
     * Get blocked tasks with reasons
     */
    getBlockedTasks: (projectId) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT id, title, blocked_reason, assignee_id FROM tasks WHERE project_id = ? AND status = 'blocked'`,
                [projectId], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
        });
    },

    /**
     * Check if project can advance phase (Decision Gate)
     */
    checkDecisionGate: (projectId, targetPhase) => {
        return new Promise((resolve, reject) => {
            // Simple heuristic: all tasks in current phase must be done
            const sql = `
                SELECT COUNT(*) as pending FROM tasks 
                WHERE project_id = ? AND step_phase = ? AND status != 'done'
            `;

            const currentPhase = targetPhase === 'pilot' ? 'design' : 'pilot';

            db.get(sql, [projectId, currentPhase], (err, row) => {
                if (err) return reject(err);

                const canAdvance = (row?.pending || 0) === 0;
                resolve({
                    canAdvance,
                    pendingTasks: row?.pending || 0,
                    message: canAdvance
                        ? `Ready to advance to ${targetPhase}`
                        : `${row?.pending} tasks must be completed before advancing`
                });
            });
        });
    }
};

module.exports = ExecutionService;
