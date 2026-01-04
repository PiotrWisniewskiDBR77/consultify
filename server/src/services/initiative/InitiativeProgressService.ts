import { getDatabase } from '../../database/Database.js';
import { IDatabase } from '../../database/IDatabase.js';
import logger from '../../utils/Logger.js';

export class InitiativeProgressService {
    private deps: {
        db: IDatabase;
    };

    constructor(deps?: { db: IDatabase }) {
        this.deps = deps || {
            db: getDatabase(),
        };
    }

    setDependencies(deps: { db: IDatabase }) {
        this.deps = deps;
    }

    /**
     * Recalculates the progress of an initiative based on its tasks
     * Formula: Σ(task_progress × priority_weight) / Σ(priority_weight)
     * Weights: Urgent/High=1.5, Medium=1.0, Low=0.5
     */
    async recalculateProgress(initiativeId: string, organizationId?: string): Promise<number> {
        try {
            // Fetch all tasks for this initiative
            let taskQuery = `SELECT progress, priority FROM tasks WHERE initiative_id = ?`;
            const taskParams = [initiativeId];

            if (organizationId) {
                taskQuery += ` AND organization_id = ?`;
                taskParams.push(organizationId);
            }

            const rows = (await this.deps.db.all<any[]>(taskQuery, taskParams)) as any[];
            const tasks = rows || [];

            // If no tasks, progress is 0
            if (tasks.length === 0) {
                await this._updateInitiativeProgress(initiativeId, 0, organizationId);
                return 0;
            }

            let totalWeightedProgress = 0;
            let totalWeight = 0;

            tasks.forEach((task: any) => {
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
                totalWeightedProgress += p * weight;
                totalWeight += weight;
            });

            const calculatedProgress = totalWeight > 0 ? Math.round(totalWeightedProgress / totalWeight) : 0;

            // Update Initiative
            await this._updateInitiativeProgress(initiativeId, calculatedProgress, organizationId);

            return calculatedProgress;
        } catch (error) {
            logger.error('[InitiativeProgressService] Error recalculating progress', error);
            throw error;
        }
    }

    private async _updateInitiativeProgress(id: string, progress: number, organizationId?: string) {
        let query = `UPDATE initiatives SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        const params = [progress, id];

        if (organizationId) {
            query += ` AND organization_id = ?`;
            params.push(organizationId);
        }

        await this.deps.db.run(query, params);
    }
}
