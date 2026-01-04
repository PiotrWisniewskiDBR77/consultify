declare namespace _default {
    export { ProjectMemoryStore };
    export { projectMemoryStore };
    export { MEMORY_TYPES };
}
export default _default;
export class ProjectMemoryStore {
    /**
     * Ensure the project_memory table exists
     */
    ensureTable(): Promise<any>;
    /**
     * Add a memory entry to a project
     * @param {string} projectId - Project ID
     * @param {Object} memory - Memory data
     */
    addMemory(projectId: string, memory: Object): Promise<any>;
    /**
     * Record a decision made in the project
     * @param {string} projectId - Project ID
     * @param {Object} decision - Decision data
     */
    recordDecision(projectId: string, decision: Object): Promise<any>;
    /**
     * Record a phase transition
     * @param {string} projectId - Project ID
     * @param {Object} transition - Transition data
     */
    recordPhaseTransition(projectId: string, transition: Object): Promise<any>;
    /**
     * Record a learning or insight
     * @param {string} projectId - Project ID
     * @param {Object} learning - Learning data
     */
    recordLearning(projectId: string, learning: Object): Promise<any>;
    /**
     * Record an AI recommendation
     * @param {string} projectId - Project ID
     * @param {Object} recommendation - Recommendation data
     */
    recordAIRecommendation(projectId: string, recommendation: Object): Promise<any>;
    /**
     * Get all memory for a project
     * @param {string} projectId - Project ID
     * @param {Object} options - Query options
     */
    getProjectMemory(projectId: string, options?: Object): Promise<any>;
    /**
     * Get project context for AI (optimized for token usage)
     * @param {string} projectId - Project ID
     * @param {Object} options - Context options
     */
    getProjectContext(projectId: string, options?: Object): Promise<{
        projectId: string;
        memoryCount: number;
        context: string;
        types: any[];
    }>;
    /**
     * Get decisions for a project
     * @param {string} projectId - Project ID
     */
    getDecisions(projectId: string): Promise<any>;
    /**
     * Get learnings that can apply to future projects
     * @param {string} projectId - Project ID
     */
    getApplicableLearnings(projectId: string): Promise<any>;
    /**
     * Search project memory by keyword
     * @param {string} projectId - Project ID
     * @param {string} query - Search query
     */
    searchMemory(projectId: string, query: string): Promise<any>;
    /**
     * Update memory importance based on usage
     * @param {string} memoryId - Memory ID
     * @param {number} delta - Importance change (+1 or -1)
     */
    updateImportance(memoryId: string, delta: number): Promise<any>;
    /**
     * Delete old, low-importance memories
     * @param {string} projectId - Project ID
     * @param {number} daysOld - Days threshold
     */
    cleanupOldMemories(projectId: string, daysOld?: number): Promise<any>;
    /**
     * Serialize memories for AI context window
     * @private
     */
    private _serializeForContext;
    /**
     * Safely parse JSON
     * @private
     */
    private _parseJSON;
}
export const projectMemoryStore: ProjectMemoryStore;
export namespace MEMORY_TYPES {
    namespace DECISION {
        let importance: number;
        let ttlDays: null;
    }
    namespace PHASE_TRANSITION {
        let importance_1: number;
        export { importance_1 as importance };
        let ttlDays_1: null;
        export { ttlDays_1 as ttlDays };
    }
    namespace LEARNING {
        let importance_2: number;
        export { importance_2 as importance };
        let ttlDays_2: null;
        export { ttlDays_2 as ttlDays };
    }
    namespace RISK {
        let importance_3: number;
        export { importance_3 as importance };
        let ttlDays_3: number;
        export { ttlDays_3 as ttlDays };
    }
    namespace MILESTONE {
        let importance_4: number;
        export { importance_4 as importance };
        let ttlDays_4: null;
        export { ttlDays_4 as ttlDays };
    }
    namespace BLOCKER {
        let importance_5: number;
        export { importance_5 as importance };
        let ttlDays_5: number;
        export { ttlDays_5 as ttlDays };
    }
    namespace AI_RECOMMENDATION {
        let importance_6: number;
        export { importance_6 as importance };
        let ttlDays_6: number;
        export { ttlDays_6 as ttlDays };
    }
    namespace USER_FEEDBACK {
        let importance_7: number;
        export { importance_7 as importance };
        let ttlDays_7: number;
        export { ttlDays_7 as ttlDays };
    }
    namespace CONTEXT_UPDATE {
        let importance_8: number;
        export { importance_8 as importance };
        let ttlDays_8: number;
        export { ttlDays_8 as ttlDays };
    }
}
//# sourceMappingURL=projectMemoryStore.d.ts.map