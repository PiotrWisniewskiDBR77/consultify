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
     * @param {string} initiativeId 
     * @returns {Promise<number>} calculated progress
     */
    recalculateProgress: (initiativeId) => {
        return new Promise((resolve, reject) => {
            if (!initiativeId) return resolve(0);

            // Fetch all tasks for this initiative
            deps.db.all(`SELECT progress, priority FROM tasks WHERE initiative_id = ?`, [initiativeId], (err, tasks) => {
                if (err) {
                    console.error("Error fetching tasks for recalculation:", err);
                    return reject(err);
                }

                // If no tasks, progress is 0 (or keep existing? Spec implies function of tasks, so 0)
                if (!tasks || tasks.length === 0) {
                    // Optionally we could set it to 0, but if there are no tasks, maybe we shouldn't overwrite manual progress?
                    // Spec says: "Progres inicjatywy = funkcja progresu tasków"
                    // So we update it to 0.
                    deps.db.run(`UPDATE initiatives SET progress = 0 WHERE id = ?`, [initiativeId], (e) => {
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

                // Update Initiative
                deps.db.run(`UPDATE initiatives SET progress = ? WHERE id = ?`, [calculatedProgress, initiativeId], (err) => {
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
