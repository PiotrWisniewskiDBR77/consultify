// Progress Calculation Service
// Step 3: PMO Objects, Statuses & Stage Gates

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database')
};

const ProgressService = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },
    /**
     * Calculate initiative progress from its tasks
     * @returns {{ progress: number, totalTasks: number, completedTasks: number, isBlocked: boolean }}
     */
    calculateInitiativeProgress: async (initiativeId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'done' OR status = 'DONE' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'blocked' OR status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked
                FROM tasks 
                WHERE initiative_id = ?
            `;

            deps.db.get(sql, [initiativeId], (err, row) => {
                if (err) return reject(err);

                const total = row?.total || 0;
                const completed = row?.completed || 0;
                const blocked = row?.blocked || 0;

                const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

                resolve({
                    progress,
                    totalTasks: total,
                    completedTasks: completed,
                    blockedTasks: blocked,
                    isBlocked: blocked > 0
                });
            });
        });
    },

    /**
     * Check if initiative has blocking decisions
     */
    hasBlockingDecisions: async (initiativeId) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as cnt FROM decisions 
                    WHERE related_object_id = ? AND related_object_type = 'INITIATIVE' AND status = 'PENDING' AND required = 1`,
                [initiativeId], (err, row) => {
                    if (err) return reject(err);
                    resolve(row && row.cnt > 0);
                });
        });
    },

    /**
     * Check if initiative has unsatisfied hard dependencies
     */
    hasBlockingDependencies: async (initiativeId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT d.id, i.status as dep_status
                FROM initiative_dependencies d
                JOIN initiatives i ON d.from_initiative_id = i.id
                WHERE d.to_initiative_id = ? 
                  AND d.type = 'FINISH_TO_START'
                  AND i.status NOT IN ('COMPLETED', 'CANCELLED')
            `;

            deps.db.all(sql, [initiativeId], (err, rows) => {
                if (err) return reject(err);
                resolve(rows && rows.length > 0);
            });
        });
    },

    /**
     * Calculate project progress from initiatives
     */
    calculateProjectProgress: async (projectId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked,
                    SUM(CASE WHEN status = 'IN_EXECUTION' THEN 1 ELSE 0 END) as in_progress,
                    AVG(progress) as avg_progress
                FROM initiatives 
                WHERE project_id = ?
            `;

            deps.db.get(sql, [projectId], (err, row) => {
                if (err) return reject(err);

                const total = row?.total || 0;
                const completed = row?.completed || 0;
                const blocked = row?.blocked || 0;
                const inProgress = row?.in_progress || 0;
                const avgProgress = row?.avg_progress || 0;

                // Weighted progress: completed initiatives count as 100%, in-progress by their progress
                const weightedProgress = total > 0
                    ? Math.round(((completed * 100) + (inProgress * avgProgress)) / total)
                    : 0;

                resolve({
                    totalInitiatives: total,
                    completedInitiatives: completed,
                    blockedInitiatives: blocked,
                    inProgressInitiatives: inProgress,
                    progress: weightedProgress,
                    healthStatus: blocked > 0 ? 'AT_RISK' : (completed === total && total > 0 ? 'COMPLETED' : 'ON_TRACK')
                });
            });
        });
    },

    /**
     * Calculate portfolio-level metrics
     */
    calculatePortfolioMetrics: async (organizationId) => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total_projects,
                    SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                    AVG(progress) as avg_progress
                FROM projects 
                WHERE organization_id = ?
            `;

            deps.db.get(sql, [organizationId], async (err, row) => {
                if (err) return reject(err);

                // Get initiative counts
                const initSql = `
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN i.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                        SUM(CASE WHEN i.status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked
                    FROM initiatives i
                    JOIN projects p ON i.project_id = p.id
                    WHERE p.organization_id = ?
                `;

                deps.db.get(initSql, [organizationId], (err2, initRow) => {
                    if (err2) return reject(err2);

                    const totalProjects = row?.total_projects || 0;
                    const activeProjects = row?.active || 0;
                    const avgProgress = row?.avg_progress || 0;
                    const blockedInits = initRow?.blocked || 0;

                    // Health score: 100 - (blocked% * 50) 
                    const blockedPercent = initRow?.total > 0 ? (blockedInits / initRow.total) * 100 : 0;
                    const healthScore = Math.max(0, Math.round(100 - (blockedPercent * 0.5)));

                    resolve({
                        organizationId,
                        totalProjects,
                        activeProjects,
                        projectsOnTrack: activeProjects - blockedInits,
                        projectsAtRisk: blockedInits > 0 ? 1 : 0,
                        projectsBlocked: 0, // Would need project-level block status
                        totalInitiatives: initRow?.total || 0,
                        completedInitiatives: initRow?.completed || 0,
                        overallProgress: Math.round(avgProgress),
                        healthScore
                    });
                });
            });
        });
    },

    /**
     * Update initiative progress (call after task changes)
     */
    updateInitiativeProgress: async (initiativeId) => {
        const progress = await ProgressService.calculateInitiativeProgress(initiativeId);

        return new Promise((resolve, reject) => {
            deps.db.run(`UPDATE initiatives SET progress = ? WHERE id = ?`,
                [progress.progress, initiativeId], (err) => {
                    if (err) return reject(err);
                    resolve(progress);
                });
        });
    },

    /**
     * Update project progress (call after initiative changes)
     */
    updateProjectProgress: async (projectId) => {
        const progress = await ProgressService.calculateProjectProgress(projectId);

        return new Promise((resolve, reject) => {
            deps.db.run(`UPDATE projects SET progress = ? WHERE id = ?`,
                [progress.progress, projectId], (err) => {
                    if (err) return reject(err);
                    resolve(progress);
                });
        });
    }
};

module.exports = ProgressService;
