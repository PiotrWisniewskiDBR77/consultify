/**
 * Initiative Service
 * 
 * Recalculates the progress of an initiative based on its tasks
 * Formula: Σ(task_progress × priority_weight) / Σ(priority_weight)
 * Weights: Urgent/High=1.5, Medium=1.0, Low=0.5
 * 
 * Fully migrated from server/services/initiativeService.js to TypeScript
 */

import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface RecalculateProgressParams {
    organizationId?: string | null;
    initiativeId: string;
}

export interface TaskRecord {
    progress?: number | null;
    priority?: string | null;
}

// Dependency injection interface for testing
export interface InitiativeServiceDependencies {
    db: IDatabase;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class InitiativeServiceClass {
    private deps: InitiativeServiceDependencies;

    constructor(deps?: Partial<InitiativeServiceDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase()
        };
    }

    /**
     * Set dependencies (for testing)
     */
    setDependencies(newDeps: Partial<InitiativeServiceDependencies>): void {
        this.deps = { ...this.deps, ...newDeps };
    }

    /**
     * Recalculates the progress of an initiative based on its tasks
     * Formula: Σ(task_progress × priority_weight) / Σ(priority_weight)
     * Weights: Urgent/High=1.5, Medium=1.0, Low=0.5
     * 
     * HARDENED: Requires organizationId to ensure multi-tenant isolation.
     * 
     * @param params - Either {organizationId, initiativeId} or legacy initiativeId string
     * @returns calculated progress
     */
    async recalculateProgress(params: RecalculateProgressParams | string): Promise<number> {
        // Support both new object format and legacy string format for backwards compatibility
        let organizationId: string | null | undefined;
        let initiativeId: string;

        if (typeof params === 'object' && params !== null) {
            organizationId = params.organizationId;
            initiativeId = params.initiativeId;
        } else {
            // Legacy: just initiativeId string (DEPRECATED but supported)
            initiativeId = params as string;
            organizationId = null;
            logger.warn('[InitiativeService] DEPRECATION WARNING: recalculateProgress called without organizationId');
        }

        if (!initiativeId) return 0;

        try {
            // Build org-scoped query for multi-tenant safety
            let taskQuery: string;
            let taskParams: unknown[];

            if (organizationId) {
                taskQuery = `SELECT progress, priority FROM tasks WHERE organization_id = ? AND initiative_id = ?`;
                taskParams = [organizationId, initiativeId];
            } else {
                // Fallback for legacy callers (less safe, logs warning above)
                taskQuery = `SELECT progress, priority FROM tasks WHERE initiative_id = ?`;
                taskParams = [initiativeId];
            }

            // Fetch all tasks for this initiative (org-scoped)
            const tasks = await this.deps.db.all<TaskRecord>(taskQuery, taskParams) as TaskRecord[];

            // If no tasks, progress is 0
            if (!tasks || tasks.length === 0) {
                const updateQuery = organizationId
                    ? `UPDATE initiatives SET progress = 0, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND id = ?`
                    : `UPDATE initiatives SET progress = 0 WHERE id = ?`;
                const updateParams = organizationId ? [organizationId, initiativeId] : [initiativeId];

                await this.deps.db.run(updateQuery, updateParams);
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
            const updateParams: unknown[] = organizationId
                ? [calculatedProgress, organizationId, initiativeId]
                : [calculatedProgress, initiativeId];

            await this.deps.db.run(updateQuery, updateParams);
            return calculatedProgress;
        } catch (error) {
            logger.error('[InitiativeService] Error recalculating initiative progress:', error as Error);
            throw error;
        }
    }
}

// Create singleton instance
const initiativeServiceInstance = new InitiativeServiceClass();

// Export individual functions for backward compatibility
export const recalculateProgress = (params: RecalculateProgressParams | string) =>
    initiativeServiceInstance.recalculateProgress(params);

// Default export for backward compatibility
const initiativeService = {
    recalculateProgress,
    setDependencies: (newDeps: Partial<InitiativeServiceDependencies>) => initiativeServiceInstance.setDependencies(newDeps)
};

export default initiativeService;
