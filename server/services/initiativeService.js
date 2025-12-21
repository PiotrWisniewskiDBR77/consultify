const db = require('../database');

// Dependency injection container (for deterministic unit tests)
const deps = { db };

const InitiativeService = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },
    /**
     * Recalculates the progress of an initiative based on its tasks
     * Formula: Σ(task_progress × priority_weight) / Σ(priority_weight)
     * Weights: Urgent/High=1.5, Medium=1.0, Low=0.5
     * 
     * HARDENED: Requires organizationId to ensure multi-tenant isolation.
     * 
     * @param {Object|string} params - Either {organizationId, initiativeId} or legacy initiativeId string
     * @returns {Promise<number>} calculated progress
     */
    recalculateProgress: (params) => {
        return new Promise((resolve, reject) => {
            // Support both new object format and legacy string format for backwards compatibility
            let organizationId, initiativeId;
            if (typeof params === 'object' && params !== null) {
                organizationId = params.organizationId;
                initiativeId = params.initiativeId;
            } else {
                // Legacy: just initiativeId string (DEPRECATED but supported)
                initiativeId = params;
                organizationId = null;
                console.warn('[InitiativeService] DEPRECATION WARNING: recalculateProgress called without organizationId');
            }

            if (!initiativeId) return resolve(0);

            // Build org-scoped query for multi-tenant safety
            let taskQuery, taskParams;
            if (organizationId) {
                taskQuery = `SELECT progress, priority FROM tasks WHERE organization_id = ? AND initiative_id = ?`;
                taskParams = [organizationId, initiativeId];
            } else {
                // Fallback for legacy callers (less safe, logs warning above)
                taskQuery = `SELECT progress, priority FROM tasks WHERE initiative_id = ?`;
                taskParams = [initiativeId];
            }

            // Fetch all tasks for this initiative (org-scoped)
            deps.db.all(taskQuery, taskParams, (err, tasks) => {
                if (err) {
                    console.error("Error fetching tasks for recalculation:", err);
                    return reject(err);
                }

                // If no tasks, progress is 0
                if (!tasks || tasks.length === 0) {
                    const updateQuery = organizationId
                        ? `UPDATE initiatives SET progress = 0, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND id = ?`
                        : `UPDATE initiatives SET progress = 0 WHERE id = ?`;
                    const updateParams = organizationId ? [organizationId, initiativeId] : [initiativeId];

                    deps.db.run(updateQuery, updateParams, (e) => {
                        if (e) console.error("Error resetting initiative progress:", e);
                        resolve(0);
                    });
                    return;
                }

                let totalWeightedProgress = 0;
                let totalWeight = 0;

                tasks.forEach(task => {
                    let weight = 1.0;
                    const priority = (task.priority || 'medium').toLowerCase();

                    if (priority === 'urgent' || priority === 'high') {
                        weight = 1.5;
                    } else if (priority === 'medium') {
                        weight = 1.0;
                    } else if (priority === 'low') {
                        weight = 0.5;
                    }

                    // Progress defaults to 0 if null
                    const p = task.progress || 0;
                    totalWeightedProgress += (p * weight);
                    totalWeight += weight;
                });

                const calculatedProgress = totalWeight > 0 ? Math.round(totalWeightedProgress / totalWeight) : 0;

                // Update Initiative (org-scoped for safety)
                const updateQuery = organizationId
                    ? `UPDATE initiatives SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND id = ?`
                    : `UPDATE initiatives SET progress = ? WHERE id = ?`;
                const updateParams = organizationId
                    ? [calculatedProgress, organizationId, initiativeId]
                    : [calculatedProgress, initiativeId];

                deps.db.run(updateQuery, updateParams, (err) => {
                    if (err) {
                        console.error("Error updating initiative progress:", err);
                        return reject(err);
                    }
                    resolve(calculatedProgress);
                });
            });
        });
    }
};

module.exports = InitiativeService;
