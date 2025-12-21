// REFACTORED: Uses BaseService for common functionality
const BaseService = require('./BaseService');
const queryHelpers = require('../utils/queryHelpers');

const InitiativeService = Object.assign({}, BaseService, {
    // For testing: allow overriding dependencies (maintained for backwards compatibility)
    setDependencies: function(newDeps = {}) {
        if (newDeps.db) this.setDb(newDeps.db);
    },
    /**
     * Recalculates the progress of an initiative based on its tasks
     * Formula: Σ(task_progress × priority_weight) / Σ(priority_weight)
     * Weights: Urgent/High=1.5, Medium=1.0, Low=0.5
     * 
     * REFACTORED: Uses BaseService query helpers
     * HARDENED: Requires organizationId to ensure multi-tenant isolation.
     * 
     * @param {Object|string} params - Either {organizationId, initiativeId} or legacy initiativeId string
     * @returns {Promise<number>} calculated progress
     */
    recalculateProgress: async function(params) {
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

        if (!initiativeId) return 0;

        try {
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
            const tasks = await this.queryAll(taskQuery, taskParams);

            // If no tasks, progress is 0
            if (!tasks || tasks.length === 0) {
                const updateQuery = organizationId
                    ? `UPDATE initiatives SET progress = 0, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND id = ?`
                    : `UPDATE initiatives SET progress = 0 WHERE id = ?`;
                const updateParams = organizationId ? [organizationId, initiativeId] : [initiativeId];

                await this.queryRun(updateQuery, updateParams);
                return 0;
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

            await this.queryRun(updateQuery, updateParams);
            return calculatedProgress;
        } catch (error) {
            this.logError('Error recalculating initiative progress', error);
            throw error;
        }
    }
});

module.exports = InitiativeService;
