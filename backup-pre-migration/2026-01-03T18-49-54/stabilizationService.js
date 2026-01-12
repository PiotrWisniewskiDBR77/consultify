// Stabilization Service - Phase 6 management
// Step 6: Stabilization, Reporting & Economics

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const STABILIZATION_STATUSES = {
    STABILIZED: 'STABILIZED',
    PARTIALLY_STABILIZED: 'PARTIALLY_STABILIZED',
    UNSTABLE: 'UNSTABLE',
    NOT_APPLICABLE: 'NOT_APPLICABLE'
};

const StabilizationService = {
    STABILIZATION_STATUSES,

    /**
     * Check entry criteria for Stabilization phase
     */
    checkEntryCriteria: async (projectId) => {
        const criteria = [];
        let allMet = true;

        // 1. Critical initiatives completed
        const criticalIncomplete = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as count FROM initiatives 
                    WHERE project_id = ? AND is_critical_path = 1 AND status NOT IN ('COMPLETED', 'CANCELLED')`,
                [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.count || 0);
                });
        });

        criteria.push({
            criterion: 'Critical initiatives completed',
            isMet: criticalIncomplete === 0,
            evidence: criticalIncomplete === 0 ? 'All critical initiatives done' : `${criticalIncomplete} critical initiatives pending`
        });
        if (criticalIncomplete > 0) allMet = false;

        // 2. No unresolved blocking decisions
        const blockingDecisions = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as count FROM decisions 
                    WHERE project_id = ? AND status = 'PENDING' AND required = 1`,
                [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.count || 0);
                });
        });

        criteria.push({
            criterion: 'No unresolved blocking decisions',
            isMet: blockingDecisions === 0,
            evidence: blockingDecisions === 0 ? 'All required decisions resolved' : `${blockingDecisions} pending decisions`
        });
        if (blockingDecisions > 0) allMet = false;

        // 3. Roadmap execution formally closed (high completion)
        const initiativeStats = await new Promise((resolve, reject) => {
            db.get(`SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status IN ('COMPLETED', 'CANCELLED') THEN 1 ELSE 0 END) as closed
                    FROM initiatives WHERE project_id = ?`,
                [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { total: 0, closed: 0 });
                });
        });

        const completionRate = initiativeStats.total > 0
            ? Math.round((initiativeStats.closed / initiativeStats.total) * 100) : 0;

        criteria.push({
            criterion: 'Roadmap execution ≥80% complete',
            isMet: completionRate >= 80,
            evidence: `${completionRate}% initiatives closed`
        });
        if (completionRate < 80) allMet = false;

        return {
            projectId,
            canEnterStabilization: allMet,
            completionCriteria: criteria
        };
    },

    /**
     * Update initiative stabilization status
     */
    setStabilizationStatus: async (initiativeId, status, userId) => {
        if (!Object.values(STABILIZATION_STATUSES).includes(status)) {
            throw new Error(`Invalid stabilization status: ${status}`);
        }

        return new Promise((resolve, reject) => {
            db.run(`UPDATE initiatives SET stabilization_status = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?`, [status, initiativeId], function (err) {
                if (err) return reject(err);
                resolve({ updated: this.changes > 0, initiativeId, status });
            });
        });
    },

    /**
     * Get stabilization summary for project
     */
    getStabilizationSummary: async (projectId) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT stabilization_status, COUNT(*) as count 
                    FROM initiatives WHERE project_id = ? AND status = 'COMPLETED'
                    GROUP BY stabilization_status`,
                [projectId], (err, rows) => {
                    if (err) return reject(err);

                    const summary = {
                        stabilized: 0,
                        partiallyStabilized: 0,
                        unstable: 0,
                        notApplicable: 0
                    };

                    (rows || []).forEach(row => {
                        switch (row.stabilization_status) {
                            case 'STABILIZED': summary.stabilized = row.count; break;
                            case 'PARTIALLY_STABILIZED': summary.partiallyStabilized = row.count; break;
                            case 'UNSTABLE': summary.unstable = row.count; break;
                            default: summary.notApplicable = row.count;
                        }
                    });

                    resolve(summary);
                });
        });
    },

    /**
     * Check exit criteria for project closure
     */
    checkExitCriteria: async (projectId) => {
        const criteria = [];
        let allMet = true;

        // 1. No unstable initiatives
        const unstableCount = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as count FROM initiatives 
                    WHERE project_id = ? AND stabilization_status = 'UNSTABLE'`,
                [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.count || 0);
                });
        });

        criteria.push({
            criterion: 'No unstable initiatives',
            isMet: unstableCount === 0,
            evidence: unstableCount === 0 ? 'All initiatives stable' : `${unstableCount} unstable initiatives`
        });
        if (unstableCount > 0) allMet = false;

        // 2. All value hypotheses reviewed
        const valueStats = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as total, SUM(CASE WHEN is_validated = 1 THEN 1 ELSE 0 END) as validated
                    FROM value_hypotheses WHERE project_id = ?`,
                [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { total: 0, validated: 0 });
                });
        });

        criteria.push({
            criterion: 'Value hypotheses reviewed',
            isMet: valueStats.total === 0 || valueStats.validated === valueStats.total,
            evidence: `${valueStats.validated}/${valueStats.total} hypotheses validated`
        });
        if (valueStats.total > 0 && valueStats.validated < valueStats.total) allMet = false;

        return {
            projectId,
            canCloseProject: allMet,
            completionCriteria: criteria
        };
    },

    /**
     * Close a project
     */
    closeProject: async (projectId, closureType, userId, lessonsLearned = null) => {
        // Get initiative stats
        const stats = await new Promise((resolve, reject) => {
            db.get(`SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled
                    FROM initiatives WHERE project_id = ?`,
                [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { total: 0, completed: 0, cancelled: 0 });
                });
        });

        // Get value hypothesis stats
        const valueStats = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as total, SUM(CASE WHEN is_validated = 1 THEN 1 ELSE 0 END) as validated
                    FROM value_hypotheses WHERE project_id = ?`,
                [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { total: 0, validated: 0 });
                });
        });

        const closureId = uuidv4();

        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO project_closures 
                (id, project_id, closure_type, closed_by, lessons_learned, final_status,
                 total_initiatives, completed_initiatives, cancelled_initiatives,
                 value_hypotheses_validated, value_hypotheses_total)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            db.run(sql, [
                closureId, projectId, closureType, userId, lessonsLearned,
                closureType === 'COMPLETED' ? 'SUCCESS' : 'TERMINATED',
                stats.total, stats.completed, stats.cancelled,
                valueStats.validated, valueStats.total
            ], function (err) {
                if (err) return reject(err);

                // Mark project as closed
                db.run(`UPDATE projects SET is_closed = 1, closed_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?`,
                    [closureType, projectId], () => {
                        resolve({
                            closureId,
                            projectId,
                            closureType,
                            initiativeStats: stats,
                            valueStats
                        });
                    });
            });
        });
    }
};

module.exports = StabilizationService;
